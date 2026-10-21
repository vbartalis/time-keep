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

const page = await import('./+page.server');

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.value;
};

const cookies = {
	get: (n: string) => (n === 'tz' ? 'UTC' : undefined),
	set: () => {},
	delete: () => {}
} as unknown as Cookies;

let clock: number;
let core: Core;
let locals: App.Locals;

beforeEach(() => {
	db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	locals = { user: { id, username: 'u', isAdmin: false } } as unknown as App.Locals;
	clock = Date.parse('2026-10-20T08:00:00Z');
	core = openCore(db, id, 'ui', () => clock);
});

type Data = {
	days: { day: string; continues: boolean; batches: { id: string; touched: string }[] }[];
	range: { from: number; to: number; total: number };
	newer: string | null;
	older: string | null;
	select: boolean;
};

const load = (query = '') =>
	page.load({ locals, cookies, url: new URL(`http://x/history${query}`) } as never) as Data;

/** `n` batches, one customer each, a minute apart; `at(i)` moves the clock for the i-th. */
function seed(n: number, at?: (i: number) => number) {
	const base = clock;
	for (let i = 0; i < n; i++) {
		clock = at ? at(i) : base + i * 60_000;
		val(core.customers.create({ name: `C${i}` }));
	}
}

describe('history load', () => {
	it('reads an empty history as 0–0 of 0, with no pages', () => {
		expect(load()).toMatchObject({
			days: [],
			range: { from: 0, to: 0, total: 0 },
			newer: null,
			older: null
		});
	});

	it('reads select=1 as the phone’s Select without the script', () => {
		expect(load().select).toBe(false);
		expect(load('?select=1').select).toBe(true);
		expect(load('?select=yes').select).toBe(false);
	});

	it('gives each row what it touched and each day its head', () => {
		seed(1);
		const data = load();
		expect(data.days).toEqual([
			{ day: 'Tue 2026-10-20', continues: false, batches: [expect.anything()] }
		]);
		expect(data.days[0].batches[0].touched).toBe('Customer C0');
	});

	it('pages 51 batches as 1–50 then 51–51, with Older and Newer hrefs', () => {
		seed(51);
		const first = load();
		expect(first.range).toEqual({ from: 1, to: 50, total: 51 });
		expect(first.newer).toBeNull();
		const lastShown = first.days.at(-1)!.batches.at(-1)!.id;
		expect(first.older).toBe(`/history?before=${lastShown}`);

		const second = load(`?before=${lastShown}`);
		expect(second.range).toEqual({ from: 51, to: 51, total: 51 });
		expect(second.newer).toBe('/history');
		expect(second.older).toBeNull();
	});

	it('shows exactly 50 batches with neither Newer nor Older', () => {
		seed(50);
		expect(load()).toMatchObject({
			range: { from: 1, to: 50, total: 50 },
			newer: null,
			older: null
		});
	});

	it('says a day continues on the older page when the 51st batch shares it', () => {
		seed(51);
		const first = load();
		expect(first.days).toHaveLength(1);
		expect(first.days[0]).toMatchObject({ day: 'Tue 2026-10-20', continues: true });
		expect(first.days[0].batches).toHaveLength(50);
		const second = load(`?before=${first.days[0].batches.at(-1)!.id}`);
		expect(second.days[0]).toMatchObject({ day: 'Tue 2026-10-20', continues: false });
	});

	it('does not say so when the 51st batch is on another day', () => {
		const day = 86_400_000;
		const start = Date.parse('2026-10-19T08:00:00Z');
		// The oldest batch on Monday, the 50 newer on Tuesday.
		seed(51, (i) => (i === 0 ? start : start + day + i * 60_000));
		const first = load();
		expect(first.days).toEqual([
			expect.objectContaining({ day: 'Tue 2026-10-20', continues: false })
		]);
		expect(first.older).not.toBeNull();
	});

	it('starts again from the newest on an unknown cursor', () => {
		seed(1);
		try {
			load('?before=nope');
			expect.unreachable();
		} catch (e) {
			expect(isRedirect(e) && e.location).toBe('/history');
		}
	});
});
