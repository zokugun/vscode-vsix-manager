export function parseAssetName(assetName: string): { name: string; platform?: string; version?: string } | undefined { // {{{
	if(!assetName.endsWith('.vsix')) {
		return undefined;
	}

	const result: { name: string; platform?: string; version?: string } = { name: '' };
	let left2parse = assetName.slice(0, Math.max(0, assetName.length - 5));
	let match = /^(.*?)-(\d+\.\d+\.\d+)/.exec(left2parse);

	if(match) {
		left2parse = match[1];
		result.version = match[2];
	}

	match = /^(.*?)-((?:alpine|darwin|linux|win32)-[a-z][a-z\d]+|universal)/.exec(left2parse);

	if(match) {
		result.name = match[1];
		result.platform = match[2];
	}
	else {
		result.name = left2parse;
	}

	return result;
} // }}}
