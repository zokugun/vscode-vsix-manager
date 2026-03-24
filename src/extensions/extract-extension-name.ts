import path from 'node:path';
import { isNonBlankString, isRecord } from '@zokugun/is-it-type';
import { err, ok, type Result, toStringFailure, xdefer, xtrySync } from '@zokugun/xtry/async';
import { open, streamToString } from '@zokugun/yauzl-plus';

export async function extractExtensionName(file: string): Promise<Result<string, string>> {
	const zipResult = await open(file, {
		decodeStrings: true,
		strictFilenames: false,
	});

	if(zipResult.fails) {
		return err(`Cannot open the zip file ${path.basename(file)}`);
	}

	const zip = zipResult.value;
	const close = xdefer(zip.close, zip);

	for await (const entryResult of zip) {
		if(entryResult.fails) {
			return close(toStringFailure(entryResult));
		}

		const entry = entryResult.value;
		if(!entry) {
			break; // No more files
		}

		const name = entry.filename;

		if(name !== 'extension/package.json') {
			continue;
		}

		const streamResult = await entry.openReadStream();
		if(streamResult.fails) {
			return close(streamResult);
		}

		const packageResult = await streamToString(streamResult.value);
		if(packageResult.fails) {
			return close(packageResult);
		}

		const packageJsonResult = xtrySync<unknown>(() => JSON.parse(packageResult.value));
		if(packageJsonResult.fails) {
			return close(toStringFailure(packageJsonResult));
		}

		const packageJson = packageJsonResult.value;

		if(isRecord(packageJson) && isNonBlankString(packageJson.publisher) && isNonBlankString(packageJson.name)) {
			const fullName = `${packageJson.publisher as string}.${packageJson.name as string}`;

			return close(ok(fullName));
		}
	}

	return close(err('package.json not found in zip file'));
}
