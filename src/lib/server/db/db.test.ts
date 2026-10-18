import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from './index';
import { createTestDb } from '../testing/db';
import { session, user } from './schema';

const now = Date.now();
const aUser = (id: string, username: string) => ({
	id,
	username,
	passwordHash: 'x',
	createdAt: now,
	updatedAt: now
});

describe('database', () => {
	it('has the user and session tables', () => {
		const db = createTestDb();
		const rows = db.$client
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			.all() as { name: string }[];
		const names = rows.map((r) => r.name);
		expect(names).toContain('user');
		expect(names).toContain('session');
	});

	it('enforces foreign keys', () => {
		const db = createTestDb();
		expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(() =>
			db.insert(session).values({ id: 's', userId: 'nobody', expiresAt: now, createdAt: now }).run()
		).toThrow();
	});

	it('keeps usernames unique', () => {
		const db = createTestDb();
		db.insert(user).values(aUser('1', 'a.b')).run();
		expect(() => db.insert(user).values(aUser('2', 'a.b')).run()).toThrow();
	});

	it('opens file databases in WAL mode', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'tk-'));
		const db = openDb(path.join(dir, 'nested', 'x.db'));
		try {
			expect(db.$client.pragma('journal_mode', { simple: true })).toBe('wal');
		} finally {
			db.$client.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
