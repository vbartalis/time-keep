import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('./auth/credentials', async () => {
	const actual = await vi.importActual<typeof import('./auth/credentials')>('./auth/credentials');
	return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

import { verifyPassword } from './auth/credentials';
import { createTestDb } from './testing/db';
import { accessToken, session, user } from './db/schema';
import type { DB } from './db/index';
import { createSession } from './auth/sessions';
import { createToken } from './auth/tokens';
import { SignInThrottle } from './auth/throttle';
import {
	authenticate,
	changeOwnPassword,
	createUser,
	listUsers,
	setDisabled,
	setPassword
} from './users';

const PW = 'correct-horse-battery';
let db: ReturnType<typeof createTestDb>;

async function make(username: string, isAdmin = false) {
	const r = await createUser(db, { username, password: PW, isAdmin });
	if (!r.ok) throw new Error(r.error);
	return r.value;
}

function sessionIds(userId: string) {
	return db
		.select()
		.from(session)
		.where(eq(session.userId, userId))
		.all()
		.map((s) => s.id);
}

beforeEach(() => {
	db = createTestDb();
	vi.mocked(verifyPassword).mockClear();
});

describe('createUser / listUsers', () => {
	it('normalizes the username and lists ordered by username', async () => {
		await make('  Zed ');
		await make('amy');
		expect(listUsers(db).map((u) => u.username)).toEqual(['amy', 'zed']);
	});

	it('rejects a duplicate case-insensitively', async () => {
		await make('Bob');
		const r = await createUser(db, { username: 'bob', password: PW, isAdmin: false });
		expect(r).toEqual({ ok: false, error: 'Username is taken.' });
	});

	function stubDbInsertThrowing(code: string): DB {
		const err = Object.assign(new Error('boom'), { code });
		return {
			select: () => ({ from: () => ({ where: () => ({ get: () => undefined }) }) }),
			insert: () => ({
				values: () => ({
					run: () => {
						throw err;
					}
				})
			})
		} as unknown as DB;
	}

	it('maps a unique-constraint error from the insert to taken', async () => {
		const r = await createUser(stubDbInsertThrowing('SQLITE_CONSTRAINT_UNIQUE'), {
			username: 'bob',
			password: PW,
			isAdmin: false
		});
		expect(r).toEqual({ ok: false, error: 'Username is taken.' });
	});

	it('rethrows other constraint errors', async () => {
		await expect(
			createUser(stubDbInsertThrowing('SQLITE_CONSTRAINT_NOTNULL'), {
				username: 'bob',
				password: PW,
				isAdmin: false
			})
		).rejects.toThrow('boom');
	});

	it('rejects invalid username and password', async () => {
		expect((await createUser(db, { username: 'a', password: PW, isAdmin: false })).ok).toBe(false);
		expect(
			(await createUser(db, { username: 'carol', password: 'short', isAdmin: false })).ok
		).toBe(false);
	});
});

describe('authenticate', () => {
	it('normalizes the username', async () => {
		await make('admin');
		const r = await authenticate(db, '  Admin ', PW, 'a', new SignInThrottle());
		expect(r.ok && r.value.username).toBe('admin');
	});

	it('gives identical errors for unknown user and wrong password, verifying once', async () => {
		await make('admin');
		const t = new SignInThrottle();
		vi.mocked(verifyPassword).mockClear();
		const unknown = await authenticate(db, 'nobody', PW, 'a', t);
		expect(verifyPassword).toHaveBeenCalledTimes(1);
		const wrong = await authenticate(db, 'admin', 'wrong-password-x', 'a', t);
		expect(unknown).toEqual({ ok: false, error: 'Wrong username or password.' });
		expect(wrong).toEqual(unknown);
	});

	it('refuses a disabled user', async () => {
		const u = await make('dan');
		setDisabled(db, 'someone-else', u.id, true);
		vi.mocked(verifyPassword).mockClear();
		const r = await authenticate(db, 'dan', PW, 'a', new SignInThrottle());
		expect(verifyPassword).toHaveBeenCalledTimes(1);
		expect(r).toEqual({ ok: false, error: 'Wrong username or password.' });
	});

	it('locks after 5 failures, even with the right password', async () => {
		await make('eve');
		const t = new SignInThrottle();
		for (let i = 0; i < 5; i++) await authenticate(db, 'eve', 'wrong-password-x', 'a', t);
		vi.mocked(verifyPassword).mockClear();
		const r = await authenticate(db, 'eve', PW, 'a', t);
		expect(verifyPassword).not.toHaveBeenCalled();
		expect(r).toEqual({ ok: false, error: 'Too many attempts. Try again in 15 minutes.' });
	});

	it('counts in-flight attempts, so parallel guesses cannot bypass the lock', async () => {
		await make('par');
		const t = new SignInThrottle();
		vi.mocked(verifyPassword).mockClear();
		const results = await Promise.all(
			Array.from({ length: 10 }, () => authenticate(db, 'par', 'wrong-password-x', 'a', t))
		);
		expect(vi.mocked(verifyPassword).mock.calls.length).toBeLessThanOrEqual(5);
		const locked = results.filter(
			(r) => !r.ok && r.error === 'Too many attempts. Try again in 15 minutes.'
		);
		expect(locked.length).toBeGreaterThanOrEqual(5);
	});

	it('success resets the failure count', async () => {
		await make('fay');
		const t = new SignInThrottle();
		for (let i = 0; i < 4; i++) await authenticate(db, 'fay', 'wrong-password-x', 'a', t);
		expect((await authenticate(db, 'fay', PW, 'a', t)).ok).toBe(true);
		for (let i = 0; i < 4; i++) await authenticate(db, 'fay', 'wrong-password-x', 'a', t);
		expect((await authenticate(db, 'fay', PW, 'a', t)).ok).toBe(true);
	});
});

describe('passwords', () => {
	it('setPassword keeps only keepSessionId and updates the hash', async () => {
		const u = await make('gus');
		const keepId = createSession(db, u.id).session.id;
		createSession(db, u.id);
		const r = await setPassword(db, u.id, 'brand-new-password', keepId);
		expect(r.ok).toBe(true);
		expect(sessionIds(u.id)).toEqual([keepId]);
		expect(
			(await authenticate(db, 'gus', 'brand-new-password', 'a', new SignInThrottle())).ok
		).toBe(true);
	});

	it('setPassword and setDisabled report an unknown user', async () => {
		expect(await setPassword(db, 'nope', 'brand-new-password')).toEqual({
			ok: false,
			error: 'User not found.'
		});
		expect(setDisabled(db, 'actor', 'nope', true)).toEqual({ ok: false, error: 'User not found.' });
	});

	it('setPassword validates', async () => {
		const u = await make('hal');
		expect((await setPassword(db, u.id, 'short')).ok).toBe(false);
	});

	it('changeOwnPassword with a wrong current password changes nothing', async () => {
		const u = await make('ivy');
		createSession(db, u.id);
		const before = db.select().from(user).where(eq(user.id, u.id)).get()!;
		const r = await changeOwnPassword(db, u.id, 'not-the-password', 'brand-new-password', 'x');
		expect(r).toEqual({ ok: false, error: 'Current password is incorrect.' });
		const after = db.select().from(user).where(eq(user.id, u.id)).get()!;
		expect(after.passwordHash).toBe(before.passwordHash);
		expect(sessionIds(u.id)).toHaveLength(1);
	});

	it('changeOwnPassword succeeds with the right current password', async () => {
		const u = await make('jon');
		const r = await changeOwnPassword(db, u.id, PW, 'brand-new-password', 'x');
		expect(r.ok).toBe(true);
	});

	it('password changes leave access tokens alone', async () => {
		const u = await make('rae');
		createToken(db, u.id, 'Laptop');
		await changeOwnPassword(db, u.id, PW, 'brand-new-password', 'x');
		await setPassword(db, u.id, 'another-new-password');
		expect(db.select().from(accessToken).where(eq(accessToken.userId, u.id)).all()).toHaveLength(1);
	});
});

describe('setDisabled', () => {
	it('refuses self-disable', async () => {
		const a = await make('kim', true);
		expect(setDisabled(db, a.id, a.id, true)).toEqual({
			ok: false,
			error: 'You cannot disable yourself.'
		});
	});

	it('disables another admin, deleting sessions, and enabling clears disabledAt', async () => {
		const a = await make('lee', true);
		const b = await make('max', true);
		createSession(db, b.id);
		expect(setDisabled(db, a.id, b.id, true, 1000).ok).toBe(true);
		const row = () => db.select().from(user).where(eq(user.id, b.id)).get()!;
		expect(row().disabledAt).toBe(1000);
		expect(sessionIds(b.id)).toHaveLength(0);
		expect(setDisabled(db, a.id, b.id, false).ok).toBe(true);
		expect(row().disabledAt).toBeNull();
		expect(listUsers(db).find((u) => u.id === b.id)?.disabled).toBe(false);
	});
	it('deletes the user tokens on disable and does not restore them on enable', async () => {
		const a = await make('ned', true);
		const b = await make('oli');
		const c = await make('pat');
		createToken(db, b.id, 'Laptop');
		createToken(db, c.id, 'Laptop');
		const tokensOf = (id: string) =>
			db.select().from(accessToken).where(eq(accessToken.userId, id)).all();
		expect(setDisabled(db, a.id, b.id, true).ok).toBe(true);
		expect(tokensOf(b.id)).toHaveLength(0);
		expect(tokensOf(c.id)).toHaveLength(1);
		expect(setDisabled(db, a.id, b.id, false).ok).toBe(true);
		expect(tokensOf(b.id)).toHaveLength(0);
	});
});
