import { describe, expect, it } from 'vitest';
import { formatElapsed, templateTimes, warningText } from './format';

describe('formatElapsed', () => {
	it('punches h:mm:ss, never negative', () => {
		expect(formatElapsed(0)).toBe('0:00:00');
		expect(formatElapsed(3_723_999)).toBe('1:02:03');
		expect(formatElapsed(26 * 3_600_000)).toBe('26:00:00');
		expect(formatElapsed(-5000)).toBe('0:00:00');
		expect(formatElapsed(Number.NaN)).toBe('0:00:00');
	});
});

describe('warningText', () => {
	it('says the known warnings in the screen’s words, others as the core does', () => {
		expect(warningText({ code: 'overlap', message: 'Overlaps 2 other entries.' })).toBe(
			'Overlaps another entry'
		);
		expect(warningText({ code: 'long', message: 'Longer than 24 hours.' })).toBe(
			'Longer than 24 hours'
		);
		expect(warningText({ code: 'odd', message: 'Something odd.' })).toBe('Something odd.');
	});
});

describe('templateTimes', () => {
	const t = (startTime: string | null, endTime: string | null, durationMinutes: number | null) => ({
		startTime,
		endTime,
		durationMinutes
	});
	it('punches what the template fixes', () => {
		expect(templateTimes(t('09:00', '17:30', null))).toBe('09:00–17:30');
		expect(templateTimes(t('22:00', '06:00', null))).toBe('22:00–06:00');
		expect(templateTimes(t('09:00', null, 45))).toBe('09:00 + 0:45');
		expect(templateTimes(t(null, null, 90))).toBe('1:30');
		expect(templateTimes(t('09:00', null, null))).toBe('09:00 –');
		expect(templateTimes(t(null, null, null))).toBeNull();
	});
});
