import * as vscode from 'vscode';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { listExtensions } from '../extensions/list-extensions.js';
import { CONFIG_KEY, EXTENSION_ID } from '../settings.js';
import { type ExtensionList, type Metadata, type Source } from '../types.js';
import { Logger } from '../utils/logger.js';
import { parseMetadata } from '../utils/parse-metadata.js';

type Adopted = { id: string; version: string; enabled: boolean };

export async function adoptExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

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

	const adopteds: Adopted[] = [];

	for(const extension of extensions) {
		await adoptExtension(extension, sources, groups, editorExtensions.value, extensionManager, adopteds);
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
			await extensionManager.addInstalled(id, version, enabled);
		}

		const saveResult = await extensionManager.save('none', editorExtensions.value);
		if(saveResult.fails) {
			Logger.error(saveResult.error);
			return;
		}
	}

	Logger.info('done');
}

async function adoptExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				if(await adoptGroup(extension, sources, groups, editorExtensions, extensionManager, adopteds)) {
					return;
				}
			}
			else if(extension.source) {
				if(await adoptExtensionWithSource(extension, sources, groups, editorExtensions, extensionManager, adopteds)) {
					return;
				}
			}
			else {
				if(await adoptExtensionWithoutSource(extension, sources, groups, editorExtensions, extensionManager, adopteds)) {
					return;
				}
			}
		}
		catch (error: unknown) {
			Logger.error(error);
		}
	}
} // {{{

async function adoptExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<boolean> { // {{{
	if(!sources) {
		Logger.info('no sources');
		return false;
	}

	const source = metadata.source === 'github' ? metadata.source : sources[metadata.source!];
	if(!source) {
		Logger.info(`source "${metadata.source!}" not found`);
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

	Logger.info(`found adoption candidate: ${metadata.source!}:${metadata.fullName}`);

	adopteds.push({ enabled: Boolean(enabled), ...extension });

	return true;
} // }}}

async function adoptExtensionWithoutSource(metadata: Metadata, _sources: Record<string, Source> | undefined, _groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<boolean> { // {{{
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

	Logger.info(`found adoption candidate: ${metadata.source!}:${metadata.fullName}`);

	adopteds.push({ enabled: Boolean(enabled), ...extension });

	return true;
} // }}}

async function adoptGroup(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<boolean> { // {{{
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
		await adoptExtension(extension, sources, groups, editorExtensions, extensionManager, adopteds);
	}

	return true;
} // }}}
