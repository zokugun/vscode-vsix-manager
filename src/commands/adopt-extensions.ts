import * as vscode from 'vscode';
import { loadAliases } from '../aliases/load-aliases.js';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { hasWorkspaceExtensions } from '../extensions/has-workspace-extensions.js';
import { isConfiguredWorkspace } from '../extensions/is-configured-workspace.js';
import { resolveExtensionName } from '../extensions/resolve-extension-name.js';
import { confirmNoWorkspaceMessage } from '../modals/confirm-no-workspace-message.js';
import { CONFIG_KEY } from '../settings.js';
import { type Aliases, type ManagerMode, type Metadata, type Source } from '../types.js';
import { FileLock } from '../utils/file-lock.js';
import { Logger } from '../utils/logger.js';
import { parseMetadata } from '../utils/parse-metadata.js';

type Adopted = { id: string; version: string; enabled: boolean; mode: ManagerMode };

export async function adoptExtensions(): Promise<void> {
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

	const aliases = await loadAliases();

	const adopteds: Adopted[] = [];

	if(extensions.globalValue) {
		await adoptAllExtensions(extensions.globalValue, sources?.globalValue, groups?.globalValue, 'global', aliases, extensionManager, adopteds);
	}

	if(mode === 'workspace') {
		const sources = config.get<Record<string, Source>>('sources');
		const groups = config.get<Record<string, unknown[]>>('groups');

		await adoptAllExtensions(extensions.workspaceValue!, sources, groups, 'workspace', aliases, extensionManager, adopteds);
	}

	Logger.debug(JSON.stringify(adopteds));

	if(adopteds.length === 0) {
		await lock.value.release();

		void vscode.window.showInformationMessage('VSIX Manager: no unmanaged extensions.');

		Logger.info('done');
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
			await lock.value.release();
			return;
		}

		await extensionManager.startSession(() => true);

		for(const { id, version, enabled, mode } of adopteds) {
			await extensionManager.addInstalled(id, version, enabled, mode);
		}

		const saveResult = await extensionManager.save('none');

		await lock.value.release();

		if(saveResult.fails) {
			Logger.error(saveResult.error);
		}
		else {
			Logger.info('done');
		}
	}
}

async function adoptAllExtensions(extensions: unknown[], sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<void> { // {{{
	for(const extension of extensions) {
		await adoptExtension(extension, sources, groups, mode, aliases, extensionManager, adopteds);
	}
} // }}}

async function adoptExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<void> { // {{{
	for(const extension of parseMetadata(data)) {
		try {
			if(extension.kind === 'group') {
				if(await adoptGroup(extension, sources, groups, mode, aliases, extensionManager, adopteds)) {
					return;
				}
			}
			else if(extension.source) {
				if(await adoptExtensionWithSource(extension, sources, groups, mode, aliases, extensionManager, adopteds)) {
					return;
				}
			}
			else {
				if(await adoptExtensionWithoutSource(extension, sources, groups, mode, aliases, extensionManager, adopteds)) {
					return;
				}
			}
		}
		catch (error: unknown) {
			Logger.error(error);
		}
	}
} // {{{

async function adoptExtensionWithSource(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<boolean> { // {{{
	if(!sources) {
		Logger.info('no sources');
		return false;
	}

	const source = metadata.source === 'github' ? metadata.source : sources[metadata.source!];
	if(!source) {
		Logger.info(`source "${metadata.source!}" not found`);
		return false;
	}

	const extensionName = resolveExtensionName(metadata, source, aliases);
	const disabled = extensionManager.getDisabledInEditor(extensionName);
	const enabled = extensionManager.getEnabledInEditor(extensionName);
	const extension = disabled ?? enabled;

	if(!extension) {
		return false;
	}

	if(extensionManager.isManaged(extensionName, mode)) {
		return true;
	}

	Logger.info(`found adoption candidate: ${metadata.source!}:${metadata.fullName}`);

	adopteds.push({ ...extension, enabled: Boolean(enabled), mode });

	return true;
} // }}}

async function adoptExtensionWithoutSource(metadata: Metadata, _sources: Record<string, Source> | undefined, _groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<boolean> { // {{{
	const disabled = extensionManager.getDisabledInEditor(metadata.fullName);
	const enabled = extensionManager.getEnabledInEditor(metadata.fullName);
	const extension = disabled ?? enabled;

	if(!extension) {
		return false;
	}

	if(extensionManager.isManaged(metadata.fullName, mode)) {
		return true;
	}

	Logger.info(`found adoption candidate: ${metadata.source!}:${metadata.fullName}`);

	adopteds.push({ ...extension, enabled: Boolean(enabled), mode });

	return true;
} // }}}

async function adoptGroup(metadata: Metadata, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, mode: ManagerMode, aliases: Aliases, extensionManager: ExtensionManager, adopteds: Adopted[]): Promise<boolean> { // {{{
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
		await adoptExtension(extension, sources, groups, mode, aliases, extensionManager, adopteds);
	}

	return true;
} // }}}
