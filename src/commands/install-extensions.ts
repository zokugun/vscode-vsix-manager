import * as vscode from 'vscode';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { listExtensions } from '../extensions/list-extensions.js';
import { confirmRestartMessage } from '../modals/confirm-restart-message.js';
import { CONFIG_KEY, EXTENSION_ID, getDebugChannel, TEMPORARY_DIR } from '../settings.js';
import type { Metadata, ExtensionList, RestartMode, Source } from '../types.js';
import { dispatchInstall } from '../utils/dispatch-install.js';
import { dispatchUpdate } from '../utils/dispatch-update.js';
import { listSources } from '../utils/list-sources.js';
import { parseMetadata } from '../utils/parse-metadata.js';

export async function installExtensions(update: boolean = false): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	if(!await confirmRestartMessage(config)) {
		return;
	}

	const debug = config.get<boolean>('debug') ?? false;
	const debugChannel = getDebugChannel(debug);

	if(debugChannel) {
		debugChannel.show(true);
	}

	const extensions = config.get<unknown[]>('extensions');
	if(!extensions) {
		return;
	}

	const sources = listSources(config);
	const groups = config.get<Record<string, unknown[]>>('groups');

	const editorExtensions = await listExtensions(EXTENSION_ID);
	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	await extensionManager.startInstallSession();

	for(const extension of extensions) {
		await installExtension(extension, sources, groups, editorExtensions, extensionManager, debugChannel, update);
	}

	const restartMode = config.get<RestartMode>('restart.mode') ?? 'auto';

	await extensionManager.save(restartMode, editorExtensions, debugChannel);

	debugChannel?.appendLine('done');
}

async function installExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				if(await installGroup(extension, sources, groups, editorExtensions, extensionManager, debugChannel, update)) {
					return;
				}
			}
			else if(extension.source) {
				if(await installExtensionWithSource(extension, sources, groups, editorExtensions, extensionManager, debugChannel, update)) {
					return;
				}
			}
			else {
				if(await installExtensionWithoutSource(extension, sources, groups, editorExtensions, extensionManager, debugChannel, update)) {
					return;
				}
			}
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // {{{

async function installExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<boolean> { // {{{
	debugChannel?.appendLine(`installing extension: ${metadata.source!}:${metadata.fullName}`);

	if(!sources) {
		debugChannel?.appendLine('no sources');
		return false;
	}

	const source = metadata.source === 'github' ? metadata.source : sources[metadata.source!];
	if(!source) {
		debugChannel?.appendLine(`source "${metadata.source!}" not found`);
		return false;
	}

	if(editorExtensions.disabled.some(({ id }) => id === metadata.fullName) || editorExtensions.enabled.some(({ id }) => id === metadata.fullName)) {
		const currentVersion = extensionManager.getCurrentVersion(metadata.fullName);

		// not null if the extension is managed by the manager
		if(currentVersion) {
			if(metadata.enabled) {
				if(!extensionManager.isEnabled(metadata.fullName)) {
					await extensionManager.flagEnabled(metadata.fullName, debugChannel);
				}
			}
			else {
				if(extensionManager.isEnabled(metadata.fullName)) {
					await extensionManager.unflagEnabled(metadata.fullName, debugChannel);
				}
			}

			if(update) {
				if(currentVersion === metadata.targetVersion) {
					debugChannel?.appendLine('expected version is already installed');
					return true;
				}

				const result = await dispatchUpdate(metadata, currentVersion, source, TEMPORARY_DIR, debugChannel);

				if(!result) {
					extensionManager.setInstalled(metadata.fullName, currentVersion);

					debugChannel?.appendLine('no newer version found');
				}
				else if(typeof result === 'string') {
					extensionManager.setInstalled(metadata.fullName, result);

					debugChannel?.appendLine(`updated to version: ${result}`);
				}
				else if(result.updated) {
					extensionManager.setInstalled(result.name, result.version);

					debugChannel?.appendLine(`updated to version: ${result.version}`);
				}
				else {
					extensionManager.setInstalled(result.name, result.version);

					debugChannel?.appendLine('no newer version found');
				}
			}
			else {
				extensionManager.setInstalled(metadata.fullName, currentVersion);

				debugChannel?.appendLine('already installed');
			}
		}
		else {
			debugChannel?.appendLine('already installed (unmanaged)');
		}

		return true;
	}

	const result = await dispatchInstall(metadata, source, sources, TEMPORARY_DIR, debugChannel);

	if(result) {
		await extensionManager.addInstalled(result.name, result.version, result.enabled, debugChannel);

		debugChannel?.appendLine(`installed version: ${result.version}`);
	}
	else {
		debugChannel?.appendLine('not found');
		return false;
	}

	return true;
} // }}}

async function installExtensionWithoutSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, debugChannel: vscode.OutputChannel | undefined, _update: boolean): Promise<boolean> { // {{{
	debugChannel?.appendLine(`installing extension: ${metadata.fullName}`);

	if(editorExtensions.disabled.some(({ id }) => id === metadata.fullName) || editorExtensions.enabled.some(({ id }) => id === metadata.fullName)) {
		const currentVersion = extensionManager.getCurrentVersion(metadata.fullName);

		// not null if the extension is managed by the manager
		if(currentVersion) {
			await extensionManager.addInstalled(metadata.fullName, currentVersion, metadata.enabled, debugChannel);

			debugChannel?.appendLine('already installed');
		}
		else {
			debugChannel?.appendLine('already installed (unmanaged)');
		}
	}
	else {
		await vscode.commands.executeCommand('workbench.extensions.installExtension', metadata.fullName);

		await extensionManager.addInstalled(metadata.fullName, '0.0.0', metadata.enabled, debugChannel); // unknown version

		debugChannel?.appendLine('installed');
	}

	return true;
} // }}}

async function installGroup(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<boolean> { // {{{
	debugChannel?.appendLine(`installing group: ${metadata.fullName}`);
	if(!groups) {
		debugChannel?.appendLine('no groups');
		return false;
	}

	const extensions = groups[metadata.fullName];
	if(!extensions) {
		debugChannel?.appendLine(`group "${metadata.fullName}" not found`);
		return false;
	}

	for(const extension of extensions) {
		await installExtension(extension, sources, groups, editorExtensions, extensionManager, debugChannel, update);
	}

	return true;
} // }}}
