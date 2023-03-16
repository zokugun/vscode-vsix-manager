import path from 'path';
import { pipeline } from 'stream/promises';
import fse from 'fs-extra';
import got from 'got';
import semver from 'semver';
import vscode from 'vscode';
import { MarketPlace } from '../utils/types';

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
				targetPlatform: string;
				version: string;
			}>;
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

async function download(extensionName: string, version: string, downloadUrl: string, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> {
	debugChannel?.appendLine(`downloading version: ${version}`);

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
						value: extensionName,
					},
					{
						filterType: 8,
						value: 'Microsoft.VisualStudio.Code',
					},
					{
						filterType: 12,
						value: '4096',
					},
				],
				pageNumber: 1,
				pageSize: 24,
				sortBy: 0,
				sortOrder: 0,
			}],
			assetTypes: [],
			flags: 950,
		},
	}).json();
} // }}}

export async function installMarketplace(extensionName: string, source: MarketPlace, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> { // {{{
	if(source.throttle > 0) {
		await delayRequest(source);
	}

	const result = await query(source, extensionName);
	const extensions = result.results[0]?.extensions;

	if(extensions) {
		const [publisher, name] = extensionName.split('.');

		for(const extension of extensions) {
			if(extension.extensionName === name && extension.publisher.publisherName === publisher) {
				const version = extension.versions[0]?.version;

				if(version) {
					const downloadUrl = getDownloadUrl(extensionName, version, source, extension.versions[0]);

					await download(extensionName, version, downloadUrl, temporaryDir, debugChannel);

					return version;
				}
			}
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
			if(extension.extensionName === name && extension.publisher.publisherName === publisher) {
				const version = extension.versions[0]?.version;

				if(version && semver.gt(version, currentVersion)) {
					const downloadUrl = getDownloadUrl(extensionName, version, source, extension.versions[0]);

					await download(extensionName, version, downloadUrl, temporaryDir, debugChannel);

					return version;
				}
			}
		}
	}
} // }}}
