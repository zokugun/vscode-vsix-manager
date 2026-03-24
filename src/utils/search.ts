import { err, ok, OK_UNDEFINED, type Result, stringifyError } from '@zokugun/xtry';
import * as FileSystem from '../sources/filesystem.js';
import * as Forgejo from '../sources/forgejo.js';
import * as Git from '../sources/git.js';
import * as GitHub from '../sources/github.js';
import * as Marketplace from '../sources/marketplace.js';
import type { Aliases, Metadata, SearchResult, Source } from '../types.js';
import { Logger } from './logger.js';

export async function search(metadata: Metadata, source: Source, sources: Record<string, Source> | undefined, temporaryDir: string, aliases: Aliases): Promise<Result<SearchResult | undefined, string>> {
	let result: SearchResult | undefined;

	try {
		if(source === 'github') {
			result = await Git.search(metadata, undefined, GitHub, temporaryDir, aliases);
		}
		else if(source.type === 'file') {
			result = await FileSystem.search(metadata, source);
		}
		else if(source.type === 'forgejo') {
			result = await Git.search(metadata, source, Forgejo, temporaryDir, aliases);
		}
		else if(source.type === 'github') {
			result = await Git.search(metadata, source, GitHub, temporaryDir, aliases);
		}
		else if(source.type === 'marketplace') {
			result = await Marketplace.search(metadata, source, temporaryDir);
		}
	}
	catch (error: unknown) {
		return err(stringifyError(error));
	}

	if(result) {
		return ok(result);
	}

	if(source !== 'github' && source.fallback) {
		const newSource = sources![source.fallback];

		if(newSource) {
			Logger.info(`searching extension: ${source.fallback}:${metadata.fullName}`);

			return search(metadata, newSource, sources, temporaryDir, aliases);
		}
	}

	return OK_UNDEFINED;
}
