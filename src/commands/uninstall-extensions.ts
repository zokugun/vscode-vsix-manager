import vscode from 'vscode';
import { CONFIG_KEY, EXTENSION_ID, getDebugChannel } from '../settings.js';
import { ExtensionManager } from '../utils/extension-manager.js';
import { listExtensions } from '../utils/list-extensions.js';
import { showRestartModal } from '../utils/show-restart-modal.js';
import { type RestartMode } from '../utils/types.js';

export async function uninstallExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	if(!await showRestartModal(config)) {
		return;
	}

	const debug = config.get<boolean>('debug') ?? false;
	const debugChannel = getDebugChannel(debug);

	if(debugChannel) {
		debugChannel.show(true);
	}

	const editorExtensions = await listExtensions(EXTENSION_ID);
	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	await extensionManager.startInstallSession();

	const restartMode = config.get<RestartMode>('restart.mode') ?? 'auto';

	await extensionManager.save(restartMode, editorExtensions, debugChannel);

	debugChannel?.appendLine('done');
}
