import vscode from 'vscode';
import { CONFIG_KEY, getDebugChannel, TEMPORARY_DIR } from '../settings.js';
import { dispatchUpdate } from '../utils/dispatch-update.js';
import { ExtensionManager } from '../utils/extension-manager.js';
import { listSources } from '../utils/list-sources.js';
import { parse } from '../utils/parse.js';
import type { Metadata, RestartMode, Source } from '../utils/types.js';

export async function updateExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);
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
	const groups = config.get<Record<string, string[]>>('groups');

	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	for(const extension of extensions) {
		await updateExtension(extension, sources, groups, extensionManager, debugChannel);
	}

	const restartMode = config.get<RestartMode>('restartMode') ?? 'auto';

	await extensionManager.save(restartMode);

	debugChannel?.appendLine('done');
}

async function updateExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, extensionManager: ExtensionManager, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	for(const extension of parse(data)) {
		try {
			if(extension.kind === 'group') {
				await updateGroup(extension, sources, groups, extensionManager, debugChannel);
			}
			else if(extensionManager.hasInstalled(extension.fullName)) {
				if(extension.source) {
					await updateExtensionWithSource(extension, sources, groups, extensionManager, debugChannel);
				}
				else {
					// skip, managed by the editor
				}

				return;
			}
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // {{{

async function updateExtensionWithSource(extension: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, extensionManager: ExtensionManager, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`updating extension: ${extension.source!}:${extension.fullName}`);

	if(extension.targetVersion) {
		debugChannel?.appendLine(`has specific version: ${extension.targetVersion}`);
		return;
	}

	if(!sources) {
		debugChannel?.appendLine('no sources');
		return;
	}

	const source = extension.source === 'github' ? extension.source : sources[extension.source!];
	if(!source) {
		debugChannel?.appendLine(`source "${extension.source!}" not found`);
		return;
	}

	const currentVersion = extensionManager.getCurrentVersion(extension.fullName);
	if(!currentVersion) {
		debugChannel?.appendLine('not managed');
		return;
	}

	if(currentVersion === extension.targetVersion) {
		debugChannel?.appendLine('expected version is already installed');
		return;
	}

	const result = await dispatchUpdate(extension, currentVersion, source, TEMPORARY_DIR, debugChannel);

	if(!result) {
		extensionManager.setInstalled(extension.fullName, currentVersion);

		debugChannel?.appendLine('no newer version found');
	}
	else if(typeof result === 'string') {
		extensionManager.setInstalled(extension.fullName, result);

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
} // }}}

async function updateGroup(extension: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, extensionManager: ExtensionManager, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`updating group: ${extension.fullName}`);
	if(!groups) {
		debugChannel?.appendLine('no groups');
		return;
	}

	const extensions = groups[extension.fullName];
	if(!extensions) {
		debugChannel?.appendLine(`group "${extension.fullName}" not found`);
		return;
	}

	for(const extension of extensions) {
		try {
			await updateExtension(extension, sources, groups, extensionManager, debugChannel);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // }}}
