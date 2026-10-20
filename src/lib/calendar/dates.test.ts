import { describe, expect, it } from 'vitest';
import {
	addDays,
	calendarHref,
	dayName,
	hm,
	isoWeek,
	periodDays,
	periodTitle,
	readView,
	shift,
	weekStart
} from './dates';

describe('readView', () => {
	it('reads a good view and date', () => {
		const q = new URLSearchParams('view=month&date=2026-10-01');
		expect(readView(q, '2026-10-14')).toEqual({ view: 'month', date: '2026-10-01' });
	});

	it('falls back to week and today', () => {
		expect(readView(new URLSearchParams(), '2026-10-14')).toEqual({
			view: 'week',
			date: '2026-10-14'
		});
		expect(readView(new URLSearchParams('view=year'), '2026-10-14').view).toBe('week');
	});

	it('rejects an impossible date', () => {
		const q = new URLSearchParams('date=2026-02-30');
		expect(readView(q, '2026-10-14').date).toBe('2026-10-14');
	});
});

describe('date arithmetic', () => {
	it('adds days across month and year ends', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('finds the Monday of the week', () => {
		expect(weekStart('2026-10-14')).toBe('2026-10-12');
		expect(weekStart('2026-10-18')).toBe('2026-10-12');
		expect(weekStart('2026-10-12')).toBe('2026-10-12');
	});

	it('numbers ISO weeks, including week 53', () => {
		expect(isoWeek('2026-10-14')).toBe(42);
		expect(isoWeek('2027-01-01')).toBe(53);
		expect(isoWeek('2026-12-31')).toBe(53);
		expect(isoWeek('2024-12-30')).toBe(1);
	});
});

describe('periodDays', () => {
	it('is one day for day', () => {
		expect(periodDays('day', '2026-10-14')).toEqual(['2026-10-14']);
	});

	it('is Monday to Sunday for week', () => {
		const days = periodDays('week', '2026-10-14');
		expect(days).toHaveLength(7);
		expect(days[0]).toBe('2026-10-12');
		expect(days[6]).toBe('2026-10-18');
	});

	it('covers the weeks touching the month', () => {
		const days = periodDays('month', '2026-10-14');
		expect(days).toHaveLength(35);
		expect(days[0]).toBe('2026-09-28');
		expect(days[34]).toBe('2026-11-01');
	});

	it('takes six weeks when the month needs them', () => {
		expect(periodDays('month', '2026-08-10')).toHaveLength(42);
	});
});

describe('shift', () => {
	it('moves by days, weeks and months', () => {
		expect(shift('day', '2026-10-14', 1)).toBe('2026-10-15');
		expect(shift('week', '2026-10-14', -1)).toBe('2026-10-07');
		expect(shift('month', '2026-10-14', 1)).toBe('2026-11-14');
		expect(shift('month', '2026-01-14', -1)).toBe('2025-12-14');
	});

	it('clamps a month shift to the last day', () => {
		expect(shift('month', '2026-01-31', 1)).toBe('2026-02-28');
		expect(shift('month', '2028-01-31', 1)).toBe('2028-02-29');
	});
});

describe('periodTitle', () => {
	it('titles a week', () => {
		expect(periodTitle('week', '2026-10-14')).toEqual({
			title: '12 – 18 October 2026',
			sub: 'Week 42'
		});
	});

	it('titles a week across months and years', () => {
		expect(periodTitle('week', '2026-10-01')).toEqual({
			title: '28 September – 4 October 2026',
			sub: 'Week 40'
		});
		expect(periodTitle('week', '2026-12-30').title).toBe('28 December 2026 – 3 January 2027');
	});

	it('titles a day', () => {
		expect(periodTitle('day', '2026-10-14')).toEqual({
			title: 'Wednesday 14 October 2026',
			sub: 'Week 42'
		});
	});

	it('titles a month', () => {
		expect(periodTitle('month', '2026-10-14')).toEqual({ title: 'October 2026', sub: '' });
	});

	it('titles the phone’s periods short, on one line', () => {
		expect(periodTitle('day', '2026-10-14', 'short')).toEqual({
			title: 'Wed 14 October',
			sub: ''
		});
		expect(periodTitle('week', '2026-10-14', 'short')).toEqual({
			title: '12 – 18 Oct',
			sub: 'Week 42'
		});
		expect(periodTitle('week', '2026-10-01', 'short').title).toBe('28 Sep – 4 Oct');
		expect(periodTitle('week', '2026-12-30', 'short').title).toBe('28 Dec 2026 – 3 Jan 2027');
		expect(periodTitle('month', '2026-10-14', 'short')).toEqual({
			title: 'October 2026',
			sub: ''
		});
	});
});

describe('calendarHref', () => {
	it('builds the url', () => {
		expect(calendarHref('week', '2026-10-14')).toBe('/calendar?view=week&date=2026-10-14');
	});

	it('carries a scope after the date', () => {
		expect(calendarHref('day', '2026-10-14', 'project=p1&activity=none')).toBe(
			'/calendar?view=day&date=2026-10-14&project=p1&activity=none'
		);
		expect(calendarHref('day', '2026-10-14', '')).toBe('/calendar?view=day&date=2026-10-14');
	});
});

describe('hm', () => {
	it.each([
		[0, '0:00'],
		[5, '0:05'],
		[60, '1:00'],
		[1665, '27:45'],
		[4360, '72:40']
	])('%i minutes is %s', (minutes, text) => {
		expect(hm(minutes)).toBe(text);
	});
});

describe('dayName', () => {
	it('names a day for a screen reader: weekday, date and month', () => {
		expect(dayName('2026-10-13')).toBe('Tuesday 13 October');
		expect(dayName('2027-01-03')).toBe('Sunday 3 January');
	});
});
