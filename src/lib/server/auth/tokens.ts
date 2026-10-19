import { createHash } from 'node:crypto';
import { and, desc, eq, isNull, lte, or } from 'drizzle-orm';
import type { DB } from '../db';
import { accessToken, user } from '../db/schema';
import { base32, newId } from '../id';
import type { Result } from '../users';

export const TOKEN_PREFIX = 'tk_';

const TOUCH_INTERVAL_MS = 60_000;
const HEADER = /^bearer (tk_[a-z2-7]{32})$/i;
const TOKEN = /^tk_[a-z2-7]{32}$/;

export type TokenSummary = {
	id: string;
	name: string;
	createdAt: number;
	lastUsedAt: number | null;
};

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function summarize(row: typeof accessToken.$inferSelect): TokenSummary {
	return { id: row.id, name: row.name, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt };
}

function isUniqueViolation(e: unknown): boolean {
	return (e as { code?: unknown } | null)?.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

/**
 * Creates a token for the user. The token is returned once; only its hash is stored.
 * A name's key is Unicode NFC, then lowercased, unique per user.
 */
export function createToken(
	db: DB,
	userId: string,
	name: unknown,
	now: number = Date.now()
): Result<{ token: string; summary: TokenSummary }> {
	const trimmed = typeof name === 'string' ? name.trim() : '';
	if (trimmed.length < 1 || trimmed.length > 100) {
		return { ok: false, error: 'Name must be 1–100 characters.' };
	}
	const token = TOKEN_PREFIX + base32(crypto.getRandomValues(new Uint8Array(20)));
	const row = {
		id: newId(),
		userId,
		name: trimmed,
		nameKey: trimmed.normalize('NFC').toLowerCase(),
		tokenHash: hashToken(token),
		createdAt: now,
		lastUsedAt: null
	};
	try {
		db.insert(accessToken).values(row).run();
	} catch (e) {
		if (isUniqueViolation(e)) {
			return { ok: false, error: 'You already have a token with that name.' };
		}
		throw e;
	}
	return { ok: true, value: { token, summary: summarize(row) } };
}

export function listTokens(db: DB, userId: string): TokenSummary[] {
	return db
		.select()
		.from(accessToken)
		.where(eq(accessToken.userId, userId))
		.orderBy(desc(accessToken.createdAt), accessToken.id)
		.all()
		.map(summarize);
}

export function revokeToken(db: DB, userId: string, id: string): Result {
	const { changes } = db
		.delete(accessToken)
		.where(and(eq(accessToken.id, id), eq(accessToken.userId, userId)))
		.run();
	if (changes === 0) return { ok: false, error: 'Token not found.' };
	return { ok: true, value: undefined };
}

/** The user a `Authorization: Bearer tk_…` header belongs to, or null. */
export function authenticateToken(
	db: DB,
	header: string | null,
	now: number = Date.now()
): { userId: string } | null {
	const token = header?.match(HEADER)?.[1];
	if (!token || !TOKEN.test(token)) return null;
	const found = db
		.select({ id: accessToken.id, userId: accessToken.userId })
		.from(accessToken)
		.innerJoin(user, eq(accessToken.userId, user.id))
		.where(and(eq(accessToken.tokenHash, hashToken(token)), isNull(user.disabledAt)))
		.get();
	if (!found) return null;
	db.update(accessToken)
		.set({ lastUsedAt: now })
		.where(
			and(
				eq(accessToken.id, found.id),
				or(isNull(accessToken.lastUsedAt), lte(accessToken.lastUsedAt, now - TOUCH_INTERVAL_MS))
			)
		)
		.run();
	return { userId: found.userId };
}
