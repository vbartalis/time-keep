import { isRedirect, type Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryFormData, EntryFormFailure } from '#lib/components/entry/types.js';
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

const listed = await import('./+page.server');
const created = await import('./new/+page.server');
const edited = await import('./[id]/+page.server');

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
let customerId: string;
let projectId: string;

beforeEach(() => {
	db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	locals = { user: { id, username: 'u', isAdmin: false } } as unknown as App.Locals;
	core = openCore(db, id, 'ui', () => Date.now());
	customerId = val(core.customers.create({ name: 'Acme' })).id;
	projectId = val(core.projects.create({ customerId, name: 'Web' })).id;
});

type Outcome = {
	redirect?: string;
	failure?: EntryFormFailure;
	status?: number;
	jar: Record<string, string>;
};

async function run(
	action: (event: never) => unknown,
	fields: Record<string, string>,
	params: Record<string, string> = {}
): Promise<Outcome> {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.append(k, v);
	const { cookies, jar } = cookieJar();
	const request = new Request('http://x/', { method: 'POST', body });
	try {
		const result = (await action({ request, locals, params, cookies } as never)) as {
			status: number;
			data: EntryFormFailure;
		};
		return { failure: result.data, status: result.status, jar };
	} catch (e) {
		if (isRedirect(e)) return { redirect: e.location, jar };
		throw e;
	}
}

const loadEdit = (id: string, query = '') =>
	(edited.load as never as (e: unknown) => EntryFormData)({
		locals,
		params: { id },
		url: new URL(`http://x/templates/${id}${query}`)
	});

const save = (fields: Record<string, string>, id: string) =>
	run(edited.actions.save as never, fields, { id });

const template = (over: Record<string, unknown> = {}) =>
	val(core.templates.create({ name: 'Standup', startTime: '09:00', durationMinutes: 15, ...over }));

describe('/templates/new', () => {
	it('loads an empty template form that returns to the screen it was opened over', () => {
		const data = (created.load as never as (e: unknown) => EntryFormData)({
			locals,
			url: new URL('http://x/templates/new?back=/templates')
		});
		expect(data).toMatchObject({ kind: 'template', mode: 'new', back: '/templates' });
		expect(data.values.name).toBe('');
	});

	it('creates the template and returns to Today by default, with the strip', async () => {
		const r = await run(created.actions.default as never, {
			name: 'Review',
			start: '09:30',
			end: '10:00',
			linked: 'end',
			projectId
		});
		expect(r.redirect).toBe('/');
		expect(JSON.parse(r.jar.flash).label).toBe('Create template "Review"');
		const [t] = val(core.templates.list());
		expect(t).toMatchObject({
			name: 'Review',
			startTime: '09:30',
			endTime: '10:00',
			durationMinutes: null,
			projectId,
			customerId
		});
	});

	it('returns to the posted back', async () => {
		const r = await run(created.actions.default as never, { name: 'A', back: '/templates' });
		expect(r.redirect).toBe('/templates');
	});

	it('refuses a blank name beside the field, keeping what was typed', async () => {
		const r = await run(created.actions.default as never, {
			name: ' ',
			start: '9',
			reference: 'R',
			back: '/templates'
		});
		expect(r.status).toBe(400);
		expect(r.failure).toMatchObject({ action: 'save', back: '/templates' });
		expect(Object.keys(r.failure!.fields)).toEqual(['name']);
		expect(r.failure!.values).toMatchObject({ start: '9', reference: 'R' });
	});

	it("shows the core's refusal of a time beside its field name", async () => {
		const r = await run(created.actions.default as never, { name: 'A', start: 'soon' });
		expect(r.status).toBe(400);
		expect(Object.keys(r.failure!.fields)).toEqual(['start']);
	});

	it('refuses a duplicate name', async () => {
		template({ name: 'Dup' });
		const r = await run(created.actions.default as never, { name: 'Dup' });
		expect(r.status).toBe(400);
		expect(r.failure!.fields.name ?? r.failure!.error).toMatch(/already exists/);
	});
});

