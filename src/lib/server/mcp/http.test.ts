import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openCore } from '#lib/server/core/index.js';
import { createSession } from '#lib/server/auth/sessions.js';
import { createToken, revokeToken } from '#lib/server/auth/tokens.js';
import { batch, user } from '#lib/server/db/schema.js';
import { newId } from '#lib/server/id.js';
import { createTestDb } from '#lib/server/testing/db.js';
import { setDisabled } from '#lib/server/users.js';
import { handleMcp } from './http';

const ORIGIN = 'http://app.test';

let db: ReturnType<typeof createTestDb>;
let userId: string;

function addUser(username: string) {
	const id = newId();
	db.insert(user)
		.values({ id, username, passwordHash: 'x', isAdmin: false, createdAt: 1, updatedAt: 1 })
		.run();
	return id;
}

function tokenFor(id: string, name = 'Agent') {
	const r = createToken(db, id, name);
	if (!r.ok) throw new Error(r.error);
	return r.value;
}

const call = (method: string, params: unknown = {}) => ({
	jsonrpc: '2.0',
	id: 1,
	method,
	params
});

function post(body: unknown, headers: Record<string, string> = {}) {
	return new Request(`${ORIGIN}/mcp`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...headers
		},
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

const listCustomers = call('tools/call', { name: 'list_customers', arguments: {} });
const handle = (request: Request) => handleMcp(request, { db, origin: ORIGIN });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

beforeEach(() => {
	db = createTestDb();
	userId = addUser('u1');
});

describe('handleMcp', () => {
	it('answers a tool call for the token’s user', async () => {
		openCore(db, userId, 'ui').customers.create({ name: 'Acme' });
		openCore(db, addUser('u2'), 'ui').customers.create({ name: 'Theirs' });
		const res = await handle(post(listCustomers, bearer(tokenFor(userId).token)));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.result.structuredContent.items.map((c: { name: string }) => c.name)).toEqual([
			'Acme'
		]);
	});

	it('lists the 13 tools', async () => {
		const res = await handle(post(call('tools/list'), bearer(tokenFor(userId).token)));
		expect(res.status).toBe(200);
		expect((await res.json()).result.tools).toHaveLength(13);
	});

	it('answers 401 with one body and header for every failure kind', async () => {
		const revoked = tokenFor(userId, 'Old');
		revokeToken(db, userId, revoked.summary.id);
		const disabled = addUser('u3');
		const disabledToken = tokenFor(disabled, 'D').token;
		setDisabled(db, userId, disabled, true);
		const headers = [
			{},
			bearer(revoked.token),
			bearer(disabledToken),
			{ authorization: 'Bearer nonsense' },
			{ authorization: 'Basic abc' }
		];
		const bodies = new Set<string>();
		for (const h of headers) {
			const res = await handle(post(listCustomers, h));
			expect(res.status).toBe(401);
			expect(res.headers.get('www-authenticate')).toBe('Bearer');
			bodies.add(await res.text());
		}
		expect([...bodies]).toEqual(['{"error":"Unauthorized."}']);
	});

	it('does not read the session cookie', async () => {
		const { token } = createSession(db, userId);
		const res = await handle(post(listCustomers, { cookie: `session=${token}` }));
		expect(res.status).toBe(401);
	});

	it('refuses a foreign Origin with 403, before the token', async () => {
		const { token } = tokenFor(userId);
		const res = await handle(post(listCustomers, { ...bearer(token), origin: 'http://evil.test' }));
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'Forbidden.' });
		const bare = await handle(post(listCustomers, { origin: 'http://evil.test' }));
		expect(bare.status).toBe(403);
	});

	it('accepts the app’s own Origin and no Origin', async () => {
		const { token } = tokenFor(userId);
		const same = await handle(post(listCustomers, { ...bearer(token), origin: ORIGIN }));
		expect(same.status).toBe(200);
		const none = await handle(post(listCustomers, bearer(token)));
		expect(none.status).toBe(200);
	});

	it('stores a change as one batch by the agent', async () => {
		const { token } = tokenFor(userId);
		const res = await handle(
			post(
				call('tools/call', {
					name: 'change',
					arguments: {
						label: 'Add Acme',
						operations: [{ command: 'customers.create', input: { name: 'Acme' } }]
					}
				}),
				bearer(token)
			)
		);
		expect(res.status).toBe(200);
		const rows = db.select().from(batch).where(eq(batch.userId, userId)).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].actor).toBe('agent');
	});

	it('answers a body that is not JSON with a JSON-RPC error, not a 500', async () => {
		const res = await handle(post('not json', bearer(tokenFor(userId).token)));
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe(-32700);
	});
	describe('body limit', () => {
		// A tools/call padded with a long string argument to exactly `size` bytes.
		function padded(size: number) {
			const make = (n: number) =>
				JSON.stringify(
					call('tools/call', { name: 'list_customers', arguments: { pad: 'x'.repeat(n) } })
				);
			const base = make(0).length;
			return make(size - base);
		}

		it('answers 413 for a body over 512 KB', async () => {
			const { token } = tokenFor(userId);
			const res = await handle(post(padded(524289), bearer(token)));
			expect(res.status).toBe(413);
			expect(await res.json()).toEqual({ error: 'Too large.' });
		});

		it('answers 413 for a streamed body with no content-length', async () => {
			const { token } = tokenFor(userId);
			const bytes = new TextEncoder().encode(padded(524289));
			const body = new ReadableStream<Uint8Array>({
				start(controller) {
					for (let i = 0; i < bytes.length; i += 65536)
						controller.enqueue(bytes.slice(i, i + 65536));
					controller.close();
				}
			});
			const res = await handle(
				new Request(`${ORIGIN}/mcp`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						accept: 'application/json, text/event-stream',
						...bearer(token)
					},
					body,
					duplex: 'half'
				} as RequestInit)
			);
			expect(res.status).toBe(413);
		});

		it('passes a body of exactly 512 KB to the server', async () => {
			const { token } = tokenFor(userId);
			const res = await handle(post(padded(524288), bearer(token)));
			expect(res.status).not.toBe(413);
		});
	});
});
