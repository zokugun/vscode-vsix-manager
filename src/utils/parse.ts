import { Extension } from './types';

export function parse(data: unknown): Extension[] {
	const result: Extension[] = [];

	if(Array.isArray(data)) {
		for(const d of data) {
			parseString(d, null, result, null);
		}
	}
	else {
		parseUniq(data, result);
	}

	return result;
}

function parseString(data: string, enabled: boolean | null, result: Extension[], targetPlatform: string | null): void {
	if(enabled === null) {
		if(data.startsWith('-')) {
			enabled = false;
			data = data.slice(1).trim();
		}
		else {
			enabled = true;
		}

		const alts = data.split('||');

		if(alts.length > 1) {
			for(const alt of alts) {
				parseString(alt.trim(), enabled, result, targetPlatform);
			}

			return;
		}
	}

	if(data.includes(':')) {
		const [source, fullName] = data.split(':');

		result.push({
			kind: 'extension',
			source,
			fullName,
			enabled,
			targetPlatform,
		});
	}
	else if(data.includes('.')) {
		result.push({
			kind: 'extension',
			fullName: data,
			enabled,
			targetPlatform,
		});
	}
	else {
		result.push({
			kind: 'group',
			fullName: data,
			enabled,
			targetPlatform,
		});
	}
}

function parseUniq(data: any, result: Extension[]): void {
	if(!data) {
		return;
	}

	if(typeof data === 'string') {
		parseString(data, null, result, null);
	}

	if(typeof data !== 'object') {
		return;
	}

	if(!data.id) {
		return;
	}

	let enabled = true;
	if(typeof data.enabled === 'boolean') {
		enabled = Boolean(data.enabled);
	}

	if(Array.isArray(data.id)) {
		for(const d of data.id) {
			if(typeof d === 'string') {
				parseString(d, enabled, result, null);
			}
		}
	}
	else if(typeof data.id === 'string') {
		let targetPlatform: string | null = null;
		if(typeof data.targetPlatform === 'string') {
			targetPlatform = data.targetPlatform as string | null;
		}

		parseString(data.id, enabled, result, targetPlatform);
	}
}
