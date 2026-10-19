import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from './auth/sessions';
import { createToken } from './auth/tokens';
import { beforeRestoreInfo, restoreBackup, writeBackup } from './backup';
import { openCore } from './core/index';
import { openDb, type DB } from './db/index';
import { runMigrations } from './db/migrate';
import { createUser } from './users';

const PW = 'correct-horse-battery';
const NOT_A_BACKUP = 'This file is not a time-keep backup.';
const TABLES = ['customer', 'entry', 'batch', 'change', 'user'] as const;

let dir: string;
let db: DB;
let adminId: string;

const at = (name: string) => path.join(dir, name);

function val<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.value;
}

function rows(conn: Database.Database, table: string): unknown[] {
	return conn.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all();
}

function snapshot(): Record<string, unknown[]> {
	return Object.fromEntries(TABLES.map((t) => [t, rows(db.$client, t)]));
}

function count(conn: Database.Database, table: string): number {
	return (conn.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;
}

function customerNames(conn: Database.Database = db.$client): string[] {
	return (conn.prepare('SELECT name FROM customer ORDER BY name').all() as { name: string }[]).map(
		(r) => r.name
	);
}

/** Reads an SQLite file on its own connection, closing it after. */
function inspect<T>(file: string, fn: (conn: Database.Database) => T): T {
	const conn = new Database(file);
	try {
		return fn(conn);
	} finally {
		conn.close();
	}
}

function seed() {
	const core = openCore(db, adminId, 'ui');
	const c = val(core.customers.create({ name: 'Acme' }));
	const p = val(core.projects.create({ customerId: c.id, name: 'Site' }));
	val(
		core.entries.create({
			projectId: p.id,
			timeZone: 'UTC',
			start: '2026-10-18T09:00',
			durationMinutes: 30
		})
	);
	return core;
}

/** The directory holds only the live database's files and the named inputs. */
function expectOnly(...inputs: string[]) {
	const left = readdirSync(dir).filter((f) => !/^live\.db(-wal|-shm)?$/.test(f));
	expect(left.sort()).toEqual([...inputs].sort());
}

beforeEach(async () => {
	dir = mkdtempSync(path.join(tmpdir(), 'tk-backup-'));
	db = openDb(at('live.db'));
	runMigrations(db);
	const r = await createUser(db, { username: 'admin', password: PW, isAdmin: true });
	if (!r.ok) throw new Error(r.error);
	adminId = r.value.id;
});

afterEach(() => {
	vi.restoreAllMocks();
	db.$client.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('writeBackup', () => {
	it('copies the data and leaves out sessions and access tokens, even as free pages', () => {
		seed();
		const token = val(createToken(db, adminId, 'agent')).token;
		createSession(db, adminId);
		const hash = (
			db.$client.prepare('SELECT token_hash FROM access_token').get() as { token_hash: string }
		).token_hash;
		const sessionId = (db.$client.prepare('SELECT id FROM session').get() as { id: string }).id;
		expect(token).toBeTruthy();

		writeBackup(db, at('out.db'));

		inspect(at('out.db'), (conn) => {
			for (const t of ['customer', 'entry', 'batch', 'change']) {
				expect(rows(conn, t)).toEqual(rows(db.$client, t));
				expect(rows(conn, t).length).toBeGreaterThan(0);
			}
			expect(count(conn, 'session')).toBe(0);
			expect(count(conn, 'access_token')).toBe(0);
		});
		const bytes = readFileSync(at('out.db'));
		expect(bytes.includes(Buffer.from(hash))).toBe(false);
		expect(bytes.includes(Buffer.from(sessionId))).toBe(false);
		expectOnly('out.db');
	});
});

describe('restoreBackup', () => {
	const opts = () => ({ beforeRestoreFile: at('before.db') });

	it('restores the backed-up rows exactly and signs everyone out', () => {
		const core = seed();
		writeBackup(db, at('backup.db'));
		const before = snapshot();
		val(core.customers.create({ name: 'Later' }));
		val(createToken(db, adminId, 'agent'));
		createSession(db, adminId);

		expect(restoreBackup(db, at('backup.db'), opts())).toEqual({ ok: true });

		expect(snapshot()).toEqual(before);
		expect(customerNames()).not.toContain('Later');
		expect(count(db.$client, 'session')).toBe(0);
		expect(count(db.$client, 'access_token')).toBe(0);
		inspect(at('before.db'), (conn) => {
			expect(customerNames(conn)).toContain('Later');
			expect(count(conn, 'session')).toBe(0);
			expect(count(conn, 'access_token')).toBe(0);
		});
		expectOnly('backup.db', 'before.db');
	});

	it('restores the same file twice, and the before-restore file brings the data back', () => {
		const core = seed();
		writeBackup(db, at('backup.db'));
		val(core.customers.create({ name: 'Later' }));

		expect(restoreBackup(db, at('backup.db'), opts())).toEqual({ ok: true });
		// The admin downloads the before-restore file; uploading it gives a fresh file.
		copyFileSync(at('before.db'), at('kept.db'));
		expect(restoreBackup(db, at('backup.db'), opts())).toEqual({ ok: true });
		expect(customerNames()).toEqual(['Acme']);

		expect(restoreBackup(db, at('kept.db'), opts())).toEqual({ ok: true });
		expect(customerNames()).toEqual(['Acme', 'Later']);
	});

	it('restores the before-restore file itself, uploaded as a copy', () => {
		const core = seed();
		writeBackup(db, at('backup.db'));
		val(core.customers.create({ name: 'Later' }));
		expect(restoreBackup(db, at('backup.db'), opts())).toEqual({ ok: true });

		copyFileSync(at('before.db'), at('upload.db'));
		expect(restoreBackup(db, at('upload.db'), opts())).toEqual({ ok: true });
		expect(customerNames()).toEqual(['Acme', 'Later']);
	});

	describe('refuses, changing nothing', () => {
		function expectRefusal(file: string, message: string) {
			const before = snapshot();
			expect(restoreBackup(db, at(file), opts())).toEqual({ ok: false, message });
			expect(snapshot()).toEqual(before);
			expect(existsSync(at('before.db'))).toBe(false);
			expectOnly(file);
		}

		function backupWith(sql: string, pragmas: string[] = []) {
			writeBackup(db, at('up.db'));
			inspect(at('up.db'), (conn) => {
				for (const p of pragmas) conn.pragma(p);
				conn.exec(sql);
			});
		}

		beforeEach(() => {
			seed();
		});

		it('a text file, logging the error', () => {
			const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
			writeFileSync(at('up.db'), 'hello');
			expectRefusal('up.db', NOT_A_BACKUP);
			expect(logged).toHaveBeenCalledOnce();
		});

		it('an SQLite file of another app', () => {
			inspect(at('up.db'), (conn) => conn.exec('CREATE TABLE t(x)'));
			expectRefusal('up.db', NOT_A_BACKUP);
		});

		it('a backup from a newer version', () => {
			backupWith(
				"INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('future', 9999999999999)"
			);
			expectRefusal('up.db', 'This backup is from a newer version of time-keep.');
		});

		it('a backup with an extra column', () => {
			backupWith('ALTER TABLE customer ADD COLUMN x');
			expectRefusal('up.db', NOT_A_BACKUP);
		});

		it('a backup whose only admin is disabled', () => {
			backupWith('UPDATE user SET disabled_at = 1');
			expectRefusal('up.db', 'This backup has no admin who can sign in.');
		});

		it('a backup with a broken foreign key', () => {
			backupWith("UPDATE project SET customer_id = 'missing'", ['foreign_keys = OFF']);
			expectRefusal('up.db', NOT_A_BACKUP);
		});
	});

	it("ignores how the upload spells drizzle's own journal table", () => {
		seed();
		writeBackup(db, at('up.db'));
		inspect(at('up.db'), (conn) => {
			conn.exec(`CREATE TABLE journal_copy AS SELECT * FROM __drizzle_migrations;
				DROP TABLE __drizzle_migrations;
				CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,
					hash TEXT NOT NULL,   created_at NUMERIC);
				INSERT INTO __drizzle_migrations SELECT * FROM journal_copy;
				DROP TABLE journal_copy`);
		});
		expect(restoreBackup(db, at('up.db'), opts())).toEqual({ ok: true });
	});

	it('migrates and restores a backup from an older version', async () => {
		const folder = at('drizzle');
		cpSync(path.resolve(process.cwd(), 'drizzle'), folder, { recursive: true });
		const journalFile = path.join(folder, 'meta', '_journal.json');
		const journal = JSON.parse(readFileSync(journalFile, 'utf8'));
		journal.entries = journal.entries.slice(0, 4);
		writeFileSync(journalFile, JSON.stringify(journal));

		const old = openDb(at('old.db'));
		runMigrations(old, folder);
		expect(
			old.$client.prepare("SELECT name FROM sqlite_master WHERE name = 'access_token'").get()
		).toBeUndefined();
		const r = await createUser(old, { username: 'olden', password: PW, isAdmin: true });
		if (!r.ok) throw new Error(r.error);
		old.$client.close();

		const schema = () =>
			db.$client.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name').all();
		const liveSchema = schema();

		expect(restoreBackup(db, at('old.db'), opts())).toEqual({ ok: true });
		expect(
			(db.$client.prepare('SELECT username, is_admin FROM user').all() as unknown[]).length
		).toBe(1);
		expect(db.$client.prepare('SELECT id, username, is_admin FROM user').get()).toEqual({
			id: r.value.id,
			username: 'olden',
			is_admin: 1
		});
		expect(schema()).toEqual(liveSchema);
	});

	it('rolls back a failure inside the copy, detaches, and restores after', () => {
		seed();
		writeBackup(db, at('backup.db'));
		val(openCore(db, adminId, 'ui').customers.create({ name: 'Later' }));
		const before = snapshot();
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		db.$client.exec(
			"CREATE TEMP TRIGGER boom BEFORE INSERT ON main.customer BEGIN SELECT RAISE(ABORT, 'boom'); END"
		);

		expect(restoreBackup(db, at('backup.db'), opts())).toEqual({
			ok: false,
			message: 'The restore failed; nothing was changed.'
		});
		expect(snapshot()).toEqual(before);
		const attached = (db.$client.pragma('database_list') as { name: string }[]).map((d) => d.name);
		expect(attached).not.toContain('backup');
		expect(logged).toHaveBeenCalledOnce();

		db.$client.exec('DROP TRIGGER temp.boom');
		expect(restoreBackup(db, at('backup.db'), opts())).toEqual({ ok: true });
		expect(customerNames()).toEqual(['Acme']);
	});
});

describe('beforeRestoreInfo', () => {
	it('is null without the file and its time after a restore', () => {
		expect(beforeRestoreInfo(at('before.db'))).toBeNull();
		seed();
		writeBackup(db, at('backup.db'));
		expect(restoreBackup(db, at('backup.db'), { beforeRestoreFile: at('before.db') })).toEqual({
			ok: true
		});
		expect(beforeRestoreInfo(at('before.db'))).toEqual({
			at: statSync(at('before.db')).mtimeMs
		});
	});
});
