import vscode from 'vscode';
import { installFileSystem } from '../sources/filesystem';
import { installGitHub } from '../sources/github';
import { installMarketplace } from '../sources/marketplace';
import { InstallResult, Source } from './types';

export async function dispatchInstall(extensionName: string, source: Source, sources: Record<string, Source> | undefined, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> {
	if(source === 'github') {
		return installGitHub(extensionName, temporaryDir, debugChannel);
	}

	let result: InstallResult;

	if(source.type === 'file') {
		result = await installFileSystem(extensionName, source, debugChannel);
	}

	if(source.type === 'marketplace') {
		result = await installMarketplace(extensionName, source, sources!, temporaryDir, debugChannel);
	}

	if(result) {
		return result;
	}

	if(source.fallback) {
		const newSource = sources![source.fallback];

		if(newSource) {
			debugChannel?.appendLine(`installing extension: ${source.fallback}:${extensionName}`);

			return dispatchInstall(extensionName, newSource, sources, temporaryDir, debugChannel);
		}
	}
}
