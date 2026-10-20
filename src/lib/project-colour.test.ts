import { describe, expect, it } from 'vitest';
import { colourOf, PROJECT_COLOURS } from './project-colour';

describe('colourOf', () => {
	it('numbers projects by creation order', () => {
		const map = colourOf([
			{ id: 'a', createdAt: 3 },
			{ id: 'b', createdAt: 1 },
			{ id: 'c', createdAt: 2 }
		]);
		expect([map.get('a'), map.get('b'), map.get('c')]).toEqual([3, 1, 2]);
	});

	it('wraps after the palette', () => {
		const projects = Array.from({ length: PROJECT_COLOURS + 1 }, (_, i) => ({
			id: `p${i}`,
			createdAt: i
		}));
		const map = colourOf(projects);
		expect(map.get(`p${PROJECT_COLOURS}`)).toBe(1);
		expect(map.get('p0')).toBe(1);
	});

	it('orders equal creation times by id', () => {
		const map = colourOf([
			{ id: 'b', createdAt: 1 },
			{ id: 'a', createdAt: 1 }
		]);
		expect([map.get('a'), map.get('b')]).toEqual([1, 2]);
	});

	it('is empty for no projects', () => {
		expect(colourOf([]).size).toBe(0);
	});
});
