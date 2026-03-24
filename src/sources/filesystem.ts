import path from 'path';
import fse from '@zokugun/fs-extra-plus/async';
import globby from 'globby';
import semver from 'semver';
import untildify from 'untildify';
import { TARGET_PLATFORM } from '../settings.js';
import type { FileSystem, Metadata, SearchFileResult } from '../types.js';
import { Logger } from '../utils/logger.js';
import { parseAssetName } from '../utils/parse-asset-name.js';

async function find(root: string, targetName: string, targetVersion: string | undefined): Promise<{ version: string; file: string }> { // {{{
	const foundFiles = await globby('*.vsix', {
		cwd: root,
		followSymbolicLinks: false,
	});

	let version: string = targetVersion ?? '';
	let platform: string = '';
	let file: string = '';

	for(const foundFile of foundFiles) {
		const result = parseAssetName(foundFile);

		if(result && result.name === targetName) {
			Logger.info(`found: ${file}`);

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

					version = result.version;
					platform = result.platform ?? '';
					file = foundFile;
				}
			}
			else {
				if(semver.gt(result.version, version)) {
					version = result.version;
					platform = result.platform ?? '';
					file = foundFile;
				}
				else if(semver.eq(result.version, version)) {
					if(platform && platform !== 'universal') {
						continue;
					}

					platform = result.platform ?? '';
					file = foundFile;
				}
			}
		}
	}

	return {
		version,
		file,
	};
} // }}}

export async function search({ fullName: extensionName, targetVersion }: Metadata, source: FileSystem): Promise<SearchFileResult | undefined> { // {{{
	const root = untildify(source.path);

	const result = await fse.exists(root);
	if(!result.value) {
		return;
	}

	let { version, file } = await find(root, extensionName, targetVersion);

	const names = /^([^.])\./.exec(extensionName);
	if(names) {
		const publisher = path.join(root, names[0]);
		if(await fse.isDir(publisher)) {
			const { version: foundVersion, file: foundFile } = await find(publisher, extensionName, targetVersion);

			if(semver.gt(foundVersion, version)) {
				version = foundVersion;
				file = foundFile;
			}
		}

		const extension = path.join(root, extensionName);
		if(await fse.isDir(extension)) {
			const { version: foundVersion, file: foundFile } = await find(extension, extensionName, targetVersion);

			if(semver.gt(foundVersion, version)) {
				version = foundVersion;
				file = foundFile;
			}
		}
	}

	if(file) {
		return {
			type: 'file',
			fullName: extensionName,
			version,
			file,
		};
	}
} // }}}
