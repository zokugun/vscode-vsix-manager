import path from 'path';
import { pipeline } from 'stream/promises';
import fse from 'fs-extra';
import got from 'got';
import semver from 'semver';
import vscode from 'vscode';
import type { GitConfig, GitService, InstallResult, UpdateResult } from '../utils/types.js';

async function download(name: string, version: string, source: GitService | undefined, config: GitConfig, url: string, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`downloading version: ${version}`);

	const fileName = path.join(temporaryDir, `${name}-${version}.vsix`);

	const gotStream = got.stream.get(url, config.getHeaders(source));

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(fileName));

	await fse.unlink(fileName);
} // }}}

export async function install(extensionName: string, extensionVersion: string | undefined, source: GitService | undefined, config: GitConfig, temporaryDir: string, enabled: boolean, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> { // {{{
	const results = await got.get(config.getReleasesUrl(extensionName, source), config.getHeaders(source)).json();

	if(!results || !Array.isArray(results)) {
		return;
	}

	let name: string = '';
	let version: string = '';
	let url: string = '';

	for(const result of results) {
		if(result.assets) {
			for(const asset of result.assets) {
				const match = /^(.*?)-(\d+\.\d+\.\d+)\.vsix$/.exec(asset.name as string);

				if(match) {
					if(extensionVersion) {
						if(extensionVersion === match[2]) {
							name = match[1];
							version = match[2];
							url = asset.browser_download_url as string;
						}
					}
					else if(!name) {
						name = match[1];
						version = match[2];
						url = asset.browser_download_url as string;
					}
					else if(name === match[1] && semver.gt(match[2], version)) {
						version = match[2];
						url = asset.browser_download_url as string;
					}
				}
			}
		}
	}

	if(!version) {
		return;
	}

	await download(name, version, source, config, url, temporaryDir, debugChannel);

	return { name, version, enabled };
} // }}}

export async function update(extensionName: string, currentVersion: string, source: GitService | undefined, config: GitConfig, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> { // {{{
	const results = await got.get(config.getReleasesUrl(extensionName, source), config.getHeaders(source)).json();

	if(!results || !Array.isArray(results)) {
		return;
	}

	let name: string = '';
	let version: string = '';
	let url: string = '';

	for(const result of results) {
		if(result.assets) {
			for(const asset of result.assets) {
				const match = /^(.*?)-(\d+\.\d+\.\d+)\.vsix$/.exec(asset.name as string);

				if(match) {
					if(!name) {
						name = match[1];
						version = match[2];
						url = asset.browser_download_url as string;
					}
					else if(name === match[1] && semver.gt(match[2], version)) {
						version = match[2];
						url = asset.browser_download_url as string;
					}
				}
			}
		}
	}

	if(!version) {
		return;
	}

	if(semver.lte(version, currentVersion)) {
		return {
			name,
			version,
			updated: false,
		};
	}

	await download(name, version, source, config, url, temporaryDir, debugChannel);

	return {
		name,
		version,
		updated: true,
	};
} // }}}
