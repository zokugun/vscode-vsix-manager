import vscode from 'vscode';
import type { MarketPlaceOld, Source } from '../types.js';

export function listSources(config: vscode.WorkspaceConfiguration): Record<string, Source> | undefined {
	const sources = config.get<Record<string, MarketPlaceOld | Source>>('sources');
	if(!sources) {
		return;
	}

	for(const [key, source] of Object.entries(sources)) {
		if((source as MarketPlaceOld).kind === 'marketplace') {
			sources[key] = {
				type: 'marketplace',
				serviceUrl: (source as MarketPlaceOld).serviceUrl,
				itemUrl: (source as MarketPlaceOld).itemUrl,
				throttle: 0,
			};

			void vscode.window.showWarningMessage('Please update your config. The property `vsix.sources/kind` has been deprecated and replaced with the property `vsix.sources/type`.');
		}
	}

	return sources as Record<string, Source>;
}
