import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import { isString } from '@zokugun/is-it-type';
import { restartApp } from '@zokugun/vscode-utils';
import { err, OK, stringifyError, type Result } from '@zokugun/xtry';
import globby from 'globby';
import vscode from 'vscode';
import { getExtensionDataPath } from '../paths/get-extension-data-path.js';
import { EXTENSION_ID, GLOBAL_STORAGE, WORKSPACE_STORAGE } from '../settings.js';
import type { Extension, ManagerMode, RestartMode } from '../types.js';
import { arrayDiff } from '../utils/array-diff.js';
import { EXTENSION_NAME } from '../utils/constants.js';
import { Logger } from '../utils/logger.js';
import { writeStateDB } from '../utils/write-statedb.js';
import { disableExtension } from './disable-extension.js';
import { enableExtension } from './enable-extension.js';

type ExtensionState = {
	version: string;
	mode: ManagerMode;
};

async function canManageExtensions(): Promise<boolean> { // {{{
	const commands = await vscode.commands.getCommands();

	return commands.some((command) => command === 'workbench.extensions.disableExtension' || command === 'workbench.extensions.enableExtension');
} // }}}

export class ExtensionManager {
	private _builtinDisabledExtensions?: Record<string, Extension>;
	private _canOperateIndividually: boolean = false;
	private _currentInstalled: Record<string, ExtensionState>;
	private readonly _extListPath: string;
	private _firstRun: boolean = false;
	private _forceUpdateDisabled: boolean = false;
	private readonly _globalManager?: ExtensionManager;
	private readonly _mode: ManagerMode;
	private _nextDisabled?: string[];
	private _nextInstalled?: Record<string, ExtensionState>;
	private readonly _primary: boolean = false;
	private readonly _stateDbPath: string;
	private readonly _storagePath: string;
	private _userDisabledExtensions: Record<string, Extension> = {};
	private _userEnabledExtensions: Record<string, Extension> = {};

	constructor(mode: ManagerMode = 'global', primary: boolean = true) { // {{{
		this._primary = primary;
		this._mode = mode;

		if(this._mode === 'global') {
			this._storagePath = GLOBAL_STORAGE;
		}
		else {
			if(!WORKSPACE_STORAGE) {
				throw new Error('Cannot find the storage for the workspace');
			}

			this._globalManager = new ExtensionManager('global', false);
			this._storagePath = WORKSPACE_STORAGE;
		}

		Logger.debug(`storage: ${this._storagePath}`);

		this._extListPath = path.join(this._storagePath, 'extensions.json');
		this._stateDbPath = path.resolve(this._storagePath, '..', 'state.vscdb');

		this._currentInstalled = {};
	} // }}}

	public async addInstalled(id: string, version: string, enabled: boolean, mode: ManagerMode): Promise<void> { // {{{
		this._nextInstalled![id] = { version, mode };

		if(!enabled) {
			this._nextDisabled!.push(id);

			if(this._canOperateIndividually && this._userEnabledExtensions[id]) {
				await disableExtension(id);
			}
		}

		return this._globalManager?.addInstalled(id, version, mode === 'global' ? enabled : false, mode);
	} // }}}

	public async disable(id: string, mode: ManagerMode): Promise<void> { // {{{
		Logger.debug('disable', id, Boolean(this._userEnabledExtensions[id]));

		this._nextDisabled?.push(id);

		if(this._canOperateIndividually && this._userEnabledExtensions[id]) {
			await disableExtension(id);
		}

		return this._globalManager?.disable(id, mode);
	} // }}}

	public async enable(id: string, mode: ManagerMode): Promise<void> { // {{{
		Logger.debug('enable', id, Boolean(this._userDisabledExtensions[id]));
		if(this._userDisabledExtensions[id]) {
			if(this._canOperateIndividually) {
				await enableExtension(id);
			}
			else {
				this._forceUpdateDisabled = true;
			}
		}

		if(this._globalManager && mode === 'workspace') {
			return this._globalManager.disable(id, mode);
		}
	} // }}}

	public getCurrentVersion(id: string): string | undefined { // {{{
		return this._currentInstalled[id]?.version;
	} // }}}

	public getDisabledInEditor(id: string): Extension | undefined { // {{{
		return this._userDisabledExtensions[id];
	} // }}}

	public getEnabledInEditor(id: string): Extension | undefined { // {{{
		return this._userEnabledExtensions[id];
	} // }}}

	public isFirstRun(): boolean { // {{{
		return this._firstRun;
	} // }}}

