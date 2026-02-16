import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import { WORKSPACE_STORAGE } from '../settings.js';

export async function isIgnoredWorkspace(): Promise<boolean> {
	if(!WORKSPACE_STORAGE) {
		return false;
	}

	const filePath = path.join(WORKSPACE_STORAGE, 'ignore');
	const exists = await fse.pathExists(filePath);

	return exists.value;
}
