import path from 'path';
import fse from 'fs-extra';
import vscode from 'vscode';
import { CONFIG_KEY, getDebugChannel, GLOBAL_STORAGE, TEMPORARY_DIR } from '../settings';
import { dispatchUpdate } from '../utils/dispatch-update';
import { listSources } from '../utils/list-sources';
import { Source } from '../utils/types';

export async function updateExtensions(): Promise<void> {
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

	const sources = listSources(config);
	const groups = config.get<Record<string, string[]>>('groups');

	const extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

	await fse.ensureFile(extensionsFileName);

	const managedExtensions: Record<string, string> = (await fse.readJson(extensionsFileName, { throws: false }) ?? {}) as Record<string, string>;

	for(const extension of extensions) {
		try {
			await updateExtension(extension, sources, groups, managedExtensions, debugChannel);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}

	await fse.writeJSON(extensionsFileName, managedExtensions);
}

async function updateExtension(extension: string, sources: Record<string, Source> | undefined, groups: Record<string, string[]> | undefined, managedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`updating extension: ${extension}`);

	if(extension.includes(':')) {
		if(!sources) {
			debugChannel?.appendLine('no sources');
			return;
		}

		const [sourceName, extensionName] = extension.split(':');

		const source = sourceName === 'github' ? sourceName : sources[sourceName];
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

		const result = await dispatchUpdate(extensionName, currentVersion, source, TEMPORARY_DIR, debugChannel);
		if(!result) {
			managedExtensions[extensionName] = currentVersion;

			debugChannel?.appendLine('no newer version found');
		}
		else if(typeof result === 'string') {
			managedExtensions[extensionName] = result;

			debugChannel?.appendLine(`updated to version: ${result}`);
		}
		else if(result.updated) {
			managedExtensions[result.name] = result.version;

			debugChannel?.appendLine(`updated to version: ${result.version}`);
		}
		else {
			managedExtensions[result.name] = result.version;

			debugChannel?.appendLine('no newer version found');
		}
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
			await updateExtension(extension, sources, groups, managedExtensions, debugChannel);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // }}}
