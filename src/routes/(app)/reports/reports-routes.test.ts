import type { Cookies } from '@sveltejs/kit';
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

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.value;
};

type Set = { value: string; opts: Record<string, unknown> };

function cookieJar(initial: Record<string, string> = {}) {
	const jar: Record<string, string> = { ...initial };
	const sets: Record<string, Set> = {};
	return {
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

const entry = (start: string, end: string | null, description = 'Fix') =>
	val(
		core.entries.create({
			projectId,
			start,
			...(end === null ? {} : { end }),
			timeZone: 'UTC',
			description
		})
	);

const ALL = '/?range=custom&from=2020-01-01&to=2099-12-31';

const { load } = await import('./+page.server');

async function loaded(query: string, kept: Record<string, string> = {}) {
	const { cookies, sets } = cookieJar(kept);
	const url = new URL(`http://x/reports${query}`);
	const data = (await (load as never as (e: unknown) => unknown)({ locals, cookies, url })) as {
		filter: { range: string };
		error: string | null;
		columnsError: string | null;
		days: { key: string; label: string; duration: string }[];
		customers: { key: string; label: string; duration: string }[];
		projects: {
			key: string;
			label: string;
			customer: string;
			project: string;
			colour: number;
			duration: string;
		}[];
		entries: number;
		count: number;
		total: string;
		running: number;
		query: string;
		hints: Record<string, string>;
	};
	return { data, sets };
}

describe('reports load', () => {
	it('keeps a named preset as output_range', async () => {
		const { sets, data } = await loaded('?range=last-month');
		expect(data.filter.range).toBe('last-month');
		expect(sets.output_range.value).toBe('last-month');
		expect(data.hints['last-month']).toBeTruthy();
	});

	it('totals the finished entries and leaves out running ones', async () => {
		entry('2026-10-19T09:00', '2026-10-19T10:30');
		entry('2026-10-19T11:00', null);
		const { data } = await loaded(ALL.slice(1));
		expect(data.entries).toBe(1);
		expect(data.count).toBe(1);
		expect(data.total).toBe('1:30');
		expect(data.running).toBe(1);
		expect(data.days).toEqual([{ key: '2026-10-19', label: expect.any(String), duration: '1:30' }]);
		expect(data.query).toContain('range=custom');
	});

	it('gives each Projects row its customer, project and palette number', async () => {
		entry('2026-10-19T09:00', '2026-10-19T10:00');
		const { data } = await loaded(ALL.slice(1));
		expect(data.projects).toEqual([
			{
				key: projectId,
				label: 'Acme › Web',
				customer: 'Acme',
				project: 'Web',
				colour: 1,
				duration: '1:00'
			}
		]);
	});

	it('follows the Duration option', async () => {
		entry('2026-10-19T09:00', '2026-10-19T10:20');
		const { data } = await loaded(`${ALL.slice(1)}&duration=decimal`);
		expect(data.total).toBe('1.33');
	});

	it('is not stopped by no columns', async () => {
		const { data } = await loaded('?cols=');
		expect(data.columnsError).toBe('Choose at least one column.');
	});
});
