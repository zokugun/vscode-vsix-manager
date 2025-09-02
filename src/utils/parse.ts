import type { Metadata } from './types.js';

export function parse(data: unknown): Metadata[] {
	const result: Metadata[] = [];

	if(Array.isArray(data)) {
		for(const d of data) {
			if(typeof d === 'string') {
				parseString(d, null, result);
			}
		}
	}
	else {
		parseUniq(data, result);
	}

	return result;
}

function parseString(data: string, enabled: boolean | null, result: Metadata[]): void {
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
				parseString(alt.trim(), enabled, result);
			}

			return;
		}
	}

	if(data.includes(':')) {
		const matches = /^([^:]*):(.*?)(?:@(\d+\.\d+\.\d+))?$/.exec(data);

		if(matches) {
			const [, source, fullName, version] = matches;

			result.push({
				kind: 'extension',
				source,
				fullName,
				version,
				enabled,
			});
		}
	}
	else if(data.includes('.')) {
		const matches = /^(.*?)(?:@(\d+\.\d+\.\d+))?$/.exec(data);

		if(matches) {
			const [, fullName, version] = matches;

			result.push({
				kind: 'extension',
				fullName,
				version,
				enabled,
			});
		}
	}
	else {
		result.push({
			kind: 'group',
			fullName: data,
			enabled,
		});
	}
}

function parseUniq(data: any, result: Metadata[]): void {
	if(!data) {
		return;
	}

	if(typeof data === 'string') {
		parseString(data, null, result);
	}

	if(typeof data !== 'object') {
		return;
	}

	const { id } = data as { id: unknown };

	if(!id) {
		return;
	}

	let enabled = true;
	if(typeof data.enabled === 'boolean') {
		enabled = Boolean(data.enabled);
	}

	if(Array.isArray(id)) {
		for(const d of id) {
			if(typeof d === 'string') {
				parseString(d, enabled, result);
			}
		}
	}
	else if(typeof id === 'string') {
		parseString(id, enabled, result);
	}
}
