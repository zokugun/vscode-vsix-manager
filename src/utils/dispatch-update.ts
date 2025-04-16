import vscode from 'vscode';
import { updateFileSystem } from '../sources/filesystem';
import { updateForgejo } from '../sources/forgejo';
import { updateGitHub } from '../sources/github';
import { updateMarketplace } from '../sources/marketplace';
import { Source, UpdateResult } from './types';

export async function dispatchUpdate(extensionName: string, currentVersion: string, source: Source, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> {
	if(source === 'github') {
		return updateGitHub(extensionName, currentVersion, undefined, temporaryDir, debugChannel);
	}

	if(source.type === 'file') {
		return updateFileSystem(extensionName, currentVersion, source, debugChannel);
	}

	if(source.type === 'forgejo') {
		return updateForgejo(extensionName, currentVersion, source, temporaryDir, debugChannel);
	}

	if(source.type === 'github') {
		return updateGitHub(extensionName, currentVersion, source, temporaryDir, debugChannel);
	}

	if(source.type === 'marketplace') {
		return updateMarketplace(extensionName, currentVersion, source, temporaryDir, debugChannel);
	}
}
