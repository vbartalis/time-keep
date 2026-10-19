import { eq } from 'drizzle-orm';
import type { DB } from './db/index';
import { accessToken, session, user, type User } from './db/schema';
import { newId } from './id';
import {
	dummyHash,
	hashPassword,
	normalizeUsername,
	validatePassword,
	validateUsername,
	verifyPassword
} from './auth/credentials';
import { invalidateUserSessions } from './auth/sessions';
import { signInThrottle, type SignInThrottle } from './auth/throttle';

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export type UserSummary = {
	id: string;
	username: string;
	isAdmin: boolean;
	disabled: boolean;
	createdAt: number;
};

const WRONG_CREDENTIALS = 'Wrong username or password.';

function summarize(row: User): UserSummary {
	return {
		id: row.id,
		username: row.username,
		isAdmin: row.isAdmin,
		disabled: row.disabledAt != null,
		createdAt: row.createdAt
	};
}

function isUniqueViolation(e: unknown): boolean {
	const code = (e as { code?: unknown } | null)?.code;
	return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
}

export function listUsers(db: DB): UserSummary[] {
	return db.select().from(user).orderBy(user.username).all().map(summarize);
}

export async function createUser(
	db: DB,
	input: { username: string; password: string; isAdmin: boolean },
	now: number = Date.now()
): Promise<Result<UserSummary>> {
	const username = normalizeUsername(input.username);
	const invalid = validateUsername(username) ?? validatePassword(input.password);
	if (invalid) return { ok: false, error: invalid };
	if (db.select().from(user).where(eq(user.username, username)).get()) {
		return { ok: false, error: 'Username is taken.' };
	}
	const row: User = {
		id: newId(),
		username,
		passwordHash: await hashPassword(input.password),
		isAdmin: input.isAdmin,
		disabledAt: null,
		createdAt: now,
		updatedAt: now
	};
	try {
		db.insert(user).values(row).run();
	} catch (e) {
		if (isUniqueViolation(e)) return { ok: false, error: 'Username is taken.' };
		throw e;
	}
	return { ok: true, value: summarize(row) };
}

export async function setPassword(
	db: DB,
	userId: string,
	password: string,
	keepSessionId?: string
): Promise<Result> {
	const invalid = validatePassword(password);
	if (invalid) return { ok: false, error: invalid };
	const passwordHash = await hashPassword(password);
	return db.transaction((tx): Result => {
		const { changes } = tx
			.update(user)
			.set({ passwordHash, updatedAt: Date.now() })
			.where(eq(user.id, userId))
			.run();
		if (changes === 0) return { ok: false, error: 'User not found.' };
		invalidateUserSessions(tx, userId, keepSessionId);
		return { ok: true, value: undefined };
	});
}

export async function changeOwnPassword(
	db: DB,
	userId: string,
	current: string,
	next: string,
	keepSessionId: string
): Promise<Result> {
	const row = db.select().from(user).where(eq(user.id, userId)).get();
	if (!row || !(await verifyPassword(row.passwordHash, current))) {
		return { ok: false, error: 'Current password is incorrect.' };
	}
	return setPassword(db, userId, next, keepSessionId);
}

export function setDisabled(
	db: DB,
	actorId: string,
	userId: string,
	disabled: boolean,
	now: number = Date.now()
): Result {
	if (actorId === userId) return { ok: false, error: 'You cannot disable yourself.' };
	return db.transaction((tx): Result => {
		const { changes } = tx
			.update(user)
			.set({ disabledAt: disabled ? now : null, updatedAt: now })
			.where(eq(user.id, userId))
			.run();
		if (changes === 0) return { ok: false, error: 'User not found.' };
		if (disabled) {
			tx.delete(session).where(eq(session.userId, userId)).run();
			tx.delete(accessToken).where(eq(accessToken.userId, userId)).run();
		}
		return { ok: true, value: undefined };
	});
}

export async function authenticate(
	db: DB,
	rawUsername: string,
	password: string,
	address: string,
	throttle: SignInThrottle = signInThrottle
): Promise<Result<User>> {
	const username = normalizeUsername(rawUsername);
	if (!throttle.acquire(username, address)) {
		return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };
	}
	try {
		const row = db.select().from(user).where(eq(user.username, username)).get();
		const valid = await verifyPassword(row?.passwordHash ?? (await dummyHash()), password);
		if (!row || !valid || row.disabledAt != null) {
			throttle.recordFailure(username, address);
			return { ok: false, error: WRONG_CREDENTIALS };
		}
		throttle.reset(username, address);
		return { ok: true, value: row };
	} finally {
		throttle.release(username, address);
	}
}
