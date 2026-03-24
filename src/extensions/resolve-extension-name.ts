import { toAlias } from '../aliases/to-alias.js';
import { type Aliases, type Metadata, type Source } from '../types.js';

export function resolveExtensionName(metadata: Metadata, source: Source, aliases: Aliases): string {
	if(source === 'github' || (source.type !== 'file' && source.type !== 'marketplace')) {
		const aliasName = toAlias(metadata);

		return aliases[aliasName] ?? metadata.fullName;
	}

	return metadata.fullName;
}
