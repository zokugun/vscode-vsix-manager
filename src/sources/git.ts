import path from 'path';
import { platform, arch } from 'process';
import { pipeline } from 'stream/promises';
import fse from 'fs-extra';
import got from 'got';
import semver from 'semver';
import vscode from 'vscode';
import type { GitConfig, GitService, InstallResult, Metadata, UpdateResult } from '../types.js';

type AssetInfo = {
	name: string;
	version: string;
	url: string;
};

const NO_ASSET = { name: undefined, version: undefined, url: undefined };
const TARGET_PLATFORM = `${platform}-${arch}` as const;

async function download(name: string, version: string, source: GitService | undefined, config: GitConfig, url: string, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`downloading version: ${version}`);

	const fileName = path.join(temporaryDir, `${name}-${version}.vsix`);

	const gotStream = got.stream.get(url, config.getDownloadHeaders(source));

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(fileName));

	await fse.unlink(fileName);
} // }}}

async function findLatestAsset({ fullName: repoName, targetName, targetVersion }: Metadata, source: GitService | undefined, config: GitConfig): Promise<AssetInfo | typeof NO_ASSET> { // {{{
	const releases = await got.get(config.getReleasesUrl(repoName, source), config.getHeaders(source)).json();

	if(!releases || !Array.isArray(releases)) {
		return NO_ASSET;
	}

	let name: string = targetName ?? '';
	let version: string = targetVersion ?? '';
	let platform: string = '';
	let url: string = '';

	for(const release of releases) {
		if(!release.assets) {
			continue;
		}

		const match = /^v?(\d+\.\d+\.\d+)(?:-.*)?$/.exec(release.name as string);

		if(match) {
			if(targetVersion) {
				if(semver.eq(match[1], targetVersion)) {
					for(const asset of release.assets) {
						const result = parseAssetName(asset.name as string);

						if(result) {
							if(result.platform && result.platform !== 'universal' && result.platform !== TARGET_PLATFORM) {
								continue;
							}

							if(!name) {
								name = result.name;
								platform = result.platform ?? '';
								url = config.getAssetUrl(asset);
							}
							else if(name === result.name) {
								platform = result.platform ?? '';
								url = config.getAssetUrl(asset);
							}

							if(url && Boolean(platform) && platform !== 'universal') {
								break;
							}
						}
					}

					break;
				}
			}

			const releaseVersion = match[1];

			if(version && semver.lte(releaseVersion, version)) {
				continue;
			}

			for(const asset of release.assets) {
				const result = parseAssetName(asset.name as string);

				if(result) {
					if(result.platform && result.platform !== 'universal' && result.platform !== TARGET_PLATFORM) {
						continue;
					}

					if(!name) {
						name = result.name;
						version = releaseVersion;
						platform = result.platform ?? '';
						url = config.getAssetUrl(asset);
					}
					else if(name === result.name) {
						version = releaseVersion;
						platform = result.platform ?? '';
						url = config.getAssetUrl(asset);
					}

					if(url && Boolean(platform) && platform !== 'universal') {
						break;
					}
				}
			}

			break;
		}
		else {
			for(const asset of release.assets) {
				const result = parseAssetName(asset.name as string);

				if(result) {
					if(result.platform && result.platform !== 'universal' && result.platform !== TARGET_PLATFORM) {
						continue;
					}

					if(!result.version) {
						continue;
					}

					if(targetVersion) {
						// Looking for a specific version
						if(targetVersion === result.version) {
							if(platform && platform !== 'universal') {
								continue;
							}

							name = result.name;
							version = result.version;
							platform = result.platform ?? '';
							url = config.getAssetUrl(asset);
						}
					}
					else if(!name) {
						name = result.name;
						version = result.version;
						platform = result.platform ?? '';
						url = config.getAssetUrl(asset);
					}
					else if(name === result.name) {
						if(semver.gt(result.version, version)) {
							version = result.version;
							platform = result.platform ?? '';
							url = config.getAssetUrl(asset);
						}
						else if(semver.eq(result.version, version)) {
							if(platform && platform !== 'universal') {
								continue;
							}

							platform = result.platform ?? '';
							url = config.getAssetUrl(asset);
						}
					}
				}
			}
		}
	}

	return url ? { name, version, url } : NO_ASSET;
} // }}}

export async function install(metadata: Metadata, source: GitService | undefined, config: GitConfig, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> { // {{{
	const { name, version, url } = await findLatestAsset(metadata, source, config);

	if(!name) {
		return;
	}

	await download(name, version, source, config, url, temporaryDir, debugChannel);

	return { name, version, enabled: metadata.enabled };
} // }}}

export async function update(metadata: Metadata, currentVersion: string, source: GitService | undefined, config: GitConfig, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> { // {{{
	const { name, version, url } = await findLatestAsset(metadata, source, config);

	if(!name) {
		return;
	}

	if(semver.lte(version, currentVersion)) {
		return { name, version, updated: true };
	}

	await download(name, version, source, config, url, temporaryDir, debugChannel);

	return { name, version, updated: true };
} // }}}

function parseAssetName(assetName: string): { name: string; platform?: string; version?: string } | undefined { // {{{
	if(!assetName.endsWith('.vsix')) {
		return undefined;
	}

	const result: { name: string; platform?: string; version?: string } = { name: '' };
	let left2parse = assetName.slice(0, Math.max(0, assetName.length - 5));
	let match = /^(.*?)-(\d+\.\d+\.\d+)/.exec(left2parse);

	if(match) {
		left2parse = match[1];
		result.version = match[2];
	}

	match = /^(.*?)-((?:alpine|darwin|linux|win32)-[a-z][a-z\d]+|universal)/.exec(left2parse);

	if(match) {
		result.name = match[1];
		result.platform = match[2];
	}
	else {
		result.name = left2parse;
	}

	return result;
} // }}}
