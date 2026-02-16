import { Buffer } from 'buffer';
import fse from '@zokugun/fs-extra-plus/async';
import { err, OK, stringifyError, type Result } from '@zokugun/xtry';
import initSqlJs, { type Database } from 'sql.js';
import { Logger } from './logger.js';

export async function writeStateDB(databasePath: string, query: string, args?: Record<string, any>): Promise<Result<void, string>> {
	const sql = await initSqlJs();

	const buffer = await fse.readFile(databasePath);
	if(buffer.fails) {
		return err(`Cannot read the database ${databasePath}`);
	}

	let database: Database | undefined;
	let data: Uint8Array;

	try {
		database = new sql.Database(buffer.value);

		database.exec(query, args);

		data = database.export();
	}
	catch (error) {
		Logger.error(error);
		return err(stringifyError(error));
	}
	finally {
		database?.close();
		database = undefined;
	}

	const newBuffer = Buffer.from(data);

	const result = await fse.writeFile(databasePath, newBuffer);
	if(result.fails) {
		return err(`Cannot write the database ${databasePath}`);
	}

	return OK;
}
