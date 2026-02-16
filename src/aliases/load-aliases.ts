import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import { isRecord } from '@zokugun/is-it-type';
import { GLOBAL_STORAGE } from '../settings.js';
import { type Aliases } from '../types.js';

export async function loadAliases(): Promise<Aliases> {
	const filePath = path.join(GLOBAL_STORAGE, 'aliases.json');
	const result = await fse.readJSON(filePath);

	return isRecord(result.value) ? result.value as Aliases : {};
}
