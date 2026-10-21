import { describe, expect, it } from 'vitest';
import { openCore, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { readShow, setupTree } from './setup';

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(r.error.message);
	return r.value;
};

function seeded() {
	const db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const core = openCore(db, id, 'ui');
	const compX = val(core.customers.create({ name: 'CompX' }));
	const compY = val(core.customers.create({ name: 'CompY' }));
	const site = val(core.projects.create({ customerId: compX.id, name: 'Site' }));
	const legacy = val(core.projects.create({ customerId: compX.id, name: 'Legacy' }));
	const gone = val(core.projects.create({ customerId: compY.id, name: 'Gone' }));
	const build = val(core.activities.create({ name: 'Build' }));
	const review = val(core.activities.create({ name: 'Review' }));
	const home = val(core.locations.create({ name: 'Home' }));
	const cafe = val(core.locations.create({ name: 'Cafe' }));
	val(core.projects.archive({ id: legacy.id }));
	val(core.projects.archive({ id: gone.id }));
	val(core.customers.archive({ id: compY.id }));
	val(core.activities.archive({ id: review.id }));
	val(core.locations.archive({ id: cafe.id }));
	return { core, compX, compY, site, legacy, gone, build, review, home, cafe };
}

describe('readShow', () => {
	const read = (q: string) => readShow(new URLSearchParams(q));
	it('reads show, with active as the default', () => {
		expect(read('')).toBe('active');
		expect(read('show=archived')).toBe('archived');
		expect(read('show=all')).toBe('all');
		expect(read('show=nonsense')).toBe('active');
	});
	it("reads round 1's archived=1 as all", () => {
		expect(read('archived=1')).toBe('all');
	});
});

describe('setupTree', () => {
	const s = seeded();

	it('active shows only active rows', () => {
		const tree = setupTree(s.core, 'active');
		expect(tree.customers.map((c) => c.name)).toEqual(['CompX']);
		expect(tree.customers[0].projects.map((p) => p.name)).toEqual(['Site']);
		expect(tree.customers[0].heading).toBe(false);
		expect(tree.activities.map((a) => a.name)).toEqual(['Build']);
		expect(tree.locations.map((l) => l.name)).toEqual(['Home']);
	});

	it('gives rows their kind, version and a project its colour', () => {
		const tree = setupTree(s.core, 'active');
		expect(tree.customers[0]).toMatchObject({ kind: 'customer', archived: false });
		expect(tree.customers[0].projects[0]).toMatchObject({
			kind: 'project',
			colour: 1,
			underArchived: false
		});
		expect(tree.activities[0]).toMatchObject({ kind: 'activity', version: 1 });
		expect(tree.locations[0].kind).toBe('location');
	});

	it('archived shows archived activities and locations', () => {
		const tree = setupTree(s.core, 'archived');
		expect(tree.activities.map((a) => a.name)).toEqual(['Review']);
		expect(tree.locations.map((l) => l.name)).toEqual(['Cafe']);
	});

	it('archived names an active customer as a heading over its archived projects', () => {
		const compX = setupTree(s.core, 'archived').customers.find((c) => c.name === 'CompX')!;
		expect(compX.heading).toBe(true);
		expect(compX.archived).toBe(false);
		expect(compX.projects.map((p) => [p.name, p.archived, p.underArchived])).toEqual([
			['Legacy', true, false]
		]);
	});

	it('archived lists an archived customer with all its projects under it', () => {
		const compY = setupTree(s.core, 'archived').customers.find((c) => c.name === 'CompY')!;
		expect(compY.heading).toBe(false);
		expect(compY.archived).toBe(true);
		expect(compY.projects.map((p) => [p.name, p.archived, p.underArchived])).toEqual([
			['Gone', true, true]
		]);
	});

	it('marks an active project under an archived customer archived, not archived itself', () => {
		// The core refuses to unarchive such a project, so archive the customer around a live one.
		const live = seeded();
		const other = val(live.core.customers.create({ name: 'Other' }));
		val(live.core.projects.create({ customerId: other.id, name: 'Live' }));
		val(live.core.customers.archive({ id: other.id }));
		const tree = setupTree(live.core, 'all');
		const project = tree.customers.find((c) => c.name === 'Other')!.projects[0];
		expect(project).toMatchObject({ archived: true, underArchived: true });
		expect(setupTree(live.core, 'active').customers.map((c) => c.name)).not.toContain('Other');
	});

	it('all shows both, the archived marked', () => {
		const tree = setupTree(s.core, 'all');
		expect(tree.customers.map((c) => [c.name, c.archived, c.heading])).toEqual([
			['CompX', false, false],
			['CompY', true, false]
		]);
		expect(tree.customers[0].projects.map((p) => [p.name, p.archived])).toEqual([
			['Legacy', true],
			['Site', false]
		]);
		expect(tree.activities.map((a) => [a.name, a.archived])).toEqual([
			['Build', false],
			['Review', true]
		]);
		expect(tree.locations.map((l) => [l.name, l.archived])).toEqual([
			['Cafe', true],
			['Home', false]
		]);
	});
});
