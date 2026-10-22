import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DB } from '#lib/server/db/index.js';
import { createUser } from '#lib/server/users.js';
import { createTestDb } from '#lib/server/testing/db.js';

let db: DB;
vi.mock('#lib/server/db/index.js', async (real) => ({
	...(await real<object>()),
	getDb: () => db
}));

const { load, actions } = await import('./+page.server');

let locals: App.Locals;
let otherId: string;

beforeEach(async () => {
	db = createTestDb();
	const admin = await createUser(db, {
		username: 'admin',
		password: 'correct-horse-1',
		isAdmin: true
	});
	const other = await createUser(db, {
		username: 'other',
		password: 'correct-horse-2',
		isAdmin: false
	});
	if (!admin.ok || !other.ok) throw new Error('seed');
	otherId = other.value.id;
	locals = {
		user: { id: admin.value.id, username: 'admin', isAdmin: true },
		session: { id: 's1' }
	} as unknown as App.Locals;
});

async function run(action: (event: never) => unknown, fields: Record<string, string>) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.append(k, v);
	const request = new Request('http://x/', { method: 'POST', body });
	return (await action({ request, locals, params: {}, cookies: {} } as never)) as {
		status?: number;
		data?: Record<string, unknown>;
	};
}

describe('/admin/users load', () => {
	it('names the dialog the address opens', async () => {
		const url = new URL('http://x/admin/users?new=user');
		const data = (await (load as never as (e: unknown) => unknown)({
			locals,
			cookies: { get: () => undefined },
			url
		})) as { dialog: unknown };
		expect(data.dialog).toEqual({ kind: 'user' });
	});
});

describe('/admin/users create', () => {
	it('places a username refusal, keeps the values, never echoes the password', async () => {
		const r = await run(actions.create as never, {
			username: 'ab',
			password: 'correct-horse-3',
			isAdmin: 'on'
		});
		expect(r.status).toBe(400);
		expect(r.data).toMatchObject({
			dialog: 'user',
			field: 'username',
			values: { username: 'ab', isAdmin: true }
		});
		expect(typeof r.data?.error).toBe('string');
		expect(JSON.stringify(r.data)).not.toContain('correct-horse-3');
	});

	it('places a password refusal on Password', async () => {
		const r = await run(actions.create as never, { username: 'fine.name', password: 'short' });
		expect(r.data).toMatchObject({
			field: 'password',
			values: { username: 'fine.name', isAdmin: false }
		});
	});
});

describe('/admin/users setPassword', () => {
	it('places a short password on Password and echoes the user', async () => {
		const r = await run(actions.setPassword as never, { userId: otherId, password: 'short' });
		expect(r.status).toBe(400);
		expect(r.data).toMatchObject({ dialog: 'password', userId: otherId, field: 'password' });
		expect(typeof r.data?.error).toBe('string');
		expect(JSON.stringify(r.data)).not.toContain('short"');
	});
});
