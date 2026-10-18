import { describe, expect, it } from 'vitest';
import {
	dummyHash,
	hashPassword,
	normalizeUsername,
	validatePassword,
	validateUsername,
	verifyPassword
} from './credentials';

describe('normalizeUsername', () => {
	it('trims and lowercases', () => {
		expect(normalizeUsername('  Ad.Min ')).toBe('ad.min');
	});
});

describe('validateUsername', () => {
	it('accepts valid names', () => {
		expect(validateUsername('abc')).toBeNull();
		expect(validateUsername('a-b_c.d')).toBeNull();
		expect(validateUsername('a'.repeat(32))).toBeNull();
	});
	it('rejects invalid names', () => {
		const msg = 'Username must be 3–32 characters: a–z, 0–9, dot, underscore or hyphen.';
		for (const bad of ['ab', 'a'.repeat(33), 'a b', 'ä']) {
			expect(validateUsername(bad)).toBe(msg);
		}
	});
});

describe('validatePassword', () => {
	it('accepts 10 and 256 characters', () => {
		expect(validatePassword('a'.repeat(10))).toBeNull();
		expect(validatePassword('a'.repeat(256))).toBeNull();
	});
	it('rejects 9 and 257 characters', () => {
		const msg = 'Password must be 10–256 characters.';
		expect(validatePassword('a'.repeat(9))).toBe(msg);
		expect(validatePassword('a'.repeat(257))).toBe(msg);
	});
});

describe('password hashing', () => {
	it('round-trips and rejects wrong passwords', async () => {
		const hash = await hashPassword('correct horse');
		expect(hash.startsWith('$argon2id$')).toBe(true);
		expect(await verifyPassword(hash, 'correct horse')).toBe(true);
		expect(await verifyPassword(hash, 'wrong horse')).toBe(false);
	});
	it('returns false for a malformed hash', async () => {
		expect(await verifyPassword('garbage', 'x')).toBe(false);
	});
	it('caches the dummy hash', async () => {
		const a = await dummyHash();
		expect(a.startsWith('$argon2id$')).toBe(true);
		expect(await dummyHash()).toBe(a);
	});
});
