import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { batch, entry as entryTable, user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import { createEntry, startTimer } from './entries';
import {
	archive,
	createActivity,
	createCustomer,
	createLocation,
	createProject
} from './reference';
import { ok, type Result } from './result';
import { createTemplate, entryFromTemplate, templateFromEntry } from './templates';
import { undo } from './undo';

const MIN = 60_000;
const H = 60 * MIN;
const ZONE = 'Europe/Budapest';
/** 2026-10-18T09:00:00Z, 11:00 in Budapest (UTC+2). */
const T9 = Date.UTC(2026, 9, 18, 9);

function setup() {
	const db = createTestDb();
	const userId = newId();
	db.insert(user)
		.values({ id: userId, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	let clock = T9;
	/** Runs a batch at `now` (default: one millisecond after the last). */
	const run = <T>(fn: Parameters<typeof runBatch<T>>[4], now = clock + 1): Result<T> => {
		clock = Math.max(clock + 1, now);
		return runBatch(db, userId, 'ui', 'test', fn, now);
	};
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const refs = val(
		run(
			(w) => {
				const c = val(createCustomer(w, { name: 'Acme' }));
				const p = val(createProject(w, { customerId: c.id, name: 'Web' }));
				const p2 = val(createProject(w, { customerId: c.id, name: 'App' }));
				const other = val(createCustomer(w, { name: 'Other' }));
				const q = val(createProject(w, { customerId: other.id, name: 'Shop' }));
				const a = val(createActivity(w, { name: 'Dev' }));
				const l = val(createLocation(w, { name: 'Home' }));
				return ok({ c, p, p2, other, q, a, l });
			},
			T9 - 10 * 24 * H
		)
	);
	const template = (input: Record<string, unknown>) =>
		val(run((w) => createTemplate(w, { name: newId(), ...input }), T9 - 10 * 24 * H + 1));
	const use = (input: Record<string, unknown>, now?: number) =>
		run((w) => entryFromTemplate(w, input), now);
	const entries = () => db.select().from(entryTable).all();
	return { db, userId, run, val, refs, template, use, entries };
}

const err = <T>(r: Result<T>) => (r.ok ? null : r.error);
const lastBatch = (db: ReturnType<typeof createTestDb>) =>
	db.select().from(batch).orderBy(batch.createdAt).all().at(-1)!.id;

describe('entryFromTemplate', () => {
	it('fills a full template with only a description and a date', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			customerId: refs.c.id,
			projectId: refs.p.id,
			activityId: refs.a.id,
			locationId: refs.l.id,
			startTime: '09:30',
			endTime: '10:00',
			timeZone: ZONE,
			reference: 'R1',
			description: 'daily'
		});
		const e = val(use({ templateId: t.id, description: 'fixed the build', date: '2026-10-15' }));
		expect(e).toMatchObject({
			projectId: refs.p.id,
			activityId: refs.a.id,
			locationId: refs.l.id,
			startAt: Date.UTC(2026, 9, 15, 7, 30),
			startZone: ZONE,
			endAt: Date.UTC(2026, 9, 15, 8),
			endZone: ZONE,
			reference: 'R1',
			description: 'fixed the build'
		});
	});

	it('defaults the date to today in the zone, not in UTC', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '00:30',
			endTime: '01:00',
			timeZone: ZONE
		});
		// 23:30Z on the 18th is 01:30 on the 19th in Budapest.
		const e = val(use({ templateId: t.id }, Date.UTC(2026, 9, 18, 23, 30)));
		expect(e.startAt).toBe(Date.UTC(2026, 9, 18, 22, 30));
		expect(e.endAt).toBe(Date.UTC(2026, 9, 18, 23));
	});

	it('ends a duration-only template now (Review Focus 1)', () => {
		const { val, refs, template, use } = setup();
		const t = template({ projectId: refs.p.id, durationMinutes: 120, timeZone: ZONE });
		const now = Date.UTC(2026, 9, 18, 15); // 17:00 in Budapest
		const e = val(use({ templateId: t.id }, now));
		expect(e).toMatchObject({ startAt: now - 2 * H, endAt: now, startZone: ZONE, endZone: ZONE });
	});

	it('ends a night shift on the next day (Review Focus 2)', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '22:00',
			endTime: '06:00',
			timeZone: ZONE
		});
		const e = val(use({ templateId: t.id, date: '2026-10-15' }));
		expect(e.startAt).toBe(Date.UTC(2026, 9, 15, 20));
		expect(e.endAt).toBe(Date.UTC(2026, 9, 16, 4));
	});

	it('adds a calendar day, not 24 hours, across a daylight-saving change', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '22:00',
			endTime: '06:00',
			timeZone: ZONE
		});
		// Budapest falls back from +02:00 to +01:00 on 2026-10-25.
		const e = val(use({ templateId: t.id, date: '2026-10-24' }, Date.UTC(2026, 9, 26)));
		expect(e.startAt).toBe(Date.UTC(2026, 9, 24, 20));
		expect(e.endAt).toBe(Date.UTC(2026, 9, 25, 5));
	});

	it('refuses an end time in a daylight-saving gap rather than rolling to the next day', () => {
		const { refs, template, use, entries } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '01:00',
			endTime: '02:30',
			timeZone: ZONE
		});
		// 02:30 does not exist on 2026-03-29 in Budapest; never a 24.5-hour entry.
		const e = err(use({ templateId: t.id, date: '2026-03-29' }, Date.UTC(2026, 2, 31)));
		expect(e).toEqual({
			code: 'invalid',
			message: 'That time does not exist in Europe/Budapest.',
			fields: { end: 'That time does not exist in Europe/Budapest.' }
		});
		expect(entries()).toHaveLength(0);
	});

	it("logs last night's shift from an overnight template tapped before tonight's start", () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '22:00',
			endTime: '06:00',
			timeZone: ZONE
		});
		// 06:30 on the 18th in Budapest.
		const e = val(use({ templateId: t.id }, Date.UTC(2026, 9, 18, 4, 30)));
		expect(e.startAt).toBe(Date.UTC(2026, 9, 17, 20));
		expect(e.endAt).toBe(Date.UTC(2026, 9, 18, 4));
	});

	it("uses today for an overnight template once tonight's start has passed", () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '22:00',
			endTime: '06:00',
			timeZone: ZONE
		});
		// 23:00 on the 18th in Budapest: tonight's shift started at 22:00, so today's date.
		// A given duration keeps the end out of the future.
		const r = use({ templateId: t.id, durationMinutes: 30 }, Date.UTC(2026, 9, 18, 21));
		expect(val(r).startAt).toBe(Date.UTC(2026, 9, 18, 20));
	});

	it('keeps today for a same-day template tapped before its start', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '18:00',
			endTime: '19:00',
			timeZone: ZONE
		});
		// 11:00 in Budapest: still today's 18:00, not yesterday's.
		const e = val(use({ templateId: t.id }, T9));
		expect(e.startAt).toBe(Date.UTC(2026, 9, 18, 16));
	});

	it('refuses a start in a daylight-saving gap (Review Focus 3)', () => {
		const { refs, template, use, entries } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '02:30',
			endTime: '03:30',
			timeZone: ZONE
		});
		const e = err(use({ templateId: t.id, date: '2026-03-29' }));
		expect(e).toMatchObject({ code: 'invalid', fields: { start: expect.any(String) } });
		expect(entries()).toHaveLength(0);
	});

	it('starts a running timer now when no end is known, stopping the project timer', () => {
		const { val, run, refs, template, use, entries } = setup();
		const first = val(run((w) => startTimer(w, { projectId: refs.p.id, timeZone: ZONE }), T9 - H));
		const t = template({ projectId: refs.p.id, timeZone: ZONE, description: 'support' });
		const e = val(use({ templateId: t.id }, T9));
		expect(e).toMatchObject({ startAt: T9, endAt: null, description: 'support' });
		const stopped = entries().find((x) => x.id === first.id)!;
		expect(stopped.endAt).toBe(T9);
	});

	it('refuses a start-only template tapped before its time', () => {
		const { refs, template, use, entries } = setup();
		const t = template({ projectId: refs.p.id, startTime: '18:00', timeZone: ZONE });
		const e = err(use({ templateId: t.id }, T9)); // 11:00 in Budapest
		expect(e).toMatchObject({ code: 'invalid', fields: { start: expect.any(String) } });
		expect(entries()).toHaveLength(0);
	});

	it('starts a start-only template as a timer once its time has passed', () => {
		const { val, refs, template, use } = setup();
		const t = template({ projectId: refs.p.id, startTime: '10:00', timeZone: ZONE });
		const e = val(use({ templateId: t.id }, T9));
		expect(e).toMatchObject({ startAt: Date.UTC(2026, 9, 18, 8), endAt: null });
	});

	it('needs a project for a customer-only template', () => {
		const { val, refs, template, use } = setup();
		const t = template({ customerId: refs.c.id, durationMinutes: 30, timeZone: ZONE });
		expect(err(use({ templateId: t.id }))).toEqual({
			code: 'invalid',
			message: 'Pick a project.',
			fields: { projectId: 'Pick a project.' }
		});
		expect(val(use({ templateId: t.id, projectId: refs.p2.id })).projectId).toBe(refs.p2.id);
	});

	it("refuses a given project of another customer than the template's", () => {
		const { refs, template, use, entries } = setup();
		const t = template({ customerId: refs.c.id, projectId: refs.p.id, timeZone: ZONE });
		const e = err(use({ templateId: t.id, projectId: refs.q.id }));
		expect(e).toMatchObject({ code: 'invalid', fields: { projectId: expect.any(String) } });
		expect(entries()).toHaveLength(0);
	});

	it('needs a time zone when neither is given', () => {
		const { val, refs, template, use } = setup();
		const t = template({ projectId: refs.p.id, startTime: '09:00', endTime: '10:00' });
		expect(err(use({ templateId: t.id }))).toEqual({
			code: 'invalid',
			message: 'Pick a time zone.',
			fields: { timeZone: 'Pick a time zone.' }
		});
		const e = val(use({ templateId: t.id, timeZone: 'UTC', date: '2026-10-15' }));
		expect(e).toMatchObject({ startAt: Date.UTC(2026, 9, 15, 9), startZone: 'UTC' });
	});

	it('lets the given zone win over the template zone', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '09:00',
			endTime: '10:00',
			timeZone: ZONE
		});
		const e = val(use({ templateId: t.id, timeZone: 'UTC', date: '2026-10-15' }));
		expect(e).toMatchObject({
			startAt: Date.UTC(2026, 9, 15, 9),
			startZone: 'UTC',
			endZone: 'UTC'
		});
	});

	it('replaces the description and reference rather than appending, and keeps explicit nulls', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			activityId: refs.a.id,
			durationMinutes: 30,
			timeZone: ZONE,
			reference: 'R1',
			description: 'daily'
		});
		const e = val(use({ templateId: t.id, description: 'new', reference: null, activityId: null }));
		expect(e).toMatchObject({ description: 'new', reference: null, activityId: null });
	});

	it('lets given times win over the template times', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			startTime: '09:00',
			endTime: '10:00',
			timeZone: ZONE
		});
		const e = val(use({ templateId: t.id, start: '2026-10-15T13:00', durationMinutes: 45 }));
		expect(e).toMatchObject({
			startAt: Date.UTC(2026, 9, 15, 11),
			endAt: Date.UTC(2026, 9, 15, 11, 45)
		});
		const f = val(use({ templateId: t.id, start: '2026-10-14T13:00' }));
		// The template end time on the given start's local date, next day when not after it.
		expect(f.endAt).toBe(Date.UTC(2026, 9, 15, 8));
	});

	it('refuses a given end with no start and no duration anywhere', () => {
		const { refs, template, use } = setup();
		const t = template({ projectId: refs.p.id, timeZone: ZONE });
		expect(err(use({ templateId: t.id, end: '2026-10-18T10:00' }))).toEqual({
			code: 'invalid',
			message: 'An end needs a start.',
			fields: { start: 'An end needs a start.' }
		});
	});

	it('starts a given end a known duration before it', () => {
		const { val, refs, template, use } = setup();
		const t = template({ projectId: refs.p.id, durationMinutes: 90, timeZone: ZONE });
		const e = val(use({ templateId: t.id, end: '2026-10-18T10:00' }));
		expect(e).toMatchObject({
			startAt: Date.UTC(2026, 9, 18, 6, 30),
			endAt: Date.UTC(2026, 9, 18, 8)
		});
		const f = val(
			use({ templateId: t.id, end: '2026-10-17T10:00', endTimeZone: 'UTC', durationMinutes: 15 })
		);
		expect(f).toMatchObject({
			startAt: Date.UTC(2026, 9, 17, 9, 45),
			endAt: Date.UTC(2026, 9, 17, 10),
			startZone: ZONE,
			endZone: 'UTC'
		});
	});

	it('refuses a date when the template has no start time', () => {
		const { refs, template, use, entries } = setup();
		const t = template({ projectId: refs.p.id, durationMinutes: 30, timeZone: ZONE });
		expect(err(use({ templateId: t.id, date: '2026-10-15' }))).toEqual({
			code: 'invalid',
			message: 'A date needs a start time on the template.',
			fields: { date: 'A date needs a start time on the template.' }
		});
		expect(entries()).toHaveLength(0);
	});

	it('keeps the template text when the given text is blank', () => {
		const { val, refs, template, use } = setup();
		const t = template({
			projectId: refs.p.id,
			durationMinutes: 30,
			timeZone: ZONE,
			reference: 'R1',
			description: 'daily'
		});
		const e = val(use({ templateId: t.id, reference: '  ', description: '' }));
		expect(e).toMatchObject({ reference: 'R1', description: 'daily' });
	});

	it('still works when the project was archived since (Review Focus 5)', () => {
		const { val, run, refs, template, use } = setup();
		const t = template({ projectId: refs.p.id, durationMinutes: 30, timeZone: ZONE });
		val(run((w) => archive(w, 'project', { id: refs.p.id })));
		expect(val(use({ templateId: t.id })).projectId).toBe(refs.p.id);
	});

	it("refuses another user's or a missing template", () => {
		const { use } = setup();
		expect(err(use({ templateId: 'nope', timeZone: ZONE }))?.code).toBe('not_found');
	});

	it('undo of the batch removes the entry', () => {
		const { db, val, run, refs, template, use, entries } = setup();
		const t = template({ projectId: refs.p.id, durationMinutes: 30, timeZone: ZONE });
		val(use({ templateId: t.id }));
		expect(entries()).toHaveLength(1);
		const used = lastBatch(db);
		val(run((w) => undo(w, { batchId: used })));
		expect(entries()).toHaveLength(0);
	});
});

