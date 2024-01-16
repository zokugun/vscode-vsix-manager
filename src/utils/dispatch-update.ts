import vscode from 'vscode';
import { updateFileSystem } from '../sources/filesystem';
import { updateGitHub } from '../sources/github';
import { updateMarketplace } from '../sources/marketplace';
import { Source, UpdateResult } from './types';

export async function dispatchUpdate(extensionName: string, currentVersion: string, source: Source, temporaryDir: string, targetPlatform: string | null, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> {
	if(source === 'github') {
		return updateGitHub(extensionName, currentVersion, temporaryDir, debugChannel);
	}

	if(source.type === 'file') {
		return updateFileSystem(extensionName, currentVersion, source, debugChannel);
	}

	if(source.type === 'marketplace') {
		return updateMarketplace(extensionName, currentVersion, source, temporaryDir, targetPlatform, debugChannel);
	}
}
