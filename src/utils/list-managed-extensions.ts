import path from 'path';
import fse from 'fs-extra';
import { GLOBAL_STORAGE } from '../settings';

export async function listManagedExtensions(): Promise<string[]> {
	const extensionsFileName = path.join(GLOBAL_STORAGE, 'extensions.json');

	await fse.ensureFile(extensionsFileName);

	const managedExtensions: Record<string, string> = (await fse.readJson(extensionsFileName, { throws: false }) ?? {}) as Record<string, string>;

	return Object.keys(managedExtensions);
}
