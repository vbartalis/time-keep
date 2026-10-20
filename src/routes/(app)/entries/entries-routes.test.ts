import { isRedirect, type Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openCore, type Core, type Result } from '#lib/server/core/index.js';
import type { DB } from '#lib/server/db/index.js';
import { user } from '#lib/server/db/schema.js';
import { newId } from '#lib/server/id.js';
import { createTestDb } from '#lib/server/testing/db.js';

let db: DB;
vi.mock('#lib/server/db/index.js', async (real) => ({
	...(await real<object>()),
	getDb: () => db
}));

const { load, actions } = await import('./+page.server');

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.value;
};

type Set = { value: string; opts: Record<string, unknown> };

function cookieJar(initial: Record<string, string> = {}) {
	const jar: Record<string, string> = { ...initial };
	const sets: Record<string, Set> = {};
	return {
		jar,
		sets,
		cookies: {
			get: (n: string) => jar[n],
			set: (n: string, v: string, opts: Record<string, unknown>) => {
				jar[n] = v;
				sets[n] = { value: v, opts };
			},
			delete: (n: string) => {
				delete jar[n];
			}
		} as unknown as Cookies
	};
}

let core: Core;
let locals: App.Locals;
let projectId: string;

beforeEach(() => {
	db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	locals = { user: { id, username: 'u', isAdmin: false } } as unknown as App.Locals;
	core = openCore(db, id, 'ui', () => Date.now());
	const customer = val(core.customers.create({ name: 'Acme' }));
	projectId = val(core.projects.create({ customerId: customer.id, name: 'Web' })).id;
});

const entry = (start = '2026-10-19T09:00', end = '2026-10-19T10:00') =>
	val(core.entries.create({ projectId, start, end, timeZone: 'UTC', description: 'Fix' }));

async function loaded(query: string, cookie?: string) {
	const { cookies, sets } = cookieJar(cookie ? { entries_range: cookie } : {});
	const url = new URL(`http://x/entries${query}`);
	const data = (await (load as never as (e: unknown) => unknown)({ locals, cookies, url })) as {
		filter: { range: string };
		back: string;
		sheet: { count: number; error: string | null };
		[k: string]: unknown;
	};
	return { data, sets };
}

async function run(action: (event: never) => unknown, fields: Record<string, string | string[]>) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields))
		for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
	const { cookies, jar } = cookieJar();
	const request = new Request('http://x/', { method: 'POST', body });
	try {
		const result = await action({ request, locals, params: {}, cookies } as never);
		return { result: result as { status?: number; data?: Record<string, unknown> }, jar };
	} catch (e) {
		if (isRedirect(e)) return { redirect: e.location, jar };
		throw e;
	}
}

describe('/entries load', () => {
	it('defaults to this month and keeps it', async () => {
		const { data, sets } = await loaded('');
		expect(data.filter.range).toBe('this-month');
		expect(data.back).toBe('/entries?range=this-month');
		expect(sets.entries_range?.value).toBe('this-month');
		expect(sets.entries_range?.opts).toMatchObject({
			path: '/',
			maxAge: 400 * 24 * 60 * 60,
			sameSite: 'lax',
			httpOnly: true
		});
	});

	it('keeps a preset the address names', async () => {
		const { data, sets } = await loaded('?range=last-month');
		expect(data.filter.range).toBe('last-month');
		expect(sets.entries_range?.value).toBe('last-month');
	});

	it('reads the kept preset when the address has no range, writing nothing', async () => {
		const { data, sets } = await loaded('', 'last-week');
		expect(data.filter.range).toBe('last-week');
		expect(data.back).toBe('/entries?range=last-week');
		expect(sets.entries_range).toBeUndefined();
	});

	it('writes no cookie for a custom range', async () => {
		const { data, sets } = await loaded('?range=custom&from=2026-10-01&to=2026-10-31');
		expect(data.filter.range).toBe('custom');
		expect(sets.entries_range).toBeUndefined();
	});

	it('returns an empty sheet and dateError for a bad date', async () => {
		const { data, sets } = await loaded('?range=custom&from=nope');
		expect(data.error).toBe('Use dates like 2026-10-01.');
		expect(data.dateError).toBe(true);
		expect(data.sheet.count).toBe(0);
		expect(sets.entries_range).toBeUndefined();
	});

	it("carries the core's refusal of the search, apart from the dates", async () => {
		const { data } = await loaded(`?q=${'x'.repeat(201)}`);
		expect(data.error).toBeNull();
		expect(data.dateError).toBe(false);
		expect(data.sheet.error).toBe('Use 1–200 characters.');
	});

	it('carries select and all', async () => {
		const { data } = await loaded('?select=1&all=1');
		expect(data.select).toBe(true);
		expect(data.all).toBe(true);
	});
});

describe('/entries actions', () => {
	it('edit with none ticked says so', async () => {
		const r = await run(actions.edit!, { back: '/entries?range=this-month' });
		expect(r.result?.status).toBe(400);
		expect(r.result?.data).toMatchObject({ action: 'edit', error: 'Select at least one entry.' });
	});

	it('edit returns the chosen entries', async () => {
		const e = entry();
		const r = await run(actions.edit!, { id: e.id, [`version.${e.id}`]: String(e.version) });
		expect(r.result).toEqual({
			action: 'edit',
			chosen: [{ id: e.id, version: String(e.version) }]
		});
	});

	it('deletes at once as one batch and returns to back', async () => {
		const a = entry();
		const b = entry('2026-10-19T11:00', '2026-10-19T12:00');
		const r = await run(actions.delete!, {
			id: [a.id, b.id],
			[`version.${a.id}`]: String(a.version),
			[`version.${b.id}`]: String(b.version),
			back: '/entries?range=last-week'
		});
		expect(r.redirect).toBe('/entries?range=last-week');
		expect(JSON.parse(r.jar.flash).label).toBe('Delete 2 entries');
		expect(val(core.entries.list({}))).toHaveLength(0);
	});

	it('refuses a stale apply naming the entry, changing nothing', async () => {
		const e = entry();
		val(core.entries.update({ id: e.id, expectedVersion: e.version, description: 'Elsewhere' }));
		const r = await run(actions.apply!, {
			id: e.id,
			[`version.${e.id}`]: String(e.version),
			activity: 'none',
			reference: 'R-1',
			back: '/entries?range=this-month'
		});
		expect(r.result?.status).toBe(400);
		expect(String(r.result?.data?.error)).toMatch(/^2026-10-19 09:00, Acme › Web: /);
		expect(val(core.entries.get({ id: e.id })).reference).toBeNull();
	});
});
