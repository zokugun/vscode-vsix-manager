import * as vscode from 'vscode';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { listExtensions } from '../extensions/list-extensions.js';
import { CONFIG_KEY, EXTENSION_ID, getDebugChannel } from '../settings.js';
import { type ExtensionList, type Metadata, type Source } from '../types.js';
import { listSources } from '../utils/list-sources.js';
import { parseMetadata } from '../utils/parse-metadata.js';

type Adopted = { id: string; version: string; enabled: boolean };

export async function adoptExtensions(): Promise<void> {
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
	const groups = config.get<Record<string, unknown[]>>('groups');

	const editorExtensions = await listExtensions(EXTENSION_ID);
	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	const adopteds: Adopted[] = [];

	for(const extension of extensions) {
		await adoptExtension(extension, sources, groups, editorExtensions, extensionManager, adopteds, debugChannel);
	}

	if(adopteds.length === 0) {
		void vscode.window.showInformationMessage('VSIX Manager: no unmanaged extensions.');
	}
	else {
		const result = await vscode.window.showInformationMessage(
			`VSIX Manager will manage:\n${adopteds.map(({ id }) => `\n- ${id}`).join('')}\n\nDo you want to continue?`,
			{
				modal: true,
			},
			'Yes',
		);

		if(!result) {
			return;
		}

		await extensionManager.startAdoptionSession();

		for(const { id, version, enabled } of adopteds) {
			await extensionManager.addInstalled(id, version, enabled, debugChannel);
		}

		await extensionManager.save('none', editorExtensions, debugChannel);
	}

	debugChannel?.appendLine('done');
}

async function adoptExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[], debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				if(await adoptGroup(extension, sources, groups, editorExtensions, extensionManager, adopteds, debugChannel)) {
					return;
				}
			}
			else if(extension.source) {
				if(await adoptExtensionWithSource(extension, sources, groups, editorExtensions, extensionManager, adopteds, debugChannel)) {
					return;
				}
			}
			else {
				if(await adoptExtensionWithoutSource(extension, sources, groups, editorExtensions, extensionManager, adopteds, debugChannel)) {
					return;
				}
			}
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // {{{

async function adoptExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[], debugChannel: vscode.OutputChannel | undefined): Promise<boolean> { // {{{
	if(!sources) {
		debugChannel?.appendLine('no sources');
		return false;
	}

	const source = metadata.source === 'github' ? metadata.source : sources[metadata.source!];
	if(!source) {
		debugChannel?.appendLine(`source "${metadata.source!}" not found`);
		return false;
	}

	const disabled = editorExtensions.disabled.find(({ id }) => id === metadata.fullName);
	const enabled = editorExtensions.enabled.find(({ id }) => id === metadata.fullName);
	const extension = disabled ?? enabled;

	if(!extension) {
		return false;
	}

	const currentVersion = extensionManager.getCurrentVersion(metadata.fullName);

	if(currentVersion) {
		return true;
	}

	debugChannel?.appendLine(`found adoption candidate: ${metadata.source!}:${metadata.fullName}`);

	adopteds.push({ enabled: Boolean(enabled), ...extension });

	return true;
} // }}}

async function adoptExtensionWithoutSource(metadata: Metadata, _sources: Record<string, Source> | undefined, _groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[], debugChannel: vscode.OutputChannel | undefined): Promise<boolean> { // {{{
	const disabled = editorExtensions.disabled.find(({ id }) => id === metadata.fullName);
	const enabled = editorExtensions.enabled.find(({ id }) => id === metadata.fullName);
	const extension = disabled ?? enabled;

	if(!extension) {
		return false;
	}

	const currentVersion = extensionManager.getCurrentVersion(metadata.fullName);

	if(currentVersion) {
		return true;
	}

	debugChannel?.appendLine(`found adoption candidate: ${metadata.source!}:${metadata.fullName}`);

	adopteds.push({ enabled: Boolean(enabled), ...extension });

	return true;
} // }}}

async function adoptGroup(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[], debugChannel: vscode.OutputChannel | undefined): Promise<boolean> { // {{{
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
		await adoptExtension(extension, sources, groups, editorExtensions, extensionManager, adopteds, debugChannel);
	}

	return true;
} // }}}
