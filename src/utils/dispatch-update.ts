import vscode from 'vscode';
import { updateFileSystem } from '../sources/filesystem';
import * as Forgejo from '../sources/forgejo';
import * as Git from '../sources/git';
import * as GitHub from '../sources/github';
import { updateMarketplace } from '../sources/marketplace';
import { Source, UpdateResult } from './types';

export async function dispatchUpdate(extensionName: string, currentVersion: string, source: Source, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> {
	if(source === 'github') {
		return Git.update(extensionName, currentVersion, undefined, GitHub, temporaryDir, debugChannel);
	}

	if(source.type === 'file') {
		return updateFileSystem(extensionName, currentVersion, source, debugChannel);
	}

	if(source.type === 'forgejo') {
		return Git.update(extensionName, currentVersion, source, Forgejo, temporaryDir, debugChannel);
	}

	if(source.type === 'github') {
		return Git.update(extensionName, currentVersion, source, GitHub, temporaryDir, debugChannel);
	}

	if(source.type === 'marketplace') {
		return updateMarketplace(extensionName, currentVersion, source, temporaryDir, debugChannel);
	}
}
