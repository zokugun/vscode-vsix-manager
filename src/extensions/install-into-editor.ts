import fse from '@zokugun/fs-extra-plus/async';
import { err, OK, type Result } from '@zokugun/xtry';
import vscode from 'vscode';
import { type SearchResult } from '../types.js';

export async function installIntoEditor(result: SearchResult): Promise<Result<void, string>> {
	await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(result.file));

	if(result.unlink) {
		const unlinkResult = await fse.unlink(result.unlink);
		if(unlinkResult.fails) {
			return err(`Cannot delete ${result.unlink}`);
		}
	}

	return OK;
}
