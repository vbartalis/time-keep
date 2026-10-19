import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { change, entry as entryTable, user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import {
	createEntry,
	deleteEntry,
	getEntry,
	listEntries,
	updateEntry,
	type EntryItem
} from './entries';
import {
	archive,
	createActivity,
	createCustomer,
	createLocation,
	createProject
} from './reference';
import type { Result } from './result';
import { undo } from './undo';

const H = 3_600_000;
/** 2026-10-18T09:00:00Z. */
const T9 = Date.UTC(2026, 9, 18, 9);

function setup() {
	const db = createTestDb();
	const mkUser = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const userId = mkUser('u');
	const other = mkUser('o');
	/** Batches run after every time the tests use, so running entries never start in the future. */
	let clock = Date.UTC(2027, 0, 1);
	const run = <T>(fn: Parameters<typeof runBatch<T>>[4], uid = userId): Result<T> =>
		runBatch(db, uid, 'ui', 'test', fn, clock++);
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const project = (name: string, customerName = 'Acme', uid = userId) =>
		val(
			run((w) => {
				const c = createCustomer(w, { name: customerName });
				if (!c.ok) return c;
				return createProject(w, { customerId: c.value.id, name });
			}, uid)
		);
	const p = project('Web');
	const create = (input: Record<string, unknown>) =>
		run((w) => createEntry(w, { projectId: p.id, timeZone: 'UTC', ...input }));
	return { db, userId, other, run, val, project, p, create };
}

const err = <T>(r: Result<T>) => (r.ok ? null : r.error);

describe('createEntry', () => {
	it('creates a finished entry from a start and an end', () => {
		const { create, val, p, userId } = setup();
		const e = val(
			create({
				start: '2026-10-18T09:00:00Z',
				end: '2026-10-18T10:30:15Z',
				reference: '  T-1 ',
				description: ' Fix the build '
			})
		);
		expect(e).toMatchObject({
			userId,
			projectId: p.id,
			activityId: null,
			locationId: null,
			startAt: T9,
			startZone: 'UTC',
			endAt: T9 + 1.5 * H + 15_000,
			endZone: 'UTC',
			reference: 'T-1',
			description: 'Fix the build',
			version: 1
		});
	});

	it('sets the end from a duration', () => {
		const { create, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00:00Z', durationMinutes: 90 }));
		expect(e.endAt).toBe(T9 + 1.5 * H);
		expect(e.endZone).toBe('UTC');
	});

	it('creates a running entry without an end', () => {
		const { create, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00:00Z' }));
		expect(e).toMatchObject({ startAt: T9, endAt: null, endZone: null });
	});

	it('reads a local start in the time zone and an offset start as given', () => {
		const { create, val } = setup();
		const local = val(
			create({ start: '2026-10-18T11:00', end: '2026-10-18T12:00', timeZone: 'Europe/Budapest' })
		);
		expect(local).toMatchObject({
			startAt: T9,
			endAt: T9 + H,
			startZone: 'Europe/Budapest',
			endZone: 'Europe/Budapest'
		});
		const offset = val(
			create({ start: '2026-10-18T11:00:00+02:00', durationMinutes: 30, timeZone: 'Asia/Tokyo' })
		);
		expect(offset).toMatchObject({ startAt: T9, startZone: 'Asia/Tokyo' });
	});

	it('reads a local end in the end time zone and stores it', () => {
		const { create, val } = setup();
		const e = val(
			create({
				start: '2026-10-18T11:00',
				timeZone: 'Europe/Budapest',
				// London is still on summer time (UTC+1).
				end: '2026-10-18T11:00',
				endTimeZone: 'Europe/London'
			})
		);
		expect(e).toMatchObject({ startAt: T9, endAt: T9 + H, endZone: 'Europe/London' });
	});

	it('refuses an unknown time zone on the time zone field', () => {
		const { create } = setup();
		expect(err(create({ start: '2026-10-18T09:00', timeZone: 'Mars/Base' }))).toMatchObject({
			code: 'invalid',
			fields: { timeZone: 'Unknown time zone.' }
		});
		expect(
			err(create({ start: '2026-10-18T09:00', end: '2026-10-18T10:00', endTimeZone: 'Nope' }))
		).toMatchObject({ code: 'invalid', fields: { endTimeZone: 'Unknown time zone.' } });
	});

	it('refuses a malformed start or a local time in a gap', () => {
		const { create } = setup();
		expect(err(create({ start: 'yesterday' }))).toMatchObject({
			code: 'invalid',
			fields: { start: expect.any(String) }
		});
		expect(err(create({ start: '2026-03-29T02:30', timeZone: 'Europe/Budapest' }))).toMatchObject({
			code: 'invalid',
			fields: { start: expect.any(String) }
		});
	});

	it('refuses an end at or before the start', () => {
		const { create } = setup();
		for (const end of ['2026-10-18T08:00:00Z', '2026-10-18T09:00:00Z']) {
			expect(err(create({ start: '2026-10-18T09:00:00Z', end }))).toMatchObject({
				code: 'invalid',
				message: 'The end must be after the start.'
			});
		}
	});

	it('refuses both an end and a duration, and a duration that is not a positive whole number', () => {
		const { create } = setup();
		expect(
			err(create({ start: '2026-10-18T09:00Z', end: '2026-10-18T10:00Z', durationMinutes: 60 }))
		).toMatchObject({ code: 'invalid' });
		for (const durationMinutes of [0, -5, 1.5]) {
			expect(err(create({ start: '2026-10-18T09:00Z', durationMinutes }))).toMatchObject({
				code: 'invalid',
				fields: { durationMinutes: expect.any(String) }
			});
		}
	});

	it('limits a duration to five years', () => {
		const { create } = setup();
		const r = create({ start: '2026-10-18T09:00Z', durationMinutes: 2628001 });
		expect(err(r)).toMatchObject({
			code: 'invalid',
			fields: { durationMinutes: 'Duration must be at most 5 years.' }
		});
		expect(create({ start: '2026-10-18T09:00Z', durationMinutes: 2628000 }).ok).toBe(true);
	});

	it('limits reference and description and stores blank ones as null', () => {
		const { create, val } = setup();
		expect(err(create({ start: '2026-10-18T09:00Z', reference: 'x'.repeat(201) }))).toMatchObject({
			code: 'invalid',
			fields: { reference: expect.any(String) }
		});
		expect(
			err(create({ start: '2026-10-18T09:00Z', description: 'x'.repeat(2001) }))
		).toMatchObject({ code: 'invalid', fields: { description: expect.any(String) } });
		const e = val(create({ start: '2026-10-18T09:00Z', reference: '  ', description: '' }));
		expect(e).toMatchObject({ reference: null, description: null });
	});

	it("refuses another user's project, activity or location as not found", () => {
		const { run, create, project, other, val } = setup();
		const theirs = project('Theirs', 'Them', other);
		const activity = val(run((w) => createActivity(w, { name: 'Dev' }), other));
		const location = val(run((w) => createLocation(w, { name: 'Home' }), other));
		expect(err(create({ start: '2026-10-18T09:00Z', projectId: theirs.id }))).toMatchObject({
			code: 'not_found'
		});
		expect(err(create({ start: '2026-10-18T09:00Z', projectId: 'missing' }))).toMatchObject({
			code: 'not_found'
		});
		expect(err(create({ start: '2026-10-18T09:00Z', activityId: activity.id }))).toMatchObject({
			code: 'not_found'
		});
		expect(err(create({ start: '2026-10-18T09:00Z', locationId: location.id }))).toMatchObject({
			code: 'not_found'
		});
	});

	it('allows archived references', () => {
		const { run, create, val, p } = setup();
		const activity = val(run((w) => createActivity(w, { name: 'Dev' })));
		const location = val(run((w) => createLocation(w, { name: 'Home' })));
		val(run((w) => archive(w, 'project', { id: p.id })));
		val(run((w) => archive(w, 'activity', { id: activity.id })));
		val(run((w) => archive(w, 'location', { id: location.id })));
		const e = val(
			create({
				start: '2026-10-18T09:00Z',
				durationMinutes: 60,
				activityId: activity.id,
				locationId: location.id
			})
		);
		expect(e).toMatchObject({ activityId: activity.id, locationId: location.id });
	});
});

describe('updateEntry', () => {
	it('changes only the given fields', () => {
		const { create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60, reference: 'R' }));
		const u = val(run((w) => updateEntry(w, { id: e.id, description: 'New' })));
		expect(u).toMatchObject({
			description: 'New',
			reference: 'R',
			startAt: e.startAt,
			endAt: e.endAt,
			version: 2
		});
	});

	it('makes a finished entry running with end null', () => {
		const { create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		const u = val(run((w) => updateEntry(w, { id: e.id, end: null })));
		expect(u).toMatchObject({ endAt: null, endZone: null });
	});

	it('sets the end from a duration and the new start', () => {
		const { create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		const u = val(
			run((w) => updateEntry(w, { id: e.id, start: '2026-10-18T12:00Z', durationMinutes: 30 }))
		);
		expect(u).toMatchObject({ startAt: T9 + 3 * H, endAt: T9 + 3.5 * H });
	});

	it('keeps the end zone when the end changes without one, or uses the start zone for a running entry', () => {
		const { create, run, val } = setup();
		const e = val(
			create({
				start: '2026-10-18T11:00',
				timeZone: 'Europe/Budapest',
				end: '2026-10-18T11:00',
				endTimeZone: 'Europe/London'
			})
		);
		const u = val(run((w) => updateEntry(w, { id: e.id, end: '2026-10-18T12:00' })));
		expect(u).toMatchObject({ endAt: T9 + 2 * H, endZone: 'Europe/London' });
		const r = val(create({ start: '2026-10-18T11:00', timeZone: 'Europe/Budapest' }));
		const s = val(run((w) => updateEntry(w, { id: r.id, end: '2026-10-18T12:00' })));
		expect(s).toMatchObject({ endAt: T9 + H, endZone: 'Europe/Budapest' });
	});

	it('refuses an end before the start, both an end and a duration, and an unknown zone', () => {
		const { create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		expect(err(run((w) => updateEntry(w, { id: e.id, start: '2026-10-18T11:00Z' })))).toMatchObject(
			{ code: 'invalid', message: 'The end must be after the start.' }
		);
		expect(
			err(run((w) => updateEntry(w, { id: e.id, end: '2026-10-18T11:00Z', durationMinutes: 5 })))
		).toMatchObject({ code: 'invalid' });
		expect(err(run((w) => updateEntry(w, { id: e.id, timeZone: 'Nope' })))).toMatchObject({
			code: 'invalid',
			fields: { timeZone: 'Unknown time zone.' }
		});
	});

	it('reports a start moved to or past the end on the start field', () => {
		const { create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		const error = err(run((w) => updateEntry(w, { id: e.id, start: '2026-10-18T10:00Z' })));
		expect(error).toMatchObject({ code: 'invalid' });
		expect(error?.fields?.start).toBe('The end must be after the start.');
	});

	it('keeps the instants and relabels the zone when only a time zone changes', () => {
		const { create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		const a = val(run((w) => updateEntry(w, { id: e.id, timeZone: 'Europe/Budapest' })));
		expect(a).toMatchObject({
			startAt: e.startAt,
			endAt: e.endAt,
			startZone: 'Europe/Budapest',
			endZone: 'UTC'
		});
		const b = val(run((w) => updateEntry(w, { id: e.id, endTimeZone: 'Europe/London' })));
		expect(b).toMatchObject({
			startAt: e.startAt,
			endAt: e.endAt,
			startZone: 'Europe/Budapest',
			endZone: 'Europe/London'
		});
	});

	it('reads a new end in the edited time zone', () => {
		const { create, run, val } = setup();
		const e = val(
			create({
				start: '2026-10-18T09:00',
				timeZone: 'Europe/Budapest',
				end: '2026-10-18T17:00'
			})
		);
		const u = val(
			run((w) =>
				updateEntry(w, {
					id: e.id,
					timeZone: 'America/New_York',
					start: '2026-10-18T09:00',
					end: '2026-10-18T17:00'
				})
			)
		);
		expect((u.endAt ?? 0) - u.startAt).toBe(8 * H);
		expect(u).toMatchObject({ startZone: 'America/New_York', endZone: 'America/New_York' });
		const d = val(
			run((w) => updateEntry(w, { id: e.id, timeZone: 'Europe/London', durationMinutes: 30 }))
		);
		expect(d).toMatchObject({ startZone: 'Europe/London', endZone: 'Europe/London' });
		const k = val(
			run((w) =>
				updateEntry(w, {
					id: e.id,
					timeZone: 'UTC',
					endTimeZone: 'Asia/Tokyo',
					durationMinutes: 30
				})
			)
		);
		expect(k).toMatchObject({ startZone: 'UTC', endZone: 'Asia/Tokyo' });
	});

	it('refuses an end time zone on a running entry without a new end', () => {
		const { create, run } = setup();
		const e = create({ start: '2026-10-18T09:00' });
		if (!e.ok) throw new Error('create');
		const error = err(run((w) => updateEntry(w, { id: e.value.id, endTimeZone: 'UTC' })));
		expect(error).toMatchObject({
			code: 'invalid',
			fields: { endTimeZone: 'A running entry has no end time zone.' }
		});
	});

	it('refuses a stale expected version, an unknown id and another user', () => {
		const { create, run, val, other } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		val(run((w) => updateEntry(w, { id: e.id, description: 'a', expectedVersion: 1 })));
		expect(
			err(run((w) => updateEntry(w, { id: e.id, description: 'b', expectedVersion: 1 })))
		).toMatchObject({ code: 'conflict' });
		expect(err(run((w) => updateEntry(w, { id: 'nope', description: 'b' })))).toMatchObject({
			code: 'not_found'
		});
		expect(err(run((w) => updateEntry(w, { id: e.id, description: 'b' }), other))).toMatchObject({
			code: 'not_found'
		});
	});

	it("refuses moving to another user's project and clears an activity with null", () => {
		const { create, run, val, project, other } = setup();
		const theirs = project('Theirs', 'Them', other);
		const activity = val(run((w) => createActivity(w, { name: 'Dev' })));
		const e = val(
			create({ start: '2026-10-18T09:00Z', durationMinutes: 60, activityId: activity.id })
		);
		expect(err(run((w) => updateEntry(w, { id: e.id, projectId: theirs.id })))).toMatchObject({
			code: 'not_found'
		});
		const u = val(run((w) => updateEntry(w, { id: e.id, activityId: null })));
		expect(u.activityId).toBeNull();
	});
});

describe('deleteEntry', () => {
	it('records a delete and undoing it restores the entry', () => {
		const { db, create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		val(run((w) => deleteEntry(w, { id: e.id, expectedVersion: 1 })));
		expect(db.select().from(entryTable).all()).toEqual([]);
		const del = db.select().from(change).where(eq(change.op, 'delete')).all();
		expect(del).toHaveLength(1);
		expect(del[0]).toMatchObject({ entity: 'entry', entityId: e.id, after: null });
		val(run((w) => undo(w, { batchId: del[0].batchId })));
		const back = db.select().from(entryTable).where(eq(entryTable.id, e.id)).get();
		expect(back).toMatchObject({ startAt: e.startAt, endAt: e.endAt, projectId: e.projectId });
	});

	it('refuses a stale version and an unknown id', () => {
		const { create, run, val } = setup();
		const e = val(create({ start: '2026-10-18T09:00Z', durationMinutes: 60 }));
		expect(err(run((w) => deleteEntry(w, { id: e.id, expectedVersion: 2 })))).toMatchObject({
			code: 'conflict'
		});
		expect(err(run((w) => deleteEntry(w, { id: 'nope' })))).toMatchObject({ code: 'not_found' });
	});
});

describe('reading entries', () => {
	function seeded() {
		const s = setup();
		const { run, val, project, create } = s;
		const app = project('App', 'Beta');
		const activity = val(run((w) => createActivity(w, { name: 'Dev' })));
		const location = val(run((w) => createLocation(w, { name: 'Home' })));
		// Starts before the window and ends inside it.
		const early = val(
			create({
				start: '2026-10-17T23:00Z',
				end: '2026-10-18T01:00Z',
				activityId: activity.id,
				locationId: location.id
			})
		);
		// Ends exactly at the window start: half-open, so outside.
		const before = val(create({ start: '2026-10-17T20:00Z', end: '2026-10-18T00:00Z' }));
		const inside = val(
			run((w) =>
				createEntry(w, {
					projectId: app.id,
					timeZone: 'UTC',
					start: '2026-10-18T09:00Z',
					durationMinutes: 60
				})
			)
		);
		// Starts exactly at the window end: outside.
		const after = val(create({ start: '2026-10-19T00:00Z', durationMinutes: 60 }));
		const running = val(create({ start: '2026-10-17T22:00Z' }));
		return { ...s, app, activity, location, early, before, inside, after, running };
	}
	const ids = (r: Result<EntryItem[]>) => (r.ok ? r.value.map((e) => e.id) : r.error);
	const NOW = Date.UTC(2026, 9, 18, 12);
	const day = { from: '2026-10-18T00:00:00Z', to: '2026-10-19T00:00:00Z' };

	it('lists entries touching the range, newest start first, running ones reaching now', () => {
		const { db, userId, early, inside, running } = seeded();
		expect(ids(listEntries(db, userId, day, NOW))).toEqual([inside.id, early.id, running.id]);
	});

	it('leaves out a running entry when now is not after the range start', () => {
		const { db, userId, early, inside } = seeded();
		expect(ids(listEntries(db, userId, day, Date.UTC(2026, 9, 17, 23)))).toEqual([
			inside.id,
			early.id
		]);
	});

	it('lists everything without a range', () => {
		const { db, userId } = seeded();
		const r = listEntries(db, userId, {}, NOW);
		expect(r.ok && r.value).toHaveLength(5);
	});

	it('filters by project, customer and running', () => {
		const { db, userId, app, inside, running, p } = seeded();
		expect(ids(listEntries(db, userId, { ...day, projectId: app.id }, NOW))).toEqual([inside.id]);
		expect(ids(listEntries(db, userId, { customerId: app.customerId }, NOW))).toEqual([inside.id]);
		expect(ids(listEntries(db, userId, { running: true }, NOW))).toEqual([running.id]);
		const finished = listEntries(db, userId, { running: false, projectId: p.id }, NOW);
		expect(finished.ok && finished.value.every((e) => e.endAt !== null)).toBe(true);
	});

	it('carries the names of the project, customer, activity and location', () => {
		const { db, userId, early, activity, location, p } = seeded();
		const r = listEntries(db, userId, day, NOW);
		const item = r.ok && r.value.find((e) => e.id === early.id);
		expect(item).toMatchObject({
			projectName: 'Web',
			customerId: p.customerId,
			customerName: 'Acme',
			activityName: activity.name,
			locationName: location.name
		});
	});

	it('refuses a range bound without an offset', () => {
		const { db, userId } = seeded();
		expect(err(listEntries(db, userId, { from: '2026-10-18T00:00' }, NOW))).toMatchObject({
			code: 'invalid',
			fields: { from: expect.any(String) }
		});
		expect(err(listEntries(db, userId, { to: 'soon' }, NOW))).toMatchObject({
			code: 'invalid',
			fields: { to: expect.any(String) }
		});
	});

	it("never lists another user's entries", () => {
		const { db, other } = seeded();
		const r = listEntries(db, other, {}, NOW);
		expect(r.ok && r.value).toEqual([]);
	});

	it('gets one entry with names, and not another user', () => {
		const { db, userId, other, inside } = seeded();
		expect(getEntry(db, userId, { id: inside.id })).toMatchObject({
			ok: true,
			value: { id: inside.id, projectName: 'App', customerName: 'Beta', activityName: null }
		});
		expect(err(getEntry(db, other, { id: inside.id }))).toMatchObject({ code: 'not_found' });
		expect(err(getEntry(db, userId, {}))).toMatchObject({ code: 'invalid' });
	});
});

describe('list filters', () => {
	const NOW = Date.UTC(2026, 9, 18, 12);
	function seeded() {
		const s = setup();
		const { run, val, project, create } = s;
		const activity = val(run((w) => createActivity(w, { name: 'Dev' })));
		const location = val(run((w) => createLocation(w, { name: 'Home' })));
		const withBoth = val(
			create({
				start: '2026-10-18T08:00Z',
				durationMinutes: 60,
				activityId: activity.id,
				locationId: location.id
			})
		);
		const bare = val(create({ start: '2026-10-18T10:00Z', durationMinutes: 60 }));
		const mk = (input: Record<string, unknown>, projectId = s.p.id) =>
			val(
				run((w) => createEntry(w, { projectId, timeZone: 'UTC', durationMinutes: 30, ...input }))
			);
		return { ...s, activity, location, withBoth, bare, mk, project };
	}
	const ids = (r: Result<EntryItem[]>) => (r.ok ? r.value.map((e) => e.id) : r.error);

	it('filters by activity and location, null meaning none', () => {
		const { db, userId, activity, location, withBoth, bare } = seeded();
		expect(ids(listEntries(db, userId, { activityId: activity.id }, NOW))).toEqual([withBoth.id]);
		expect(ids(listEntries(db, userId, { activityId: null }, NOW))).toEqual([bare.id]);
		expect(ids(listEntries(db, userId, { locationId: location.id }, NOW))).toEqual([withBoth.id]);
		expect(ids(listEntries(db, userId, { locationId: null }, NOW))).toEqual([bare.id]);
	});

	it('finds text in description, project name and customer name, ignoring case', () => {
		const { db, userId, mk, project } = seeded();
		const desc = mk({ start: '2026-10-18T11:00Z', description: 'Called ÜGYFÉL' });
		const pc = project('CompB – ProjC', 'Zed');
		const onProject = mk({ start: '2026-10-18T12:00Z' }, pc.id);
		const ac = project('Other', 'Acme Corp');
		const onCustomer = mk({ start: '2026-10-18T13:00Z' }, ac.id);
		const ref = mk({ start: '2026-10-18T14:00Z', reference: 'INV-77' });
		expect(ids(listEntries(db, userId, { text: 'ügyfél' }, NOW))).toEqual([desc.id]);
		expect(ids(listEntries(db, userId, { text: 'compb' }, NOW))).toEqual([onProject.id]);
		expect(ids(listEntries(db, userId, { text: 'acme corp' }, NOW))).toEqual([onCustomer.id]);
		expect(ids(listEntries(db, userId, { text: 'inv-7' }, NOW))).toEqual([ref.id]);
		expect(ids(listEntries(db, userId, { text: '  ügyfél ' }, NOW))).toEqual([desc.id]);
	});

	it('matches text literally, without LIKE wildcards', () => {
		const { db, userId, mk } = seeded();
		mk({ start: '2026-10-18T11:00Z', description: '500 units' });
		mk({ start: '2026-10-18T12:00Z', description: 'axb' });
		const pct = mk({ start: '2026-10-18T13:00Z', description: 'raised 50% fee' });
		const under = mk({ start: '2026-10-18T14:00Z', description: 'a_b' });
		expect(ids(listEntries(db, userId, { text: '50%' }, NOW))).toEqual([pct.id]);
		expect(ids(listEntries(db, userId, { text: 'a_b' }, NOW))).toEqual([under.id]);
	});

	it('refuses bad text, limit and order', () => {
		const { db, userId } = seeded();
		for (const input of [
			{ text: '' },
			{ text: 'x'.repeat(201) },
			{ limit: 0 },
			{ limit: 1001 },
			{ limit: 1.5 },
			{ order: 'up' }
		]) {
			expect(err(listEntries(db, userId, input, NOW))).toMatchObject({ code: 'invalid' });
		}
	});

	it('startedIn leaves out an entry that began before the range', () => {
		const { db, userId, mk } = seeded();
		const early = mk({ start: '2026-10-17T23:00Z', durationMinutes: 120 });
		const range = { from: '2026-10-18T00:00:00Z', to: '2026-10-19T00:00:00Z' };
		expect(ids(listEntries(db, userId, range, NOW))).toContain(early.id);
		const r = listEntries(db, userId, { ...range, startedIn: true }, NOW);
		expect(ids(r)).not.toContain(early.id);
		expect(r.ok && r.value).toHaveLength(2);
		const upTo = listEntries(db, userId, { to: '2026-10-18T09:00:00Z', startedIn: true }, NOW);
		expect(upTo.ok && upTo.value.map((e) => e.startAt < Date.UTC(2026, 9, 18, 9))).not.toContain(
			false
		);
	});

	it('orders ascending and limits after the order and text filter', () => {
		const { db, userId, withBoth, bare, mk } = seeded();
		const last = mk({ start: '2026-10-18T11:00Z' });
		expect(ids(listEntries(db, userId, { order: 'asc' }, NOW))).toEqual([
			withBoth.id,
			bare.id,
			last.id
		]);
		expect(ids(listEntries(db, userId, { order: 'asc', limit: 2 }, NOW))).toEqual([
			withBoth.id,
			bare.id
		]);
		expect(ids(listEntries(db, userId, { limit: 1 }, NOW))).toEqual([last.id]);
		expect(ids(listEntries(db, userId, { text: 'web', order: 'asc', limit: 1 }, NOW))).toEqual([
			withBoth.id
		]);
	});
});
