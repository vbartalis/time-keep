import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db';
import { session, user } from '../db/schema';
import { createTestDb } from '../testing/db';
import {
	createSession,
	generateSessionToken,
	invalidateSession,
	invalidateUserSessions,
	validateSessionToken
} from './sessions';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

let db: DB;

function addUser(id: string, disabledAt: number | null = null) {
	db.insert(user)
		.values({
			id,
			username: id,
			passwordHash: 'x',
			disabledAt,
			createdAt: NOW,
			updatedAt: NOW
		})
		.run();
}

function rows(userId: string) {
	return db.select().from(session).where(eq(session.userId, userId)).all();
}

beforeEach(() => {
	db = createTestDb();
	addUser('u1');
});

describe('generateSessionToken', () => {
	it('is 32 lowercase base32 characters', () => {
		expect(generateSessionToken()).toMatch(/^[a-z2-7]{32}$/);
	});
});

describe('createSession', () => {
	it('stores the hash of the token, not the token', () => {
		const { token, session: s } = createSession(db, 'u1', NOW);
		expect(s.id).not.toBe(token);
		expect(s.id).toMatch(/^[0-9a-f]{64}$/);
		expect(s.expiresAt).toBe(NOW + 30 * DAY);
		expect(rows('u1')).toHaveLength(1);
	});
});

describe('validateSessionToken', () => {
	it('returns the user for a valid token', () => {
		const { token } = createSession(db, 'u1', NOW);
		const res = validateSessionToken(db, token, NOW + DAY);
		expect(res?.user.id).toBe('u1');
		expect(res?.renewed).toBe(false);
	});
	it('returns null for an unknown token', () => {
		expect(validateSessionToken(db, 'nope', NOW)).toBeNull();
	});
	it('expires and deletes the row', () => {
		const { token } = createSession(db, 'u1', NOW);
		expect(validateSessionToken(db, token, NOW + 30 * DAY + 1)).toBeNull();
		expect(rows('u1')).toHaveLength(0);
	});
	it('does not renew with 16 days left', () => {
		const { token, session: s } = createSession(db, 'u1', NOW);
		const res = validateSessionToken(db, token, NOW + 14 * DAY);
		expect(res?.renewed).toBe(false);
		expect(res?.session.expiresAt).toBe(s.expiresAt);
	});
	it('renews with fewer than 15 days left', () => {
		const { token } = createSession(db, 'u1', NOW);
		const res = validateSessionToken(db, token, NOW + 20 * DAY);
		expect(res?.renewed).toBe(true);
		expect(res?.session.expiresAt).toBe(NOW + 20 * DAY + 30 * DAY);
		expect(rows('u1')[0].expiresAt).toBe(NOW + 50 * DAY);
	});
	it('rejects a disabled user and deletes all their sessions', () => {
		addUser('u2', NOW);
		const a = createSession(db, 'u2', NOW);
		createSession(db, 'u2', NOW);
		expect(validateSessionToken(db, a.token, NOW + DAY)).toBeNull();
		expect(rows('u2')).toHaveLength(0);
	});
});

describe('invalidation', () => {
	it('invalidateSession removes one session', () => {
		const a = createSession(db, 'u1', NOW);
		invalidateSession(db, a.session.id);
		expect(rows('u1')).toHaveLength(0);
	});
	it('invalidateUserSessions keeps the excepted one', () => {
		const keep = createSession(db, 'u1', NOW);
		createSession(db, 'u1', NOW);
		createSession(db, 'u1', NOW);
		invalidateUserSessions(db, 'u1', keep.session.id);
		expect(rows('u1').map((r) => r.id)).toEqual([keep.session.id]);
	});
	it('invalidateUserSessions without exception removes all', () => {
		createSession(db, 'u1', NOW);
		invalidateUserSessions(db, 'u1');
		expect(rows('u1')).toHaveLength(0);
	});
});
