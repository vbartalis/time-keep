import { describe, expect, it } from 'vitest';
import { withCurrent } from './edit';

describe('withCurrent', () => {
	const active = [
		{ id: 'a', name: 'Alpha' },
		{ id: 'b', name: 'Beta' }
	];
	const all = [...active, { id: 'z', name: 'Zeta' }];

	it('keeps the active list when the current one is in it or there is none', () => {
		expect(withCurrent(active, all, 'a')).toEqual([
			{ id: 'a', name: 'Alpha', archived: false },
			{ id: 'b', name: 'Beta', archived: false }
		]);
		expect(withCurrent(active, all, null)).toHaveLength(2);
	});
	it('adds the current archived one, marked', () => {
		expect(withCurrent(active, all, 'z')).toEqual([
			{ id: 'a', name: 'Alpha', archived: false },
			{ id: 'b', name: 'Beta', archived: false },
			{ id: 'z', name: 'Zeta', archived: true }
		]);
	});
	it('ignores a current id that is nowhere', () => {
		expect(withCurrent(active, all, 'gone')).toHaveLength(2);
	});
});
