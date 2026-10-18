import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import { createActivity, createCustomer, createLocation, createProject } from './reference';
import type { Result } from './result';
import {
	createTemplate,
	deleteTemplate,
	getTemplate,
	listTemplates,
	updateTemplate
} from './templates';
import { undo } from './undo';

function setup() {
	const db = createTestDb();
	const mkUser = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const userId = mkUser('u');
	const other = mkUser('o');
	let clock = 1_000;
	const run = <T>(fn: Parameters<typeof runBatch<T>>[4], uid = userId): Result<T> =>
		runBatch(db, uid, 'ui', 'test', fn, clock++);
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const refs = (uid = userId, customerName = 'Acme') =>
		val(
			run((w) => {
				const c = createCustomer(w, { name: customerName });
				const p = createProject(w, { customerId: val(c).id, name: 'Web' });
				const a = createActivity(w, { name: 'Dev' });
				const l = createLocation(w, { name: 'Home' });
				return {
					ok: true as const,
					value: { c: val(c), p: val(p), a: val(a), l: val(l) },
					warnings: []
				};
			}, uid)
		);
	const create = (input: Record<string, unknown>, uid = userId) =>
		run((w) => createTemplate(w, input), uid);
	return { db, userId, other, run, val, refs, create };
}

const err = <T>(r: Result<T>) => (r.ok ? null : r.error);

describe('createTemplate', () => {
	it('stores a full template', () => {
		const { val, refs, create } = setup();
		const r = refs();
		const t = val(
			create({
				name: ' Standup ',
				customerId: r.c.id,
				projectId: r.p.id,
				activityId: r.a.id,
				locationId: r.l.id,
				startTime: '09:30',
				endTime: '10:00',
				timeZone: 'Europe/Budapest',
				reference: ' R1 ',
				description: ' daily '
			})
		);
		expect(t).toMatchObject({
			name: 'Standup',
			nameKey: 'standup',
			customerId: r.c.id,
			projectId: r.p.id,
			activityId: r.a.id,
			locationId: r.l.id,
			startTime: '09:30',
			endTime: '10:00',
			durationMinutes: null,
			timeZone: 'Europe/Budapest',
			reference: 'R1',
			description: 'daily',
			version: 1
		});
	});

	it('stores a template with only a name', () => {
		const { val, create } = setup();
		const t = val(create({ name: 'Blank' }));
		expect(t).toMatchObject({
			customerId: null,
			projectId: null,
			activityId: null,
			locationId: null,
			startTime: null,
			endTime: null,
			durationMinutes: null,
			timeZone: null,
			reference: null,
			description: null
		});
	});

	it('refuses a missing or foreign reference', () => {
		const { refs, create, other } = setup();
		const mine = refs();
		const theirs = refs(other, 'Theirs');
		for (const [field, id] of [
			['customerId', theirs.c.id],
			['projectId', theirs.p.id],
			['activityId', theirs.a.id],
			['locationId', theirs.l.id],
			['projectId', 'nope']
		]) {
			expect(err(create({ name: 'X', [field]: id }))?.code, field).toBe('not_found');
		}
		expect(err(create({ name: 'X', projectId: mine.p.id }))).toBeNull();
	});

	it("refuses a project that is not the customer's", () => {
		const { run, val, refs, create } = setup();
		const r = refs();
		const c2 = val(run((w) => createCustomer(w, { name: 'Other' })));
		expect(err(create({ name: 'X', customerId: c2.id, projectId: r.p.id }))).toMatchObject({
			code: 'invalid',
			fields: { projectId: "That project is not this customer's." }
		});
		expect(err(create({ name: 'Y', customerId: r.c.id, projectId: r.p.id }))).toBeNull();
	});

	it('needs a start time for an end time', () => {
		const { create } = setup();
		expect(err(create({ name: 'X', endTime: '10:00' }))).toMatchObject({
			code: 'invalid',
			fields: { endTime: 'An end time needs a start time.' }
		});
	});

	it('refuses an end time with a duration', () => {
		const { create } = setup();
		const e = err(create({ name: 'X', startTime: '09:00', endTime: '10:00', durationMinutes: 30 }));
		expect(e?.code).toBe('invalid');
		expect(e?.fields).toHaveProperty('endTime');
		expect(e?.fields).toHaveProperty('durationMinutes');
	});

	it('checks the time format, duration and zone', () => {
		const { create } = setup();
		for (const bad of ['9:00', '24:00', '09:60', 'abc', '09:00:00']) {
			expect(err(create({ name: 'X', startTime: bad }))?.fields, bad).toHaveProperty('startTime');
		}
		expect(err(create({ name: 'X', startTime: '9:00' }))?.fields?.startTime).toBe(
			'Use a time like 09:00.'
		);
		expect(err(create({ name: 'X', durationMinutes: 0 }))?.fields).toHaveProperty(
			'durationMinutes'
		);
		expect(err(create({ name: 'X', durationMinutes: 2_628_001 }))?.fields).toHaveProperty(
			'durationMinutes'
		);
		expect(err(create({ name: 'X', durationMinutes: 1.5 }))?.fields).toHaveProperty(
			'durationMinutes'
		);
		expect(err(create({ name: 'X', timeZone: 'Mars/Base' }))?.fields).toHaveProperty('timeZone');
		expect(err(create({ name: 'X', durationMinutes: 2_628_000 }))).toBeNull();
	});

	it('limits the text', () => {
		const { create } = setup();
		expect(err(create({ name: 'X', reference: 'a'.repeat(201) }))?.fields).toHaveProperty(
			'reference'
		);
		expect(err(create({ name: 'X', description: 'a'.repeat(2001) }))?.fields).toHaveProperty(
			'description'
		);
		expect(err(create({ name: '' }))?.fields).toHaveProperty('name');
	});

	it('refuses a duplicate name in any case', () => {
		const { create } = setup();
		expect(err(create({ name: 'Ügyfél' }))).toBeNull();
		expect(err(create({ name: 'ügyfél' }))).toMatchObject({
			code: 'conflict',
			fields: { name: 'A template with this name already exists.' }
		});
	});

	it('lets two users share a name', () => {
		const { create, other } = setup();
		expect(err(create({ name: 'A' }))).toBeNull();
		expect(err(create({ name: 'A' }, other))).toBeNull();
	});
});

