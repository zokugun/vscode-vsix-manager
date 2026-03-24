import vscode from 'vscode';
import { ExtensionManager } from '../extensions/extension-manager.js';
import { confirmRestartMessage } from '../modals/confirm-restart-message.js';
import { CONFIG_KEY } from '../settings.js';
import { type RestartMode } from '../types.js';
import { FileLock } from '../utils/file-lock.js';
import { Logger } from '../utils/logger.js';

export async function uninstallExtensions(): Promise<void> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	if(!await confirmRestartMessage(config)) {
		return;
	}

	Logger.setup(true);

	const lock = await FileLock.acquire();
	if(lock.fails) {
		Logger.error(lock.error);
		return;
	}

	const extensionManager = new ExtensionManager('global');

	await extensionManager.load();

	await extensionManager.startSession();

	const restartMode = config.get<RestartMode>('restart.mode') ?? 'auto';

	const saveResult = await extensionManager.save(restartMode);

	await lock.value.release();

	if(saveResult.fails) {
		Logger.error(saveResult.error);
	}
	else {
		Logger.info('done');
	}
}
