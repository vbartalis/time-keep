import { describe, expect, it } from 'vitest';
import { batch, change, user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { openCore, type Result } from './index';

function setup() {
	const db = createTestDb();
	const mkUser = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const userId = mkUser('u');
	const otherId = mkUser('o');
	let clock = 1000;
	const tick = () => clock++;
	const core = openCore(db, userId, 'ui', tick);
	const other = openCore(db, otherId, 'agent', tick);
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const batches = () => db.select().from(batch).all();
	const changes = () => db.select().from(change).all();
	return { db, core, other, val, batches, changes };
}

describe('a lone command', () => {
	it('makes one batch with the generated label and the actor', () => {
		const { core, val, batches, changes } = setup();
		val(core.customers.create({ name: ' Acme ' }));
		expect(batches()).toHaveLength(1);
		expect(batches()[0]).toMatchObject({ label: 'Create customer "Acme"', actor: 'ui' });
		expect(changes()).toHaveLength(1);
	});

	it('labels each command with the current names', () => {
		const { core, val, batches } = setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const p = val(core.projects.create({ customerId: c.id, name: 'Old' }));
		val(core.projects.rename({ id: p.id, name: ' New ' }));
		val(core.projects.archive({ id: p.id }));
		val(core.projects.unarchive({ id: p.id }));
		const a = val(core.activities.create({ name: 'Dev' }));
		val(core.activities.archive({ id: a.id }));
		const l = val(core.locations.create({ name: 'Home' }));
		val(core.locations.archive({ id: l.id }));
		val(core.locations.unarchive({ id: l.id }));
		val(core.customers.rename({ id: c.id, name: 'Acme 2' }));
		expect(batches().map((b) => b.label)).toEqual([
			'Create customer "Acme"',
			'Create project "Old"',
			'Rename project "Old" to "New"',
			'Archive project "New"',
			'Unarchive project "New"',
			'Create activity "Dev"',
			'Archive activity "Dev"',
			'Create location "Home"',
			'Archive location "Home"',
			'Unarchive location "Home"',
			'Rename customer "Acme" to "Acme 2"'
		]);
	});

	it('stores nothing when the command fails', () => {
		const { core, val, batches } = setup();
		val(core.customers.create({ name: 'Acme' }));
		expect(core.customers.create({ name: 'acme' }).ok).toBe(false);
		expect(core.customers.rename({ id: 'nope', name: 'X' }).ok).toBe(false);
		expect(core.customers.archive({ id: 'nope' }).ok).toBe(false);
		expect(core.customers.create({ name: '' }).ok).toBe(false);
		expect(batches()).toHaveLength(1);
	});

	it('lists through the core', () => {
		const { core, val } = setup();
		val(core.customers.create({ name: 'B' }));
		val(core.customers.create({ name: 'A' }));
		expect(val(core.customers.list()).map((c) => c.name)).toEqual(['A', 'B']);
		expect(val(core.history.list())).toHaveLength(2);
	});
});

describe('batch', () => {
	const setUp = (c: ReturnType<typeof setup>['core']) =>
		c.batch('Set up', (b) => {
			const cust = b.customers.create({ name: 'Acme' });
			if (!cust.ok) return cust;
			const one = b.projects.create({ customerId: cust.value.id, name: 'One' });
			if (!one.ok) return one;
			return b.projects.create({ customerId: cust.value.id, name: 'Two' });
		});

	it('makes one batch with all its changes', () => {
		const { core, val, batches, changes } = setup();
		val(setUp(core));
		expect(batches()).toHaveLength(1);
		expect(batches()[0]).toMatchObject({ label: 'Set up', actor: 'ui' });
		expect(changes()).toHaveLength(3);
	});

	it('writes nothing when the third command fails', () => {
		const { core, batches, changes } = setup();
		const r = core.batch('Set up', (b) => {
			const cust = b.customers.create({ name: 'Acme' });
			if (!cust.ok) return cust;
			const one = b.projects.create({ customerId: cust.value.id, name: 'One' });
			if (!one.ok) return one;
			return b.projects.create({ customerId: cust.value.id, name: 'one' });
		});
		expect(r.ok).toBe(false);
		expect(batches()).toHaveLength(0);
		expect(changes()).toHaveLength(0);
		expect(core.customers.list()).toEqual({ ok: true, value: [], warnings: [] });
	});

	it('is undone as a whole by one new batch', () => {
		const { core, val, batches, changes, db } = setup();
		val(setUp(core));
		const original = batches()[0];
		val(core.undo({ batchId: original.id }));
		expect(batches()).toHaveLength(2);
		expect(batches().find((b) => b.id !== original.id)!.label).toBe('Undo "Set up"');
		expect(changes()).toHaveLength(6);
		expect(val(core.customers.list({ includeArchived: true }))).toEqual([]);
		expect(val(core.projects.list({ includeArchived: true }))).toEqual([]);
		const history = val(core.history.list());
		expect(history.find((h) => h.id === original.id)!.undone).toBe(true);
		void db;
	});

	it('labels an undo of chosen changes by count', () => {
		const { core, val, batches, changes } = setup();
		val(core.customers.create({ name: 'Acme' }));
		val(core.undo({ changeIds: [changes()[0].id] }));
		expect(batches().map((b) => b.label)).toEqual(['Create customer "Acme"', 'Undo 1 change']);
	});

	it('refuses the outer core inside a batch and writes nothing', () => {
		const { core, batches, changes } = setup();
		expect(() =>
			core.batch('outer', () => {
				core.customers.create({ name: 'Acme' });
				return core.customers.create({ name: 'Beta' });
			})
		).toThrow('A batch is already open: use the core passed to batch().');
		expect(batches()).toHaveLength(0);
		expect(changes()).toHaveLength(0);
	});

	it('validates the label', () => {
		const { core, batches } = setup();
		for (const label of ['', '   ', 'x'.repeat(201)]) {
			const r = core.batch(label, (b) => b.customers.create({ name: 'Acme' }));
			expect(r).toMatchObject({
				ok: false,
				error: { code: 'invalid', fields: { label: 'Label must be 1–200 characters.' } }
			});
		}
		expect(core.batch(' ok ', (b) => b.customers.create({ name: 'Acme' })).ok).toBe(true);
		expect(batches().map((b) => b.label)).toEqual(['ok']);
	});

	it('fails an undo of an unknown batch without storing one', () => {
		const { core, batches } = setup();
		const r = core.undo({ batchId: 'nope' });
		expect(r.ok).toBe(false);
		expect(batches()).toHaveLength(0);
	});
});

describe('users are separate', () => {
	it("cannot see or undo another user's data", () => {
		const { core, other, val, batches } = setup();
		val(core.customers.create({ name: 'Acme' }));
		const mine = batches()[0];
		expect(val(other.customers.list())).toEqual([]);
		expect(val(other.history.list())).toEqual([]);
		const r = other.undo({ batchId: mine.id });
		expect(r.ok).toBe(false);
		expect(!r.ok && r.error.code).toBe('not_found');
		expect(other.customers.rename({ id: val(core.customers.list())[0].id, name: 'X' }).ok).toBe(
			false
		);
		expect(val(core.customers.list())).toHaveLength(1);
		expect(batches()).toHaveLength(1);
	});
});
