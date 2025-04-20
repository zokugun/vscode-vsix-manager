import vscode from 'vscode';
import { CONFIG_KEY, EXTENSION_ID, getDebugChannel } from '../settings.js';
import { ExtensionManager } from '../utils/extension-manager.js';
import { listExtensions } from '../utils/list-extensions.js';
import { type RestartMode } from '../utils/types.js';

export async function uninstallExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);
	const debug = config.get<boolean>('debug') ?? false;
	const debugChannel = getDebugChannel(debug);

	if(debugChannel) {
		debugChannel.show(true);
	}

	const editorExtensions = await listExtensions(EXTENSION_ID);
	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	await extensionManager.startInstallSession();

	const restartMode = config.get<RestartMode>('restartMode') ?? 'auto';

	await extensionManager.save(restartMode, editorExtensions, debugChannel);

	debugChannel?.appendLine('done');
}
