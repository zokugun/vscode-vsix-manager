import vscode from 'vscode';
import { updateFileSystem } from '../sources/filesystem';
import { updateMarketplace } from '../sources/marketplace';
import { Source } from './types';

export async function dispatchUpdate(extensionName: string, currentVersion: string, source: Source, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> {
	if(source.type === 'file') {
		return updateFileSystem(extensionName, currentVersion, source, temporaryDir, debugChannel);
	}

	if(source.type === 'marketplace') {
		return updateMarketplace(extensionName, currentVersion, source, temporaryDir, debugChannel);
	}
}
