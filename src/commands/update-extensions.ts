import path from 'path';
import fse from 'fs-extra';
import vscode from 'vscode';
import { CONFIG_KEY, getDebugChannel, GLOBAL_STORAGE, TEMPORARY_DIR } from '../settings';
import { dispatchUpdate } from '../utils/dispatch-update';
import { listSources } from '../utils/list-sources';
import { parse } from '../utils/parse';
import { Extension, Source } from '../utils/types';

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

	const extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

	await fse.ensureFile(extensionsFileName);

	const managedExtensions: Record<string, string> = (await fse.readJson(extensionsFileName, { throws: false }) ?? {}) as Record<string, string>;

	for(const extension of extensions) {
		await updateExtension(extension, sources, groups, managedExtensions, debugChannel);
	}

	await fse.writeJSON(extensionsFileName, managedExtensions);

	debugChannel?.appendLine('done');
}

async function updateExtension(data: unknown, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, managedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	for(const extension of parse(data)) {
		try {
			if(extension.kind === 'group') {
				await updateGroup(extension, sources, groups, managedExtensions, debugChannel);
			}
			else if(managedExtensions[extension.fullName]) {
				if(extension.source) {
					await updateExtensionWithSource(extension, sources, groups, managedExtensions, debugChannel);
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

async function updateExtensionWithSource(extension: Extension, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, managedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`updating extension: ${extension.source!}:${extension.fullName}`);

	if(!sources) {
		debugChannel?.appendLine('no sources');
		return;
	}

	const source = extension.source === 'github' ? extension.source : sources[extension.source!];
	if(!source) {
		debugChannel?.appendLine(`source "${extension.source!}" not found`);
		return;
	}

	const currentVersion = managedExtensions[extension.fullName];
	if(!currentVersion) {
		debugChannel?.appendLine('not managed');
		return;
	}

	const result = await dispatchUpdate(extension.fullName, currentVersion, source, TEMPORARY_DIR, debugChannel);

	if(!result) {
		managedExtensions[extension.fullName] = currentVersion;

		debugChannel?.appendLine('no newer version found');
	}
	else if(typeof result === 'string') {
		managedExtensions[extension.fullName] = result;

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
} // }}}

async function updateGroup(extension: Extension, sources: Record<string, Source> | undefined, groups: Record<string, unknown[]> | undefined, managedExtensions: Record<string, string>, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
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
			await updateExtension(extension, sources, groups, managedExtensions, debugChannel);
		}
		catch (error: unknown) {
			debugChannel?.appendLine(String(error));
		}
	}
} // }}}
