import * as vscode from 'vscode';
import { EXTENSION_NAME } from '../utils/constants.js';

export async function confirmNoWorkspaceMessage() {
	return vscode.window.showInformationMessage(
		`Source: ${EXTENSION_NAME}\n\nNot supported on this workspace.\n\nFirstly, run:\n\`> VSIX Manager: Install extensions\`.`,
		{
			modal: true,
		},
	);
}
