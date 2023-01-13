import vscode from 'vscode';
import { installFileSystem } from '../sources/filesystem';
import { installMarketplace } from '../sources/marketplace';
import { Source } from './types';

export async function dispatchInstall(extensionName: string, source: Source, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> {
	if(source.type === 'file') {
		return installFileSystem(extensionName, source, temporaryDir, debugChannel);
	}

	if(source.type === 'marketplace') {
		return installMarketplace(extensionName, source, temporaryDir, debugChannel);
	}
}
