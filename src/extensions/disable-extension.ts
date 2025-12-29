import vscode from 'vscode';

export async function disableExtension(id: string, debugChannel: vscode.OutputChannel | undefined): Promise<boolean> {
	debugChannel?.appendLine(`disable: ${id}`);

	try {
		await vscode.commands.executeCommand('workbench.extensions.disableExtension', id);

		return true;
	}
	catch {
		return false;
	}
}
