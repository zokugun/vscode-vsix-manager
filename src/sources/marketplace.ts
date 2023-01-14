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

async function download(extensionName: string, version: string, source: MarketPlace, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> {
	debugChannel?.appendLine(`downloading version: ${version}`);

	const [publisher, name] = extensionName.split('.');

	const fileName = path.join(temporaryDir, `${extensionName}-${version}.vsix`);

	const gotStream = got.stream.get(`${source.serviceUrl}/publishers/${publisher}/vsextensions/${name}/${version}/vspackage`);

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(fileName));

	await fse.unlink(fileName);
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
				pageSize: 1,
				sortBy: 0,
				sortOrder: 0,
			}],
			assetTypes: [],
			flags: 950,
		},
	}).json();
} // }}}

export async function installMarketplace(extensionName: string, source: MarketPlace, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> { // {{{
	const result = await query(source, extensionName);

	const version = result.results[0]?.extensions[0]?.versions[0]?.version;
	if(!version) {
		return;
	}

	await download(extensionName, version, source, temporaryDir, debugChannel);

	return version;
} // }}}

export async function updateMarketplace(extensionName: string, currentVersion: string, source: MarketPlace, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> { // {{{
	const result = await query(source, extensionName);

	const version = result.results[0]?.extensions[0]?.versions[0]?.version;
	if(!version) {
		return;
	}

	if(semver.lte(version, currentVersion)) {
		return;
	}

	await download(extensionName, version, source, temporaryDir, debugChannel);

	return version;
} // }}}
