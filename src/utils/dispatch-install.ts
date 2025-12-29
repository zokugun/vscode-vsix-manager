import type vscode from 'vscode';
import { installFileSystem } from '../sources/filesystem.js';
import * as Forgejo from '../sources/forgejo.js';
import * as Git from '../sources/git.js';
import * as GitHub from '../sources/github.js';
import { installMarketplace } from '../sources/marketplace.js';
import type { InstallResult, Metadata, Source } from '../types.js';

export async function dispatchInstall(metadata: Metadata, source: Source, sources: Record<string, Source> | undefined, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> {
	if(source === 'github') {
		return Git.install(metadata, undefined, GitHub, temporaryDir, debugChannel);
	}

	try {
		let result: InstallResult;

		if(source.type === 'file') {
			result = await installFileSystem(metadata, source, debugChannel);
		}

		if(source.type === 'forgejo') {
			result = await Git.install(metadata, source, Forgejo, temporaryDir, debugChannel);
		}

		if(source.type === 'github') {
			result = await Git.install(metadata, source, GitHub, temporaryDir, debugChannel);
		}

		if(source.type === 'marketplace') {
			result = await installMarketplace(metadata, source, sources!, temporaryDir, debugChannel);
		}

		if(result) {
			return result;
		}
	}
	catch (error: unknown) {
		debugChannel?.appendLine(String(error));
	}

	if(source.fallback) {
		const newSource = sources![source.fallback];

		if(newSource) {
			debugChannel?.appendLine(`installing extension: ${source.fallback}:${metadata.fullName}`);

			return dispatchInstall(metadata, newSource, sources, temporaryDir, debugChannel);
		}
	}
}
