import path from 'path';
import fse from 'fs-extra';
import globby from 'globby';
import semver from 'semver';
import untildify from 'untildify';
import vscode from 'vscode';
import { FileSystem } from '../utils/types';

async function find(root: string, extensionName: string, debugChannel: vscode.OutputChannel | undefined): Promise<{ version: string; file: string }> { // {{{
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

			if(latestVersion) {
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

async function search(extensionName: string, root: string, debugChannel: vscode.OutputChannel | undefined): Promise<{ version: string; file: string }> { // {{{
	let { version, file } = await find(root, extensionName, debugChannel);

	const names = /^([^.])\./.exec(extensionName);
	if(names) {
		const publisher = path.join(root, names[0]);
		if(fse.statSync(publisher).isDirectory()) {
			const { version: pubVersion, file: pubFile } = await find(publisher, extensionName, debugChannel);

			if(semver.gt(pubVersion, version)) {
				version = pubVersion;
				file = pubFile;
			}
		}

		const extension = path.join(root, extensionName);
		if(fse.statSync(extension).isDirectory()) {
			const { version: extVersion, file: extFile } = await find(extension, extensionName, debugChannel);

			if(semver.gt(extVersion, version)) {
				version = extVersion;
				file = extFile;
			}
		}
	}

	return {
		version,
		file,
	};
} // }}}

export async function installFileSystem(extensionName: string, source: FileSystem, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> { // {{{
	const root = untildify(source.path);

	if(!fse.existsSync(root)) {
		return;
	}

	const { file, version } = await search(extensionName, root, debugChannel);

	if(file) {
		debugChannel?.appendLine(`installing: ${file}`);

		await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(path.join(root, file)));

		return version;
	}
} // }}}

export async function updateFileSystem(extensionName: string, currentVersion: string, source: FileSystem, debugChannel: vscode.OutputChannel | undefined): Promise<string | undefined> { // {{{
	const root = untildify(source.path);

	if(!fse.existsSync(root)) {
		return;
	}

	const { file, version } = await search(extensionName, root, debugChannel);

	if(file) {
		if(semver.lte(version, currentVersion)) {
			return;
		}

		debugChannel?.appendLine(`updating to: ${file}`);

		await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(path.join(root, file)));

		return version;
	}
} // }}}
