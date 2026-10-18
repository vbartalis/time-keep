import { createHash } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import type { DB } from '../db';
import { session, user, type Session, type User } from '../db/schema';
import { base32 } from '../id';

export const SESSION_COOKIE = 'session';
export const SESSION_DAYS = 30;
export const RENEW_BELOW_DAYS = 15;

const DAY_MS = 86_400_000;

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** 20 random bytes as 32 lowercase base32 characters. */
export function generateSessionToken(): string {
	return base32(crypto.getRandomValues(new Uint8Array(20)));
}

export function createSession(
	db: DB,
	userId: string,
	now: number = Date.now()
): { token: string; session: Session } {
	const token = generateSessionToken();
	const row: Session = {
		id: hashToken(token),
		userId,
		expiresAt: now + SESSION_DAYS * DAY_MS,
		createdAt: now
	};
	db.insert(session).values(row).run();
	return { token, session: row };
}

export function validateSessionToken(
	db: DB,
	token: string,
	now: number = Date.now()
): { user: User; session: Session; renewed: boolean } | null {
	const id = hashToken(token);
	const found = db
		.select({ session, user })
		.from(session)
		.innerJoin(user, eq(session.userId, user.id))
		.where(eq(session.id, id))
		.get();
	if (!found) return null;

	if (found.user.disabledAt !== null) {
		invalidateUserSessions(db, found.user.id);
		return null;
	}
	if (now > found.session.expiresAt) {
		invalidateSession(db, id);
		return null;
	}

	let renewed = false;
	let current = found.session;
	if (current.expiresAt - now < RENEW_BELOW_DAYS * DAY_MS) {
		const expiresAt = now + SESSION_DAYS * DAY_MS;
		db.update(session).set({ expiresAt }).where(eq(session.id, id)).run();
		current = { ...current, expiresAt };
		renewed = true;
	}
	return { user: found.user, session: current, renewed };
}

export function invalidateSession(db: DB, sessionId: string): void {
	db.delete(session).where(eq(session.id, sessionId)).run();
}

export function invalidateUserSessions(
	db: Pick<DB, 'delete'>,
	userId: string,
	exceptSessionId?: string
): void {
	db.delete(session)
		.where(
			exceptSessionId === undefined
				? eq(session.userId, userId)
				: and(eq(session.userId, userId), ne(session.id, exceptSessionId))
		)
		.run();
}

export function setSessionCookie(
	cookies: Cookies,
	token: string,
	expiresAt: number,
	secure: boolean
): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		expires: new Date(expiresAt)
	});
}

export function clearSessionCookie(cookies: Cookies, secure: boolean): void {
	cookies.set(SESSION_COOKIE, '', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: 0
	});
}
