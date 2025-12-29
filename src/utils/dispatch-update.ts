import type vscode from 'vscode';
import { updateFileSystem } from '../sources/filesystem.js';
import * as Forgejo from '../sources/forgejo.js';
import * as Git from '../sources/git.js';
import * as GitHub from '../sources/github.js';
import { updateMarketplace } from '../sources/marketplace.js';
import type { Metadata, Source, UpdateResult } from '../types.js';

export async function dispatchUpdate(extension: Metadata, currentVersion: string, source: Source, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> {
	if(source === 'github') {
		return Git.update(extension, currentVersion, undefined, GitHub, temporaryDir, debugChannel);
	}

	if(source.type === 'file') {
		return updateFileSystem(extension, currentVersion, source, debugChannel);
	}

	if(source.type === 'forgejo') {
		return Git.update(extension, currentVersion, source, Forgejo, temporaryDir, debugChannel);
	}

	if(source.type === 'github') {
		return Git.update(extension, currentVersion, source, GitHub, temporaryDir, debugChannel);
	}

	if(source.type === 'marketplace') {
		return updateMarketplace(extension, currentVersion, source, temporaryDir, debugChannel);
	}
}
