import { describe, expect, it } from 'vitest';
import { COLUMNS } from '#lib/output.js';
import {
	DEFAULT_CHOICE,
	choiceQuery,
	optionsLabel,
	readChoice,
	type OutputChoice
} from './output.js';

const read = (query: string, kept?: string) => readChoice(new URLSearchParams(query), kept);

describe('readChoice', () => {
	it('is the default for an empty address and nothing kept', () => {
		const r = read('');
		expect(r.choice).toEqual(DEFAULT_CHOICE);
		expect(r.named).toBe(false);
		expect(r.columnsError).toBeNull();
		expect(DEFAULT_CHOICE.columns).toEqual([...COLUMNS]);
	});

	it('orders columns as COLUMNS and drops unknown names', () => {
		expect(read('cols=description,date').choice.columns).toEqual(['date', 'description']);
		expect(read('cols=date,bogus').choice.columns).toEqual(['date']);
		expect(read('cols=date').named).toBe(true);
	});

	it('gives no columns and an error for an empty or unknown-only cols', () => {
		for (const q of ['cols=', 'cols=bogus']) {
			const r = read(q);
			expect(r.choice.columns).toEqual([]);
			expect(r.columnsError).toBe('Choose at least one column.');
			expect(r.named).toBe(true);
		}
	});

	it('takes what the address lacks from kept', () => {
		const kept = 'cols=date&round=0&split=1&duration=decimal';
		const r = read('round=1', kept);
		expect(r.choice).toEqual({
			columns: ['date'],
			options: { round: true, split: true, duration: 'decimal' }
		});
		const a = read('round=0&duration=decimal');
		expect(a.choice.options).toEqual({ round: false, split: false, duration: 'decimal' });
		expect(a.choice.columns).toEqual([...COLUMNS]);
	});

	it('reads a form posted without the script: ticked boxes and their fallbacks', () => {
		// The blank `cols` is always sent, then one per ticked box; each switch sends its
		// hidden 0, then 1 when ticked: the last value counts.
		const r = read('cols=&cols=description&cols=date&round=0&round=1&split=0&duration=decimal');
		expect(r.choice).toEqual({
			columns: ['date', 'description'],
			options: { round: true, split: false, duration: 'decimal' }
		});
		const none = read('cols=&round=0&split=0&duration=hm');
		expect(none.choice.columns).toEqual([]);
		expect(none.columnsError).toBe('Choose at least one column.');
	});

	it('uses kept alone when the address names nothing', () => {
		const r = read('', 'cols=date&round=0&split=1&duration=decimal');
		expect(r.choice).toEqual({
			columns: ['date'],
			options: { round: false, split: true, duration: 'decimal' }
		});
		expect(r.named).toBe(false);
	});
});

describe('choiceQuery', () => {
	it('writes all four names', () => {
		expect(choiceQuery(DEFAULT_CHOICE)).toBe(
			'cols=date,start,end,duration,customer,project,activity,location,reference,description&round=1&split=0&duration=hm'
		);
	});

	it('reads back to the same choice', () => {
		const c: OutputChoice = {
			columns: ['start', 'project'],
			options: { round: false, split: true, duration: 'decimal' }
		};
		expect(read(choiceQuery(c)).choice).toEqual(c);
	});
});

describe('optionsLabel', () => {
	it('names the options', () => {
		expect(optionsLabel(DEFAULT_CHOICE.options)).toBe('Options · h:mm, rounded');
		expect(optionsLabel({ round: false, split: true, duration: 'decimal' })).toBe(
			'Options · decimal, exact, split'
		);
	});
});
