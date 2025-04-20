import type vscode from 'vscode';
import { updateFileSystem } from '../sources/filesystem.js';
import * as Forgejo from '../sources/forgejo.js';
import * as Git from '../sources/git.js';
import * as GitHub from '../sources/github.js';
import { updateMarketplace } from '../sources/marketplace.js';
import type { Source, UpdateResult } from './types.js';

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
