import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { listUsers } from '../users';
import { ensureAdmin } from './bootstrap';

const env = { ADMIN_USERNAME: 'Root', ADMIN_PASSWORD: 'correct-horse-battery' };

describe('ensureAdmin', () => {
	it('creates an admin when none exists', async () => {
		const db = createTestDb();
		expect(await ensureAdmin(db, env)).toBe('created');
		const users = listUsers(db);
		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({ username: 'root', isAdmin: true });
	});

	it('returns exists and ignores changed env', async () => {
		const db = createTestDb();
		await ensureAdmin(db, env);
		expect(
			await ensureAdmin(db, { ADMIN_USERNAME: 'other', ADMIN_PASSWORD: 'another-password-1' })
		).toBe('exists');
		expect(await ensureAdmin(db, {})).toBe('exists');
		expect(listUsers(db)).toHaveLength(1);
	});

	it('throws when env is missing and no admin exists', async () => {
		await expect(ensureAdmin(createTestDb(), { ADMIN_USERNAME: 'root' })).rejects.toThrow(
			'No admin exists: set ADMIN_USERNAME and ADMIN_PASSWORD to create one.'
		);
	});

	it('throws the validation message for invalid values', async () => {
		await expect(
			ensureAdmin(createTestDb(), { ADMIN_USERNAME: 'root', ADMIN_PASSWORD: 'short' })
		).rejects.toThrow('ADMIN_USERNAME/ADMIN_PASSWORD: Password must be 10–256 characters.');
	});
});
