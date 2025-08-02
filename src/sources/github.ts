import process from 'process';
import type { GitHub } from '../utils/types.js';

export function getReleasesUrl(extensionName: string, source: GitHub | undefined): string { // {{{
	const serviceUrl = source?.serviceUrl ?? 'https://api.github.com';
	if(source?.owner) {
		return `${serviceUrl}/repos/${source.owner}/${extensionName}/releases`;
	}
	else {
		return `${serviceUrl}/repos/${extensionName}/releases`;
	}
} // }}}

export function getAssetUrl(asset: unknown): string { // {{{
	return (asset as { url: string }).url;
} // }}}

export function getHeaders(source: GitHub | undefined): { headers: {} } | undefined { // {{{
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

export function getDownloadHeaders(source: GitHub | undefined): { headers: {} } | undefined { // {{{
	return {
		headers: {
			Accept: 'application/octet-stream',
			...getHeaders(source)?.headers,
		},
	};
} // }}}