describe('updateTemplate', () => {
	it('changes only what is given and clears with null', () => {
		const { run, val, refs, create } = setup();
		const r = refs();
		const t = val(
			create({ name: 'T', projectId: r.p.id, startTime: '09:00', durationMinutes: 30 })
		);
		const u = val(run((w) => updateTemplate(w, { id: t.id, description: 'hi' })));
		expect(u).toMatchObject({
			description: 'hi',
			projectId: r.p.id,
			startTime: '09:00',
			durationMinutes: 30,
			version: 2
		});
		const c = val(
			run((w) =>
				updateTemplate(w, { id: t.id, projectId: null, durationMinutes: null, description: null })
			)
		);
		expect(c).toMatchObject({
			projectId: null,
			durationMinutes: null,
			description: null,
			startTime: '09:00'
		});
	});

	it('renames and refuses a taken name', () => {
		const { run, val, create } = setup();
		const a = val(create({ name: 'A' }));
		val(create({ name: 'B' }));
		expect(val(run((w) => updateTemplate(w, { id: a.id, name: 'C' }))).nameKey).toBe('c');
		expect(err(run((w) => updateTemplate(w, { id: a.id, name: 'b' })))).toMatchObject({
			code: 'conflict',
			fields: { name: 'A template with this name already exists.' }
		});
		expect(err(run((w) => updateTemplate(w, { id: a.id, name: 'C' })))).toBeNull();
	});

	it('checks the rules against the merged row', () => {
		const { run, val, create } = setup();
		const t = val(create({ name: 'T', startTime: '09:00', endTime: '10:00' }));
		expect(err(run((w) => updateTemplate(w, { id: t.id, durationMinutes: 30 })))?.code).toBe(
			'invalid'
		);
		expect(err(run((w) => updateTemplate(w, { id: t.id, startTime: null })))?.fields).toEqual({
			endTime: 'An end time needs a start time.'
		});
		// swapping end for duration in one command works
		expect(
			err(run((w) => updateTemplate(w, { id: t.id, endTime: null, durationMinutes: 30 })))
		).toBeNull();
	});

	it('checks the project against the customer when only one changes', () => {
		const { run, val, refs, create } = setup();
		const r = refs();
		const c2 = val(run((w) => createCustomer(w, { name: 'Other' })));
		const t = val(create({ name: 'T', customerId: r.c.id, projectId: r.p.id }));
		expect(err(run((w) => updateTemplate(w, { id: t.id, customerId: c2.id })))?.fields).toEqual({
			projectId: "That project is not this customer's."
		});
	});

	it('refuses a stale version, an unknown id and another user', () => {
		const { run, val, create, other } = setup();
		const t = val(create({ name: 'T' }));
		val(run((w) => updateTemplate(w, { id: t.id, description: 'x' })));
		expect(
			err(run((w) => updateTemplate(w, { id: t.id, description: 'y', expectedVersion: 1 })))?.code
		).toBe('conflict');
		expect(err(run((w) => updateTemplate(w, { id: 'nope', description: 'y' })))?.code).toBe(
			'not_found'
		);
		expect(err(run((w) => updateTemplate(w, { id: t.id, description: 'y' }), other))?.code).toBe(
			'not_found'
		);
	});

	it('refuses a foreign reference', () => {
		const { run, val, refs, create, other } = setup();
		const theirs = refs(other, 'Theirs');
		const t = val(create({ name: 'T' }));
		expect(err(run((w) => updateTemplate(w, { id: t.id, locationId: theirs.l.id })))?.code).toBe(
			'not_found'
		);
	});
});

