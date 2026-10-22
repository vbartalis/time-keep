import { isRedirect, type Cookies } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryFormFailure } from '#lib/components/entry/types.js';
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

const { actions } = await import('./entries/[id]/+page.server');
const restart = (await import('./timers/restart/+page.server')).actions;
const stop = (await import('./timers/stop/+page.server')).actions;
const start = (await import('./timers/start/+page.server')).actions;
const newEntry = await import('./entries/new/+page.server');

const zone = 'Europe/Budapest';

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.value;
};

function cookieJar() {
	const jar: Record<string, string> = {};
	return {
		jar,
		cookies: {
			get: (n: string) => jar[n],
			set: (n: string, v: string) => {
				jar[n] = v;
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

const entry = () =>
	val(
		core.entries.create({
			projectId,
			start: '2026-10-19T09:00',
			end: '2026-10-19T10:00',
			timeZone: zone,
			description: 'Fix'
		})
	);

/** Runs an action; the redirect it throws, or the failure it returns. */
async function run(
	action: (event: never) => unknown,
	fields: Record<string, string>,
	params: Record<string, string> = {}
) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	const { cookies, jar } = cookieJar();
	const request = new Request('http://x/', { method: 'POST', body });
	try {
		const result = await action({ request, locals, params, cookies } as never);
		return { result: result as { status: number; data: EntryFormFailure }, jar };
	} catch (e) {
		if (isRedirect(e)) return { redirect: e.location, jar };
		throw e;
	}
}

const shown = (id: string, version: number, changes: Record<string, string> = {}) => ({
	version: String(version),
	date: '2026-10-19',
	start: '09:00',
	end: '10:00',
	duration: '1:00',
	projectId,
	description: 'Fix',
	back: '/entries',
	...changes,
	id
});

describe('/entries/[id] actions', () => {
	it('saves a change and returns to back with the strip', async () => {
		const e = entry();
		const r = await run(actions.save!, shown(e.id, e.version, { description: 'New' }), {
			id: e.id
		});
		expect(r.redirect).toBe('/entries');
		expect(JSON.parse(r.jar.flash).batchId).not.toBeNull();
		expect(val(core.entries.get({ id: e.id })).description).toBe('New');
	});

	it('returns without a strip when nothing changed', async () => {
		const e = entry();
		const r = await run(actions.save!, shown(e.id, e.version), { id: e.id });
		expect(r.redirect).toBe('/entries');
		expect(r.jar.flash).toBeUndefined();
	});

	it('refuses a stale save with a conflict, keeping what was typed', async () => {
		const e = entry();
		val(core.entries.update({ id: e.id, expectedVersion: e.version, description: 'Elsewhere' }));
		const r = await run(actions.save!, shown(e.id, e.version, { description: 'Mine' }), {
			id: e.id
		});
		expect(r.result?.status).toBe(400);
		expect(r.result?.data).toMatchObject({
			action: 'save',
			conflict: true,
			gone: false,
			error: 'This was changed elsewhere; reload and try again.',
			values: { description: 'Mine', version: String(e.version) }
		});
	});

	it('refuses an unreadable time beside its field', async () => {
		const e = entry();
		const r = await run(actions.save!, shown(e.id, e.version, { start: 'nope' }), { id: e.id });
		expect(r.result?.data.fields.start).toBeDefined();
		expect(r.result?.data.values?.start).toBe('nope');
	});

	it('says gone for a save, delete or template of a deleted entry', async () => {
		const e = entry();
		val(core.entries.delete({ id: e.id, expectedVersion: e.version }));
		for (const action of ['save', 'delete', 'saveAsTemplate'] as const) {
			const r = await run(actions[action]!, { ...shown(e.id, e.version), name: 'T' }, { id: e.id });
			expect(r.result?.data).toMatchObject({
				action,
				gone: true,
				error: 'This entry was deleted elsewhere.'
			});
		}
	});

	it('deletes at once, with the strip on back', async () => {
		const e = entry();
		const r = await run(
			actions.delete!,
			{ version: String(e.version), back: '/entries' },
			{
				id: e.id
			}
		);
		expect(r.redirect).toBe('/entries');
		expect(JSON.parse(r.jar.flash).label).toContain('Delete');
		expect(core.entries.get({ id: e.id }).ok).toBe(false);
	});

	it('refuses a stale delete with a conflict', async () => {
		const e = entry();
		val(core.entries.update({ id: e.id, expectedVersion: e.version, description: 'Elsewhere' }));
		const r = await run(actions.delete!, { version: String(e.version), back: '/' }, { id: e.id });
		expect(r.result?.data).toMatchObject({ action: 'delete', conflict: true });
		expect(core.entries.get({ id: e.id }).ok).toBe(true);
	});

	it('saves as a template and returns to back', async () => {
		const e = entry();
		const r = await run(
			actions.saveAsTemplate!,
			{ name: 'Fixing', back: '/entries' },
			{
				id: e.id
			}
		);
		expect(r.redirect).toBe('/entries');
		expect(val(core.templates.list()).map((t) => t.name)).toEqual(['Fixing']);
	});
});

describe('/timers/stop and /timers/restart', () => {
	it('offers the stopped entry to restart, and restarts it in its start zone', async () => {
		const running = val(
			core.timers.start({ projectId, timeZone: 'Asia/Tokyo', description: 'Call' })
		);
		const stopped = await run(stop.default!, { id: running.id, back: '/entries' });
		expect(stopped.redirect).toBe('/entries');
		expect(JSON.parse(stopped.jar.flash).restartId).toBe(running.id);

		const r = await run(restart.default!, { id: running.id, back: '/' });
		expect(r.redirect).toBe('/');
		const now = val(core.entries.list({ running: true }));
		expect(now).toHaveLength(1);
		expect(now[0]).toMatchObject({ projectId, startZone: 'Asia/Tokyo', description: 'Call' });
		expect(now[0].id).not.toBe(running.id);
	});

	it('flashes the refusal when the entry to restart is gone', async () => {
		const e = entry();
		val(core.entries.delete({ id: e.id, expectedVersion: e.version }));
		for (const id of [e.id, 'missing']) {
			const r = await run(restart.default!, { id, back: '/' });
			expect(r.redirect).toBe('/');
			expect(JSON.parse(r.jar.flash).error).toBe('This entry was deleted elsewhere.');
		}
	});
});

describe('/timers/start', () => {
	it('starts now from a template with the typed description, in the posted zone', async () => {
		const t = val(
			core.templates.create({
				name: 'Support',
				projectId,
				startTime: '09:00',
				endTime: '17:00',
				timeZone: 'Asia/Tokyo'
			})
		);
		const r = await run(start.default!, {
			templateId: t.id,
			description: 'Ticket 7',
			timeZone: zone,
			back: '/entries'
		});
		expect(r.redirect).toBe('/entries');
		expect(JSON.parse(r.jar.flash).label).toContain('Start timer');
		const running = val(core.entries.list({ running: true }));
		expect(running).toHaveLength(1);
		expect(running[0]).toMatchObject({ projectId, startZone: zone, description: 'Ticket 7' });
		expect(Math.abs(running[0].startAt - Date.now())).toBeLessThan(60_000);
	});

	it('opens the form in timer mode for a template without a project', async () => {
		const t = val(core.templates.create({ name: 'Loose', description: 'Note' }));
		const r = await run(start.default!, { templateId: t.id, timeZone: zone, back: '/entries' });
		expect(r.redirect).toBe(`/entries/new?template=${t.id}&timer=1&back=%2Fentries`);
		expect(val(core.entries.list({ running: true }))).toHaveLength(0);
	});
});

describe('/entries/new', () => {
	const loadValues = async (query: string) => {
		const { cookies } = cookieJar();
		const url = new URL(`http://x/entries/new?${query}`);
		const data = (await (newEntry.load as (e: never) => unknown)({
			locals,
			cookies,
			url
		} as never)) as { values: Record<string, string> };
		return data.values;
	};

	it('marks a timer form as starting now, and no other form', async () => {
		const timer = await loadValues('timer=1');
		expect(timer.startNow).toBe(`${timer.date}T${timer.start}`);
		const t = val(core.templates.create({ name: 'T', projectId, startTime: '09:00' }));
		const withTemplate = await loadValues(`template=${t.id}&timer=1`);
		expect(withTemplate.startNow).toBe(`${withTemplate.date}T${withTemplate.start}`);
		for (const query of ['', 'start=09:00', `copy=${entry().id}`, `template=${t.id}`]) {
			expect((await loadValues(query)).startNow).toBe('');
		}
	});

	describe('save', () => {
		// Tomorrow at 10:30:40 UTC: always after the real-clock batches the setup writes,
		// which the core keeps strictly increasing.
		const today = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
		const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
		const NOW = Date.parse(`${today}T10:30:40.000Z`);
		const filled = (over: Record<string, string> = {}) => ({
			projectId,
			timeZone: 'UTC',
			date: today,
			start: '10:30',
			startNow: `${today}T10:30`,
			back: '/entries',
			...over
		});
		const running = () => {
			vi.setSystemTime(NOW - 20_000);
			const old = val(core.timers.start({ projectId, timeZone: 'UTC' }));
			vi.setSystemTime(NOW);
			return old;
		};

		beforeEach(() => {
			vi.useFakeTimers();
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it('starts an untouched Start at the moment of saving, stopping the old timer there', async () => {
			const old = running();
			const r = await run(newEntry.actions.default!, filled());
			expect(r.redirect).toBe('/entries');
			const [now] = val(core.entries.list({ running: true }));
			expect(now.startAt).toBe(NOW);
			expect(val(core.entries.get({ id: old.id })).endAt).toBe(NOW);
		});

		it('keeps a typed start: a changed date is not now', async () => {
			running();
			const r = await run(newEntry.actions.default!, filled({ date: yesterday }));
			expect(r.result?.status).toBe(400);
			expect(r.result?.data.fields.start).toContain("This project's timer has been running since");
		});

		it('takes the typed start when an end comes with startNow', async () => {
			const r = await run(
				newEntry.actions.default!,
				filled({ start: '09:00', startNow: `${today}T09:00`, end: '09:30' })
			);
			expect(r.redirect).toBe('/entries');
			const [e] = val(core.entries.list({}));
			expect(e.startAt).toBe(Date.parse(`${today}T09:00:00Z`));
			expect(e.endAt).toBe(Date.parse(`${today}T09:30:00Z`));
		});

		it('takes the typed start when a duration comes with startNow', async () => {
			const r = await run(
				newEntry.actions.default!,
				filled({ start: '09:00', startNow: `${today}T09:00`, duration: '0:30' })
			);
			expect(r.redirect).toBe('/entries');
			const [e] = val(core.entries.list({}));
			expect(e.startAt).toBe(Date.parse(`${today}T09:00:00Z`));
			expect(e.endAt).toBe(Date.parse(`${today}T09:30:00Z`));
		});

		it('keeps the posted startNow in a refusal', async () => {
			running();
			const r = await run(newEntry.actions.default!, filled({ date: yesterday }));
			expect(r.result?.data.values?.startNow).toBe(`${today}T10:30`);
		});
	});
});
