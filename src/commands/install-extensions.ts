import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import semver from 'semver';
import * as vscode from 'vscode';
import { loadAliases } from '../aliases/load-aliases.js';
import { saveAliases } from '../aliases/save-aliases.js';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { hasWorkspaceExtensions } from '../extensions/has-workspace-extensions.js';
import { installIntoEditor } from '../extensions/install-into-editor.js';
import { confirmInstallWorkspaceMessage } from '../modals/confirm-install-workspace-message.js';
import { confirmRestartMessage } from '../modals/confirm-restart-message.js';
import { CONFIG_KEY, TEMPORARY_DIR, WORKSPACE_STORAGE } from '../settings.js';
import type { Metadata, Source, SearchResult, ManagerMode, RestartMode, Aliases } from '../types.js';
import { download } from '../utils/download.js';
import { FileLock } from '../utils/file-lock.js';
import { Logger } from '../utils/logger.js';
import { parseMetadata } from '../utils/parse-metadata.js';
import { search } from '../utils/search.js';

export async function installExtensions(update: boolean = false, automatic: boolean = false): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);
	const extensions = config.inspect<unknown[]>('extensions');
	const sources = config.inspect<Record<string, Source>>('sources');
	const groups = config.inspect<Record<string, unknown[]>>('groups');

	if(!extensions) {
		return;
	}

	const workspaceEnabled = config.get<string>('workspace.enable') ?? 'off';
	const workspaceAutoInstall = config.get<string>('workspace.autoInstall') ?? 'ask';

	let mode: ManagerMode = 'global';

	if(WORKSPACE_STORAGE && hasWorkspaceExtensions(config) && workspaceEnabled !== 'off' && ((automatic && workspaceAutoInstall !== 'off') || !automatic)) {
		const ignoreFile = path.join(WORKSPACE_STORAGE, 'ignore');
		const exists = await fse.pathExists(ignoreFile);

		if(automatic && exists.value) {
			return;
		}

		if(workspaceEnabled === 'ask' || (automatic && workspaceAutoInstall === 'ask')) {
			if(!await confirmInstallWorkspaceMessage()) {
				await fse.ensureFile(ignoreFile);

				return;
			}
		}

		if(exists.value) {
			await fse.remove(ignoreFile);
		}

		mode = 'workspace';
	}

	if(!await confirmRestartMessage(config)) {
		return;
	}

	Logger.setup(true);

	const lock = await FileLock.acquire();
	if(lock.fails) {
		Logger.error(lock.error);
		return;
	}

	const extensionManager = new ExtensionManager(mode);

	const loadResult = await extensionManager.load();
	if(loadResult.fails) {
		await lock.value.release();

		Logger.error(loadResult.error);
		return;
	}

	if(mode === 'global') {
		await extensionManager.startSession(({ mode }) => mode === 'workspace');
	}
	else {
		await extensionManager.startSession();
	}

	const aliases = await loadAliases();

	if(extensions.globalValue) {
		await installAllExtensions(extensions.globalValue, sources?.globalValue, groups?.globalValue, 'global', aliases, extensionManager, update);
	}

	if(mode === 'workspace') {
		const sources = config.get<Record<string, Source>>('sources');
		const groups = config.get<Record<string, unknown[]>>('groups');

		await installAllExtensions(extensions.workspaceValue!, sources, groups, 'workspace', aliases, extensionManager, update);
	}

	await saveAliases(aliases);

	const restartMode = config.get<RestartMode>('restart.mode') ?? 'auto';

	const saveResult = await extensionManager.save(restartMode);

	await lock.value.release();

	if(saveResult.fails) {
		Logger.error(saveResult.error);
	}
	else {
		Logger.info('done');
	}
}

async function installAllExtensions(extensions: unknown[], sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, update: boolean): Promise<void> { // {{{
	for(const extension of extensions) {
		await installExtension(extension, sources, groups, mode, aliases, extensionManager, update);
	}
} // }}}

async function installExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, update: boolean): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				if(await installGroup(extension, sources, groups, mode, aliases, extensionManager, update)) {
					return;
				}
			}
			else if(extension.source) {
				if(await installExtensionWithSource(extension, sources, groups, mode, aliases, extensionManager, update)) {
					return;
				}
			}
			else {
				if(await installExtensionWithoutSource(extension, sources, groups, mode, aliases, extensionManager, update)) {
					return;
				}
			}
		}
		catch (error: unknown) {
			Logger.info(String(error));
		}
	}
} // }}}

