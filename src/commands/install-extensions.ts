import semver from 'semver';
import * as vscode from 'vscode';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { installIntoEditor } from '../extensions/install-into-editor.js';
import { listExtensions } from '../extensions/list-extensions.js';
import { confirmRestartMessage } from '../modals/confirm-restart-message.js';
import { CONFIG_KEY, EXTENSION_ID, TEMPORARY_DIR } from '../settings.js';
import type { Metadata, ExtensionList, RestartMode, Source, SearchResult } from '../types.js';
import { Logger } from '../utils/logger.js';
import { parseMetadata } from '../utils/parse-metadata.js';
import { search } from '../utils/search.js';

export async function installExtensions(update: boolean = false): Promise<void> {
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
	const groups = config.get<Record<string, unknown[]>>('groups');

	const editorExtensions = await listExtensions(EXTENSION_ID);
	if(editorExtensions.fails) {
		Logger.error(editorExtensions.error);
		return;
	}

	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	await extensionManager.startInstallSession();

	for(const extension of extensions) {
		await installExtension(extension, sources, groups, editorExtensions.value, extensionManager, update);
	}

	const restartMode = config.get<RestartMode>('restart.mode') ?? 'auto';

	await extensionManager.save(restartMode, editorExtensions.value);

	Logger.info('done');
}

async function installExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, update: boolean): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				if(await installGroup(extension, sources, groups, editorExtensions, extensionManager, update)) {
					return;
				}
			}
			else if(extension.source) {
				if(await installExtensionWithSource(extension, sources, groups, editorExtensions, extensionManager, update)) {
					return;
				}
			}
			else {
				if(await installExtensionWithoutSource(extension, sources, groups, editorExtensions, extensionManager, update)) {
					return;
				}
			}
		}
		catch (error: unknown) {
			Logger.info(String(error));
		}
	}
} // }}}

async function installExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, update: boolean): Promise<boolean> { // {{{
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
		result = await search(metadata, source, sources, TEMPORARY_DIR);

		if(!result) {
			Logger.info('not found');

			return false;
		}

		extensionName = result.fullName;
	}
	else {
		extensionName = metadata.fullName;
	}

	if(editorExtensions.disabled.some(({ id }) => id === extensionName) || editorExtensions.enabled.some(({ id }) => id === extensionName)) {
		const currentVersion = extensionManager.getCurrentVersion(extensionName);

		// not null if the extension is managed by the manager
		if(currentVersion) {
			if(metadata.enabled) {
				if(!extensionManager.isEnabled(extensionName)) {
					await extensionManager.flagEnabled(extensionName);
				}
			}
			else {
				if(extensionManager.isEnabled(extensionName)) {
					await extensionManager.unflagEnabled(extensionName);
				}
			}

			if(update) {
				if(currentVersion === metadata.targetVersion) {
					Logger.info('expected version is already installed');

					return true;
				}

				result ??= await search(metadata, source, sources, TEMPORARY_DIR);

				if(!result) {
					Logger.info('not found');

					return false;
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
			}
			else {
				extensionManager.setInstalled(extensionName, currentVersion);

				Logger.info('already installed');
			}
		}
		else {
			Logger.info('already installed (unmanaged)');
		}

		return true;
	}

	result ??= await search(metadata, source, sources, TEMPORARY_DIR);

	if(!result) {
		Logger.info('not found');

		return false;
	}

	await installIntoEditor(result);

	await extensionManager.addInstalled(result.fullName, result.version, metadata.enabled);

	Logger.info(`installed version: ${result.version}`);

	return true;
} // }}}

async function installExtensionWithoutSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, _update: boolean): Promise<boolean> { // {{{
	Logger.info(`installing extension: ${metadata.fullName}`);

	if(editorExtensions.disabled.some(({ id }) => id === metadata.fullName) || editorExtensions.enabled.some(({ id }) => id === metadata.fullName)) {
		const currentVersion = extensionManager.getCurrentVersion(metadata.fullName);

		// not null if the extension is managed by the manager
		if(currentVersion) {
			await extensionManager.addInstalled(metadata.fullName, currentVersion, metadata.enabled);

			Logger.info('already installed');
		}
		else {
			Logger.info('already installed (unmanaged)');
		}
	}
	else {
		await vscode.commands.executeCommand('workbench.extensions.installExtension', metadata.fullName);

		await extensionManager.addInstalled(metadata.fullName, '0.0.0', metadata.enabled); // unknown version

		Logger.info('installed');
	}

	return true;
} // }}}

async function installGroup(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, update: boolean): Promise<boolean> { // {{{
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
		await installExtension(extension, sources, groups, editorExtensions, extensionManager, update);
	}

	return true;
} // }}}
