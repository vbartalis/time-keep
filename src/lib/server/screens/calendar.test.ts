import { describe, expect, it } from 'vitest';
import { colourOf } from '#lib/project-colour.js';
import { newId } from '../id';
import { user } from '../db/schema';
import { createTestDb } from '../testing/db';
import { openCore, type Result } from '../core/index';
import { calendarFor, moveInput } from './calendar';
import { rows } from './actions';

const zone = 'Europe/Budapest';
const NOW = Date.parse('2026-10-20T10:00:00Z');
const MIN = 60_000;

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r.error)}`);
	return r.value;
};

function setup() {
	const db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const core = openCore(db, id, 'ui', () => NOW);
	const customer = val(core.customers.create({ name: 'Acme' }));
	const project = val(core.projects.create({ customerId: customer.id, name: 'Web' }));
	const log = (start: string, end?: string) =>
		val(
			core.entries.create({
				projectId: project.id,
				timeZone: zone,
				start,
				...(end ? { end } : {})
			})
		);
	return { core, project, log };
}

const none = { customer: '', project: '', activity: '', location: '' };

const week = (core: ReturnType<typeof setup>['core'], date = '2026-10-14') =>
	calendarFor(core, { view: 'week', date, zone, now: NOW, scope: none });

describe('calendarFor', () => {
	it('marks both entries of an overlap', () => {
		const { core, log } = setup();
		const a = log('2026-10-14T09:00', '2026-10-14T11:00');
		const b = log('2026-10-14T10:00', '2026-10-14T12:00');
		const c = log('2026-10-14T13:00', '2026-10-14T14:00');
		const byId = Object.fromEntries(week(core).entries.map((e) => [e.id, e.overlaps]));
		expect(byId).toEqual({ [a.id]: true, [b.id]: true, [c.id]: false });
	});

	it('brings a midnight crossing into the week of the next day, counted on its start day', () => {
		const { core, log } = setup();
		log('2026-10-13T23:00', '2026-10-14T01:00');
		const r = calendarFor(core, { view: 'week', date: '2026-10-14', zone, now: NOW, scope: none });
		expect(r.entries).toHaveLength(1);
		expect(r.totals['2026-10-13']).toBe(120 * MIN);
		expect(r.entries[0]).toMatchObject({
			date: '2026-10-13',
			startTime: '23:00',
			endTime: '01:00'
		});
		const day = calendarFor(core, { view: 'day', date: '2026-10-14', zone, now: NOW, scope: none });
		expect(day.entries).toHaveLength(1);
	});

	it("leaves the leading September days out of a month's total", () => {
		const { core, log } = setup();
		log('2026-09-30T09:00', '2026-09-30T10:00');
		log('2026-10-02T09:00', '2026-10-02T11:00');
		const r = calendarFor(core, { view: 'month', date: '2026-10-15', zone, now: NOW, scope: none });
		expect(r.days[0]).toBe('2026-09-28');
		expect(r.totals['2026-09-30']).toBe(60 * MIN);
		expect(r.periodTotal).toBe(120 * MIN);
		expect(r.weekTotal).toBe(0);
	});

	it('totals the week for a day view, and the week holding the date', () => {
		const { core, log } = setup();
		log('2026-10-12T09:00', '2026-10-12T10:00');
		log('2026-10-14T09:00', '2026-10-14T11:00');
		const r = calendarFor(core, { view: 'day', date: '2026-10-14', zone, now: NOW, scope: none });
		expect(r.periodTotal).toBe(120 * MIN);
		expect(r.weekTotal).toBe(180 * MIN);
		expect(r.entries).toHaveLength(1);
	});

	it('runs a timer to now, from an earlier start', () => {
		const { core, log } = setup();
		log('2026-10-20T10:00'); // 08:00 UTC, two hours before NOW
		const r = calendarFor(core, { view: 'day', date: '2026-10-20', zone, now: NOW, scope: none });
		expect(r.entries[0]).toMatchObject({ running: true, endTime: null, endAt: null });
		expect(r.totals['2026-10-20']).toBe(120 * MIN);
		const next = calendarFor(core, {
			view: 'week',
			date: '2026-10-20',
			zone,
			now: NOW,
			scope: none
		});
		expect(next.entries).toHaveLength(1);
		expect(next.now).toBe(NOW);
	});

	it("totals a running timer's seconds too, exact, as Entries' total does", () => {
		const { core, log } = setup();
		log('2026-10-20T09:00', '2026-10-20T09:30');
		log('2026-10-20T10:00'); // 08:00 UTC
		const now = NOW + 31_000;
		const r = calendarFor(core, { view: 'week', date: '2026-10-20', zone, now, scope: none });
		expect(r.totals['2026-10-20']).toBe(150 * MIN + 31_000);
		expect(r.periodTotal).toBe(150 * MIN + 31_000);
		expect(r.weekTotal).toBe(150 * MIN + 31_000);
	});

	it('colours by colourOf and names the entry', () => {
		const { core, project, log } = setup();
		log('2026-10-14T09:00', '2026-10-14T10:00');
		const colours = colourOf(rows(core.projects.list({ includeArchived: true })));
		const [e] = week(core).entries;
		expect(e.colour).toBe(colours.get(project.id));
		expect(e).toMatchObject({ projectName: 'Web', customerName: 'Acme', running: false });
	});

	it("shows an end time in the screen's zone, whatever the entry's end zone", () => {
		const { core, project } = setup();
		val(
			core.entries.create({
				projectId: project.id,
				timeZone: zone,
				start: '2026-10-14T09:00',
				end: '2026-10-14T10:00',
				endTimeZone: 'America/New_York'
			})
		);
		const [e] = week(core).entries;
		expect(e).toMatchObject({ startTime: '09:00', endTime: '16:00' });
	});

	it("counts a timer from the previous day on that day, not the day's", () => {
		const { core, log } = setup();
		log('2026-10-19T22:00');
		const r = calendarFor(core, { view: 'day', date: '2026-10-20', zone, now: NOW, scope: none });
		expect(r.entries).toHaveLength(1);
		expect(r.entries[0]).toMatchObject({ running: true, date: '2026-10-19', endTime: null });
		expect(r.totals['2026-10-20']).toBeUndefined();
		expect(r.periodTotal).toBe(0);
		expect(r.weekTotal).toBe(840 * MIN);
	});
});

describe('moveInput', () => {
	const form = (fields: Record<string, string>) => {
		const f = new FormData();
		for (const [k, v] of Object.entries(fields)) f.set(k, v);
		return f;
	};
	const full = {
		id: 'e1',
		version: '3',
		start: '2026-10-16T12:15:00.000Z',
		end: '2026-10-16T13:45:00.000Z',
		back: '/calendar'
	};

	it('reads the id, the version and the two instants', () => {
		expect(moveInput(form(full))).toEqual({
			ok: true,
			input: {
				id: 'e1',
				expectedVersion: 3,
				start: '2026-10-16T12:15:00.000Z',
				end: '2026-10-16T13:45:00.000Z'
			}
		});
	});

	it('refuses a missing id, a version that is no number, and a missing time', () => {
		expect(moveInput(form({ ...full, id: '' }))).toEqual({ ok: false });
		expect(moveInput(form({ ...full, version: 'x' }))).toEqual({ ok: false });
		expect(moveInput(form({ ...full, version: '' }))).toEqual({ ok: false });
		expect(moveInput(form({ ...full, start: '' }))).toEqual({ ok: false });
		const noEnd = form(full);
		noEnd.delete('end');
		expect(moveInput(noEnd)).toEqual({ ok: false });
	});

	it('is an update the core takes, keeping the zones', () => {
		const { core, log } = setup();
		const e = log('2026-10-13T13:30', '2026-10-13T15:00');
		const read = moveInput(
			form({
				...full,
				id: e.id,
				version: String(e.version),
				start: '2026-10-16T12:15:00.000Z',
				end: '2026-10-16T13:45:00.000Z'
			})
		);
		if (!read.ok) throw new Error('unread');
		const moved = val(core.entries.update(read.input));
		expect(moved).toMatchObject({ startZone: zone, endZone: zone });
		const [shown] = week(core, '2026-10-16').entries;
		expect(shown).toMatchObject({ date: '2026-10-16', startTime: '14:15', endTime: '15:45' });
	});
});

describe('calendarFor with a scope', () => {
	function two() {
		const { core, project, log } = setup();
		const customer = val(core.customers.create({ name: 'Beta' }));
		const other = val(core.projects.create({ customerId: customer.id, name: 'Site' }));
		const logOther = (start: string, end: string) =>
			val(core.entries.create({ projectId: other.id, timeZone: zone, start, end }));
		return { core, project, other, log, logOther };
	}

	it('lists only the matching entries and counts only them', () => {
		const { core, project, log, logOther } = two();
		const mine = log('2026-10-13T09:00', '2026-10-13T10:00');
		logOther('2026-10-14T09:00', '2026-10-14T12:00');
		const r = calendarFor(core, {
			view: 'week',
			date: '2026-10-14',
			zone,
			now: NOW,
			scope: { ...none, project: project.id }
		});
		expect(r.entries.map((e) => e.id)).toEqual([mine.id]);
		expect(r.totals).toEqual({ '2026-10-13': 60 * MIN });
		expect(r.periodTotal).toBe(60 * MIN);
		expect(r.weekTotal).toBe(60 * MIN);
		expect(r.filtered).toBe(true);
		expect(r.scopeQuery).toBe(`project=${project.id}`);
	});

	it('counts the month and the week from the matching ones only', () => {
		const { core, other, log, logOther } = two();
		log('2026-10-02T09:00', '2026-10-02T10:00');
		logOther('2026-10-14T09:00', '2026-10-14T11:00');
		const r = calendarFor(core, {
			view: 'month',
			date: '2026-10-14',
			zone,
			now: NOW,
			scope: { ...none, project: other.id }
		});
		expect(r.periodTotal).toBe(120 * MIN);
		expect(r.weekTotal).toBe(120 * MIN);
	});

	it('keeps overlaps from a partner the filter hides (call 38)', () => {
		const { core, project, log, logOther } = two();
		const shown = log('2026-10-14T09:00', '2026-10-14T11:00');
		logOther('2026-10-14T10:00', '2026-10-14T12:00');
		const r = calendarFor(core, {
			view: 'week',
			date: '2026-10-14',
			zone,
			now: NOW,
			scope: { ...none, project: project.id }
		});
		expect(r.entries).toHaveLength(1);
		expect(r.entries[0]).toMatchObject({ id: shown.id, overlaps: true });
	});

	it('is not filtered with no scope', () => {
		const { core } = two();
		const r = week(core);
		expect(r.filtered).toBe(false);
		expect(r.scopeQuery).toBe('');
	});
});
