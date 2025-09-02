import path from 'path';
import { restartApp } from '@zokugun/vscode-utils';
import fse from 'fs-extra';
import vscode from 'vscode';
import { GLOBAL_STORAGE } from '../settings.js';
import { arrayDiff } from './array-diff.js';
import { disableExtension } from './disable-extension.js';
import { enableExtension } from './enable-extension.js';
import { getUserDataPath } from './get-user-data-path.js';
import type { ExtensionList, RestartMode } from './types.js';
import { writeStateDB } from './write-statedb.js';

async function canManageExtensions(): Promise<boolean> { // {{{
	const commands = await vscode.commands.getCommands();

	return commands.some((command) => command === 'workbench.extensions.disableExtension' || command === 'workbench.extensions.enableExtension');
} // }}}

export class ExtensionManager {
	private _canUninstallIndividually: boolean = false;
	private _currentDisabled: string[];
	private _currentInstalled: Record<string, string>;
	private readonly _extensionsFileName: string;
	private _forceUpdateDisabled: boolean = false;
	private _nextDisabled?: string[];
	private _nextInstalled?: Record<string, string>;

	constructor() { // {{{
		this._extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

		this._currentInstalled = {};
		this._currentDisabled = [];
	} // }}}

	public async addInstalled(id: string, version: string, enabled: boolean, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
		this._nextInstalled![id] = version;

		if(!enabled) {
			this._nextDisabled!.push(id);

			if(!this._currentDisabled.includes(id) && this._canUninstallIndividually) {
				await disableExtension(id, debugChannel);
			}
		}
	} // }}}

	public async flagEnabled(id: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
		if(this._currentDisabled.includes(id)) {
			if(this._canUninstallIndividually) {
				await enableExtension(id, debugChannel);
			}
			else {
				this._forceUpdateDisabled = true;
			}
		}
	} // }}}

	public getCurrentVersion(id: string): string | undefined { // {{{
		return this._currentInstalled[id];
	} // }}}

	public hasInstalled(id: string): boolean { // {{{
		return Boolean(this._currentInstalled[id]);
	} // }}}

	public isEnabled(id: string): boolean { // {{{
		return !this._currentDisabled.includes(id);
	} // }}}

	public listInstalled(): string[] { // {{{
		return Object.keys(this._currentInstalled);
	} // }}}

	public listNotInstalled(): string[] { // {{{
		return arrayDiff(Object.keys(this._currentInstalled), Object.keys(this._nextInstalled!));
	} // }}}

	public async load() { // {{{
		await fse.ensureFile(this._extensionsFileName);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const data = await fse.readJson(this._extensionsFileName, { throws: false }) ?? {};

		if(data.installed && data.disabled) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			this._currentInstalled = data.installed;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			this._currentDisabled = data.disabled;
		}
		else {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			this._currentInstalled = data;
		}
	} // }}}

	public async save(restartMode: RestartMode, editor?: ExtensionList, debugChannel?: vscode.OutputChannel | undefined) { // {{{
		let reload = false;
		let restart = false;

		if(this._nextInstalled) {
			const uninstalls = this.listNotInstalled();

			if(uninstalls.length > 0) {
				for(const id of uninstalls) {
					debugChannel?.appendLine(`uninstall: ${id}`);

					try {
						await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', id);
					}
					catch {
					}
				}

				reload = true;
			}

			const toDisable: Array<{ id: string }> = [];

			if(!this._canUninstallIndividually) {
				if(editor!.builtin?.disabled) {
					toDisable.push(...editor!.builtin.disabled.map(({ id }) => ({ id })));
				}

				toDisable.push(...arrayDiff(editor!.disabled.map(({ id }) => id), this._currentDisabled).map((id) => ({ id })));
			}

			this._currentInstalled = this._nextInstalled;
			this._currentDisabled = this._nextDisabled!;

			this._nextInstalled = undefined;
			this._nextDisabled = undefined;

			if(!this._canUninstallIndividually && (this._forceUpdateDisabled || this._currentDisabled.length > 0)) {
				toDisable.push(...this._currentDisabled.map((id) => ({ id })));

				await writeStateDB(getUserDataPath(), 'INSERT OR REPLACE INTO ItemTable (key, value) VALUES (\'extensionsIdentifiers/disabled\', $value)', {
					$value: JSON.stringify(toDisable),
				});

				restart = true;
			}
		}

		await fse.writeJSON(this._extensionsFileName, {
			installed: this._currentInstalled,
			disabled: this._currentDisabled,
		});

		if(restartMode === 'auto') {
			if(restart) {
				await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
			}
			else if(reload) {
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		}
		else if(restartMode === 'none') {
			// do nothing
		}
		else if(restartMode === 'reload-windows') {
			if(restart || reload) {
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		}
		else if(restartMode === 'restart-app') {
			if(restart || reload) {
				await restartApp();
			}
		}
		else if(restartMode === 'restart-host') {
			if(restart || reload) {
				await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
			}
		}
	} // }}}

	public setInstalled(id: string, version: string): void { // {{{
		if(this._nextInstalled) {
			this._nextInstalled[id] = version;
		}
		else {
			this._currentInstalled[id] = version;
		}
	} // }}}

	public async startAdoptionSession(): Promise<void> { // {{{
		this._nextInstalled = { ...this._currentInstalled };
		this._nextDisabled = [...this._currentDisabled];

		this._canUninstallIndividually = false;
	} // }}}

	public async startInstallSession(): Promise<void> { // {{{
		this._nextInstalled = {};
		this._nextDisabled = [];

		this._canUninstallIndividually = await canManageExtensions();
	} // }}}

	public async unflagEnabled(id: string, debugChannel: vscode.OutputChannel | undefined) { // {{{
		this._nextDisabled?.push(id);

		if(!this._currentDisabled.includes(id) && this._canUninstallIndividually) {
			await disableExtension(id, debugChannel);
		}
	} // }}}
}
