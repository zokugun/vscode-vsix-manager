import * as vscode from 'vscode';

export function hasWorkspaceExtensions(config: vscode.WorkspaceConfiguration): boolean {
	const extensions = vscode.workspace.getConfiguration('vsix').inspect('extensions');

	return Array.isArray(extensions?.workspaceValue) && extensions.workspaceValue.length > 0;
}
