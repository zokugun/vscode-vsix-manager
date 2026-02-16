import * as os from 'os';
import * as path from 'path';
import process from 'process';
import fse from '@zokugun/fs-extra-plus/async';
import { isNumber, isRecord } from '@zokugun/is-it-type';
import { err, ok, type Result, stringifyError } from '@zokugun/xtry';
import { GLOBAL_STORAGE } from '../settings.js';

type LockOptions = {
	timeoutMs?: number;
	retryIntervalMs?: number;
	staleMs?: number;
};

export class FileLock {
	private _acquired = false;
	private readonly _baseDir: string;
	private _cleanupHandlersInstalled = false;
	private readonly _lockDir: string;
	private readonly _ownerFile: string;
	private readonly _retryIntervalMs: number;
	private readonly _staleMs: number;
	private readonly _timeoutMs: number;

	constructor(lockName: string, options?: LockOptions) { // {{{
		this._baseDir = path.join(GLOBAL_STORAGE, 'locks');
		this._lockDir = path.join(this._baseDir, `${lockName}.lock`);
		this._ownerFile = path.join(this._lockDir, 'owner.json');
		this._timeoutMs = options?.timeoutMs ?? 30_000; // default 30s timeout
		this._retryIntervalMs = options?.retryIntervalMs ?? 300; // retry interval
		this._staleMs = options?.staleMs ?? 60_000; // consider locks stale after 60s
	} // }}}

	private readonly onExit = async () => { // {{{
		if(this._acquired) {
			return this.release();
		}
	}; // }}}

	public static async acquire(): Promise<Result<FileLock, string>> { // {{{
		const lock = new FileLock('main', { staleMs: 600_000 });

		return lock.acquire();
	} // }}}

	public async acquire(): Promise<Result<FileLock, string>> { // {{{
		const ensureResult = await fse.ensureDir(this._baseDir);
		if(ensureResult.fails) {
			return err(stringifyError(ensureResult.error));
		}

		const start = Date.now();

		// eslint-disable-next-line no-constant-condition
		while(true) {
			const makeResult = await fse.mkdir(this._lockDir);

			if(makeResult.fails) {
				if(makeResult.error.code !== 'EEXIST') {
					return err(stringifyError(ensureResult.error));
				}

				const stale = await this.isLockStale();
				if(stale) {
					const rmResult = await fse.remove(this._lockDir);
					if(rmResult.fails) {
						return err(stringifyError(rmResult.error));
					}
				}

				if(Date.now() - start > this._timeoutMs) {
					return err(`Timeout acquiring lock at ${this._lockDir}`);
				}

				await this.wait();
			}
			else {
				const data = {
					pid: process.pid,
					ts: Date.now(),
					host: os.hostname(),
				};

				const writeResult = await fse.writeJSON(this._ownerFile, data);
				if(writeResult.fails) {
					return err(stringifyError(ensureResult.error));
				}

				this._acquired = true;

				this.installCleanup();

				break;
			}
		}

		return ok(this);
	} // }}}

	public async release(): Promise<void> { // {{{
		if(!this._acquired) {
			return;
		}

		await fse.remove(this._lockDir);

		this._acquired = false;
	} // }}}

	private async isLockStale(): Promise<boolean> { // {{{
		const result = await fse.readJSON(this._ownerFile);
		if(result.fails) {
			const result = await fse.stat(this._lockDir);

			if(!result.fails) {
				return Date.now() - result.value.mtimeMs > this._staleMs;
			}

			return true;
		}

		if(isRecord(result.value) && isNumber(result.value.ts)) {
			return Date.now() - result.value.ts > this._staleMs;
		}

		return false;
	} // }}}

	private installCleanup() { // {{{
		if(this._cleanupHandlersInstalled) {
			return;
		}

		// Hooks - they won't always fire in extension host abnormal crash, but help on normal exit
		process.on('exit', this.onExit);
		process.on('SIGINT', this.onExit);
		process.on('SIGTERM', this.onExit);

		this._cleanupHandlersInstalled = true;
	} // }}}

	private async wait() { // {{{
		return new Promise<void>((resolve) => {
			setTimeout(resolve, this._retryIntervalMs);
		});
	} // }}}
}
