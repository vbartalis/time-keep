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
const { GET } = await import('./csv/+server');

async function loaded(query: string, kept: Record<string, string> = {}) {
	const { cookies, sets } = cookieJar(kept);
	const url = new URL(`http://x/copy-out${query}`);
	const data = (await (load as never as (e: unknown) => unknown)({ locals, cookies, url })) as {
		filter: { range: string };
		error: string | null;
		columnsError: string | null;
		choice: { columns: string[] };
		heads: string[];
		rows: Record<string, string>[];
		count: number;
		total: string;
		running: number;
		query: string;
		csvHref: string;
	};
	return { data, sets };
}

async function csv(query: string, kept: Record<string, string> = {}) {
	const { cookies, sets } = cookieJar(kept);
	const url = new URL(`http://x/copy-out/csv${query}`);
	const response = await (GET as never as (e: unknown) => Promise<Response>)({
		locals,
		cookies,
		url
	});
	return { response, sets, body: await response.text() };
}

describe('copy-out load', () => {
	it('keeps a named preset as output_range', async () => {
		const { sets, data } = await loaded('?range=last-month');
		expect(data.filter.range).toBe('last-month');
		expect(sets.output_range.value).toBe('last-month');
		expect(sets.output_range.opts).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
	});

	it('keeps named columns as output_choice and heads them', async () => {
		const { sets, data } = await loaded('?cols=date,duration');
		expect(data.heads).toEqual(['Date', 'Duration']);
		expect(sets.output_choice.value).toContain('cols=date,duration');
	});

	it('answers no columns with an error and no kept choice, still counting the range', async () => {
		entry('2026-10-19T09:00', '2026-10-19T10:00');
		entry('2026-10-19T11:02', '2026-10-19T11:31');
		const { sets, data } = await loaded(`${ALL.slice(1)}&cols=&round=0&duration=decimal`);
		expect(data.columnsError).toBe('Choose at least one column.');
		expect(data.heads).toEqual([]);
		// The toolbar's count and total are the range's, computed with the options.
		expect(data.count).toBe(2);
		expect(data.total).toBe('1.48');
		expect(sets.output_choice).toBeUndefined();
	});

	it('lists the rows, their count and total, and builds the CSV link', async () => {
		entry('2026-10-19T09:00', '2026-10-19T10:30');
		entry('2026-10-19T11:00', null);
		const { data } = await loaded(ALL.slice(1));
		expect(data.count).toBe(1);
		expect(data.rows).toHaveLength(1);
		expect(data.total).toBe('1:30');
		expect(data.running).toBe(1);
		expect(data.csvHref).toBe(`/copy-out/csv?${data.query}`);
	});

	it('does not keep a custom range for Reports', async () => {
		const reports = await import('../reports/+page.server');
		const jar = cookieJar();
		const copy = new URL(`http://x/copy-out?range=custom&from=2026-01-01&to=2026-01-31`);
		await (load as never as (e: unknown) => unknown)({
			locals,
			cookies: jar.cookies,
			url: copy
		});
		expect(jar.sets.output_range).toBeUndefined();
		const data = (await (reports.load as never as (e: unknown) => unknown)({
			locals,
			cookies: jar.cookies,
			url: new URL('http://x/reports')
		})) as { filter: { range: string }; error: string | null };
		expect(data.filter.range).toBe('this-month');
		expect(data.error).toBeNull();
	});

	it('reports the same total as Reports, rounded and not', async () => {
		const reports = await import('../reports/+page.server');
		entry('2026-10-19T09:01', '2026-10-19T10:03');
		for (const round of ['0', '1']) {
			const query = `${ALL}&round=${round}`.replace('/', '');
			const sheet = await loaded(query);
			const report = (await (reports.load as never as (e: unknown) => unknown)({
				locals,
				cookies: cookieJar().cookies,
				url: new URL(`http://x/reports${query}`)
			})) as { total: string };
			expect(report.total).toBe(sheet.data.total);
		}
	});
});

describe('copy-out csv', () => {
	it('reads the kept range and choice and writes no cookie', async () => {
		entry('2026-09-15T09:00', '2026-09-15T10:00');
		const { response, sets, body } = await csv('?range=last-month', {
			output_choice: 'cols=date,description&round=1&split=0&duration=hm'
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
		expect(body.replace('﻿', '').split(/\r?\n/)[0]).toBe('Date,Description');
		expect(Object.keys(sets)).toEqual([]);
	});

	it('refuses no columns with a 400', async () => {
		const { response, body } = await csv('?cols=');
		expect(response.status).toBe(400);
		expect(body).toBe('Choose at least one column.');
	});

	it('refuses a bad date with the screen message', async () => {
		const { response, body } = await csv('?range=custom&from=2026-13-01');
		expect(response.status).toBe(400);
		expect(body).toBe('Use dates like 2026-10-01.');
	});

	it('refuses a long search with the field message', async () => {
		const { response, body } = await csv(`?q=${'x'.repeat(201)}`);
		expect(response.status).toBe(400);
		expect(body).toBe('Use 1–200 characters.');
	});
});
