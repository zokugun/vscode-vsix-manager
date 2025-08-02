import path from 'path';
import { pipeline } from 'stream/promises';
import fse from 'fs-extra';
import got from 'got';
import semver from 'semver';
import vscode from 'vscode';
import type { GitConfig, GitService, InstallResult, UpdateResult } from '../utils/types.js';

type AssetInfo = {
	name: string;
	version: string;
	url: string;
};

const NO_ASSET = { name: undefined, version: undefined, url: undefined };

async function download(name: string, version: string, source: GitService | undefined, config: GitConfig, url: string, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`downloading version: ${version}`);

	const fileName = path.join(temporaryDir, `${name}-${version}.vsix`);

	const gotStream = got.stream.get(url, config.getDownloadHeaders(source));

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(fileName));

	await fse.unlink(fileName);
} // }}}

async function findLatestAsset(extensionName: string, source: GitService | undefined, config: GitConfig, targetVersion?: string): Promise<AssetInfo | typeof NO_ASSET> { // {{{
	const releases = await got.get(config.getReleasesUrl(extensionName, source), config.getHeaders(source)).json();

	if(!releases || !Array.isArray(releases)) {
		return NO_ASSET;
	}

	let name: string = '';
	let version: string = '';
	let url: string = '';

	for(const release of releases) {
		if(release.assets) {
			for(const asset of release.assets) {
				const match = /^(.*?)-(\d+\.\d+\.\d+)\.vsix$/.exec(asset.name as string);

				if(match) {
					if(targetVersion) {
						// Looking for a specific version
						if(targetVersion === match[2]) {
							name = match[1];
							version = match[2];
							url = config.getAssetUrl(asset);
						}
					}
					else if(!name) {
						name = match[1];
						version = match[2];
						url = config.getAssetUrl(asset);
					}
					else if(name === match[1] && semver.gt(match[2], version)) {
						version = match[2];
						url = config.getAssetUrl(asset);
					}
				}
			}
		}
	}

	return version ? { name, version, url } : NO_ASSET;
} // }}}

export async function install(extensionName: string, extensionVersion: string | undefined, source: GitService | undefined, config: GitConfig, temporaryDir: string, enabled: boolean, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> { // {{{
	const { name, version, url } = await findLatestAsset(extensionName, source, config, extensionVersion);

	if(!name) {
		return;
	}

	await download(name, version, source, config, url, temporaryDir, debugChannel);

	return { name, version, enabled };
} // }}}

export async function update(extensionName: string, currentVersion: string, source: GitService | undefined, config: GitConfig, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> { // {{{
	const { name, version, url } = await findLatestAsset(extensionName, source, config);

	if(!name) {
		return;
	}

	if(semver.lte(version, currentVersion)) {
		return { name, version, updated: true };
	}

	await download(name, version, source, config, url, temporaryDir, debugChannel);

	return { name, version, updated: true };
} // }}}
