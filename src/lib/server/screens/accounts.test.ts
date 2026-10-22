import { describe, expect, it } from 'vitest';
import { validatePassword, validateUsername } from '#lib/server/auth/credentials.js';
import { dialogOf, fieldOf } from './accounts';

describe('fieldOf', () => {
	it('places a username refusal on Username', () => {
		expect(fieldOf('Username is taken.', 'user')).toBe('username');
		expect(fieldOf(validateUsername('ab')!, 'user')).toBe('username');
	});

	it('places a password rule on Password, or on the new password for the own form', () => {
		const rule = validatePassword('123')!;
		expect(fieldOf(validatePassword('123')!, 'user')).toBe('password');
		expect(fieldOf(rule, 'setPassword')).toBe('password');
		expect(fieldOf(rule, 'ownPassword')).toBe('next');
	});

	it('places the own-password refusals', () => {
		expect(fieldOf('Current password is incorrect.', 'ownPassword')).toBe('current');
		expect(fieldOf('Passwords do not match.', 'ownPassword')).toBe('confirm');
	});

	it('places token name refusals on Name', () => {
		expect(fieldOf('Name must be 1–100 characters.', 'token')).toBe('name');
		expect(fieldOf('You already have a token with that name.', 'token')).toBe('name');
	});

	it('leaves the rest unplaced', () => {
		expect(fieldOf('User not found.', 'setPassword')).toBeNull();
		expect(fieldOf('Token not found.', 'token')).toBeNull();
	});
});

describe('dialogOf', () => {
	const of = (q: string) => dialogOf(new URLSearchParams(q));
	it('reads the no-script address', () => {
		expect(of('new=token')).toEqual({ kind: 'token' });
		expect(of('new=user')).toEqual({ kind: 'user' });
		expect(of('password=u1')).toEqual({ kind: 'password', userId: 'u1' });
		expect(of('revoke=t1')).toEqual({ kind: 'revoke', tokenId: 't1' });
	});
	it('reads nothing else', () => {
		expect(of('new=bogus')).toBeNull();
		expect(of('')).toBeNull();
		expect(of('password=')).toBeNull();
	});
});
