import { describe, expect, it } from 'vitest';
import { createSelection } from './selection.svelte';

const ROWS = ['a', 'b', 'c', 'd', 'e'];

describe('createSelection', () => {
	it('ticks and unticks one row, keeping display order', () => {
		const s = createSelection(() => ROWS);
		s.toggle('d', false);
		s.toggle('b', false);
		expect(s.ids).toEqual(['b', 'd']);
		expect(s.has('b')).toBe(true);
		s.toggle('b', false);
		expect(s.ids).toEqual(['d']);
	});

	it('shift ticks the run from the last toggled row down', () => {
		const s = createSelection(() => ROWS);
		s.toggle('b', false);
		s.toggle('d', true);
		expect(s.ids).toEqual(['b', 'c', 'd']);
	});

	it('shift ticks the run from the last toggled row up', () => {
		const s = createSelection(() => ROWS);
		s.toggle('e', false);
		s.toggle('b', true);
		expect(s.ids).toEqual(['b', 'c', 'd', 'e']);
	});

	it('shift on a ticked row unticks the run', () => {
		const s = createSelection(() => ROWS);
		s.setMany(ROWS, true);
		s.toggle('a', false);
		s.toggle('c', true);
		expect(s.ids).toEqual(['d', 'e']);
	});

	it('shift with nothing toggled before ticks only that row', () => {
		const s = createSelection(() => ROWS);
		s.toggle('c', true);
		expect(s.ids).toEqual(['c']);
	});

	it("tells a day's state: none, some or all", () => {
		const s = createSelection(() => ROWS);
		const day = ['b', 'c'];
		expect(s.state(day)).toBe('none');
		s.toggle('b', false);
		expect(s.state(day)).toBe('some');
		s.setMany(day, true);
		expect(s.state(day)).toBe('all');
		s.setMany(day, false);
		expect(s.state(day)).toBe('none');
		expect(s.state([])).toBe('none');
	});

	it('drops ids that are no longer rows', () => {
		let rows = ROWS;
		const s = createSelection(() => rows);
		s.setMany(['a', 'c', 'e'], true);
		rows = ['a', 'b'];
		expect(s.ids).toEqual(['a']);
		expect(s.has('c')).toBe(false);
		expect(s.state(['a', 'b'])).toBe('some');
	});

	it('clears', () => {
		const s = createSelection(() => ROWS);
		s.setMany(ROWS, true);
		s.clear();
		expect(s.ids).toEqual([]);
		expect(s.state(ROWS)).toBe('none');
	});
});
