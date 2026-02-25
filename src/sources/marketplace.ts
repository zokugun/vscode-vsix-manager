import path from 'path';
import { pipeline } from 'stream/promises';
import fse from '@zokugun/fs-extra-plus/async';
import got from 'got';
import semver from 'semver';
import vscode from 'vscode';
import { TARGET_PLATFORM } from '../settings.js';
import type { MarketPlace, Metadata, SearchDownloadResult } from '../types.js';
import { Logger } from '../utils/logger.js';

type Version = {
	assetUri: string;
	fallbackAssetUri: string;
	files: Array<{
		assetType: string;
		source: string;
	}>;
	properties: Array<{
		key: string;
		value: string;
	}>;
	targetPlatform: string | undefined;
	version: string | undefined;
};

type QueryResult = {
	results: Array<{
		extensions: Array<{
			displayName: string;
			extensionId: string;
			extensionName: string;
			publisher: {
				displayName: string;
				publisherId: string;
				publisherName: string;
			};
			shortDescription: string;
			versions: Version[];
		}>;
	}>;
};

const $nextRequestAt: Record<string, number> = {};

async function delayRequest(source: MarketPlace): Promise<void> { // {{{
	let when = Date.now();
	const next = $nextRequestAt[source.serviceUrl];

	if(next && next > when) {
		await new Promise((resolve) => {
			setTimeout(resolve, next - when);
		});

		when = Date.now();
	}

	$nextRequestAt[source.serviceUrl] = when + source.throttle;
} // }}}

async function download(extensionName: string, version: string, platform: string | undefined, downloadUrl: string, temporaryDir: string): Promise<string> { // {{{
	Logger.info(`downloading version: ${version}, platform: ${platform ?? 'universal'}`);

	const fileName = path.join(temporaryDir, `${extensionName}-${version}.vsix`);

	const gotStream = got.stream.get(downloadUrl);

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	return fileName;
} // }}}

function getDownloadUrl(extensionName: string, version: string, source: MarketPlace, { files }: { files: Array<{ assetType: string; source: string }> }): string { // {{{
	for(const { assetType, source } of files) {
		if(assetType === 'Microsoft.VisualStudio.Services.VSIXPackage') {
			return source;
		}
	}

	const [publisher, name] = extensionName.split('.');

	return `${source.serviceUrl}/publishers/${publisher}/vsextensions/${name}/${version}/vspackage`;
} // }}}

async function query(source: MarketPlace, extensionName: string): Promise<QueryResult> { // {{{
	return got.post(`${source.serviceUrl}/extensionquery`, {
		json: {
			filters: [{
				criteria: [
					{
						filterType: 10,
						value: extensionName.replace('.', ' '),
					},
					{
						filterType: 8,
						value: 'Microsoft.VisualStudio.Code',
					},
					{
						filterType: 12,
						value: `${0x1000}`,
					},
				],
				pageNumber: 1,
				pageSize: 24,
				sortBy: 0,
				sortOrder: 0,
			}],
			assetTypes: ['Microsoft.VisualStudio.Services.VSIXPackage'],
			flags: 0x200 | 0x100 | 0x80 | 0x20 | 0x10 | 0x4 | 0x2,
		},
	}).json();
} // }}}

export async function search({ fullName: extensionName, targetVersion }: Metadata, source: MarketPlace, temporaryDir: string): Promise<SearchDownloadResult | undefined> { // {{{
	if(source.throttle > 0) {
		await delayRequest(source);
	}

	const result = await query(source, extensionName);
	const extensions = result.results[0]?.extensions;

	if(extensions) {
		const [publisher, name] = extensionName.split('.');

		let minEngineVersion: string | null = null;

		for(const extension of extensions) {
			if(extension.extensionName === name && (extension.publisher.publisherName === publisher || extension.publisher.displayName === publisher)) {
				for(const data of extension.versions) {
					const version = data.version;

					if(targetVersion && version !== targetVersion) {
						continue;
					}

					const matchedPlatform = data.targetPlatform ? data.targetPlatform === TARGET_PLATFORM || data.targetPlatform === 'universal' : true;

					if(version && matchedPlatform && isCompatibleEngine(data)) {
						let downloadUrl: string | null = null;

						if(targetVersion) {
							Logger.info(`use specified version: ${targetVersion}`);

							downloadUrl = getDownloadUrl(extensionName, version, source, data);
						}
						else {
							const engineVersion = getEngineVersion(data);

							if(engineVersion) {
								if(!minEngineVersion || semver.lt(engineVersion, minEngineVersion)) {
									minEngineVersion = engineVersion;
								}
							}
							else {
								downloadUrl = getDownloadUrl(extensionName, version, source, data);
							}
						}

						if(version && downloadUrl) {
							return {
								type: 'download',
								fullName: extensionName,
								version,
								download: async () => download(extensionName, version, data.targetPlatform, downloadUrl, temporaryDir),
							};
						}
					}
				}
			}
		}

		if(minEngineVersion) {
			Logger.info(`the extension requires an IDE with the minimum version of "${minEngineVersion}"`);
		}
	}
} // }}}

function isCompatibleEngine(extension: Version): boolean { // {{{
	for(const { key, value } of extension.properties) {
		if(key === 'Microsoft.VisualStudio.Code.Engine') {
			const minVersion = semver.minVersion(value);
			if(!minVersion) {
				continue;
			}

			return semver.gte(vscode.version, minVersion);
		}
	}

	return true;
} // }}}

function getEngineVersion(extension: Version): string | null { // {{{
	let min: string | null = null;

	for(const { key, value } of extension.properties) {
		if(key === 'Microsoft.VisualStudio.Code.Engine') {
			const minVersion = semver.minVersion(value);
			if(!minVersion) {
				continue;
			}

			if(semver.gte(vscode.version, minVersion)) {
				return null;
			}
			else if(!min || semver.lt(value, min)) {
				min = value;
			}
		}
	}

	return min;
} // }}}