async function installExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, update: boolean): Promise<boolean> { // {{{
	Logger.info(`installing extension: ${metadata.source!}:${metadata.fullName}${metadata.targetName ? '!' + metadata.targetName : ''}${metadata.targetVersion ? '@' + metadata.targetVersion : ''}`);

	if(!sources) {
		Logger.info('no sources');
		return false;
	}

	const source = metadata.source === 'github' ? metadata.source : sources[metadata.source!];
	if(!source) {
		Logger.info(`source "${metadata.source!}" not found`);
		return false;
	}

	let result: SearchResult | undefined;
	let extensionName: string;

	if(source === 'github' || source.type !== 'marketplace') {
		const searchResult = await search(metadata, source, sources, TEMPORARY_DIR, aliases);
		if(searchResult.fails) {
			Logger.error(searchResult.error);

			return true;
		}

		result = searchResult.value;

		if(!result) {
			Logger.info('not found');

			return false;
		}

		extensionName = result.fullName;
	}
	else {
		extensionName = metadata.fullName;
	}

	if(extensionManager.isInstalledInEditor(extensionName)) {
		const currentVersion = extensionManager.getCurrentVersion(extensionName);

		// not null if the extension is managed by the manager
		if(Boolean(currentVersion) || extensionManager.isFirstRun()) {
			if(metadata.enabled) {
				await extensionManager.enable(extensionName, mode);
			}
			else {
				await extensionManager.disable(extensionName, mode);
			}

			if(update) {
				if(currentVersion === metadata.targetVersion) {
					Logger.info('expected version is already installed');

					return true;
				}

				if(!result) {
					const searchResult = await search(metadata, source, sources, TEMPORARY_DIR, aliases);
					if(searchResult.fails) {
						Logger.error(searchResult.error);

						return true;
					}

					result = searchResult.value;
				}

				if(!result) {
					Logger.info('not found');

					return false;
				}

				if(!currentVersion) {
					const disabled = extensionManager.getDisabledInEditor(metadata.fullName);
					const enabled = extensionManager.getEnabledInEditor(metadata.fullName);
					const extension = disabled ?? enabled;

					if(extension) {
						if(semver.gt(result.version, extension.version)) {
							result = await download(result);

							await installIntoEditor(result);

							await extensionManager.addInstalled(metadata.fullName, result.version, metadata.enabled, mode);

							Logger.info(`adopting version: ${result.version}`);
						}
						else {
							await extensionManager.addInstalled(metadata.fullName, extension.version, metadata.enabled, mode);

							Logger.info(`adopting version: ${extension.version}`);
						}
					}
				}
				else if(semver.gt(result.version, currentVersion)) {
					result = await download(result);

					await installIntoEditor(result);

					extensionManager.setInstalled(extensionName, result.version, mode);

					Logger.info(`updated to version: ${result.version}`);
				}
				else {
					extensionManager.setInstalled(extensionName, currentVersion, mode);

					Logger.info('no newer version found');
				}
			}
			else {
				if(currentVersion) {
					extensionManager.setInstalled(extensionName, currentVersion, mode);

					Logger.info('already installed');
				}
				else {
					const disabled = extensionManager.getDisabledInEditor(metadata.fullName);
					const enabled = extensionManager.getEnabledInEditor(metadata.fullName);
					const extension = disabled ?? enabled;

					if(extension) {
						await extensionManager.addInstalled(metadata.fullName, extension.version, metadata.enabled, mode);

						Logger.info(`adopting version: ${extension.version}`);
					}
				}
			}
		}
		else {
			Logger.info('already installed (unmanaged)');
		}

		return true;
	}

	if(!result) {
		const searchResult = await search(metadata, source, sources, TEMPORARY_DIR, aliases);
		if(searchResult.fails) {
			Logger.error(searchResult.error);

			return true;
		}

		result = searchResult.value;
	}

	if(!result) {
		Logger.info('not found');

		return false;
	}

	result = await download(result);

	await installIntoEditor(result);

	await extensionManager.addInstalled(result.fullName, result.version, metadata.enabled, mode);

	Logger.info(`installed version: ${result.version}`);

	return true;
} // }}}

async function installExtensionWithoutSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, _update: boolean): Promise<boolean> { // {{{
	Logger.info(`installing extension: ${metadata.fullName}`);

	if(extensionManager.isInstalledInEditor(metadata.fullName)) {
		const currentVersion = extensionManager.getCurrentVersion(metadata.fullName);

		// not null if the extension is managed by the manager
		if(currentVersion) {
			await extensionManager.addInstalled(metadata.fullName, currentVersion, metadata.enabled, mode);

			Logger.info('already installed');
		}
		else {
			Logger.info('already installed (unmanaged)');
		}
	}
	else {
		await vscode.commands.executeCommand('workbench.extensions.installExtension', metadata.fullName);

		await extensionManager.addInstalled(metadata.fullName, '0.0.0', metadata.enabled, mode); // unknown version

		Logger.info('installed');
	}

	return true;
} // }}}

async function installGroup(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, update: boolean): Promise<boolean> { // {{{
	Logger.info(`installing group: ${metadata.fullName}`);
	if(!groups) {
		Logger.info('no groups');
		return false;
	}

	const extensions = groups[metadata.fullName];
	if(!extensions) {
		Logger.info(`group "${metadata.fullName}" not found`);
		return false;
	}

	for(const extension of extensions) {
		await installExtension(extension, sources, groups, mode, aliases, extensionManager, update);
	}

	return true;
} // }}}
