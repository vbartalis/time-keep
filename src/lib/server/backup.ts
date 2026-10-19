import { rmSync, statSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { DB } from './db';
import { appMigrations, runMigrations } from './db/migrate';

export type RestoreResult = { ok: true } | { ok: false; message: string };

/** Tables whose rows are credentials: never written to a backup, never restored. */
const CREDENTIALS = ['session', 'access_token'];

const NOT_A_BACKUP = 'This file is not a time-keep backup.';
const NEWER = 'This backup is from a newer version of time-keep.';
const NO_ADMIN = 'This backup has no admin who can sign in.';
const FAILED = 'The restore failed; nothing was changed.';

/**
 * Drizzle's own journal is left out of the schema comparison and the copy: its DDL text
 * belongs to drizzle-orm, and once the upload is migrated both sides hold the same set.
 */
const JOURNAL = '__drizzle_migrations';

const SCHEMA_SQL = `SELECT type, name, tbl_name, sql FROM sqlite_master
	WHERE substr(name, 1, 7) <> 'sqlite_' AND tbl_name <> '${JOURNAL}' ORDER BY type, name`;

class Refusal extends Error {}

function quote(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

/** Removes the side files SQLite may leave next to a database file. */
function removeSideFiles(file: string): void {
	for (const suffix of ['-journal', '-wal', '-shm']) rmSync(file + suffix, { force: true });
}

/**
 * Writes a consistent copy of the database to `file` (which must not exist), with the
 * credential rows deleted and the file vacuumed so no free page still holds them.
 */
export function writeBackup(db: DB, file: string): void {
	try {
		db.$client.prepare('VACUUM INTO ?').run(file);
		const copy = new Database(file);
		try {
			copy.pragma('journal_mode = DELETE');
			for (const t of CREDENTIALS) copy.exec(`DELETE FROM ${quote(t)}`);
			copy.exec('VACUUM');
		} finally {
			copy.close();
		}
	} catch (e) {
		rmSync(file, { force: true });
		throw e;
	} finally {
		removeSideFiles(file);
	}
}

/** Checks the upload and brings it to the current schema, or throws a Refusal. */
function prepareUpload(db: DB, uploadFile: string, migrationsFolder?: string): void {
	let upload: Database.Database | undefined;
	try {
		upload = new Database(uploadFile, { fileMustExist: true });
		if (upload.pragma('integrity_check', { simple: true }) !== 'ok') {
			throw new Refusal(NOT_A_BACKUP);
		}
		const hasJournal = upload
			.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
			.get(JOURNAL);
		if (!hasJournal) throw new Refusal(NOT_A_BACKUP);

		const known = new Set(appMigrations(migrationsFolder));
		const recorded = upload.prepare('SELECT created_at FROM __drizzle_migrations').pluck().all();
		if (recorded.some((at) => !known.has(Number(at)))) throw new Refusal(NEWER);

		// The migrator needs only the session; the app's schema typing does not apply here.
		runMigrations(drizzle(upload) as unknown as DB, migrationsFolder);

		const same =
			JSON.stringify(upload.prepare(SCHEMA_SQL).all()) ===
			JSON.stringify(db.$client.prepare(SCHEMA_SQL).all());
		if (!same) throw new Refusal(NOT_A_BACKUP);
		const admin = upload
			.prepare('SELECT 1 FROM user WHERE is_admin = 1 AND disabled_at IS NULL LIMIT 1')
			.get();
		if (!admin) throw new Refusal(NO_ADMIN);
		if ((upload.pragma('foreign_key_check') as unknown[]).length > 0)
			throw new Refusal(NOT_A_BACKUP);
	} catch (error) {
		if (error instanceof Refusal) throw error;
		console.error(error);
		throw new Refusal(NOT_A_BACKUP);
	} finally {
		upload?.close();
	}
}

/** Replaces every row of the running database with the upload's, in one transaction. */
function copyIn(db: DB, uploadFile: string): void {
	const client = db.$client;
	client.prepare('ATTACH ? AS backup').run(uploadFile);
	try {
		const tables = (live: string) =>
			client
				.prepare(
					`SELECT name FROM ${live}.sqlite_master WHERE type = 'table'
					AND (substr(name, 1, 7) <> 'sqlite_' OR name = 'sqlite_sequence')
						AND name <> '${JOURNAL}'`
				)
				.pluck()
				.all() as string[];
		const main = tables('main');
		const incoming = new Set(tables('backup'));
		client.transaction(() => {
			client.pragma('defer_foreign_keys = ON');
			for (const t of main) client.exec(`DELETE FROM main.${quote(t)}`);
			for (const t of main) {
				if (CREDENTIALS.includes(t) || !incoming.has(t)) continue;
				client.exec(`INSERT INTO main.${quote(t)} SELECT * FROM backup.${quote(t)}`);
			}
		})();
	} finally {
		client.exec('DETACH backup');
	}
}

/**
 * Restores the uploaded backup into the running database: checks it, migrates it, keeps
 * the current data in `beforeRestoreFile`, then copies the upload's rows in. The upload
 * file itself is the caller's to remove; every side file is removed here.
 */
export function restoreBackup(
	db: DB,
	uploadFile: string,
	opts: { beforeRestoreFile: string; migrationsFolder?: string }
): RestoreResult {
	try {
		try {
			prepareUpload(db, uploadFile, opts.migrationsFolder);
		} catch (e) {
			return { ok: false, message: (e as Refusal).message };
		}
		try {
			rmSync(opts.beforeRestoreFile, { force: true });
			writeBackup(db, opts.beforeRestoreFile);
			copyIn(db, uploadFile);
		} catch (error) {
			console.error(error);
			return { ok: false, message: FAILED };
		}
		return { ok: true };
	} finally {
		removeSideFiles(uploadFile);
	}
}

/** When the before-restore file was written, or null when there is none. */
export function beforeRestoreInfo(file: string): { at: number } | null {
	try {
		return { at: statSync(file).mtimeMs };
	} catch {
		return null;
	}
}
