import { describe, expect, it } from 'vitest';
import { openCore, type EntryItem, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { outputRows } from './copy-out';
import { readOutput } from './output';
import { isoWeek, reportFor, reportTotals } from './reports';

const BUD = 'Europe/Budapest';
const at = (iso: string) => Date.parse(iso);

function entry(start: string, end: string | null, over: Partial<EntryItem> = {}): EntryItem {
	return {
		id: 'e1',
		userId: 'u1',
		projectId: 'p1',
		activityId: null,
		locationId: null,
		startAt: at(start),
		startZone: BUD,
		endAt: end === null ? null : at(end),
		endZone: end === null ? null : BUD,
		reference: null,
		description: null,
		version: 1,
		createdAt: 0,
		updatedAt: 0,
		projectName: 'Site',
		customerId: 'c1',
		customerName: 'Acme',
		activityName: null,
		locationName: null,
		...over
	};
}

const base = { round: true, split: false };

describe('isoWeek', () => {
	it('numbers a week and gives its Monday and Sunday', () => {
		const w43 = { week: 43, monday: '2026-10-19', sunday: '2026-10-25' };
		expect(isoWeek('2026-10-19')).toEqual(w43);
		expect(isoWeek('2026-10-25')).toEqual(w43);
	});
	it('keeps a week across the new year together', () => {
		const w53 = { week: 53, monday: '2026-12-28', sunday: '2027-01-03' };
		expect(isoWeek('2026-12-31')).toEqual(w53);
		expect(isoWeek('2027-01-01')).toEqual(w53);
		expect(isoWeek('2027-01-04').week).toBe(1);
	});
});

describe('days', () => {
	it("reads as Entries' day heads", () => {
		const report = reportTotals(
			[entry('2026-10-01T09:00:00+02:00', '2026-10-01T10:00:00+02:00')],
			base
		);
		expect(report.days[0].label).toBe('Thu 2026-10-01');
	});
	const night = entry('2026-10-07T22:00:00+02:00', '2026-10-08T02:00:00+02:00');
	it('puts an unsplit entry on its start day', () => {
		expect(reportTotals([night], base).days).toEqual([
			{ key: '2026-10-07', label: 'Wed 2026-10-07', minutes: 240 }
		]);
	});
	it('splits it at midnight, leaving the other tables as they were', () => {
		const whole = reportTotals([night], base);
		const split = reportTotals([night], { ...base, split: true });
		expect(split.days).toEqual([
			{ key: '2026-10-07', label: 'Wed 2026-10-07', minutes: 120 },
			{ key: '2026-10-08', label: 'Thu 2026-10-08', minutes: 120 }
		]);
		expect(split.weeks).toEqual(whole.weeks);
		expect(split.customers).toEqual(whole.customers);
		expect(split.projects).toEqual(whole.projects);
		expect(split.entries).toBe(1);
	});
});

describe('weeks', () => {
	it('labels ISO weeks and orders them by date', () => {
		const report = reportTotals(
			[
				entry('2026-10-19T09:00:00+02:00', '2026-10-19T10:00:00+02:00'),
				entry('2026-10-18T09:00:00+02:00', '2026-10-18T10:00:00+02:00', { id: 'e2' })
			],
			base
		);
		expect(report.weeks.map((w) => w.label)).toEqual([
			'W42 · 2026-10-12 – 10-18',
			'W43 · 2026-10-19 – 10-25'
		]);
	});
	it('writes the Sunday in full when it falls in the next year', () => {
		// Review Focus 5: an entry on 2026-12-31. ISO 8601 numbers that week 53 of 2026
		// (2026 begins on a Thursday), so it reads W53, not W01.
		const report = reportTotals(
			[entry('2026-12-31T09:00:00+01:00', '2026-12-31T10:00:00+01:00')],
			base
		);
		expect(report.weeks[0].label).toBe('W53 · 2026-12-28 – 2027-01-03');
		const next = reportTotals(
			[entry('2027-01-01T09:00:00+01:00', '2027-01-01T10:00:00+01:00')],
			base
		);
		expect(next.weeks[0].label).toBe('W53 · 2026-12-28 – 2027-01-03');
	});
	it('labels a week the range cuts as the whole week, counting only the entries found', () => {
		const report = reportTotals(
			[
				entry('2026-10-01T09:00:00+02:00', '2026-10-01T10:00:00+02:00'),
				entry('2026-10-02T09:00:00+02:00', '2026-10-02T09:30:00+02:00', { id: 'e2' })
			],
			base
		);
		expect(report.weeks).toEqual([
			{ key: expect.any(String), label: 'W40 · 2026-09-28 – 10-04', minutes: 90 }
		]);
	});
});

describe('customers and projects', () => {
	const hour = ['2026-10-07T09:00:00+02:00', '2026-10-07T10:00:00+02:00'] as const;
	it('orders customers by name, ignoring case', () => {
		const report = reportTotals(
			[
				entry(...hour, { customerId: 'c1', customerName: 'beta' }),
				entry(...hour, { id: 'e2', customerId: 'c2', customerName: 'Alpha' })
			],
			base
		);
		expect(report.customers.map((c) => c.label)).toEqual(['Alpha', 'beta']);
	});
	it('keeps a project name under two customers as two rows', () => {
		const report = reportTotals(
			[
				entry(...hour, { projectId: 'p2', customerId: 'c2', customerName: 'Bolt' }),
				entry(...hour, { id: 'e2' })
			],
			base
		);
		expect(report.projects.map((p) => p.label)).toEqual(['Acme › Site', 'Bolt › Site']);
		expect(report.projects.map((p) => p.key)).toEqual(['p1', 'p2']);
		expect(report.projects[1]).toMatchObject({ customer: 'Bolt', project: 'Site' });
	});
});

describe('totals', () => {
	it('counts an entry that rounds to nothing', () => {
		const report = reportTotals(
			[entry('2026-10-07T09:01:00+02:00', '2026-10-07T09:02:00+02:00')],
			base
		);
		expect(report.entries).toBe(1);
		expect(report.minutes).toBe(0);
		expect(report.days).toEqual([{ key: '2026-10-07', label: 'Wed 2026-10-07', minutes: 0 }]);
	});
	it('leaves a running entry out and counts it', () => {
		const report = reportTotals([entry('2026-10-07T09:00:00+02:00', null)], base);
		expect(report).toMatchObject({ running: 1, entries: 0, minutes: 0 });
		expect([report.days, report.weeks, report.customers, report.projects]).toEqual([
			[],
			[],
			[],
			[]
		]);
	});
	it('sums every table to the minutes the copy-out rows sum to', () => {
		const entries = [
			entry('2026-10-07T22:00:00+02:00', '2026-10-08T02:10:00+02:00'),
			entry('2026-10-12T09:01:00+02:00', '2026-10-12T10:47:00+02:00', {
				id: 'e2',
				projectId: 'p2',
				customerId: 'c2',
				customerName: 'Bolt'
			}),
			entry('2026-10-13T09:00:00+02:00', null, { id: 'e3' })
		];
		for (const split of [false, true]) {
			const options = { round: true, split, duration: 'hm' as const };
			const report = reportTotals(entries, options);
			const sum = (rows: { minutes: number }[]) => rows.reduce((n, r) => n + r.minutes, 0);
			expect(report.minutes).toBe(outputRows(entries, options).minutes);
			for (const table of [report.days, report.weeks, report.customers, report.projects]) {
				expect(sum(table)).toBe(report.minutes);
			}
		}
	});
});

describe('reportFor', () => {
	const db = createTestDb();
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(r.error.message);
		return r.value;
	};
	const make = (name: string) => {
		const id = newId();
		db.insert(user)
			.values({ id, username: name, passwordHash: 'x', createdAt: 1, updatedAt: 1 })
			.run();
		const core = openCore(db, id, 'ui');
		const customer = val(core.customers.create({ name: 'C' }));
		const project = val(core.projects.create({ customerId: customer.id, name: 'P' }));
		return { core, project };
	};
	const mine = make('a');
	const other = make('b');
	const query = (q: string) => readOutput(new URLSearchParams(q), {}, '2026-10-19').view;

	it('totals every entry of the user, not a capped page', () => {
		for (let i = 0; i < 600; i++) {
			const minute = String(i % 60).padStart(2, '0');
			const hour = String(Math.floor(i / 60)).padStart(2, '0');
			val(
				mine.core.entries.create({
					projectId: mine.project.id,
					start: `2026-10-05T${hour}:${minute}`,
					end: '2026-10-05T23:59',
					timeZone: BUD
				})
			);
		}
		val(
			other.core.entries.create({
				projectId: other.project.id,
				start: '2026-10-05T08:00',
				end: '2026-10-05T09:00',
				timeZone: BUD
			})
		);
		const result = reportFor(mine.core, query(''), BUD);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.report.entries).toBe(600);
			expect(result.report.customers).toHaveLength(1);
		}
	});

	it('gives the field message when the list is refused', () => {
		const result = reportFor(mine.core, query(`q=${'x'.repeat(201)}`), BUD);
		expect(result).toEqual({ ok: false, message: 'Use 1–200 characters.' });
	});
});
