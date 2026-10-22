import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createToken } from '#lib/server/auth/tokens.js';
import type { DB } from '#lib/server/db/index.js';
import { createTestDb } from '#lib/server/testing/db.js';
import { createUser } from '#lib/server/users.js';

let db: DB;
vi.mock('#lib/server/db/index.js', async (real) => ({
	...(await real<object>()),
	getDb: () => db
}));

const { load, actions } = await import('./+page.server');

let locals: App.Locals;
let userId: string;

beforeEach(async () => {
	db = createTestDb();
	const u = await createUser(db, { username: 'mary', password: 'correct-horse-1', isAdmin: false });
	if (!u.ok) throw new Error('seed');
	userId = u.value.id;
	locals = {
		user: { id: userId, username: 'mary', isAdmin: false },
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

describe('/account load', () => {
	it('names the dialog the address opens', async () => {
		const url = new URL('http://x/account?new=token');
		const data = (await (load as never as (e: unknown) => unknown)({
			locals,
			cookies: { get: () => undefined },
			url
		})) as { dialog: unknown };
		expect(data.dialog).toEqual({ kind: 'token' });
	});
});

describe('/account password', () => {
	it('places a mismatched confirm on the new password', async () => {
		const r = await run(actions.password as never, {
			current: 'correct-horse-1',
			next: 'another-long-one',
			confirm: 'different-long-one'
		});
		expect(r.status).toBe(400);
		expect(r.data).toMatchObject({ error: 'Passwords do not match.', field: 'confirm' });
	});

	it('places a wrong current password on Current', async () => {
		const r = await run(actions.password as never, {
			current: 'nope-nope-nope',
			next: 'another-long-one',
			confirm: 'another-long-one'
		});
		expect(r.data).toMatchObject({ field: 'current' });
	});
});

describe('/account createToken', () => {
	it('places a duplicate name on Name and keeps it', async () => {
		createToken(db, userId, 'laptop');
		const r = await run(actions.createToken as never, { name: 'Laptop' });
		expect(r.status).toBe(400);
		expect(r.data).toMatchObject({ dialog: 'token', field: 'name', values: { name: 'Laptop' } });
		expect(typeof r.data?.tokenError).toBe('string');
	});
});
