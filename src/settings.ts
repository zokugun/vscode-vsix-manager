import path from 'path';
import fse from 'fs-extra';
import vscode from 'vscode';

export const CONFIG_KEY = 'vsix';
/* eslint-disable import/no-mutable-exports, @typescript-eslint/naming-convention */
export let EXTENSION_ID: string = '';
export let GLOBAL_STORAGE: string = '';
export let TEMPORARY_DIR: string = '';
/* eslint-enable */

let $channel: vscode.OutputChannel | null = null;

export function getDebugChannel(debug: boolean): vscode.OutputChannel | undefined { // {{{
	if(debug) {
		$channel ||= vscode.window.createOutputChannel('VSIX Manager');

		return $channel;
	}

	return undefined;
} // }}}

export async function setupSettings(context: vscode.ExtensionContext) {
	EXTENSION_ID = context.extension.id;
	GLOBAL_STORAGE = context.globalStorageUri.fsPath;
	TEMPORARY_DIR = path.join(GLOBAL_STORAGE, 'temp');

	await fse.ensureDir(TEMPORARY_DIR);
}
