import { stringifyError } from '@zokugun/xtry';
import semver from 'semver';
import vscode from 'vscode';
import { loadAliases } from '../aliases/load-aliases.js';
import { saveAliases } from '../aliases/save-aliases.js';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { hasWorkspaceExtensions } from '../extensions/has-workspace-extensions.js';
import { installIntoEditor } from '../extensions/install-into-editor.js';
import { isConfiguredWorkspace } from '../extensions/is-configured-workspace.js';
import { resolveExtensionName } from '../extensions/resolve-extension-name.js';
import { confirmNoWorkspaceMessage } from '../modals/confirm-no-workspace-message.js';
import { confirmRestartMessage } from '../modals/confirm-restart-message.js';
import { CONFIG_KEY, TEMPORARY_DIR } from '../settings.js';
import type { Aliases, ManagerMode, Metadata, RestartMode, SearchResult, Source } from '../types.js';
import { download } from '../utils/download.js';
import { FileLock } from '../utils/file-lock.js';
import { Logger } from '../utils/logger.js';
import { parseMetadata } from '../utils/parse-metadata.js';
import { search } from '../utils/search.js';

export async function updateExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);
	const extensions = config.inspect<unknown[]>('extensions');
	const sources = config.inspect<Record<string, Source>>('sources');
	const groups = config.inspect<Record<string, unknown[]>>('groups');

	if(!extensions) {
		return;
	}

	const workspaceEnabled = config.get<string>('workspace.enable') ?? 'off';

	let mode: ManagerMode = 'global';

	if(hasWorkspaceExtensions(config) && workspaceEnabled !== 'off') {
		if(!await isConfiguredWorkspace()) {
			await confirmNoWorkspaceMessage();

			return;
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

	await extensionManager.startSession(() => true);

	const aliases = await loadAliases();

	if(extensions.globalValue) {
		await updateAllExtensions(extensions.globalValue, sources?.globalValue, groups?.globalValue, 'global', aliases, extensionManager);
	}

	if(mode === 'workspace') {
		const sources = config.get<Record<string, Source>>('sources');
		const groups = config.get<Record<string, unknown[]>>('groups');

		await updateAllExtensions(extensions.workspaceValue!, sources, groups, 'workspace', aliases, extensionManager);
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

async function updateAllExtensions(extensions: unknown[], sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager): Promise<void> { // {{{
	Logger.debug(extensions);
	for(const extension of extensions) {
		await updateExtension(extension, sources, groups, mode, aliases, extensionManager);
	}
} // }}}

async function updateExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				return updateGroup(extension, sources, groups, mode, aliases, extensionManager);
			}
			else if(extension.source) {
				const source = extension.source === 'github' ? extension.source : sources?.[extension.source];

				if(!source) {
					return;
				}

				const extensionName = resolveExtensionName(extension, source, aliases);

				if(extensionManager.isManaged(extensionName, mode)) {
					return updateExtensionWithSource(extension, sources, groups, mode, aliases, extensionManager);
				}

				return;
			}
		}
		catch (error: unknown) {
			Logger.error(stringifyError(error));
		}
	}
} // }}}

async function updateExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager): Promise<void> { // {{{
	Logger.info(`updating extension: ${metadata.source!}:${metadata.fullName}`);

	if(metadata.targetVersion) {
		Logger.info(`has specific version: ${metadata.targetVersion}`);
		return;
	}

	if(!sources) {
		Logger.info('no sources');
		return;
	}

	const source = metadata.source === 'github' ? metadata.source : sources[metadata.source!];
	if(!source) {
		Logger.info(`source "${metadata.source!}" not found`);
		return;
	}

	let result: SearchResult | undefined;
	let extensionName: string;

	if(source === 'github' || source.type !== 'marketplace') {
		const searchResult = await search(metadata, source, sources, TEMPORARY_DIR, aliases);
		if(searchResult.fails) {
			Logger.error(searchResult.error);
			return;
		}

		result = searchResult.value;

		if(!result) {
			Logger.info('not found');

			return;
		}

		extensionName = result.fullName;
	}
	else {
		extensionName = metadata.fullName;
	}

	const currentVersion = extensionManager.getCurrentVersion(extensionName);
	if(!currentVersion) {
		Logger.info('not managed');
		return;
	}

	if(currentVersion === metadata.targetVersion) {
		Logger.info('expected version is already installed');
		return;
	}

	if(!result) {
		const searchResult = await search(metadata, source, sources, TEMPORARY_DIR, aliases);
		if(searchResult.fails) {
			Logger.error(searchResult.error);
			return;
		}

		result = searchResult.value;
	}

	if(!result) {
		Logger.info('not found');

		return;
	}

	if(semver.gt(result.version, currentVersion)) {
		result = await download(result);

		await installIntoEditor(result);

		extensionManager.setInstalled(extensionName, result.version, mode);

		Logger.info(`updated to version: ${result.version}`);
	}
	else {
		extensionManager.setInstalled(extensionName, currentVersion, mode);

		Logger.info('no newer version found');
	}
} // }}}

async function updateGroup(extension: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager): Promise<void> { // {{{
	Logger.info(`updating group: ${extension.fullName}`);
	if(!groups) {
		Logger.info('no groups');
		return;
	}

	const extensions = groups[extension.fullName];
	if(!extensions) {
		Logger.info(`group "${extension.fullName}" not found`);
		return;
	}

	for(const extension of extensions) {
		try {
			await updateExtension(extension, sources, groups, mode, aliases, extensionManager);
		}
		catch (error: unknown) {
			Logger.error(stringifyError(error));
		}
	}
} // }}}
