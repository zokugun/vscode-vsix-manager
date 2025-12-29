import path from 'path';
import fse from 'fs-extra';
import globby from 'globby';
import semver from 'semver';
import untildify from 'untildify';
import vscode from 'vscode';
import type { FileSystem, InstallResult, Metadata } from '../types.js';

async function find(root: string, extensionName: string, extensionVersion: string | undefined, debugChannel: vscode.OutputChannel | undefined): Promise<{ version: string; file: string }> { // {{{
	const files = await globby('*.vsix', {
		cwd: root,
		followSymbolicLinks: false,
	});

	let latestVersion: string = '';
	let lastestFile: string = '';

	for(const file of files) {
		const match = /^(.*?)-(\d+\.\d+\.\d+)\.vsix$/.exec(file);

		if(match && match[1] === extensionName) {
			debugChannel?.appendLine(`found: ${file}`);

			if(extensionVersion) {
				if(extensionVersion === match[2]) {
					latestVersion = match[2];
					lastestFile = file;
				}
			}
			else if(latestVersion) {
				if(semver.gt(match[2], latestVersion)) {
					latestVersion = match[2];
					lastestFile = file;
				}
			}
			else {
				latestVersion = match[2];
				lastestFile = file;
			}
		}
	}

	return {
		version: latestVersion,
		file: lastestFile,
	};
} // }}}

async function search(extensionName: string, extensionVersion: string | undefined, root: string, debugChannel: vscode.OutputChannel | undefined): Promise<{ version: string; file: string }> { // {{{
	let { version, file } = await find(root, extensionName, extensionVersion, debugChannel);

	const names = /^([^.])\./.exec(extensionName);
	if(names) {
		const publisher = path.join(root, names[0]);
		if(fse.statSync(publisher).isDirectory()) {
			const { version: foundVersion, file: foundFile } = await find(publisher, extensionName, extensionVersion, debugChannel);

			if(semver.gt(foundVersion, version)) {
				version = foundVersion;
				file = foundFile;
			}
		}

		const extension = path.join(root, extensionName);
		if(fse.statSync(extension).isDirectory()) {
			const { version: foundVersion, file: foundFile } = await find(extension, extensionName, extensionVersion, debugChannel);

			if(semver.gt(foundVersion, version)) {
				version = foundVersion;
				file = foundFile;
			}
		}
	}

	return {
		version,
		file,
	};
} // }}}

export async function installFileSystem({ fullName: extensionName, targetVersion, enabled }: Metadata, source: FileSystem, debugChannel: vscode.OutputChannel | undefined): Promise<InstallResult> { // {{{
	const root = untildify(source.path);

	if(!fse.existsSync(root)) {
		return;
	}

	const { file, version } = await search(extensionName, targetVersion, root, debugChannel);

	if(file) {
		debugChannel?.appendLine(`installing: ${file}`);

		await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(path.join(root, file)));

		return { name: extensionName, version, enabled };
	}
} // }}}

export async function updateFileSystem({ fullName: extensionName }: Metadata, currentVersion: string, source: FileSystem, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> { // {{{
	const root = untildify(source.path);

	if(!fse.existsSync(root)) {
		return;
	}

	const { file, version } = await search(extensionName, undefined, root, debugChannel);

	if(file) {
		if(semver.lte(version, currentVersion)) {
			return;
		}

		debugChannel?.appendLine(`updating to: ${file}`);

		await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(path.join(root, file)));

		return version;
	}
} // }}}
