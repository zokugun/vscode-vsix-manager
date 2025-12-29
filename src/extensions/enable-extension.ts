import vscode from 'vscode';

export async function enableExtension(id: string, debugChannel: vscode.OutputChannel | undefined): Promise<boolean> {
	debugChannel?.appendLine(`enable: ${id}`);

	try {
		await vscode.commands.executeCommand('workbench.extensions.enableExtension', id);

		return true;
	}
	catch {
		return false;
	}
}
