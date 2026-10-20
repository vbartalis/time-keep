import { describe, expect, it } from 'vitest';
import { matchProjects } from './match';
import type { PickerProject } from './types';

const project = (
	id: string,
	customerId: string,
	customerName: string,
	name: string
): PickerProject => ({ id, name, customerId, customerName, colour: 1, archived: false });

const projects = [
	project('p1', 'c1', 'CompX', 'ClientY - ProjectZ'),
	project('p2', 'c1', 'CompX', 'CompY - Support'),
	project('p3', 'c2', 'Myself', 'time-keep'),
	project('p4', 'c3', 'Café Lumière', 'Website')
];

const names = (groups: ReturnType<typeof matchProjects>) =>
	groups.map((g) => [g.customerName, g.projects.map((p) => p.name)]);

describe('matchProjects', () => {
	it('finds a project by words from its customer and its name', () => {
		expect(names(matchProjects('compx support', projects))).toEqual([
			['CompX', ['CompY - Support']]
		]);
	});

	it("finds a project by its own name, under its customer's group", () => {
		expect(names(matchProjects('clienty', projects))).toEqual([['CompX', ['ClientY - ProjectZ']]]);
	});

	it('ignores case and accents on both sides', () => {
		expect(names(matchProjects('Café', projects))).toEqual([['Café Lumière', ['Website']]]);
		expect(names(matchProjects('cafe lumiere', projects))).toEqual([['Café Lumière', ['Website']]]);
	});

	it('returns every group, in customer order, for an empty query', () => {
		const groups = matchProjects('  ', projects);
		expect(groups.map((g) => g.customerId)).toEqual(['c1', 'c2', 'c3']);
		expect(groups[0].projects.map((p) => p.id)).toEqual(['p1', 'p2']);
	});

	it('returns no groups when nothing matches', () => {
		expect(matchProjects('nothing here', projects)).toEqual([]);
	});
});
