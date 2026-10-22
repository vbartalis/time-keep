import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DB } from '#lib/server/db/index.js';
import { createTestDb } from '#lib/server/testing/db.js';
import { createUser } from '#lib/server/users.js';

let db: DB;
vi.mock('#lib/server/db/index.js', async (real) => ({
	...(await real<object>()),
	getDb: () => db
}));

const { actions } = await import('./+page.server');

beforeEach(async () => {
	db = createTestDb();
	await createUser(db, { username: 'mary', password: 'correct-horse-1', isAdmin: false });
});

describe('login', () => {
	it('refuses a wrong password and echoes the username only', async () => {
		const body = new FormData();
		body.append('username', 'mary');
		body.append('password', 'wrong-wrong-wrong');
		const request = new Request('http://x/login', { method: 'POST', body });
		const r = (await (actions.default as never as (e: unknown) => unknown)({
			request,
			locals: {},
			cookies: {},
			url: new URL('http://x/login'),
			getClientAddress: () => '127.0.0.1'
		})) as { status: number; data: Record<string, unknown> };
		expect(r.status).toBe(400);
		expect(r.data).toEqual({ error: 'Wrong username or password.', username: 'mary' });
	});
});
