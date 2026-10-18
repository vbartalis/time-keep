import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(raw: string): string {
	return raw.trim().toLowerCase();
}

export function validateUsername(normalized: string): string | null {
	return USERNAME_PATTERN.test(normalized)
		? null
		: 'Username must be 3–32 characters: a–z, 0–9, dot, underscore or hyphen.';
}

export function validatePassword(raw: string): string | null {
	return raw.length >= 10 && raw.length <= 256 ? null : 'Password must be 10–256 characters.';
}

/** argon2id is the library default. */
export function hashPassword(password: string): Promise<string> {
	return hash(password);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
	try {
		return await verify(hashed, password);
	} catch {
		return false;
	}
}

let cachedDummy: Promise<string> | undefined;

/** Hash of a fixed random string, for constant-work failures. */
export function dummyHash(): Promise<string> {
	cachedDummy ??= hashPassword(randomBytes(32).toString('hex'));
	return cachedDummy;
}
