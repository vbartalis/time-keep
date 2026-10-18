import { describe, expect, it } from 'vitest';
import { isTimeZone, localParts, nextDate, parseTime, previousDate } from './time';

const FORMAT = 'Use a date and time like 2026-10-18T09:00.';
const at = (iso: string) => Date.parse(iso);

describe('parseTime', () => {
	it('reads local time in the zone', () => {
		expect(parseTime('2026-10-18T09:00', 'Europe/Budapest')).toEqual({
			ok: true,
			at: at('2026-10-18T07:00:00Z')
		});
	});

	it('reads an explicit offset', () => {
		expect(parseTime('2026-10-18T09:00:00+02:00', 'America/New_York')).toEqual({
			ok: true,
			at: at('2026-10-18T07:00:00Z')
		});
	});

	it('ignores the zone with Z', () => {
		expect(parseTime('2026-10-18T09:00Z', 'Asia/Kolkata')).toEqual({
			ok: true,
			at: at('2026-10-18T09:00:00Z')
		});
	});

	it('reads seconds and milliseconds', () => {
		expect(parseTime('2026-10-18T09:00:05.250Z', 'UTC')).toEqual({
			ok: true,
			at: at('2026-10-18T09:00:05.250Z')
		});
		expect(parseTime('2026-10-18T09:00:05', 'Europe/Budapest')).toEqual({
			ok: true,
			at: at('2026-10-18T07:00:05Z')
		});
	});

	it('rejects a time in a DST gap', () => {
		expect(parseTime('2026-03-29T02:30', 'Europe/Budapest')).toEqual({
			ok: false,
			message: 'That time does not exist in Europe/Budapest.'
		});
	});

	it('takes the earlier instant when ambiguous', () => {
		expect(parseTime('2026-10-25T02:30', 'Europe/Budapest')).toEqual({
			ok: true,
			at: at('2026-10-25T00:30:00Z')
		});
	});

	it('handles New York winter and Kolkata half-hour offsets', () => {
		expect(parseTime('2026-01-15T09:00', 'America/New_York')).toEqual({
			ok: true,
			at: at('2026-01-15T14:00:00Z')
		});
		expect(parseTime('2026-01-15T09:00', 'Asia/Kolkata')).toEqual({
			ok: true,
			at: at('2026-01-15T03:30:00Z')
		});
	});

	it('rejects garbage and out-of-range fields', () => {
		for (const text of [
			'garbage',
			'',
			'2026-13-01T00:00',
			'2026-02-30T00:00',
			'2026-10-18T24:00',
			'2026-10-18T09:60',
			'2026-10-18',
			'2026-10-18T09:00+25:00'
		]) {
			expect(parseTime(text, 'UTC')).toEqual({ ok: false, message: FORMAT });
		}
	});
});

describe('isTimeZone', () => {
	it('accepts real zones and rejects others', () => {
		expect(isTimeZone('Europe/Budapest')).toBe(true);
		expect(isTimeZone('Mars/Base')).toBe(false);
		expect(isTimeZone('')).toBe(false);
	});
});

describe('localParts', () => {
	it('gives the local date and time of an instant in a zone', () => {
		expect(localParts(Date.UTC(2026, 9, 18, 23, 5), 'Europe/Budapest')).toEqual({
			date: '2026-10-19',
			time: '01:05'
		});
		expect(localParts(Date.UTC(2026, 0, 1, 0, 0), 'UTC')).toEqual({
			date: '2026-01-01',
			time: '00:00'
		});
	});
});

describe('nextDate', () => {
	it('adds one calendar day', () => {
		expect(nextDate('2026-10-24')).toBe('2026-10-25');
		expect(nextDate('2026-12-31')).toBe('2027-01-01');
		expect(nextDate('2028-02-28')).toBe('2028-02-29');
	});
});

describe('previousDate', () => {
	it('takes away one calendar day', () => {
		expect(previousDate('2026-10-25')).toBe('2026-10-24');
		expect(previousDate('2027-01-01')).toBe('2026-12-31');
		expect(previousDate('2028-03-01')).toBe('2028-02-29');
	});
});
