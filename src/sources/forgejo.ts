import process from 'process';
import type { Forgejo } from '../utils/types.js';

export function getReleasesUrl(extensionName: string, source: Forgejo): string { // {{{
	if(source.owner) {
		return `${source.serviceUrl}/repos/${source.owner}/${extensionName}/releases`;
	}
	else {
		return `${source.serviceUrl}/repos/${extensionName}/releases`;
	}
} // }}}

export function getHeaders(source: Forgejo): {} | undefined { // {{{
	if(source.token) {
		let token: string | undefined = '';

		if(source.token.startsWith('env:')) {
			token = process.env[source.token.slice(4)];
		}
		else {
			token = source.token;
		}

		if(token) {
			return {
				headers: {
					Authorization: `token ${token}`,
				},
			};
		}
	}

	return undefined;
} // }}}
