import path from 'path';
import fse from 'fs-extra';
import vscode from 'vscode';
import { CONFIG_KEY, getDebugChannel, GLOBAL_STORAGE } from '../settings';

export async function uninstallExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);
	const debug = config.get<boolean>('debug') ?? false;
	const debugChannel = getDebugChannel(debug);

	if(debugChannel) {
		debugChannel.show(true);
	}

	const extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

	await fse.ensureFile(extensionsFileName);

	const managedExtensions: Record<string, string> = (await fse.readJson(extensionsFileName, { throws: false }) ?? {}) as Record<string, string>;

	for(const extension of Object.keys(managedExtensions)) {
		debugChannel?.appendLine(`uninstalling extension: ${extension}`);

		await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extension);
	}

	await fse.writeJSON(extensionsFileName, {});

	debugChannel?.appendLine('done');
}
