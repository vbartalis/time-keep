import { afterEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { batch, change, customer, user } from '../db/schema';
import { newId } from '../id';
import { fail, ok } from './result';
import { nameKey } from './names';
import { registerRules, rowJson, Writer } from './write';
import { runBatch } from './batch';

function setup() {
	const db = createTestDb();
	const userId = newId();
	db.insert(user)
		.values({ id: userId, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const named = (name: string) => ({ id: newId(), userId, name, nameKey: nameKey(name) });
	const counts = () => ({
		batches: db.select().from(batch).all().length,
		changes: db.select().from(change).all().length,
		customers: db.select().from(customer).all().length
	});
	return { db, userId, named, counts };
}

afterEach(() => registerRules('customer', []));

describe('runBatch and the writer', () => {
	it('records an insert as one batch with one create change', () => {
		const { db, userId, named } = setup();
		const res = runBatch(
			db,
			userId,
			'ui',
			'Create customer',
			(w) => ok(w.insert('customer', named('CompA'))),
			1000
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value).toMatchObject({
			name: 'CompA',
			version: 1,
			createdAt: 1000,
			updatedAt: 1000
		});
		const batches = db.select().from(batch).all();
		expect(batches).toEqual([
			{ id: batches[0].id, userId, actor: 'ui', label: 'Create customer', createdAt: 1000 }
		]);
		const changes = db.select().from(change).all();
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			batchId: batches[0].id,
			seq: 0,
			entity: 'customer',
			entityId: res.value.id,
			op: 'create',
			before: null,
			after: rowJson(db.select().from(customer).get()!),
			shape: 1,
			reverts: null
		});
	});

	it('records an update with before and after and bumps the version', () => {
		const { db, userId, named } = setup();
		const c = named('CompA');
		runBatch(db, userId, 'ui', 'create', (w) => ok(w.insert('customer', c)), 1000);
		const before = rowJson(db.select().from(customer).get()!);
		const res = runBatch(
			db,
			userId,
			'ui',
			'rename',
			(w) => ok(w.update('customer', c.id, { name: 'CompB', nameKey: 'compb' })),
			2000
		);
		expect(res.ok && res.value).toMatchObject({
			name: 'CompB',
			version: 2,
			updatedAt: 2000,
			createdAt: 1000
		});
		const after = rowJson(db.select().from(customer).get()!);
		const last = db
			.select()
			.from(change)
			.all()
			.find((ch) => ch.op === 'update');
		expect(last).toMatchObject({ before, after, seq: 0 });
	});

	it('records nothing and stores no batch for an unchanged patch', () => {
		const { db, userId, named, counts } = setup();
		const c = named('CompA');
		runBatch(db, userId, 'ui', 'create', (w) => ok(w.insert('customer', c)));
		const res = runBatch(db, userId, 'ui', 'rename', (w) =>
			ok(w.update('customer', c.id, { name: 'CompA', nameKey: 'compa' }))
		);
		expect(res).toEqual({ ok: true, value: null, warnings: [] });
		expect(counts()).toEqual({ batches: 1, changes: 1, customers: 1 });
		expect(db.select().from(customer).get()!.version).toBe(1);
	});

	it('numbers two writes in one batch 0 and 1', () => {
		const { db, userId, named } = setup();
		runBatch(db, userId, 'ui', 'two', (w) => {
			w.insert('customer', named('A'));
			w.insert('customer', named('B'));
			return ok(w.changeCount);
		});
		const changes = db.select().from(change).all();
		expect(new Set(changes.map((ch) => ch.batchId)).size).toBe(1);
		expect(changes.map((ch) => ch.seq).sort()).toEqual([0, 1]);
	});

	it('writes nothing when fn returns a failure after writing', () => {
		const { db, userId, named, counts } = setup();
		const res = runBatch(db, userId, 'ui', 'bad', (w) => {
			w.insert('customer', named('A'));
			return fail('invalid', 'Nope.');
		});
		expect(res).toEqual({ ok: false, error: { code: 'invalid', message: 'Nope.' } });
		expect(counts()).toEqual({ batches: 0, changes: 0, customers: 0 });
	});

	it('aborts with a rule error and writes nothing', () => {
		const { db, userId, named, counts } = setup();
		registerRules('customer', [
			() => null,
			(_tx, row) => (row.name === 'Bad' ? { code: 'invalid', message: 'Bad name.' } : null)
		]);
		const res = runBatch(db, userId, 'ui', 'rule', (w) => {
			w.insert('customer', named('Good'));
			w.insert('customer', named('Bad'));
			return ok(null);
		});
		expect(res).toEqual({ ok: false, error: { code: 'invalid', message: 'Bad name.' } });
		expect(counts()).toEqual({ batches: 0, changes: 0, customers: 0 });
	});

	it('maps a unique violation to conflict on the name field', () => {
		const { db, userId, named, counts } = setup();
		runBatch(db, userId, 'ui', 'a', (w) => ok(w.insert('customer', named('Ügyfél'))));
		const res = runBatch(db, userId, 'ui', 'b', (w) => ok(w.insert('customer', named('ügyfél'))));
		expect(res).toEqual({
			ok: false,
			error: {
				code: 'conflict',
				message: 'That name is already taken.',
				fields: { name: 'That name is already taken.' }
			}
		});
		expect(counts()).toEqual({ batches: 1, changes: 1, customers: 1 });
	});

	it('rolls back when fn catches a rule failure and returns ok', () => {
		const { db, userId, named, counts } = setup();
		registerRules('customer', [() => ({ code: 'invalid', message: 'Rule broke.' })]);
		const res = runBatch(db, userId, 'ui', 'swallow', (w) => {
			try {
				w.insert('customer', named('A'));
			} catch {
				/* a command that wrongly swallows the failure */
			}
			return ok(null);
		});
		expect(res).toEqual({ ok: false, error: { code: 'invalid', message: 'Rule broke.' } });
		expect(counts()).toEqual({ batches: 0, changes: 0, customers: 0 });
	});

	it('rolls back when fn catches a constraint error and returns ok', () => {
		const { db, userId, named, counts } = setup();
		runBatch(db, userId, 'ui', 'a', (w) => ok(w.insert('customer', named('A'))));
		const res = runBatch(db, userId, 'ui', 'b', (w) => {
			w.insert('customer', named('B'));
			try {
				w.insert('customer', named('a'));
			} catch {
				/* swallowed */
			}
			return ok(null);
		});
		expect(res).toMatchObject({
			ok: false,
			error: { code: 'conflict', fields: { name: expect.any(String) } }
		});
		expect(counts()).toEqual({ batches: 1, changes: 1, customers: 1 });
	});

	it('rolls back on a caught not_found from update', () => {
		const { db, userId, named, counts } = setup();
		const res = runBatch(db, userId, 'ui', 'x', (w) => {
			w.insert('customer', named('A'));
			try {
				w.update('customer', 'missing', { name: 'B' });
			} catch {
				/* swallowed */
			}
			return ok(null);
		});
		expect(res).toEqual({ ok: false, error: { code: 'not_found', message: 'Not found.' } });
		expect(counts()).toEqual({ batches: 0, changes: 0, customers: 0 });
	});

	it('ignores undefined values and non-columns in an update patch', () => {
		const { db, userId, named, counts } = setup();
		const c = named('A');
		runBatch(db, userId, 'ui', 'c', (w) => ok(w.insert('customer', c)));
		const res = runBatch(db, userId, 'ui', 'u', (w) =>
			ok(w.update('customer', c.id, { name: undefined, bogus: 1, customerId: 'x' }))
		);
		expect(res).toEqual({ ok: true, value: null, warnings: [] });
		expect(counts()).toEqual({ batches: 1, changes: 1, customers: 1 });
		expect(db.select().from(customer).get()).toMatchObject({ name: 'A', version: 1 });
	});

	it('maps a foreign key violation to conflict', () => {
		const { db, userId, named, counts } = setup();
		const res = runBatch(db, userId, 'ui', 'p', (w) =>
			ok(w.insert('project', { ...named('P'), customerId: 'missing' }))
		);
		expect(res).toEqual({
			ok: false,
			error: { code: 'conflict', message: 'Other records depend on this.' }
		});
		expect(counts()).toEqual({ batches: 0, changes: 0, customers: 0 });
	});

	it('rethrows other errors and writes nothing', () => {
		const { db, userId, named, counts } = setup();
		expect(() =>
			runBatch(db, userId, 'ui', 'x', (w) => {
				w.insert('customer', named('A'));
				throw new Error('boom');
			})
		).toThrow('boom');
		expect(counts()).toEqual({ batches: 0, changes: 0, customers: 0 });
	});

	it('records archive and unarchive ops', () => {
		const { db, userId, named } = setup();
		const c = named('A');
		runBatch(db, userId, 'ui', 'c', (w) => ok(w.insert('customer', c)));
		runBatch(db, userId, 'ui', 'a', (w) =>
			ok(w.update('customer', c.id, { archivedAt: 5 }, 'archive'))
		);
		runBatch(db, userId, 'ui', 'u', (w) =>
			ok(w.update('customer', c.id, { archivedAt: null }, 'unarchive'))
		);
		expect(
			db
				.select()
				.from(change)
				.all()
				.map((ch) => ch.op)
				.sort()
		).toEqual(['archive', 'create', 'unarchive']);
		expect(db.select().from(customer).get()!.version).toBe(3);
	});

	it("does not update another user's row", () => {
		const { db, userId, named } = setup();
		const other = newId();
		db.insert(user)
			.values({ id: other, username: 'o', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
			.run();
		const c = named('A');
		runBatch(db, userId, 'ui', 'c', (w) => ok(w.insert('customer', c)));
		const res = runBatch(db, other, 'ui', 'r', (w) =>
			ok(w.update('customer', c.id, { name: 'B' }))
		);
		expect(res.ok).toBe(false);
		expect(db.select().from(customer).get()!.name).toBe('A');
	});

	it('removes a row and records a delete with the row before and no after', () => {
		const { db, userId, named, counts } = setup();
		const c = named('A');
		runBatch(db, userId, 'ui', 'c', (w) => ok(w.insert('customer', c)), 1000);
		const res = runBatch(db, userId, 'ui', 'd', (w) => ok(w.remove('customer', c.id)), 2000);
		expect(res.ok && res.value).toMatchObject({ id: c.id, name: 'A' });
		expect(counts()).toEqual({ batches: 2, changes: 2, customers: 0 });
		const del = db
			.select()
			.from(change)
			.all()
			.find((ch) => ch.op === 'delete')!;
		expect(del).toMatchObject({ entityId: c.id, after: null, reverts: null, seq: 0 });
		expect(JSON.parse(del.before!)).toMatchObject({ id: c.id, name: 'A' });
	});

	it("refuses to remove a missing or another user's row as not found", () => {
		const { db, userId, named } = setup();
		const c = named('A');
		runBatch(db, userId, 'ui', 'c', (w) => ok(w.insert('customer', c)), 1000);
		const other = newId();
		db.insert(user)
			.values({ id: other, username: 'o', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
			.run();
		for (const [uid, id] of [
			[userId, 'nope'],
			[other, c.id]
		]) {
			const res = runBatch(db, uid, 'ui', 'd', (w) => ok(w.remove('customer', id)));
			expect(res).toMatchObject({ ok: false, error: { code: 'not_found' } });
		}
		expect(db.select().from(customer).all()).toHaveLength(1);
	});
});

describe('restore', () => {
	function created() {
		const s = setup();
		const c = s.named('A');
		runBatch(s.db, s.userId, 'ui', 'c', (w) => ok(w.insert('customer', c)), 1000);
		const createChange = s.db.select().from(change).get()!;
		return { ...s, c, createChange };
	}

	it('deletes the row when before is null and records a delete', () => {
		const { db, userId, c, createChange } = created();
		runBatch(db, userId, 'ui', 'undo', (w) => {
			w.restore('customer', c.id, null, createChange.id);
			return ok(null);
		});
		expect(db.select().from(customer).all()).toEqual([]);
		const del = db
			.select()
			.from(change)
			.all()
			.find((ch) => ch.op === 'delete')!;
		expect(del).toMatchObject({
			before: createChange.after,
			after: null,
			reverts: createChange.id,
			entityId: c.id
		});
	});

	it('re-inserts an absent row with a raised version and records a create', () => {
		const { db, userId, c, createChange } = created();
		runBatch(
			db,
			userId,
			'ui',
			'undo',
			(w) => {
				w.restore('customer', c.id, null, createChange.id);
				return ok(null);
			},
			4000
		);
		const before = JSON.parse(createChange.after!);
		runBatch(
			db,
			userId,
			'ui',
			'redo',
			(w) => {
				w.restore('customer', c.id, before, createChange.id);
				return ok(null);
			},
			5000
		);
		const row = db.select().from(customer).get()!;
		const strip = (r: Record<string, unknown>) => {
			const rest = { ...r };
			delete rest.version;
			delete rest.updatedAt;
			return rest;
		};
		expect(strip(row)).toEqual(strip(before));
		expect(row).toMatchObject({ version: 2, updatedAt: 5000 });
		const re = db
			.select()
			.from(change)
			.all()
			.find((ch) => ch.op === 'create' && ch.reverts);
		expect(re).toMatchObject({ before: null, after: rowJson(row) });
	});

	it('restores the stored columns of an existing row, raising its version', () => {
		const { db, userId, c } = created();
		runBatch(
			db,
			userId,
			'ui',
			'r',
			(w) => ok(w.update('customer', c.id, { name: 'B', nameKey: 'b' })),
			2000
		);
		const upd = db
			.select()
			.from(change)
			.all()
			.find((ch) => ch.op === 'update')!;
		runBatch(
			db,
			userId,
			'ui',
			'undo',
			(w) => {
				w.restore('customer', c.id, JSON.parse(upd.before!), upd.id);
				return ok(null);
			},
			3000
		);
		const row = db.select().from(customer).get()!;
		expect(row).toMatchObject({
			name: 'A',
			nameKey: 'a',
			version: 3,
			updatedAt: 3000,
			createdAt: 1000
		});
		const rev = db
			.select()
			.from(change)
			.all()
			.find((ch) => ch.reverts === upd.id)!;
		expect(rev).toMatchObject({ op: 'update', before: upd.after, after: rowJson(row) });
	});

	it('runs the rules on a restored row', () => {
		const { db, userId, c } = created();
		runBatch(db, userId, 'ui', 'r', (w) =>
			ok(w.update('customer', c.id, { name: 'B', nameKey: 'b' }))
		);
		const upd = db
			.select()
			.from(change)
			.all()
			.find((ch) => ch.op === 'update')!;
		registerRules('customer', [
			(_tx, row) => (row.name === 'A' ? { code: 'archived', message: 'No.' } : null)
		]);
		const res = runBatch(db, userId, 'ui', 'undo', (w) => {
			w.restore('customer', c.id, JSON.parse(upd.before!), upd.id);
			return ok(null);
		});
		expect(res).toEqual({ ok: false, error: { code: 'archived', message: 'No.' } });
		expect(db.select().from(customer).get()!.name).toBe('B');
	});
});

describe('rowJson', () => {
	it('serialises with sorted keys regardless of property order', () => {
		expect(rowJson({ b: 1, a: null })).toBe(rowJson({ a: null, b: 1 }));
		expect(rowJson({ b: 1, a: null })).toBe('{"a":null,"b":1}');
	});
});

it('exposes the transaction and time', () => {
	const { db, userId } = setup();
	runBatch(
		db,
		userId,
		'system',
		'x',
		(w) => {
			expect(w).toBeInstanceOf(Writer);
			expect(w.now).toBe(42);
			expect(w.tx).toBeDefined();
			return ok(null);
		},
		42
	);
});