	public isInstalledInEditor(id: string): boolean { // {{{
		return Boolean(this._userDisabledExtensions[id]) || Boolean(this._userEnabledExtensions[id]);
	} // }}}

	public isManaged(id: string, mode: ManagerMode): boolean { // {{{
		return this._currentInstalled[id]?.mode === mode;
	} // }}}

	public listInstalled(): string[] { // {{{
		return Object.keys(this._currentInstalled);
	} // }}}

	public async load(): Promise<Result<void, string>> { // {{{
		const ensureResult = await fse.ensureDir(this._storagePath);
		if(ensureResult.fails) {
			return err(stringifyError(ensureResult.error));
		}

		const managedResult = await this.loadManagedExtensions();
		if(managedResult.fails) {
			return managedResult;
		}

		const editorResult = await this.loadEditorExtensions();
		if(editorResult.fails) {
			return editorResult;
		}

		if(this._globalManager) {
			const managedResult = await this._globalManager.loadManagedExtensions();
			if(managedResult.fails) {
				return managedResult;
			}

			this._globalManager.setEditorExtensions(this._builtinDisabledExtensions, this._userDisabledExtensions, this._userEnabledExtensions);
		}

		return OK;
	} // }}}

	public async loadManagedExtensions(): Promise<Result<void, string>> { // {{{
		const exists = await fse.pathExists(this._extListPath);

		if(!exists.value) {
			this._currentInstalled = {};
			this._firstRun = true;

			return OK;
		}

		const dataResult = await fse.readJson(this._extListPath);
		if(dataResult.fails) {
			console.log(dataResult);
			return err(`Cannot read the file ${this._extListPath}`);
		}

		const data: { installed?: Record<string, string | ExtensionState> } = dataResult.value ?? {};

		this._currentInstalled = {};

		const save = false;

		if(data.installed) {
			for(const [name, installed] of Object.entries(data.installed)) {
				if(isString(installed)) {
					this._currentInstalled[name] = { version: installed, mode: 'global' };
				}
				else {
					this._currentInstalled[name] = installed;
				}
			}
		}
		else {
			for(const [name, installed] of Object.entries(data as Record<string, unknown>)) {
				if(isString(installed)) {
					this._currentInstalled[name] = { version: installed, mode: 'global' };
				}
			}
		}

		if(save) {
			const writeResult = await fse.writeJSON(this._extListPath, {
				installed: this._currentInstalled,
			});
			if(writeResult.fails) {
				return err(`Cannot write the file ${this._extListPath}`);
			}
		}

		return OK;
	} // }}}

	public async save(restartMode: RestartMode): Promise<Result<void, string>> { // {{{
		let reload = false;
		let restart = this._mode !== 'global';

		if(this._nextInstalled) {
			const toDisable: Array<{ id: string }> = [];

			if(this._primary && this._mode === 'global') {
				for(const id in this._currentInstalled) {
					if(this._nextInstalled[id]) {
						if(!this._canOperateIndividually && this._nextInstalled[id].mode === 'workspace') {
							toDisable.push({ id });
						}
					}
					else {
						Logger.info(`uninstall: ${id}`);

						try {
							await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', id);

							reload = true;
						}
						catch {
						}
					}
				}
			}

			if(!this._canOperateIndividually) {
				if(this._builtinDisabledExtensions) {
					for(const id of Object.keys(this._builtinDisabledExtensions)) {
						toDisable.push({ id });
					}
				}

				const disabledUnmanageds = arrayDiff(Object.keys(this._userDisabledExtensions), Object.keys(this._currentInstalled));

				toDisable.push(...disabledUnmanageds.map((id) => ({ id })));
			}

			if(!this._canOperateIndividually && (this._forceUpdateDisabled || this._nextDisabled!.length > 0)) {
				toDisable.push(...this._nextDisabled!.map((id) => ({ id })));

				Logger.debug('extensionsIdentifiers/disabled', this._stateDbPath, JSON.stringify(toDisable));

				const writeResult = await writeStateDB(this._stateDbPath, 'INSERT OR REPLACE INTO ItemTable (key, value) VALUES (\'extensionsIdentifiers/disabled\', $value)', {
					$value: JSON.stringify(toDisable),
				});
				if(writeResult.fails) {
					return writeResult;
				}

				restart = true;
			}

			this._currentInstalled = this._nextInstalled;
			this._nextInstalled = undefined;
			this._nextDisabled = undefined;
		}

		const writeResult = await fse.writeJSON(this._extListPath, {
			installed: this._currentInstalled,
		});
		if(writeResult.fails) {
			return err(`Cannot write the file ${this._extListPath}`);
		}

		if(this._globalManager) {
			const result = await this._globalManager.save('none');
			if(result.fails) {
				return result;
			}
		}

		if(restartMode === 'auto') {
			if(restart) {
				await restartApp(EXTENSION_NAME);
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
				await restartApp(EXTENSION_NAME);
			}
		}
		else if(restartMode === 'restart-host') {
			if(restart || reload) {
				await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
			}
		}

		return OK;
	} // }}}

