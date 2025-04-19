import vscode from 'vscode';
import { installFileSystem } from '../sources/filesystem';
import * as Forgejo from '../sources/forgejo';
import * as Git from '../sources/git';
import * as GitHub from '../sources/github';
import { installMarketplace } from '../sources/marketplace';
import { InstallResult, Source } from './types';

export async function dispatchInstall(extensionName: string, extensionVersion: string | undefined, source: Source, sources: Record<string, Source> | undefined, temporaryDir: string, enabled: boolean, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> {
	if(source === 'github') {
		return Git.install(extensionName, extensionVersion, undefined, GitHub, temporaryDir, enabled, debugChannel);
	}

	try {
		let result: InstallResult;

		if(source.type === 'file') {
			result = await installFileSystem(extensionName, extensionVersion, source, enabled, debugChannel);
		}

		if(source.type === 'forgejo') {
			result = await Git.install(extensionName, extensionVersion, source, Forgejo, temporaryDir, enabled, debugChannel);
		}

		if(source.type === 'github') {
			result = await Git.install(extensionName, extensionVersion, source, GitHub, temporaryDir, enabled, debugChannel);
		}

		if(source.type === 'marketplace') {
			result = await installMarketplace(extensionName, extensionVersion, source, sources!, temporaryDir, enabled, debugChannel);
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
			debugChannel?.appendLine(`installing extension: ${source.fallback}:${extensionName}`);

			return dispatchInstall(extensionName, extensionVersion, newSource, sources, temporaryDir, enabled, debugChannel);
		}
	}
}
