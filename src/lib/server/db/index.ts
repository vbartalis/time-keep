import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export function openDb(file: string): DB {
	if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
	const client = new Database(file);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	return drizzle(client, { schema });
}

let instance: DB | undefined;

/** Opens the app database once; the server hooks call this with the configured path. */
export function initDb(file: string): DB {
	instance ??= openDb(file);
	return instance;
}

export function getDb(): DB {
	if (!instance) throw new Error('Database not initialised: initDb() runs at server start.');
	return instance;
}
