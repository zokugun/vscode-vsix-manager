import * as vscode from 'vscode';
import { EXTENSION_NAME } from '../utils/constants.js';

export async function confirmInstallWorkspaceMessage(): Promise<boolean> {
	const result = await vscode.window.showInformationMessage(
		`Source: ${EXTENSION_NAME}\n\nThe workspace contains a custom extension list.\n\n⚠️ Do you want to install them?`,
		{
			modal: true,
		},
		'Yes',
	);

	return Boolean(result);
}
