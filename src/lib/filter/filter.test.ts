import { describe, expect, it } from 'vitest';
import {
	PRESETS,
	filterQuery,
	matchesScope,
	presetDays,
	presetHint,
	rangeLabel,
	readFilter,
	readScope,
	scopeCount,
	scopeQuery,
	type Filter,
	type Scope
} from './filter.js';

const TODAY = '2026-10-20';
const none: Scope = { customer: '', project: '', activity: '', location: '' };
const read = (query: string, kept?: string, today = TODAY) =>
	readFilter(new URLSearchParams(query), kept, today);

describe('presets', () => {
	it('lists them in the spec order', () => {
		expect(PRESETS.map((p) => p.label)).toEqual([
			'Today',
			'Yesterday',
			'This week',
			'Last week',
			'This month',
			'Last month'
		]);
	});

	it('resolves each preset to days', () => {
		expect(presetDays('today', TODAY)).toEqual({ from: '2026-10-20', to: '2026-10-20' });
		expect(presetDays('yesterday', TODAY)).toEqual({ from: '2026-10-19', to: '2026-10-19' });
		expect(presetDays('this-week', TODAY)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
		expect(presetDays('last-week', TODAY)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
		expect(presetDays('this-month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
		expect(presetDays('last-month', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
	});

	it('crosses a year for last month', () => {
		expect(presetDays('last-month', '2026-01-10')).toEqual({
			from: '2025-12-01',
			to: '2025-12-31'
		});
	});

	it('hints in short ISO', () => {
		expect(presetHint('today', TODAY)).toBe('10-20');
		expect(presetHint('yesterday', TODAY)).toBe('10-19');
		expect(presetHint('this-week', TODAY)).toBe('10-19 – 10-25');
		expect(presetHint('last-week', TODAY)).toBe('10-12 – 10-18');
		expect(presetHint('this-month', TODAY)).toBe('2026-10');
		expect(presetHint('last-month', TODAY)).toBe('2026-09');
	});
});

describe('readFilter', () => {
	it('opens on this month with nothing kept', () => {
		const { filter, error } = read('');
		expect(error).toBeNull();
		expect(filter).toMatchObject({
			range: 'this-month',
			from: '2026-10-01',
			to: '2026-10-31',
			q: ''
		});
	});

	it('uses the kept preset when the address has no range', () => {
		expect(read('', 'last-month').filter.range).toBe('last-month');
		expect(read('', 'last-month').filter.from).toBe('2026-09-01');
	});

	it('falls back to this month for an unknown kept value or range', () => {
		expect(read('', 'nonsense').filter.range).toBe('this-month');
		expect(read('', 'custom').filter.range).toBe('this-month');
		expect(read('range=bogus', 'last-week').filter.range).toBe('last-week');
		expect(read('range=bogus').filter.range).toBe('this-month');
	});

	it('prefers the address over the kept value', () => {
		expect(read('range=today', 'last-month').filter.range).toBe('today');
	});

	it('recomputes a kept preset from today', () => {
		const a = read('', 'this-week', '2026-10-20').filter;
		const b = read('', 'this-week', '2026-10-27').filter;
		expect([a.from, a.to]).toEqual(['2026-10-19', '2026-10-25']);
		expect([b.from, b.to]).toEqual(['2026-10-26', '2026-11-01']);
	});

	it('reads a custom range with an open side', () => {
		const { filter, error } = read('range=custom&from=&to=2026-10-05');
		expect(error).toBeNull();
		expect(filter).toMatchObject({ range: 'custom', from: '', to: '2026-10-05' });
		expect(read('range=custom').filter).toMatchObject({ from: '', to: '' });
	});

	it('refuses bad dates and a reversed range', () => {
		expect(read('range=custom&from=nope').error).toBe('Use dates like 2026-10-01.');
		expect(read('range=custom&to=2026-02-30').error).toBe('Use dates like 2026-10-01.');
		expect(read('range=custom&from=2026-10-05&to=2026-10-01').error).toBe(
			'From must not be after To.'
		);
	});

	it('ignores from and to on a preset', () => {
		expect(read('range=today&from=2020-01-01').filter.from).toBe('2026-10-20');
	});

	it('reads the scope, search and the no-JS scope select', () => {
		const { filter } = read('customer=c1&activity=none&location=l1&q=%20abc%20');
		expect(filter).toMatchObject({ customer: 'c1', activity: 'none', location: 'l1', q: 'abc' });
		expect(read('scope=customer:c1').filter).toMatchObject({ customer: 'c1', project: '' });
		expect(read('scope=project:p9').filter).toMatchObject({ customer: '', project: 'p9' });
		expect(read('scope=').filter).toMatchObject({ customer: '', project: '' });
	});
});

describe('readScope and scopeQuery', () => {
	it('reads only the scope keys', () => {
		expect(readScope(new URLSearchParams('project=p1&activity=any&q=x'))).toEqual({
			...none,
			project: 'p1'
		});
	});

	it('writes set keys in order, empty when none', () => {
		expect(scopeQuery(none)).toBe('');
		expect(scopeQuery({ customer: 'c1', project: '', activity: 'none', location: 'l 1' })).toBe(
			'customer=c1&activity=none&location=l%201'
		);
	});
});

describe('filterQuery', () => {
	const roundTrips: Filter[] = [
		{ ...none, range: 'last-week', ...presetDays('last-week', TODAY), q: '' },
		{ ...none, range: 'custom', from: '2026-09-01', to: '', q: 'a&b c' },
		{
			customer: 'c1',
			project: 'p1',
			activity: 'none',
			location: 'l1',
			range: 'custom',
			from: '',
			to: '2026-09-15',
			q: 'x'
		}
	];

	it('writes range always, dates only for custom, then scope, then q', () => {
		expect(filterQuery(roundTrips[0])).toBe('range=last-week');
		expect(filterQuery(roundTrips[1])).toBe('range=custom&from=2026-09-01&to=&q=a%26b+c');
		expect(filterQuery(roundTrips[2])).toBe(
			'range=custom&from=&to=2026-09-15&customer=c1&project=p1&activity=none&location=l1&q=x'
		);
	});

	it('round-trips through readFilter', () => {
		for (const f of roundTrips) {
			expect(read(filterQuery(f)).filter).toEqual(f);
		}
	});
});

describe('scopeCount', () => {
	it('counts customer and project once', () => {
		expect(scopeCount(none)).toBe(0);
		expect(scopeCount({ ...none, customer: 'c1' })).toBe(1);
		expect(scopeCount({ ...none, customer: 'c1', project: 'p1' })).toBe(1);
		expect(scopeCount({ ...none, project: 'p1', activity: 'none', location: 'l1' })).toBe(3);
	});
});

describe('rangeLabel', () => {
	const f = (over: Partial<Filter>): Filter => ({
		...none,
		range: 'custom',
		from: '',
		to: '',
		q: '',
		...over
	});
	it('names the range', () => {
		expect(rangeLabel(f({ range: 'this-month', from: '2026-10-01', to: '2026-10-31' }))).toBe(
			'This month'
		);
		expect(rangeLabel(f({ from: '2026-09-01', to: '2026-09-15' }))).toBe('2026-09-01 – 2026-09-15');
		expect(rangeLabel(f({ from: '2026-09-01' }))).toBe('From 2026-09-01');
		expect(rangeLabel(f({ to: '2026-09-15' }))).toBe('Until 2026-09-15');
		expect(rangeLabel(f({}))).toBe('All time');
	});
});

describe('matchesScope', () => {
	const e = { customerId: 'c1', projectId: 'p1', activityId: 'a1', locationId: null };
	it('matches an empty scope', () => expect(matchesScope(e, none)).toBe(true));
	it('matches customer and project', () => {
		expect(matchesScope(e, { ...none, customer: 'c1' })).toBe(true);
		expect(matchesScope(e, { ...none, customer: 'c2' })).toBe(false);
		expect(matchesScope(e, { ...none, project: 'p1' })).toBe(true);
		expect(matchesScope(e, { ...none, project: 'p2' })).toBe(false);
	});
	it('matches activity and location, any and none included', () => {
		expect(matchesScope(e, { ...none, activity: 'a1' })).toBe(true);
		expect(matchesScope(e, { ...none, activity: 'a2' })).toBe(false);
		expect(matchesScope(e, { ...none, activity: 'none' })).toBe(false);
		expect(matchesScope(e, { ...none, activity: 'any' })).toBe(true);
		expect(matchesScope(e, { ...none, location: 'none' })).toBe(true);
		expect(matchesScope(e, { ...none, location: 'l1' })).toBe(false);
		expect(matchesScope({ ...e, activityId: null }, { ...none, activity: 'none' })).toBe(true);
	});
});
