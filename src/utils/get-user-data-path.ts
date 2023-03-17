import path from 'path';
import process from 'process';
import { GLOBAL_STORAGE } from '../settings';

export function getUserDataPath(): string { // {{{
	const globalStoragePath = process.env.VSCODE_PORTABLE ? path.resolve(process.env.VSCODE_PORTABLE, 'user-data') : path.resolve(GLOBAL_STORAGE, '../../..');

	return path.resolve(globalStoragePath, 'User');
} // }}}
