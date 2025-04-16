import path from 'path';
import process from 'process';
import { pipeline } from 'stream/promises';
import fse from 'fs-extra';
import got from 'got';
import semver from 'semver';
import vscode from 'vscode';
import { Forgejo, InstallResult, UpdateResult } from '../utils/types';

async function download(name: string, version: string, source: Forgejo, url: string, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<void> { // {{{
	debugChannel?.appendLine(`downloading version: ${version}`);

	const fileName = path.join(temporaryDir, `${name}-${version}.vsix`);

	const gotStream = got.stream.get(url, getHeaders(source));

	const outStream = fse.createWriteStream(fileName);

	await pipeline(gotStream, outStream);

	await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(fileName));

	await fse.unlink(fileName);
} // }}}

export async function installForgejo(extensionName: string, extensionVersion: string | undefined, source: Forgejo, temporaryDir: string, enabled: boolean, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> { // {{{
	const results = await got.get(getReleasesUrl(extensionName, source), getHeaders(source)).json();

	if(!results || !Array.isArray(results)) {
		return;
	}

	let name: string = '';
	let version: string = '';
	let url: string = '';

	for(const result of results) {
		if(result.assets) {
			for(const asset of result.assets) {
				const match = /^(.*?)-(\d+\.\d+\.\d+)\.vsix$/.exec(asset.name);

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

	await download(name, version, source, url, temporaryDir, debugChannel);

	return { name, version, enabled };
} // }}}

export async function updateForgejo(extensionName: string, currentVersion: string, source: Forgejo, temporaryDir: string, debugChannel: vscode.OutputChannel | undefined): Promise<UpdateResult> { // {{{
	const results = await got.get(getReleasesUrl(extensionName, source), getHeaders(source)).json();

	if(!results || !Array.isArray(results)) {
		return;
	}

	let name: string = '';
	let version: string = '';
	let url: string = '';

	for(const result of results) {
		if(result.assets) {
			for(const asset of result.assets) {
				const match = /^(.*?)-(\d+\.\d+\.\d+)\.vsix$/.exec(asset.name);

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

	await download(name, version, source, url, temporaryDir, debugChannel);

	return {
		name,
		version,
		updated: true,
	};
} // }}}

function getReleasesUrl(extensionName: string, source: Forgejo): string { // {{{
	return `${source.serviceUrl}/repos/${source.owner}/${extensionName}/releases`;
} // }}}

function getHeaders(source: Forgejo): {} | undefined { // {{{
	if(source?.token) {
		let token: string | undefined = '';

		if(source.token.startsWith('env:')) {
			token = process.env[source.token.slice(4)];
		}
		else {
			token = source.token;
		}

		if(token) {
			return {
				headers: {
					Authorization: `token ${token}`,
				},
			};
		}
	}

	return undefined;
} // }}}
