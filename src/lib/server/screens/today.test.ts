import { describe, expect, it } from 'vitest';
import { openCore, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import {
	earlierDate,
	formatDate,
	formatHours,
	formatTime,
	toLocalInput,
	templateCards,
	todayFor,
	todayRange
} from './today';

const H = 3_600_000;

describe('todayRange', () => {
	it('uses the local day at 00:30 in Budapest, not the UTC day', () => {
		// 2026-10-18T00:30+02:00 is still 2026-10-17 in UTC.
		const now = Date.parse('2026-10-17T22:30:00Z');
		expect(todayRange(now, 'Europe/Budapest')).toEqual({
			from: '2026-10-17T22:00:00.000Z',
			to: '2026-10-18T22:00:00.000Z',
			date: '2026-10-18'
		});
	});
	it('is 23 hours on the spring-forward day', () => {
		const r = todayRange(Date.parse('2026-03-29T12:00:00Z'), 'Europe/Budapest');
		expect(r.date).toBe('2026-03-29');
		expect((Date.parse(r.to) - Date.parse(r.from)) / H).toBe(23);
	});
	it('is 25 hours on the fall-back day', () => {
		const r = todayRange(Date.parse('2026-10-25T12:00:00Z'), 'Europe/Budapest');
		expect(r.date).toBe('2026-10-25');
		expect((Date.parse(r.to) - Date.parse(r.from)) / H).toBe(25);
	});
	it('starts at 01:00 when midnight is skipped (Havana, 2026-03-08)', () => {
		const r = todayRange(Date.parse('2026-03-08T12:00:00Z'), 'America/Havana');
		expect(r).toEqual({
			from: '2026-03-08T05:00:00.000Z',
			to: '2026-03-09T04:00:00.000Z',
			date: '2026-03-08'
		});
		// The day before ends where this one starts: no gap, no overlap.
		expect(todayRange(Date.parse('2026-03-07T12:00:00Z'), 'America/Havana').to).toBe(r.from);
	});
	it('works in UTC', () => {
		expect(todayRange(Date.parse('2026-10-18T13:00:00Z'), 'UTC')).toEqual({
			from: '2026-10-18T00:00:00.000Z',
			to: '2026-10-19T00:00:00.000Z',
			date: '2026-10-18'
		});
	});
});

describe('formatters', () => {
	const at = Date.parse('2026-10-17T22:05:00Z');
	it('formats time, date and the datetime-local value in a zone', () => {
		expect(formatTime(at, 'Europe/Budapest')).toBe('00:05');
		expect(formatDate(at, 'Europe/Budapest')).toBe('2026-10-18');
		expect(toLocalInput(at, 'Europe/Budapest')).toBe('2026-10-18T00:05');
		expect(formatDate(at, 'UTC')).toBe('2026-10-17');
	});
	it('formats hours as h:mm', () => {
		expect(formatHours(0)).toBe('0:00');
		expect(formatHours(90 * 60_000)).toBe('1:30');
		expect(formatHours(25 * H + 5 * 60_000)).toBe('25:05');
		expect(formatHours(59_999)).toBe('0:00');
	});
	it('shows 0:00 for negative or non-finite hours', () => {
		expect(formatHours(-90 * 60_000)).toBe('0:00');
		expect(formatHours(Number.NaN)).toBe('0:00');
		expect(formatHours(Number.POSITIVE_INFINITY)).toBe('0:00');
		expect(formatHours(Number.NEGATIVE_INFINITY)).toBe('0:00');
	});
});

describe('earlierDate', () => {
	const now = Date.parse('2026-10-18T10:00:00Z');
	it('is null for a start on the same day in its own zone', () => {
		expect(earlierDate(Date.parse('2026-10-18T07:00:00Z'), 'Europe/Budapest', now)).toBeNull();
	});
	it('is the start date when it is an earlier day', () => {
		expect(earlierDate(Date.parse('2026-10-16T21:00:00Z'), 'Europe/Budapest', now)).toBe(
			'2026-10-16'
		);
	});
	it('reads both days in the entry zone', () => {
		// 2026-10-17T23:30Z is already the 18th in Budapest, still the 17th in UTC.
		expect(earlierDate(Date.parse('2026-10-17T23:30:00Z'), 'Europe/Budapest', now)).toBeNull();
		expect(earlierDate(Date.parse('2026-10-17T23:30:00Z'), 'UTC', now)).toBe('2026-10-17');
	});
});

describe('todayFor', () => {
	const ZONE = 'Europe/Budapest';
	const NOW = Date.parse('2026-10-20T10:00:00Z'); // 12:00 in Budapest
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(r.error.message);
		return r.value;
	};
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
		const make = (project: { id: string }, start: string, end?: string) =>
			val(core.entries.create({ projectId: project.id, start, end, timeZone: ZONE }));
		return { core, p1, p2, make };
	};

	it('lists today newest start first and totals the day', () => {
		const { core, p1, make } = setup();
		make(p1, '2026-10-20T09:30', '2026-10-20T09:45');
		make(p1, '2026-10-20T10:00', '2026-10-20T12:18');
		make(p1, '2026-10-19T09:00', '2026-10-19T10:00');
		const t = todayFor(core, ZONE, NOW);
		expect(t.day.date).toBe('2026-10-20');
		expect(t.day.label).toBe('Tue 2026-10-20');
		expect(t.day.rows.map((r) => r.start)).toEqual(['10:00', '09:30']);
		expect(t.day.totalMs).toBe(153 * 60_000);
		expect(t.day.rows.every((r) => r.since === null)).toBe(true);
	});

	it('lists an entry running since yesterday as since, outside the total', () => {
		const { core, p1, make } = setup();
		make(p1, '2026-10-19T22:00');
		make(p1, '2026-10-20T09:00', '2026-10-20T10:00');
		const t = todayFor(core, ZONE, NOW);
		expect(t.day.rows.map((r) => [r.start, r.since])).toEqual([
			['09:00', null],
			['22:00', '2026-10-19']
		]);
		expect(t.day.totalMs).toBe(60 * 60_000);
	});

	it('flags an overlapping pair', () => {
		const { core, p1, p2, make } = setup();
		make(p1, '2026-10-20T09:00', '2026-10-20T10:00');
		make(p2, '2026-10-20T09:30', '2026-10-20T10:30');
		make(p1, '2026-10-20T11:00', '2026-10-20T11:30');
		const t = todayFor(core, ZONE, NOW);
		expect(t.day.rows.map((r) => r.overlaps)).toEqual([false, true, true]);
	});

	it('judges overlap against entries from before today, however long ago they began', () => {
		const { core, p1, p2, make } = setup();
		make(p1, '2026-10-17T12:00', '2026-10-20T09:30');
		make(p2, '2026-10-20T09:00', '2026-10-20T10:00');
		const t = todayFor(core, ZONE, NOW);
		expect(t.day.rows.map((r) => [r.start, r.overlaps])).toEqual([
			['09:00', true],
			['12:00', true]
		]);
	});

	it('lists templates by name with colour and whether they run', () => {
		const { core, p2 } = setup();
		val(core.templates.create({ name: 'Zeta', projectId: p2.id }));
		val(core.templates.create({ name: 'Alpha', startTime: '09:00', endTime: '09:30' }));
		const t = todayFor(core, ZONE, NOW);
		expect(t.templates.map((x) => [x.name, x.colour, x.runs])).toEqual([
			['Alpha', null, false],
			['Zeta', 2, true]
		]);
	});

	it('gives the Templates screen the same cards, each with its version', () => {
		const { core, p2 } = setup();
		const zeta = val(core.templates.create({ name: 'Zeta', projectId: p2.id }));
		val(core.templates.update({ id: zeta.id, expectedVersion: zeta.version, name: 'zeta' }));
		val(core.templates.create({ name: 'Alpha', durationMinutes: 30 }));
		const cards = templateCards(core);
		expect(cards.map((c) => [c.name, c.version, c.colour, c.runs])).toEqual([
			['Alpha', 1, null, false],
			['zeta', 2, 2, true]
		]);
		expect(todayFor(core, ZONE, NOW).templates).toEqual(cards);
	});
});
