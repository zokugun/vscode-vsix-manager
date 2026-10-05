import { isString } from '@zokugun/is-it-type';
import * as vscode from 'vscode';

import { IS_REMOTE } from './settings.js';
import { Logger } from './logger.js';

export function getExtensions(config: vscode.WorkspaceConfiguration): unknown[] | undefined {
	Logger.debug('IS_REMOTE:', IS_REMOTE);

	if(!IS_REMOTE) {
		return config.get<unknown[]>('extensions');
	}

	const enabled = config.get<boolean>('remote.enabled') ?? false;

	Logger.debug('remote.enabled:', enabled);

	if(!enabled) {
		return config.get<unknown[]>('extensions');
	}

	const { remoteAuthority } = vscode.env;

	Logger.debug('remoteAuthority:', remoteAuthority);

	if(!isString(remoteAuthority)) {
		return config.get<unknown[]>('extensions');
	}

	const index = remoteAuthority.indexOf('+');
	const remote = index === -1 ? remoteAuthority : remoteAuthority.slice(index + 1);

	Logger.debug('remote:', remote);

	const hostMap = config.get<Record<string, unknown[]>>('remote.extensions') ?? {};

	return hostMap[remote];
}
