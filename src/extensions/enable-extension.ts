import vscode from 'vscode';
import { Logger } from '../utils/logger.js';

export async function enableExtension(id: string): Promise<boolean> {
	Logger.info(`enable: ${id}`);

	try {
		await vscode.commands.executeCommand('workbench.extensions.enableExtension', id);

		return true;
	}
	catch {
		return false;
	}
}