describe('deleteTemplate', () => {
	it('deletes and undo brings it back', () => {
		const { db, run, val, create, userId } = setup();
		const t = val(create({ name: 'T', description: 'd' }));
		const del = run((w) => deleteTemplate(w, { id: t.id }));
		expect(val(del).id).toBe(t.id);
		expect(err(getTemplate(db, userId, { id: t.id }))?.code).toBe('not_found');
		// find the delete batch via the history of changes
		const batchId = db.$client
			.prepare("select batch_id as b from change where op = 'delete' and entity = 'template'")
			.get() as { b: string };
		val(run((w) => undo(w, { batchId: batchId.b })));
		expect(val(getTemplate(db, userId, { id: t.id })).description).toBe('d');
	});

	it('undoes a create by removing it, and an update by restoring', () => {
		const { db, run, val, create, userId } = setup();
		const t = val(create({ name: 'T' }));
		val(run((w) => updateTemplate(w, { id: t.id, description: 'new' })));
		const rows = db.$client
			.prepare("select batch_id as b, op from change where entity = 'template' order by rowid")
			.all() as { b: string; op: string }[];
		val(run((w) => undo(w, { batchId: rows[1].b })));
		expect(val(getTemplate(db, userId, { id: t.id })).description).toBeNull();
		val(run((w) => undo(w, { batchId: rows[0].b })));
		expect(err(getTemplate(db, userId, { id: t.id }))?.code).toBe('not_found');
	});

	it('honours expectedVersion and other users', () => {
		const { run, val, create, other } = setup();
		const t = val(create({ name: 'T' }));
		expect(err(run((w) => deleteTemplate(w, { id: t.id, expectedVersion: 9 })))?.code).toBe(
			'conflict'
		);
		expect(err(run((w) => deleteTemplate(w, { id: t.id }), other))?.code).toBe('not_found');
	});
});

describe('reads', () => {
	it('lists by name with the referenced names', () => {
		const { db, val, refs, create, userId, other } = setup();
		const r = refs();
		val(create({ name: 'zeta' }));
		val(create({ name: 'Émile', customerId: r.c.id, projectId: r.p.id, activityId: r.a.id }));
		val(create({ name: 'alpha', locationId: r.l.id }));
		val(create({ name: 'theirs' }, other));
		const list = val(listTemplates(db, userId));
		expect(list.map((t) => t.name)).toEqual(['alpha', 'Émile', 'zeta']);
		expect(list[0]).toMatchObject({
			customerName: null,
			projectName: null,
			activityName: null,
			locationName: 'Home'
		});
		expect(list[1]).toMatchObject({
			customerName: 'Acme',
			projectName: 'Web',
			activityName: 'Dev',
			locationName: null
		});
	});

	it("gets one with its names, and not another user's", () => {
		const { db, val, refs, create, userId, other } = setup();
		const r = refs();
		const t = val(create({ name: 'T', projectId: r.p.id }));
		expect(val(getTemplate(db, userId, { id: t.id })).projectName).toBe('Web');
		expect(err(getTemplate(db, other, { id: t.id }))?.code).toBe('not_found');
	});
});
