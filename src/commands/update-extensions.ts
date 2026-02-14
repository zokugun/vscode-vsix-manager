import semver from 'semver';
import vscode from 'vscode';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { installIntoEditor } from '../extensions/install-into-editor.js';
import { confirmRestartMessage } from '../modals/confirm-restart-message.js';
import { CONFIG_KEY, TEMPORARY_DIR } from '../settings.js';
import type { Metadata, RestartMode, SearchResult, Source } from '../types.js';
import { Logger } from '../utils/logger.js';
import { parseMetadata } from '../utils/parse-metadata.js';
import { search } from '../utils/search.js';

export async function updateExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	if(!await confirmRestartMessage(config)) {
		return;
	}

	Logger.setup(true);

	const extensions = config.get<unknown[]>('extensions');
	if(!extensions) {
		return;
	}

	const sources = config.get<Record<string, Source>>('sources');
	const groups = config.get<Record<string, string[]>>('groups');

	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	for(const extension of extensions) {
		await updateExtension(extension, sources, groups, extensionManager);
	}

	const restartMode = config.get<RestartMode>('restart.mode') ?? 'auto';

	const saveResult = await extensionManager.save(restartMode);
	if(saveResult.fails) {
		Logger.error(saveResult.error);
		return;
	}

	Logger.info('done');
}

async function updateExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, extensionManager: ExtensionManager): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				await updateGroup(extension, sources, groups, extensionManager);
			}
			else if(extensionManager.hasInstalled(extension.fullName)) {
				if(extension.source) {
					await updateExtensionWithSource(extension, sources, groups, extensionManager);
				}
				else {
					// skip, managed by the editor
				}

				return;
			}
		}
		catch (error: unknown) {
			Logger.error(error);
		}
	}
} // }}}

async function updateExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, extensionManager: ExtensionManager): Promise<void> { // {{{
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
		result = await search(metadata, source, sources, TEMPORARY_DIR);

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

	result ??= await search(metadata, source, sources, TEMPORARY_DIR);

	if(!result) {
		Logger.info('not found');

		return;
	}

	if(semver.gt(result.version, currentVersion)) {
		await installIntoEditor(result);

		extensionManager.setInstalled(extensionName, result.version);

		Logger.info(`updated to version: ${result.version}`);
	}
	else {
		extensionManager.setInstalled(extensionName, currentVersion);

		Logger.info('no newer version found');
	}
} // }}}

async function updateGroup(extension: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, extensionManager: ExtensionManager): Promise<void> { // {{{
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
			await updateExtension(extension, sources, groups, extensionManager);
		}
		catch (error: unknown) {
			Logger.info(String(error));
		}
	}
} // }}}
