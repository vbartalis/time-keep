import { describe, expect, it } from 'vitest';
import type { Named, ProjectListItem } from '../core/index';
import { setupTree } from './setup';

const named = (id: string, name: string, archivedAt: number | null = null, version = 1): Named => ({
	id,
	userId: 'u',
	name,
	nameKey: name.toLowerCase(),
	archivedAt,
	version,
	createdAt: 0,
	updatedAt: 0
});
const project = (
	id: string,
	customer: Named,
	name: string,
	archivedAt: number | null = null
): ProjectListItem => ({
	...named(id, name, archivedAt),
	customerId: customer.id,
	customerName: customer.name
});

const acme = named('c1', 'Acme', null, 3);
const old = named('c2', 'Old', 9);
const projects = [
	project('p1', acme, 'Site'),
	project('p2', acme, 'Legacy', 9),
	project('p3', old, 'Gone')
];

describe('setupTree', () => {
	it('hides archived customers and archived projects by default', () => {
		expect(setupTree([acme, old], projects, false)).toEqual([
			{
				id: 'c1',
				name: 'Acme',
				version: 3,
				archived: false,
				projects: [{ id: 'p1', name: 'Site', version: 1, archived: false, spent: false }]
			}
		]);
	});
	it('shows archived rows, and every project of an archived customer, when asked', () => {
		const tree = setupTree([acme, old], projects, true);
		expect(tree.map((c) => [c.id, c.archived])).toEqual([
			['c1', false],
			['c2', true]
		]);
		expect(tree[0].projects.map((p) => [p.id, p.archived])).toEqual([
			['p1', false],
			['p2', true]
		]);
		expect(tree[1].projects.map((p) => p.id)).toEqual(['p3']);
	});
	it('lists an archived customer all its projects even when they are active', () => {
		const tree = setupTree([old], [project('p4', old, 'Live')], true);
		expect(tree[0].projects.map((p) => p.id)).toEqual(['p4']);
	});
	it('marks an active project under an archived customer spent, keeping its own archived state', () => {
		const p = setupTree([old], [project('p4', old, 'Live')], true)[0].projects[0];
		expect(p.archived).toBe(false);
		expect(p.spent).toBe(true);
	});
	it('gives an active customer whose projects are all archived none', () => {
		const only = [project('p2', acme, 'Legacy', 9)];
		expect(setupTree([acme], only, false)[0].projects).toEqual([]);
		expect(setupTree([acme], only, true)[0].projects).toHaveLength(1);
	});
});
