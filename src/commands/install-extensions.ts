import path from 'path';
import fse from 'fs-extra';
import vscode from 'vscode';
import { CONFIG_KEY, EXTENSION_ID, getDebugChannel, GLOBAL_STORAGE, TEMPORARY_DIR } from '../settings';
import { installMarketplace, updateMarketplace } from '../sources/marketplace';
import { listExtensions } from '../utils/list-extensions';
import { ExtensionList, Source } from '../utils/types';

export async function installExtensions(update: boolean = false): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);
	const debug = config.get<boolean>('debug') ?? false;
	const debugChannel = getDebugChannel(debug);

	if(debugChannel) {
		debugChannel.show(true);
	}

	const extensions = config.get<string[]>('extensions');
	if(!extensions) {
		return;
	}

	const sources = config.get<Record<string, Source>>('sources');
	const groups = config.get<Record<string, string[]>>('groups');

	const editorExtensions = await listExtensions(EXTENSION_ID);
	const extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

	await fse.ensureFile(extensionsFileName);

	const managedExtensions: Record<string, string> = (await fse.readJson(extensionsFileName, { throws: false }) ?? {}) as Record<string, string>;
	const installedExtensions: Record<string, string> = {};

	for(const extension of extensions) {
		try {
			await installExtension(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
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
}

async function installExtension(extension: string, sources: Record<string, Source> | undefined, groups: Record<string, string[]> | undefined, editorExtensions: ExtensionList, managedExtensions: Record<string, string>, installedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<void> { // {{{
	debugChannel?.appendLine(`installing extension: ${extension}`);

	if(extension.includes(':')) {
		if(!sources) {
			debugChannel?.appendLine('no sources');
			return;
		}

		const [sourceName, extensionName] = extension.split(':');

		const source = sources[sourceName];
		if(!source) {
			debugChannel?.appendLine(`source "${sourceName}" not found`);
			return;
		}

		if(!extensionName) {
			return;
		}

		if(editorExtensions.disabled.includes(extensionName) || editorExtensions.enabled.includes(extensionName)) {
			const currentVersion = managedExtensions[extensionName];

			if(update && currentVersion) {
				const version = await updateMarketplace(extensionName, currentVersion, source, TEMPORARY_DIR, debugChannel);
				if(version) {
					installedExtensions[extensionName] = version;

					debugChannel?.appendLine(`updated to version: ${version}`);
				}
				else {
					debugChannel?.appendLine('no newer version found');
				}
			}
			else {
				if(currentVersion) {
					installedExtensions[extensionName] = currentVersion;
				}

				debugChannel?.appendLine('already installed');
				return;
			}
		}

		if(source.kind === 'marketplace') {
			const version = await installMarketplace(extensionName, source, TEMPORARY_DIR, debugChannel);
			if(version) {
				installedExtensions[extensionName] = version;

				debugChannel?.appendLine(`installed version: ${version}`);
			}
			else {
				debugChannel?.appendLine('not found');
			}
		}
	}
	else if(extension.includes('.')) {
		if(editorExtensions.disabled.includes(extension) || editorExtensions.enabled.includes(extension)) {
			debugChannel?.appendLine('already installed');
			return;
		}

		await vscode.commands.executeCommand('workbench.extensions.installExtension', extension);

		debugChannel?.appendLine('installed');
	}
	else {
		await installGroup(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update);
	}
} // }}}

async function installGroup(groupName: string, sources: Record<string, Source> | undefined, groups: Record<string, string[]> | undefined, editorExtensions: ExtensionList, managedExtensions: Record<string, string>, installedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined, update: boolean): Promise<void> { // {{{
	debugChannel?.appendLine(`installing group: ${groupName}`);
	if(!groups) {
		debugChannel?.appendLine('no groups');
		return;
	}

	const extensions = groups[groupName];
	if(!extensions) {
		debugChannel?.appendLine(`group "${groupName}" not found`);
		return;
	}

	for(const extension of extensions) {
		try {
			await installExtension(extension, sources, groups, editorExtensions, managedExtensions, installedExtensions, debugChannel, update);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // }}}
