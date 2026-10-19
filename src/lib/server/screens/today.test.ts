import { describe, expect, it } from 'vitest';
import {
	earlierDate,
	formatDate,
	formatHours,
	formatTime,
	toLocalInput,
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
