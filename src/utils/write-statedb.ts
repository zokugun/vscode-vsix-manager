import { Buffer } from 'buffer';
import path from 'path';
import fse from '@zokugun/fs-extra-plus/async';
import { err, OK, type Result } from '@zokugun/xtry';
import initSqlJs from 'sql.js';

export async function writeStateDB(userDataPath: string, query: string, args?: Record<string, any>): Promise<Result<void, string>> {
	const sql = await initSqlJs();
	const databasePath = path.join(userDataPath, 'globalStorage', 'state.vscdb');

	const buffer = await fse.readFile(databasePath);
	if(buffer.fails) {
		return err(`Cannot read the database ${databasePath}`);
	}

	const database = new sql.Database(buffer.value);

	try {
		database.exec(query, args);

		const data = database.export();
		const buffer = Buffer.from(data);

		const result = await fse.writeFile(databasePath, buffer);
		if(result.fails) {
			return err(`Cannot write the database ${databasePath}`);
		}
	}
	finally {
		database.close();
	}

	return OK;
}
