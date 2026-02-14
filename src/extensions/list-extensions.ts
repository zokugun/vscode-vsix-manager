import path from 'path';
import fse from '@zokugun/fs-extra-plus/async';
import { err, ok, type Result } from '@zokugun/xtry';
import globby from 'globby';
import vscode from 'vscode';
import { getExtensionDataPath } from '../paths/get-extension-data-path.js';
import type { Extension, ExtensionList } from '../types.js';

export async function listExtensions(extensionId: string): Promise<Result<ExtensionList, string>> { // {{{
	const builtin: {
		disabled: Extension[];
	} = {
		disabled: [],
	};
	const disabled: Extension[] = [];
	const enabled: Extension[] = [];

	const ids: Record<string, boolean> = {};

	for(const extension of vscode.extensions.all) {
		const id = extension.id;
		const pkg = extension.packageJSON as { isBuiltin: boolean; isUnderDevelopment: boolean; version: string; uuid: string };

		if(!pkg || pkg.isUnderDevelopment || id === extensionId) {
			continue;
		}

		if(!pkg.isBuiltin) {
			enabled.push({ id, version: pkg.version });
		}

		ids[id] = true;
	}

	const extensionDataPath = await getExtensionDataPath();
	const obsoletePath = path.join(extensionDataPath, '.obsolete');

	let obsolete: Record<string, boolean> = {};

	const exists = await fse.pathExists(obsoletePath);
	if(exists.value) {
		const result = await fse.readJSON(obsoletePath);
		if(result.fails) {
			return err(`Cannot read the file ${obsoletePath}`);
		}

		obsolete = result.value as Record<string, boolean>;
	}

	const extensions = await globby('*/package.json', {
		cwd: extensionDataPath,
	});

	for(const packagePath of extensions) {
		const name = path.dirname(packagePath);

		if(obsolete[name]) {
			continue;
		}

		const match = /^(.*?)-\d+\.\d+\.\d+$/.exec(name);
		if(!match) {
			continue;
		}

		const result = await fse.readJSON(path.join(extensionDataPath, packagePath));
		if(result.fails) {
			return err(`Cannot read the extension: ${packagePath}`);
		}

		const pkg = result.value as { name: string; publisher: string; version: string; __metadata: { id: string } };
		const id = `${pkg.publisher}.${pkg.name}`;

		if(obsolete[id]) {
			continue;
		}

		if(!ids[id] && id !== extensionId) {
			enabled.push({ id, version: pkg.version });
		}
	}

	const builtinDataPath = path.join(vscode.env.appRoot, 'extensions');
	const builtinExtensions = await globby('*/package.json', {
		cwd: builtinDataPath,
	});

	for(const packagePath of builtinExtensions) {
		const result = await fse.readJSON(path.join(builtinDataPath, packagePath));
		if(result.fails) {
			return err(`Cannot read the extension: ${packagePath}`);
		}

		const pkg = result.value as { name: string; publisher: string; version: string; __metadata: { id: string } };
		const id = `${pkg.publisher}.${pkg.name}`;

		if(!ids[id]) {
			builtin.disabled.push({ id, version: pkg.version });
		}
	}

	if(builtin.disabled.length > 0) {
		return ok({ builtin, disabled, enabled });
	}
	else {
		return ok({ disabled, enabled });
	}
} // }}}
