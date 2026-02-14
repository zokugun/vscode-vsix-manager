import * as FileSystem from '../sources/filesystem.js';
import * as Forgejo from '../sources/forgejo.js';
import * as Git from '../sources/git.js';
import * as GitHub from '../sources/github.js';
import * as Marketplace from '../sources/marketplace.js';
import type { PartialSearchResult, Metadata, SearchResult, Source } from '../types.js';
import { Logger } from './logger.js';
import { updateName } from './update-name.js';

export async function search(metadata: Metadata, source: Source, sources: Record<string, Source> | undefined, temporaryDir: string): Promise<SearchResult | undefined> {
	try {
		let result: SearchResult | PartialSearchResult | undefined;

		if(source === 'github') {
			result = await Git.search(metadata, undefined, GitHub, temporaryDir);
		}
		else if(source.type === 'file') {
			result = await FileSystem.search(metadata, source);
		}
		else if(source.type === 'forgejo') {
			result = await Git.search(metadata, source, Forgejo, temporaryDir);
		}
		else if(source.type === 'github') {
			result = await Git.search(metadata, source, GitHub, temporaryDir);
		}
		else if(source.type === 'marketplace') {
			result = await Marketplace.search(metadata, source, temporaryDir);
		}

		if(result) {
			const update = await updateName(result);
			if(!update.fails) {
				return update.value;
			}
		}
	}
	catch (error: unknown) {
		Logger.error(error);
	}

	if(source !== 'github' && source.fallback) {
		const newSource = sources![source.fallback];

		if(newSource) {
			Logger.info(`searching extension: ${source.fallback}:${metadata.fullName}`);

			return search(metadata, newSource, sources, temporaryDir);
		}
	}
}
