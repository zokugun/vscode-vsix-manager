import path from 'path';
import fse from 'fs-extra';
import vscode from 'vscode';
import { CONFIG_KEY, EXTENSION_ID, getDebugChannel, GLOBAL_STORAGE, TEMPORARY_DIR } from '../settings';
import { dispatchInstall } from '../utils/dispatch-install';
import { dispatchUpdate } from '../utils/dispatch-update';
import { listExtensions } from '../utils/list-extensions';
import { listSources } from '../utils/list-sources';
import { parse } from '../utils/parse';
import { Extension, ExtensionList, Source } from '../utils/types';

export async function installExtensions(update: boolean = false): Promise<void> {
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
	const extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

	await fse.ensureFile(extensionsFileName);

	const managedExtensions: Record<string, string> = (await fse.readJson(extensionsFileName, { throws: false }) ?? {}) as Record<string, string>;
	const installedExtensions: Record<string, string> = {};

	for(const extension of extensions) {
		await installExtension(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update);
	}

	for(const extension in managedExtensions) {
		if(!installedExtensions[extension]) {
			try {
				await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extension);
			}
			catch {
			}
		}
	}

	await fse.writeJSON(extensionsFileName, installedExtensions);

	debugChannel?.appendLine('done');
}

async function installExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, managedExtensions: Record<string, string>, installedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<void> { // {{{
	for(const extension of parse(data)) {
		try {
			if(extension.kind === 'group') {
				if(await installGroup(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update)) {
					return;
				}
			}
			else if(extension.source) {
				if(await installExtensionWithSource(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update)) {
					return;
				}
			}
			else {
				if(await installExtensionWithoutSource(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update)) {
					return;
				}
			}
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // {{{

async function installExtensionWithSource(extension: Extension, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, managedExtensions: Record<string, string>, installedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<boolean> { // {{{
	debugChannel?.appendLine(`installing extension: ${extension.source!}:${extension.fullName}`);

	if(!sources) {
		debugChannel?.appendLine('no sources');
		return false;
	}

	const source = extension.source === 'github' ? extension.source : sources[extension.source!];
	if(!source) {
		debugChannel?.appendLine(`source "${extension.source!}" not found`);
		return false;
	}

	if(editorExtensions.disabled.includes(extension.fullName) || editorExtensions.enabled.includes(extension.fullName)) {
		const currentVersion = managedExtensions[extension.fullName];

		if(update && currentVersion) {
			const result = await dispatchUpdate(extension.fullName, currentVersion, source, TEMPORARY_DIR, debugChannel);
			if(!result) {
				installedExtensions[extension.fullName] = currentVersion;

				debugChannel?.appendLine('no newer version found');
			}
			else if(typeof result === 'string') {
				installedExtensions[extension.fullName] = result;

				debugChannel?.appendLine(`updated to version: ${result}`);
			}
			else if(result.updated) {
				installedExtensions[result.name] = result.version;

				debugChannel?.appendLine(`updated to version: ${result.version}`);
			}
			else {
				installedExtensions[result.name] = result.version;

				debugChannel?.appendLine('no newer version found');
			}
		}
		else {
			if(currentVersion) { // not null if the extension is managed by the manager
				installedExtensions[extension.fullName] = currentVersion;
			}

			debugChannel?.appendLine('already installed');
		}

		return true;
	}

	const result = await dispatchInstall(extension.fullName, source, TEMPORARY_DIR, debugChannel);

	if(!result) {
		debugChannel?.appendLine('not found');
	}
	else if(typeof result === 'string') {
		installedExtensions[extension.fullName] = result;

		debugChannel?.appendLine(`installed version: ${result}`);
	}
	else {
		installedExtensions[result.name] = result.version;

		debugChannel?.appendLine(`installed version: ${result.version}`);
	}

	return true;
} // }}}

async function installExtensionWithoutSource(extension: Extension, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, managedExtensions: Record<string, string>, installedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined, _update: boolean): Promise<boolean> { // {{{
	debugChannel?.appendLine(`installing extension: ${extension.fullName}`);

	if(editorExtensions.disabled.includes(extension.fullName) || editorExtensions.enabled.includes(extension.fullName)) {
		const currentVersion = managedExtensions[extension.fullName];

		installedExtensions[extension.fullName] = currentVersion ?? '0.0.0'; // can be null if the extension hasn't been installed by the manager

		debugChannel?.appendLine('already installed');
	}
	else {
		await vscode.commands.executeCommand('workbench.extensions.installExtension', extension.fullName);

		installedExtensions[extension.fullName] = '0.0.0'; // unknown version

		debugChannel?.appendLine('installed');
	}

	return true;
} // }}}

async function installGroup(extension: Extension, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, editorExtensions: ExtensionList, managedExtensions: Record<string, string>, installedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<boolean> { // {{{
	debugChannel?.appendLine(`installing group: ${extension.fullName}`);
	if(!groups) {
		debugChannel?.appendLine('no groups');
		return false;
	}

	const extensions = groups[extension.fullName];
	if(!extensions) {
		debugChannel?.appendLine(`group "${extension.fullName}" not found`);
		return false;
	}

	for(const extension of extensions) {
		await installExtension(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update);
	}

	return true;
} // }}}
