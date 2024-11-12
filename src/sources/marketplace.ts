import path from 'path';
import { platform, arch } from 'process';
import { pipeline } from 'stream/promises';
import fse from 'fs-extra';
import got from 'got';
import semver from 'semver';
import vscode from 'vscode';
import { InstallResult, MarketPlace, Source } from '../utils/types';

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
			versions: Array<{
				assetUri: string;
				fallbackAssetUri: string;
				files: Array<{
					assetType: string;
					source: string;
				}>;
				properties: {
					key: string;
					value: string;
				};
				targetPlatform: string | undefined;
				version: string | undefined;
			}>;
		}>;
	}>;
};

const $nextRequestAt: Record<string, number> = {};
const targetPlatform = `${platform}-${arch}`;

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

async function download(extensionName: string, version: string, platform: string | undefined, downloadUrl: string, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`downloading version: ${version}, platform: ${platform ?? 'universal'}`);

	const fileName = path.join(temporaryDir, `${extensionName}-${version}.vsix`);

	const gotStream = got.stream.get(downloadUrl);

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(fileName));

	await fse.unlink(fileName);
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

export async function installMarketplace(extensionName: string, extensionVersion: string | undefined, source: MarketPlace, sources: Record<string, Source>, temporaryDir: string, enabled: boolean, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> { // {{{
	if(source.throttle > 0) {
		await delayRequest(source);
	}

	const result = await query(source, extensionName);
	debugChannel?.appendLine(JSON.stringify(result, null, '\t'));
	const extensions = result.results[0]?.extensions;

	if(extensions) {
		const [publisher, name] = extensionName.split('.');

		let minEngineVersion: string | null = null;

		for(const extension of extensions) {
			if(extension.extensionName === name && (extension.publisher.publisherName === publisher || extension.publisher.displayName === publisher)) {
				for(const data of extension.versions) {
					let version = data.version;
					const matchedPlatform = data.targetPlatform ? data.targetPlatform === targetPlatform : true;

					if(version && matchedPlatform) {
						let downloadUrl: string | null = null;

						if(extensionVersion) {
							debugChannel?.appendLine(`use specified version: ${extensionVersion}`);

							version = extensionVersion;
							downloadUrl = `${source.serviceUrl}/publishers/${publisher}/vsextensions/${name}/${version}/vspackage`;
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
							await download(extensionName, version, data.targetPlatform, downloadUrl, temporaryDir, debugChannel);

							return { name: extensionName, version, enabled };
						}
					}
				}
			}
		}

		if(minEngineVersion) {
			debugChannel?.appendLine(`the extension requires an IDE with the minimum version of "${minEngineVersion}"`);
		}
	}
} // }}}

export async function updateMarketplace(extensionName: string, currentVersion: string, source: MarketPlace, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> { // {{{
	if(source.throttle > 0) {
		await delayRequest(source);
	}

	const result = await query(source, extensionName);
	const extensions = result.results[0]?.extensions;

	if(extensions) {
		const [publisher, name] = extensionName.split('.');

		for(const extension of extensions) {
			if(extension.extensionName === name && (extension.publisher.publisherName === publisher || extension.publisher.displayName === publisher)) {
				for(const extensionVersion of extension.versions) {
					const version = extensionVersion.version;
					const matchedPlatform = extensionVersion.targetPlatform ? extensionVersion.targetPlatform === targetPlatform : true;

					if(version && matchedPlatform && semver.gt(version, currentVersion) && isCompatibleEngine(extensionVersion)) {
						const downloadUrl = getDownloadUrl(extensionName, version, source, extensionVersion);

						await download(extensionName, version, extensionVersion.targetPlatform, downloadUrl, temporaryDir, debugChannel);

						return version;
					}
				}
			}
		}
	}
} // }}}

function isCompatibleEngine(extension): boolean { // {{{
	for(const { key, value } of extension.properties) {
		if(key === 'Microsoft.VisualStudio.Code.Engine') {
			return semver.satisfies(vscode.version, value);
		}
	}

	return true;
} // }}}

function getEngineVersion(extension): string | null { // {{{
	let min: string | null = null;

	for(const { key, value } of extension.properties) {
		if(key === 'Microsoft.VisualStudio.Code.Engine') {
			if(semver.satisfies(vscode.version, value)) {
				return null;
			}
			else if(!min || semver.lt(value, min)) {
				min = value as string;
			}
		}
	}

	return min;
} // }}}
