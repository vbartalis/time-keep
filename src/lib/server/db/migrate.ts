import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DB } from './index';

export function runMigrations(db: DB): void {
	migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
}
