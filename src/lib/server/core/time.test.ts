import { describe, expect, it } from 'vitest';
import { isTimeZone, parseTime } from './time';

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