describe('/templates/[id] load', () => {
	it('loads the template for the form', () => {
		const t = template({ customerId });
		const data = loadEdit(t.id, '?back=/templates');
		expect(data).toMatchObject({ kind: 'template', mode: 'edit', back: '/templates' });
		expect(data.values).toMatchObject({ id: t.id, name: 'Standup', customerId, start: '09:00' });
	});

	it('is a 404 for a template that is gone', () => {
		expect(() => loadEdit('nope')).toThrow();
	});

	it('marks the archived activity, location and project it names, and keeps them on a save', async () => {
		const activity = val(core.activities.create({ name: 'Old build' }));
		const location = val(core.locations.create({ name: 'Old office' }));
		const old = val(core.projects.create({ customerId, name: 'Old' }));
		const t = template({
			customerId,
			projectId: old.id,
			activityId: activity.id,
			locationId: location.id
		});
		val(core.activities.archive({ id: activity.id }));
		val(core.locations.archive({ id: location.id }));
		val(core.projects.archive({ id: old.id }));

		const data = loadEdit(t.id);
		expect(data.activities).toEqual([{ id: activity.id, name: 'Old build', archived: true }]);
		expect(data.locations).toEqual([{ id: location.id, name: 'Old office', archived: true }]);
		expect(data.projects.find((p) => p.id === old.id)?.archived).toBe(true);

		// The form posts back what it showed, the archived references among it.
		const r = await save(
			{
				version: String(t.version),
				name: 'Standup renamed',
				customerId,
				projectId: old.id,
				activityId: activity.id,
				locationId: location.id,
				start: '09:00',
				duration: '0:15',
				linked: 'duration'
			},
			t.id
		);
		expect(r.redirect).toBe('/');
		const kept = val(core.templates.get({ id: t.id }));
		expect(kept).toMatchObject({
			name: 'Standup renamed',
			projectId: old.id,
			activityId: activity.id,
			locationId: location.id
		});
	});
});

describe('/templates/[id] save', () => {
	const same = (t: { id: string; version: number }) => ({
		version: String(t.version),
		name: 'Standup',
		start: '09:00',
		duration: '0:15',
		linked: 'duration',
		back: '/templates'
	});

	it('saves and returns to back with the strip', async () => {
		const t = template();
		const r = await save({ ...same(t), name: 'Daily' }, t.id);
		expect(r.redirect).toBe('/templates');
		expect(JSON.parse(r.jar.flash).label).toBe('Edit template "Standup"');
		expect(val(core.templates.get({ id: t.id })).name).toBe('Daily');
	});

	it('returns without a strip when nothing changed', async () => {
		const t = template();
		const r = await save(same(t), t.id);
		expect(r.redirect).toBe('/templates');
		expect(r.jar.flash).toBeUndefined();
		expect(val(core.templates.get({ id: t.id })).version).toBe(t.version);
	});

	it('is a conflict over a stale version, offering a reload', async () => {
		const t = template();
		val(core.templates.update({ id: t.id, expectedVersion: t.version, name: 'Elsewhere' }));
		const r = await save({ ...same(t), name: 'Mine' }, t.id);
		expect(r.status).toBe(400);
		expect(r.failure).toMatchObject({ action: 'save', conflict: true, gone: false });
		expect(r.failure!.values).toMatchObject({ name: 'Mine', version: String(t.version) });
		expect(val(core.templates.get({ id: t.id })).name).toBe('Elsewhere');
	});

	it('says so when the template was deleted elsewhere', async () => {
		const t = template();
		val(core.templates.delete({ id: t.id, expectedVersion: t.version }));
		const r = await save(same(t), t.id);
		expect(r.failure).toMatchObject({ action: 'save', gone: true, back: '/templates' });
		expect(r.failure!.error).toMatch(/template/);
	});

	it('refuses a time that cannot be read beside its field', async () => {
		const t = template();
		const r = await save({ ...same(t), end: '25:00', linked: 'end' }, t.id);
		expect(r.status).toBe(400);
		expect(Object.keys(r.failure!.fields)).toEqual(['end']);
	});

	it("refuses a project that is not the customer's, beside the project", async () => {
		const other = val(core.customers.create({ name: 'Other' })).id;
		const t = template();
		const r = await save({ ...same(t), customerId: other, projectId }, t.id);
		expect(r.status).toBe(400);
		expect(Object.keys(r.failure!.fields)).toEqual(['projectId']);
	});

	it('clears a field posted blank', async () => {
		const t = template({ reference: 'PO-1', customerId });
		await save({ ...same(t), reference: '' }, t.id);
		expect(val(core.templates.get({ id: t.id }))).toMatchObject({
			reference: null,
			customerId: null
		});
	});
});

