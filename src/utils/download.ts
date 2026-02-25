import { type SearchFileResult, type SearchResult } from '../types.js';

export async function download(result: SearchResult): Promise<SearchFileResult> {
	if(result.type === 'download') {
		const file = await result.download();

		return {
			...result,
			type: 'file',
			file,
			unlink: file,
		};
	}
	else {
		return result;
	}
}
