import { type Metadata } from '../types.js';

export function toAlias({ source, fullName, targetName }: Metadata): string {
	return `${source}:${fullName}${targetName ? `!${targetName}` : ''}`;
}
