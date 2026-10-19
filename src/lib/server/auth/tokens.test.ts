import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../testing/db';
import { accessToken, user } from '../db/schema';
import { authenticateToken, createToken, listTokens, revokeToken } from './tokens';

let db: ReturnType<typeof createTestDb>;

function addUser(id: string) {
	db.insert(user)
		.values({ id, username: id, passwordHash: 'x', isAdmin: false, createdAt: 1, updatedAt: 1 })
		.run();
	return id;
}

function make(userId: string, name = 'Laptop', now = 1000) {
	const r = createToken(db, userId, name, now);
	if (!r.ok) throw new Error(r.error);
	return r.value;
}

function lastUsed(id: string) {
	return db.select().from(accessToken).where(eq(accessToken.id, id)).get()!.lastUsedAt;
}

beforeEach(() => {
	db = createTestDb();
	addUser('u1');
	addUser('u2');
});

describe('createToken', () => {
	it('returns a tk_ token, stores only its SHA-256 hex', () => {
		const { token, summary } = make('u1');
		expect(token).toMatch(/^tk_[a-z2-7]{32}$/);
		const row = db.select().from(accessToken).where(eq(accessToken.id, summary.id)).get()!;
		expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
		expect(Object.values(row)).not.toContain(token);
		expect(summary).toEqual({ id: row.id, name: 'Laptop', createdAt: 1000, lastUsedAt: null });
	});

	it('trims the name and enforces 1-100 characters', () => {
		expect(make('u1', '  Laptop ').summary.name).toBe('Laptop');
		const copy = { ok: false, error: 'Name must be 1–100 characters.' };
		expect(createToken(db, 'u1', '')).toEqual(copy);
		expect(createToken(db, 'u1', '   ')).toEqual(copy);
		expect(createToken(db, 'u1', 'a'.repeat(101))).toEqual(copy);
		expect(createToken(db, 'u1', 5)).toEqual(copy);
		expect(createToken(db, 'u1', 'a'.repeat(100)).ok).toBe(true);
	});

	it('refuses a name taken case-insensitively, but not for another user', () => {
		make('u1');
		expect(createToken(db, 'u1', 'laptop')).toEqual({
			ok: false,
			error: 'You already have a token with that name.'
		});
		expect(createToken(db, 'u2', 'Laptop').ok).toBe(true);
	});
});

describe('authenticateToken', () => {
	it('accepts the bearer scheme in any case', () => {
		const { token } = make('u1');
		expect(authenticateToken(db, 'Bearer ' + token)).toEqual({ userId: 'u1' });
		expect(authenticateToken(db, 'bearer ' + token)).toEqual({ userId: 'u1' });
		expect(authenticateToken(db, 'BEARER ' + token)).toEqual({ userId: 'u1' });
	});

	it('rejects malformed headers and unknown tokens', () => {
		const { token } = make('u1');
		const bad = [
			null,
			'',
			'Bearer',
			'Bearer ',
			'Basic ' + token,
			'Bearer  ' + token,
			'Bearer ' + token + ' ',
			' Bearer ' + token,
			'Bearer ' + token.toUpperCase(),
			'Bearer tk_' + 'a'.repeat(32)
		];
		for (const h of bad) expect(authenticateToken(db, h)).toBeNull();
	});

	it('rejects a revoked token and a disabled user', () => {
		const a = make('u1');
		const b = make('u2');
		expect(revokeToken(db, 'u1', a.summary.id).ok).toBe(true);
		expect(authenticateToken(db, 'Bearer ' + a.token)).toBeNull();
		db.update(user).set({ disabledAt: 5 }).where(eq(user.id, 'u2')).run();
		expect(authenticateToken(db, 'Bearer ' + b.token)).toBeNull();
	});

	it('touches last_used_at at most once a minute', () => {
		const { token, summary } = make('u1');
		const h = 'Bearer ' + token;
		expect(lastUsed(summary.id)).toBeNull();
		authenticateToken(db, h, 10_000);
		expect(lastUsed(summary.id)).toBe(10_000);
		authenticateToken(db, h, 10_000 + 59_999);
		expect(lastUsed(summary.id)).toBe(10_000);
		authenticateToken(db, h, 10_000 + 60_000);
		expect(lastUsed(summary.id)).toBe(70_000);
	});
});

describe('listTokens / revokeToken', () => {
	it('lists the user own tokens newest first', () => {
		const a = make('u1', 'A', 1000);
		const b = make('u1', 'B', 2000);
		make('u2', 'C', 3000);
		expect(listTokens(db, 'u1').map((t) => t.id)).toEqual([b.summary.id, a.summary.id]);
	});

	it('will not revoke another user token or an unknown id', () => {
		const a = make('u1');
		const notFound = { ok: false, error: 'Token not found.' };
		expect(revokeToken(db, 'u2', a.summary.id)).toEqual(notFound);
		expect(revokeToken(db, 'u1', 'nope')).toEqual(notFound);
		expect(listTokens(db, 'u1')).toHaveLength(1);
	});
});
