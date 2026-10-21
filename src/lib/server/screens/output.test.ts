import { describe, expect, it } from 'vitest';
import { DEFAULT_CHOICE } from '#lib/filter/output.js';
import { outputInput, outputQuery, readOutput } from './output.js';

const TODAY = '2026-10-21';
const read = (query: string, cookies: { range?: string; choice?: string } = {}) =>
	readOutput(new URLSearchParams(query), cookies, TODAY);

describe('readOutput', () => {
	it('starts on this month with the default choice, keeping the range only', () => {
		const r = read('');
		expect(r.view.filter).toMatchObject({
			range: 'this-month',
			from: '2026-10-01',
			to: '2026-10-31'
		});
		expect(r.view.choice).toEqual(DEFAULT_CHOICE);
		expect(r.keepRange).toBe('this-month');
		expect(r.keepChoice).toBeNull();
	});

	it('reads the kept range without rewriting it', () => {
		const r = read('', { range: 'last-month' });
		expect(r.view.filter).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
		expect(r.keepRange).toBeNull();
	});

	it('keeps a named preset', () => {
		expect(read('range=last-week', { range: 'last-month' }).keepRange).toBe('last-week');
	});

	it('does not keep an open custom range and leaves "to" empty', () => {
		const r = read('range=custom&from=2026-10-01');
		expect(r.keepRange).toBeNull();
		expect(r.view.filter).toMatchObject({ from: '2026-10-01', to: '' });
		const input = outputInput(r.view.filter, 'UTC');
		expect(input).toHaveProperty('from');
		expect(input).not.toHaveProperty('to');
	});

	it('refuses no columns and keeps no choice', () => {
		const r = read('cols=');
		expect(r.columnsError).toBe('Choose at least one column.');
		expect(r.keepChoice).toBeNull();
	});

	it('keeps a named choice in full', () => {
		expect(read('cols=date&round=0').keepChoice).toBe('cols=date&round=0&split=0&duration=hm');
	});

	it('ignores a round 1 address, using the kept range', () => {
		const r = read('show=1&from=2026-10-01&to=2026-10-31&round=1&col=date&col=start&col=end', {
			range: 'last-month'
		});
		expect(r.view.filter).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
		expect(r.view.choice.columns).toEqual(DEFAULT_CHOICE.columns);
		expect(r.error).toBeNull();
	});

	it('reads an outputQuery back to the same view', () => {
		const r = read('range=last-week&cols=date,project&round=0&split=1&duration=decimal&q=x');
		expect(read(outputQuery(r.view)).view).toEqual(r.view);
	});
});

describe('outputInput', () => {
	it('has no limit, ascends, and spans the range', () => {
		const { view } = read('');
		const input = outputInput(view.filter, 'UTC');
		expect(input).not.toHaveProperty('limit');
		expect(input.order).toBe('asc');
		expect(input.from).toBe('2026-10-01T00:00:00.000Z');
		expect(input.to).toBe('2026-11-01T00:00:00.000Z');
	});
});
