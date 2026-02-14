import path from 'path';
import { pipeline } from 'stream/promises';
import fse from '@zokugun/fs-extra-plus/async';
import got from 'got';
import semver from 'semver';
import { TARGET_PLATFORM } from '../settings.js';
import type { GitConfig, GitService, PartialSearchResult, Metadata } from '../types.js';
import { Logger } from '../utils/logger.js';
import { parseAssetName } from '../utils/parse-asset-name.js';

type AssetInfo = {
	name: string;
	version: string;
	platform?: string;
	url: string;
};

const NO_ASSET = { name: undefined, version: undefined, platform: undefined, url: undefined };

async function download(name: string, version: string, platform: string | undefined, source: GitService | undefined, config: GitConfig, url: string, temporaryDir: string): Promise<string> { // {{{
	Logger.info(`downloading version: ${version}, platform: ${platform ?? 'universal'}`);

	const fileName = path.join(temporaryDir, `${name}-${version}.vsix`);

	const gotStream = got.stream.get(url, config.getDownloadHeaders(source));

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	return fileName;
} // }}}

async function findLatestAsset({ fullName: repoName, targetName, targetVersion }: Metadata, source: GitService | undefined, config: GitConfig): Promise<AssetInfo | typeof NO_ASSET> { // {{{
	const releases = await got.get(config.getReleasesUrl(repoName, source), config.getHeaders(source)).json();

	if(!releases || !Array.isArray(releases)) {
		return NO_ASSET;
	}

	let name: string = targetName ?? '';
	let version: string = targetVersion ?? '';
	let platform: string | undefined;
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
								platform = result.platform;
								url = config.getAssetUrl(asset);
							}
							else if(name === result.name) {
								platform = result.platform;
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
						platform = result.platform;
						url = config.getAssetUrl(asset);
					}
					else if(name === result.name) {
						version = releaseVersion;
						platform = result.platform;
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
							platform = result.platform;
							url = config.getAssetUrl(asset);
						}
					}
					else if(!name) {
						name = result.name;
						version = result.version;
						platform = result.platform;
						url = config.getAssetUrl(asset);
					}
					else if(name === result.name) {
						if(semver.gt(result.version, version)) {
							version = result.version;
							platform = result.platform;
							url = config.getAssetUrl(asset);
						}
						else if(semver.eq(result.version, version)) {
							if(platform && platform !== 'universal') {
								continue;
							}

							platform = result.platform;
							url = config.getAssetUrl(asset);
						}
					}
				}
			}
		}
	}

	return url ? { name, version, platform, url } : NO_ASSET;
} // }}}

export async function search(metadata: Metadata, source: GitService | undefined, config: GitConfig, temporaryDir: string): Promise<PartialSearchResult | undefined> { // {{{
	const { name, version, platform, url } = await findLatestAsset(metadata, source, config);

	if(!name) {
		return;
	}

	const file = await download(name, version, platform, source, config, url, temporaryDir);

	return { version, file, unlink: file };
} // }}}