	public setInstalled(id: string, version: string, mode: ManagerMode): void { // {{{
		if(this._nextInstalled) {
			this._nextInstalled[id] = { version, mode };

			this._globalManager?.setInstalled(id, version, mode);
		}
	} // }}}

	public async startSession(filter?: (item: ExtensionState) => boolean): Promise<void> { // {{{
		this._nextInstalled = {};
		this._nextDisabled = [];

		if(this._primary) {
			this._canOperateIndividually = await canManageExtensions();

			if(filter) {
				for(const id in this._currentInstalled) {
					if(filter(this._currentInstalled[id])) {
						this._nextInstalled[id] = this._currentInstalled[id];
					}
				}
			}
		}
		else {
			this._canOperateIndividually = false;
		}

		return this._globalManager?.startSession(filter);
	} // }}}

	protected async loadEditorExtensions(): Promise<Result<void, string>> { // {{{
		this._builtinDisabledExtensions = undefined;
		this._userDisabledExtensions = {};
		this._userEnabledExtensions = {};

		const ids: Record<string, boolean> = {};

		for(const extension of vscode.extensions.all) {
			const id = extension.id;
			const pkg = extension.packageJSON as { isBuiltin: boolean; isUnderDevelopment: boolean; version: string; uuid: string };

			if(!pkg || pkg.isUnderDevelopment || id === EXTENSION_ID) {
				continue;
			}

			if(!pkg.isBuiltin) {
				this._userEnabledExtensions[id] = { id, version: pkg.version };
			}

			ids[id] = true;
		}

		const extensionDataPath = await getExtensionDataPath();
		const obsoletePath = path.join(extensionDataPath, '.obsolete');

		let obsolete: Record<string, boolean> = {};

		const exists = await fse.pathExists(obsoletePath);
		if(exists.value) {
			const result = await fse.readJSON(obsoletePath);
			if(result.fails) {
				return err(`Cannot read the file ${obsoletePath}`);
			}

			obsolete = result.value as Record<string, boolean>;
		}

		const extensions = await globby('*/package.json', {
			cwd: extensionDataPath,
		});

		for(const packagePath of extensions) {
			const name = path.dirname(packagePath);

			if(obsolete[name]) {
				continue;
			}

			const match = /^(.*?)-\d+\.\d+\.\d+$/.exec(name);
			if(!match) {
				continue;
			}

			const result = await fse.readJSON(path.join(extensionDataPath, packagePath));
			if(result.fails) {
				return err(`Cannot read the extension: ${packagePath}`);
			}

			const pkg = result.value as { name: string; publisher: string; version: string; __metadata: { id: string } };
			const id = `${pkg.publisher}.${pkg.name}`;

			if(obsolete[id]) {
				continue;
			}

			if(!ids[id] && id !== EXTENSION_ID) {
				this._userDisabledExtensions[id] = { id, version: pkg.version };
			}
		}

		const builtinDataPath = path.join(vscode.env.appRoot, 'extensions');
		const builtinExtensions = await globby('*/package.json', {
			cwd: builtinDataPath,
		});

		for(const packagePath of builtinExtensions) {
			const result = await fse.readJSON(path.join(builtinDataPath, packagePath));
			if(result.fails) {
				return err(`Cannot read the extension: ${packagePath}`);
			}

			const pkg = result.value as { name: string; publisher: string; version: string; __metadata: { id: string } };
			const id = `${pkg.publisher}.${pkg.name}`;

			if(!ids[id]) {
				this._builtinDisabledExtensions ??= {};
				this._builtinDisabledExtensions[id] = { id, version: pkg.version };
			}
		}

		return OK;
	} // }}}

	protected setEditorExtensions(builtinDisabledExtensions: Record<string, Extension> | undefined, userDisabledExtensions: Record<string, Extension>, userEnabledExtensions: Record<string, Extension>): void { // {{{
		this._builtinDisabledExtensions = builtinDisabledExtensions;
		this._userDisabledExtensions = userDisabledExtensions;
		this._userEnabledExtensions = userEnabledExtensions;
	} // }}}
}