describe('templateFromEntry', () => {
	it('keeps the start and end times of a same-day entry', () => {
		const { val, run, refs } = setup();
		const e = val(
			run((w) =>
				createEntry(w, {
					projectId: refs.p.id,
					activityId: refs.a.id,
					locationId: refs.l.id,
					start: '2026-10-15T09:30',
					end: '2026-10-15T10:15',
					timeZone: ZONE,
					reference: 'R1',
					description: 'daily'
				})
			)
		);
		const t = val(run((w) => templateFromEntry(w, { entryId: e.id, name: 'Standup' })));
		expect(t).toMatchObject({
			name: 'Standup',
			customerId: refs.c.id,
			projectId: refs.p.id,
			activityId: refs.a.id,
			locationId: refs.l.id,
			startTime: '09:30',
			endTime: '10:15',
			durationMinutes: null,
			timeZone: ZONE,
			reference: 'R1',
			description: 'daily'
		});
	});

	it('keeps a duration for an entry of a day or more', () => {
		const { val, run, refs } = setup();
		const make = (start: string, end: string) =>
			val(run((w) => createEntry(w, { projectId: refs.p.id, start, end, timeZone: ZONE })));
		const long = make('2026-10-15T22:00', '2026-10-17T06:30');
		const t = val(run((w) => templateFromEntry(w, { entryId: long.id, name: 'Long' })));
		expect(t).toMatchObject({ startTime: '22:00', endTime: null, durationMinutes: 1950 });
		const day = make('2026-10-15T10:00', '2026-10-16T11:00');
		const u = val(run((w) => templateFromEntry(w, { entryId: day.id, name: 'Day' })));
		expect(u).toMatchObject({ startTime: '10:00', endTime: null, durationMinutes: 1500 });
	});

	it('keeps the times of an overnight entry, which then lands on another date', () => {
		const { val, run, refs, use } = setup();
		const e = val(
			run((w) =>
				createEntry(w, {
					projectId: refs.p.id,
					start: '2026-10-15T22:00',
					end: '2026-10-16T06:00',
					timeZone: ZONE
				})
			)
		);
		const t = val(run((w) => templateFromEntry(w, { entryId: e.id, name: 'Shift' })));
		expect(t).toMatchObject({ startTime: '22:00', endTime: '06:00', durationMinutes: null });
		const f = val(use({ templateId: t.id, date: '2026-10-10' }));
		expect(f.startAt).toBe(Date.UTC(2026, 9, 10, 20));
		expect(f.endAt).toBe(Date.UTC(2026, 9, 11, 4));
	});

	it('keeps only the start of a running entry', () => {
		const { val, run, refs } = setup();
		const e = val(
			run((w) => startTimer(w, { projectId: refs.p.id, timeZone: ZONE, start: '2026-10-18T10:05' }))
		);
		const t = val(run((w) => templateFromEntry(w, { entryId: e.id, name: 'Run' })));
		expect(t).toMatchObject({ startTime: '10:05', endTime: null, durationMinutes: null });
	});

	it('refuses a missing entry and a taken name', () => {
		const { val, run, refs } = setup();
		expect(err(run((w) => templateFromEntry(w, { entryId: 'nope', name: 'X' })))?.code).toBe(
			'not_found'
		);
		const e = val(
			run((w) =>
				createEntry(w, {
					projectId: refs.p.id,
					start: '2026-10-15T09:00',
					durationMinutes: 5,
					timeZone: ZONE
				})
			)
		);
		val(run((w) => templateFromEntry(w, { entryId: e.id, name: 'X' })));
		expect(err(run((w) => templateFromEntry(w, { entryId: e.id, name: 'x' })))?.code).toBe(
			'conflict'
		);
	});
});
