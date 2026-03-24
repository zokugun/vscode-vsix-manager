import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import { GLOBAL_STORAGE } from '../settings.js';
import { type Aliases } from '../types.js';

export async function saveAliases(aliases: Aliases): Promise<void> {
	const filePath = path.join(GLOBAL_STORAGE, 'aliases.json');

	await fse.writeJSON(filePath, aliases);
}
