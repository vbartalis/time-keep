import { describe, expect, it } from 'vitest';
import type { Filter } from '#lib/filter/filter.js';
import { openCore, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { filterOptions, listInput, timesheetFor } from './timesheet';

const ZONE = 'Europe/Budapest';
const NOW = Date.parse('2026-10-20T10:00:00Z');
const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(r.error.message);
	return r.value;
};
const filter = (over: Partial<Filter> = {}): Filter => ({
	customer: '',
	project: '',
	activity: 'any',
	location: 'any',
	range: 'custom',
	from: '2026-10-01',
	to: '2026-10-31',
	q: '',
	...over
});
const setup = () => {
	const db = createTestDb();
	const uid = newId();
	db.insert(user)
		.values({ id: uid, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const core = openCore(db, uid, 'ui', () => NOW);
	const customer = val(core.customers.create({ name: 'C' }));
	const p1 = val(core.projects.create({ customerId: customer.id, name: 'P1' }));
	const p2 = val(core.projects.create({ customerId: customer.id, name: 'P2' }));
	const make = (project: { id: string }, start: string, end?: string, timeZone = ZONE) =>
		val(core.entries.create({ projectId: project.id, start, end, timeZone }));
	return { core, customer, p1, p2, make };
};

describe('listInput', () => {
	it('asks for the range as instants in the zone, newest first', () => {
		expect(listInput(filter({ activity: 'none', q: 'x', project: 'p' }), ZONE)).toEqual({
			from: '2026-09-30T22:00:00.000Z',
			to: '2026-10-31T23:00:00.000Z',
			startedIn: true,
			order: 'desc',
			limit: 501,
			projectId: 'p',
			activityId: null,
			text: 'x'
		});
	});

	it('leaves open sides and unset scope out', () => {
		expect(listInput(filter({ from: '', to: '' }), ZONE)).toEqual({
			startedIn: true,
			order: 'desc',
			limit: 501
		});
	});
});

describe('timesheetFor', () => {
	it('groups newest day and newest start first, with labels and totals', () => {
		const { core, p1, make } = setup();
		make(p1, '2026-10-05T09:00', '2026-10-05T10:00');
		make(p1, '2026-10-05T13:00', '2026-10-05T13:30');
		make(p1, '2026-10-06T09:00', '2026-10-06T09:15');
		const sheet = timesheetFor(core, filter(), ZONE, NOW);
		expect(sheet.days.map((d) => d.date)).toEqual(['2026-10-06', '2026-10-05']);
		expect(sheet.days[0].label).toBe('Tue 2026-10-06');
		expect(sheet.days[1].rows.map((r) => r.start)).toEqual(['13:00', '09:00']);
		expect(sheet.days[1].totalMs).toBe(90 * 60_000);
		expect(sheet.count).toBe(3);
		expect(sheet.totalMs).toBe(105 * 60_000);
		expect(sheet.truncated).toBe(false);
		expect(sheet.days[1].rows[1]).toMatchObject({
			customer: 'C',
			project: 'P1',
			colour: 1,
			plusDays: 0,
			running: false,
			overlaps: false
		});
	});

	it("gives the core's refusal of the list, not an empty sheet", () => {
		const { core, p1, make } = setup();
		make(p1, '2026-10-05T09:00', '2026-10-05T10:00');
		const sheet = timesheetFor(core, filter({ q: 'x'.repeat(201) }), ZONE, NOW);
		expect(sheet.error).toBe('Use 1–200 characters.');
		expect(sheet.count).toBe(0);
		expect(timesheetFor(core, filter(), ZONE, NOW).error).toBeNull();
	});

	it('counts a midnight crosser whole in its start day with plusDays', () => {
		const { core, p1, make } = setup();
		make(p1, '2026-10-05T22:00', '2026-10-06T01:30');
		const sheet = timesheetFor(core, filter(), ZONE, NOW);
		expect(sheet.days).toHaveLength(1);
		expect(sheet.days[0].totalMs).toBe(210 * 60_000);
		expect(sheet.days[0].rows[0]).toMatchObject({ start: '22:00', end: '01:30', plusDays: 1 });
	});

	it('counts a running entry to now', () => {
		const { core, p1, make } = setup();
		make(p1, '2026-10-20T11:00'); // 09:00Z, an hour before now
		const sheet = timesheetFor(core, filter(), ZONE, NOW);
		expect(sheet.days[0].rows[0]).toMatchObject({ end: null, running: true, endAt: null });
		expect(sheet.totalMs).toBe(3_600_000);
	});

	it('shows an entry in its own zone and day (call 26)', () => {
		const { core, p1, make } = setup();
		make(p1, '2026-10-05T23:30', '2026-10-06T00:30', 'America/New_York'); // 03:30Z-04:30Z
		const sheet = timesheetFor(core, filter(), ZONE, NOW);
		expect(sheet.days[0].date).toBe('2026-10-05');
		expect(sheet.days[0].rows[0]).toMatchObject({ start: '23:30', end: '00:30', plusDays: 1 });
	});

	it('shows the newest 500 of 501 and says so', () => {
		const { core, p1, make } = setup();
		for (let i = 0; i < 501; i++) {
			const m = (n: number) =>
				`2026-10-05T${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
			make(p1, m(i), m(i + 1));
		}
		const sheet = timesheetFor(core, filter(), ZONE, NOW);
		expect(sheet.truncated).toBe(true);
		expect(sheet.count).toBe(500);
		expect(sheet.totalMs).toBe(500 * 60_000);
		expect(sheet.days[0].rows).toHaveLength(500);
	});

	it('marks overlaps whose partner the filter hides', () => {
		const { core, p1, p2, make } = setup();
		make(p1, '2026-10-05T09:00', '2026-10-05T10:00');
		make(p2, '2026-10-05T09:30', '2026-10-05T10:30');
		make(p2, '2026-10-05T12:00', '2026-10-05T13:00');
		const sheet = timesheetFor(core, filter({ project: p1.id }), ZONE, NOW);
		expect(sheet.days[0].rows).toHaveLength(1);
		expect(sheet.days[0].rows[0].overlaps).toBe(true);
		const other = timesheetFor(core, filter({ project: p2.id }), ZONE, NOW);
		expect(other.days[0].rows.map((r) => r.overlaps)).toEqual([false, true]);
	});

	it('marks an overlap with an entry that starts before the range', () => {
		const { core, p1, p2, make } = setup();
		make(p2, '2026-10-04T23:00', '2026-10-05T01:00');
		make(p1, '2026-10-05T00:30', '2026-10-05T02:00');
		const sheet = timesheetFor(core, filter({ from: '2026-10-05', to: '2026-10-05' }), ZONE, NOW);
		expect(sheet.days[0].rows).toHaveLength(1);
		expect(sheet.days[0].rows[0].overlaps).toBe(true);
	});
});

describe('filterOptions', () => {
	it('leaves archived rows out unless asked, then flags them', () => {
		const { core, customer, p1 } = setup();
		const a = val(core.activities.create({ name: 'A' }));
		val(core.activities.create({ name: 'B' }));
		val(core.locations.create({ name: 'L' }));
		val(core.activities.archive({ id: a.id, expectedVersion: a.version }));
		val(core.projects.archive({ id: p1.id, expectedVersion: p1.version }));
		const live = filterOptions(core, { archived: false });
		expect(live.activities.map((x) => x.name)).toEqual(['B']);
		expect(live.projects.map((x) => x.name)).toEqual(['P2']);
		const all = filterOptions(core, { archived: true });
		expect(all.activities).toEqual([
			{ id: a.id, name: 'A', archived: true },
			expect.objectContaining({ name: 'B', archived: false })
		]);
		expect(all.projects.find((x) => x.name === 'P1')).toMatchObject({
			customerId: customer.id,
			customerName: 'C',
			colour: 1,
			archived: true
		});
		expect(all.locations).toHaveLength(1);
	});
});
