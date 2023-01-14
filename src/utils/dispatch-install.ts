import vscode from 'vscode';
import { installFileSystem } from '../sources/filesystem';
import { installGitHub } from '../sources/github';
import { installMarketplace } from '../sources/marketplace';
import { InstallResult, Source } from './types';

export async function dispatchInstall(extensionName: string, source: Source, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> {
	if(source === 'github') {
		return installGitHub(extensionName, temporaryDir, debugChannel);
	}

	if(source.type === 'file') {
		return installFileSystem(extensionName, source, debugChannel);
	}

	if(source.type === 'marketplace') {
		return installMarketplace(extensionName, source, temporaryDir, debugChannel);
	}
}
