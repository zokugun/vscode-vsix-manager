import vscode from 'vscode';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { listExtensions } from '../extensions/list-extensions.js';
import { confirmRestartMessage } from '../modals/confirm-restart-message.js';
import { CONFIG_KEY, EXTENSION_ID } from '../settings.js';
import { type RestartMode } from '../types.js';
import { Logger } from '../utils/logger.js';

export async function uninstallExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	if(!await confirmRestartMessage(config)) {
		return;
	}

	Logger.setup(true);

	const editorExtensions = await listExtensions(EXTENSION_ID);
	if(editorExtensions.fails) {
		Logger.error(editorExtensions.error);
		return;
	}

	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	await extensionManager.startInstallSession();

	const restartMode = config.get<RestartMode>('restart.mode') ?? 'auto';

	const saveResult = await extensionManager.save(restartMode, editorExtensions.value);
	if(saveResult.fails) {
		Logger.error(saveResult.error);
	}
	else {
		Logger.info('done');
	}
}
