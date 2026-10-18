import { openDb, type DB } from '../db/index';
import { runMigrations } from '../db/migrate';

export function createTestDb(): DB {
	const db = openDb(':memory:');
	runMigrations(db);
	return db;
}
