import * as vscode from 'vscode';
import { EXTENSION_NAME } from '../utils/constants.js';

export async function confirmRestartMessage(config: vscode.WorkspaceConfiguration): Promise<boolean> {
	const confirm = config.get<boolean>('restart.confirm') ?? true;

	if(!confirm) {
		return true;
	}

	const result = await vscode.window.showInformationMessage(
		`Source: ${EXTENSION_NAME}\n\nThe editor might restart or reload. Do you want to continue?`,
		{
			modal: true,
		},
		'Yes',
	);

	return Boolean(result);
}