describe('/templates/[id] save without javascript', () => {
	// No script, so no `linked`: the form posts the end and the duration it showed.
	const timed = () => template({ startTime: '09:00', endTime: '10:00', durationMinutes: null });
	const posted = (t: { version: number }) => ({
		version: String(t.version),
		name: 'Standup',
		start: '09:00',
		end: '10:00',
		duration: '1:00',
		back: '/templates'
	});

	it('keeps a changed duration over the unchanged end, as a duration with no end', async () => {
		const t = timed();
		const r = await save({ ...posted(t), duration: '2:00' }, t.id);
		expect(r.redirect).toBe('/templates');
		expect(JSON.parse(r.jar.flash).label).toBe('Edit template "Standup"');
		expect(val(core.templates.get({ id: t.id }))).toMatchObject({
			endTime: null,
			durationMinutes: 120
		});
	});

	it('keeps a changed end', async () => {
		const t = timed();
		const r = await save({ ...posted(t), end: '10:30' }, t.id);
		expect(r.redirect).toBe('/templates');
		expect(val(core.templates.get({ id: t.id }))).toMatchObject({
			endTime: '10:30',
			durationMinutes: null
		});
	});

	it('returns without a strip when nothing changed', async () => {
		const t = timed();
		const r = await save(posted(t), t.id);
		expect(r.redirect).toBe('/templates');
		expect(r.jar.flash).toBeUndefined();
		expect(val(core.templates.get({ id: t.id })).version).toBe(t.version);
	});
});

describe('/templates/[id] save without javascript, duration only', () => {
	const posted = (t: { version: number }, over: Record<string, string> = {}) => ({
		version: String(t.version),
		name: 'Ticket',
		duration: '0:30',
		back: '/templates',
		...over
	});

	it('keeps an unchanged duration, with no strip', async () => {
		const t = template({ name: 'Ticket', startTime: null, durationMinutes: 30 });
		const r = await save(posted(t), t.id);
		expect(r.redirect).toBe('/templates');
		expect(r.jar.flash).toBeUndefined();
		expect(val(core.templates.get({ id: t.id }))).toMatchObject({ durationMinutes: 30 });
	});

	it('stores a changed duration', async () => {
		const t = template({ name: 'Ticket', startTime: null, durationMinutes: 30 });
		await save(posted(t, { duration: '0:45' }), t.id);
		expect(val(core.templates.get({ id: t.id }))).toMatchObject({ durationMinutes: 45 });
	});

	it('keeps the duration of a start and duration template, the end blank', async () => {
		const t = template({ name: 'Ticket', startTime: '09:00', durationMinutes: 30 });
		const r = await save(posted(t, { start: '09:00' }), t.id);
		expect(r.jar.flash).toBeUndefined();
		expect(val(core.templates.get({ id: t.id }))).toMatchObject({
			startTime: '09:00',
			durationMinutes: 30
		});
	});
});

describe('/templates/[id] delete', () => {
	it('deletes at once and the strip undoes it', async () => {
		const t = template();
		const r = await run(
			edited.actions.delete as never,
			{ version: String(t.version), back: '/templates' },
			{ id: t.id }
		);
		expect(r.redirect).toBe('/templates');
		expect(val(core.templates.list())).toHaveLength(0);
		const flash = JSON.parse(r.jar.flash);
		expect(flash.label).toBe('Delete template "Standup"');
		val(core.undo({ batchId: flash.batchId }));
		expect(val(core.templates.list()).map((x) => x.name)).toEqual(['Standup']);
	});

	it('refuses a stale version with a conflict', async () => {
		const t = template();
		val(core.templates.update({ id: t.id, expectedVersion: t.version, name: 'Elsewhere' }));
		const r = await run(
			edited.actions.delete as never,
			{ version: String(t.version) },
			{ id: t.id }
		);
		expect(r.failure).toMatchObject({ action: 'delete', conflict: true });
		expect(val(core.templates.list())).toHaveLength(1);
	});

	it('says so when it was deleted elsewhere', async () => {
		const t = template();
		val(core.templates.delete({ id: t.id, expectedVersion: t.version }));
		const r = await run(
			edited.actions.delete as never,
			{ version: String(t.version) },
			{ id: t.id }
		);
		expect(r.failure).toMatchObject({ action: 'delete', gone: true });
	});
});

describe('/templates load', () => {
	it('lists the cards by name with their versions, the pickers and the flash', () => {
		const t = template({ projectId, customerId });
		template({ name: 'Ad hoc', startTime: null, durationMinutes: null });
		const { cookies, jar } = cookieJar();
		jar.flash = JSON.stringify({ label: 'Done', batchId: null, warnings: [] });
		const data = (listed.load as never as (e: unknown) => Record<string, unknown>)({
			locals,
			cookies
		}) as {
			templates: { id: string; name: string; version: number; runs: boolean }[];
			projects: { id: string }[];
			flash: { label: string } | null;
		};
		expect(data.templates.map((c) => [c.name, c.runs])).toEqual([
			['Ad hoc', true],
			['Standup', false]
		]);
		expect(data.templates[1]).toMatchObject({ id: t.id, version: t.version });
		expect(data.projects.map((p) => p.id)).toEqual([projectId]);
		expect(data.flash?.label).toBe('Done');
	});
});
