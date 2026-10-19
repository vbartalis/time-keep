import { readFileSync } from 'node:fs';
import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DB } from './index';

const DEFAULT_FOLDER = path.resolve(process.cwd(), 'drizzle');

export function runMigrations(db: DB, migrationsFolder = DEFAULT_FOLDER): void {
	migrate(db, { migrationsFolder });
}

/** The app's migrations as drizzle records them: `__drizzle_migrations.created_at`. */
export function appMigrations(migrationsFolder = DEFAULT_FOLDER): number[] {
	const journal = JSON.parse(
		readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')
	) as { entries: { when: number }[] };
	return journal.entries.map((e) => e.when);
}
