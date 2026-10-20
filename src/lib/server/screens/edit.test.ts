import { describe, expect, it } from 'vitest';
import { postedValues, withCurrent } from './edit';

const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};
const unchanged = {
	version: '3',
	start: '2026-10-18T09:00',
	end: '2026-10-18T16:30',
	projectId: 'p1',
	activityId: 'a1',
	locationId: '',
	reference: 'WEB-1',
	description: 'Fixed the build'
};

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

describe('postedValues', () => {
	it('echoes the posted version with the named fields, so a refused form keeps its version', () => {
		const values = postedValues(form({ ...unchanged, version: '3' }), ['start', 'description']);
		expect(values).toEqual({
			version: '3',
			start: '2026-10-18T09:00',
			description: 'Fixed the build'
		});
	});
	it('uses empty text for what was not posted', () => {
		expect(postedValues(form({}), ['end'])).toEqual({ version: '', end: '' });
	});
});
