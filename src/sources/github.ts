import process from 'process';
import { GitHub } from '../utils/types';

export function getReleasesUrl(extensionName: string, source: GitHub | undefined): string { // {{{
	if(source?.owner) {
		return `https://api.github.com/repos/${source.owner}/${extensionName}/releases`;
	}
	else {
		return `https://api.github.com/repos/${extensionName}/releases`;
	}
} // }}}

export function getHeaders(source: GitHub | undefined): {} | undefined { // {{{
	if(source?.token) {
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
					Authorization: `Bearer ${token}`,
				},
			};
		}
	}

	return undefined;
} // }}}
