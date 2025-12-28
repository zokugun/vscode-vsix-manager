import * as vscode from 'vscode';

export async function showRestartModal(config: vscode.WorkspaceConfiguration): Promise<boolean> {
	const confirm = config.get<boolean>('restart.confirm') ?? true;

	if(!confirm) {
		return true;
	}

	const result = await vscode.window.showInformationMessage(
		'The editor might restart or reload. Do you want to continue?',
		{
			modal: true,
		},
		'Yes',
	);

	return Boolean(result);
}
