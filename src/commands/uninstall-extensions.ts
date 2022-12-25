import path from 'path';
import fse from 'fs-extra';
import vscode from 'vscode';
import { CONFIG_KEY, getDebugChannel, GLOBAL_STORAGE } from '../settings';
import { Source } from '../utils/types';

export async function uninstallExtensions(): Promise<void> {
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

	const extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

	await fse.ensureFile(extensionsFileName);

	const managedExtensions: Record<string, string> = (await fse.readJson(extensionsFileName, { throws: false }) ?? {}) as Record<string, string>;

	for(const extension of extensions) {
		try {
			await uninstallExtension(extension, sources, groups, managedExtensions, debugChannel);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}

	await fse.writeJSON(extensionsFileName, []);
}

async function uninstallExtension(extension: string, sources: Record<string, Source> | undefined, groups: Record<string, string[]> | undefined, managedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`uninstalling extension: ${extension}`);

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

		const currentVersion = managedExtensions[extensionName];
		if(!currentVersion) {
			debugChannel?.appendLine('not managed');
			return;
		}

		await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extensionName);
	}
	else if(extension.includes('.')) {
		// skip, managed by the editor
	}
	else {
		await updateGroup(extension, sources, groups, managedExtensions, debugChannel);
	}
} // }}}

async function updateGroup(groupName: string, sources: Record<string, Source> | undefined, groups: Record<string, string[]> | undefined, managedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`updating group: ${groupName}`);
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
			await uninstallExtension(extension, sources, groups, managedExtensions, debugChannel);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // }}}
