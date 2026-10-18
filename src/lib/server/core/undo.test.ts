import { desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { batch, change, customer, project, user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import { listHistory } from './history';
import { archive, createCustomer, createProject, rename, unarchive } from './reference';
import type { Result } from './result';
import { undo, undoLabel } from './undo';
import type { Writer } from './write';

function setup() {
	const db = createTestDb();
	const mkUser = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const userId = mkUser('u');
	const other = mkUser('o');
	let clock = 1000;
	const run = <T>(fn: (w: Writer) => Result<T>, label = 'test', uid = userId): Result<T> =>
		runBatch(db, uid, 'ui', label, fn, clock++);
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const counts = () => ({
		batches: db.select().from(batch).all().length,
		changes: db.select().from(change).all().length
	});
	/** The newest batch's id and its changes in seq order. */
	const last = () => {
		const b = db.select().from(batch).orderBy(desc(batch.createdAt)).limit(1).get()!;
		const changes = db
			.select()
			.from(change)
			.where(eq(change.batchId, b.id))
			.orderBy(change.seq)
			.all();
		return { id: b.id, changes };
	};
	const getCustomer = (id: string) => db.select().from(customer).where(eq(customer.id, id)).get();
	const getProject = (id: string) => db.select().from(project).where(eq(project.id, id)).get();
	const mkCustomer = (name: string, uid = userId) =>
		val(run((w) => createCustomer(w, { name }), `Create ${name}`, uid));
	const undoRun = (input: unknown, label = 'undo', uid = userId) =>
		run((w) => undo(w, input), label, uid);
	return {
		db,
		userId,
		other,
		run,
		val,
		counts,
		last,
		getCustomer,
		getProject,
		mkCustomer,
		undoRun
	};
}

const err = <T>(r: Result<T>) => (r.ok ? null : r.error);

describe('undo of a single change', () => {
	it('removes a created row and records the revert', () => {
		const { mkCustomer, last, undoRun, val, getCustomer } = setup();
		const c = mkCustomer('Acme');
		const created = last();
		const r = val(undoRun({ batchId: created.id }));
		expect(r.reverted).toEqual([created.changes[0].id]);
		expect(getCustomer(c.id)).toBeUndefined();
		const u = last();
		expect(u.changes).toHaveLength(1);
		expect(u.changes[0]).toMatchObject({ op: 'delete', reverts: created.changes[0].id });
	});

	it('restores the name after a rename and raises the version', () => {
		const { mkCustomer, run, last, undoRun, val, getCustomer } = setup();
		const c = mkCustomer('Acme');
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'Beta' })));
		val(undoRun({ batchId: last().id }));
		expect(getCustomer(c.id)).toMatchObject({ name: 'Acme', nameKey: 'acme', version: 3 });
	});

	it('restores an archived row to active, and an unarchived one to archived', () => {
		const { mkCustomer, run, last, undoRun, val, getCustomer } = setup();
		const c = mkCustomer('Acme');
		val(run((w) => archive(w, 'customer', { id: c.id })));
		const archivedAt = getCustomer(c.id)!.archivedAt;
		expect(archivedAt).not.toBeNull();
		val(undoRun({ batchId: last().id }));
		expect(getCustomer(c.id)!.archivedAt).toBeNull();

		val(run((w) => archive(w, 'customer', { id: c.id })));
		const again = getCustomer(c.id)!.archivedAt;
		val(run((w) => unarchive(w, 'customer', { id: c.id })));
		val(undoRun({ batchId: last().id }));
		expect(getCustomer(c.id)!.archivedAt).toBe(again);
	});
});

describe('undo of several changes', () => {
	it('undoes every change of a batch, newest first', () => {
		const { run, last, undoRun, val, getCustomer, getProject, counts } = setup();
		const made = val(
			run((w) => {
				const c = createCustomer(w, { name: 'Acme' });
				if (!c.ok) return c;
				const p = createProject(w, { customerId: c.value.id, name: 'Site' });
				if (!p.ok) return p;
				const r = rename(w, 'customer', { id: c.value.id, name: 'Acme Ltd' });
				if (!r.ok) return r;
				return { ok: true, value: { c: c.value, p: p.value }, warnings: [] };
			})
		);
		const b = last();
		expect(b.changes).toHaveLength(3);
		const r = val(undoRun({ batchId: b.id }));
		expect(r.reverted).toEqual([b.changes[2].id, b.changes[1].id, b.changes[0].id]);
		expect(getCustomer(made.c.id)).toBeUndefined();
		expect(getProject(made.p.id)).toBeUndefined();
		expect(last().changes.map((c) => c.reverts)).toEqual(r.reverted);
		expect(counts().batches).toBe(2);
	});

	it('undoes chosen changes across two batches', () => {
		const { mkCustomer, run, last, undoRun, val, getCustomer } = setup();
		const a = mkCustomer('A');
		const b = mkCustomer('B');
		val(run((w) => rename(w, 'customer', { id: a.id, name: 'A2' })));
		const renameA = last().changes[0];
		val(run((w) => rename(w, 'customer', { id: b.id, name: 'B2' })));
		const renameB = last().changes[0];
		const r = val(undoRun({ changeIds: [renameA.id, renameB.id] }));
		expect(r.reverted).toEqual([renameB.id, renameA.id]);
		expect(getCustomer(a.id)!.name).toBe('A');
		expect(getCustomer(b.id)!.name).toBe('B');
		expect(last().changes).toHaveLength(2);
	});
});

describe('undo refused', () => {
	it('undoes the rest of a partly undone batch', () => {
		const { run, last, undoRun, val, getCustomer, db, userId } = setup();
		const made = val(
			run((w) => {
				const c = createCustomer(w, { name: 'Acme' });
				if (!c.ok) return c;
				const p = createProject(w, { customerId: c.value.id, name: 'Site' });
				if (!p.ok) return p;
				const r = rename(w, 'customer', { id: c.value.id, name: 'Acme Ltd' });
				if (!r.ok) return r;
				return c;
			})
		);
		const b = last();
		val(undoRun({ changeIds: [b.changes[2].id] }));
		expect(getCustomer(made.id)!.name).toBe('Acme');
		const r = val(undoRun({ batchId: b.id }));
		expect(r.reverted).toEqual([b.changes[1].id, b.changes[0].id]);
		expect(getCustomer(made.id)).toBeUndefined();
		const entry = val(listHistory(db, userId)).find((h) => h.id === b.id)!;
		expect(entry.undone).toBe(true);
		expect(err(undoRun({ batchId: b.id }))).toEqual({
			code: 'conflict',
			message: 'That batch is already undone.'
		});
	});

	it('refuses a change that is already undone', () => {
		const { mkCustomer, last, undoRun, val, counts } = setup();
		mkCustomer('Acme');
		const b = last();
		val(undoRun({ batchId: b.id }));
		const before = counts();
		expect(err(undoRun({ batchId: b.id }))).toEqual({
			code: 'conflict',
			message: 'That batch is already undone.'
		});
		expect(err(undoRun({ changeIds: [b.changes[0].id] }))?.code).toBe('conflict');
		expect(counts()).toEqual(before);
	});

	it('refuses when a later batch touched the row, naming it, and writes nothing', () => {
		const { mkCustomer, run, last, undoRun, val, counts, getCustomer } = setup();
		const c = mkCustomer('Acme');
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'Beta' }), 'Rename to Beta'));
		const first = last();
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'Gamma' }), 'Rename to Gamma'));
		val(run((w) => archive(w, 'customer', { id: c.id }), 'Archive Gamma'));
		const before = counts();
		expect(err(undoRun({ batchId: first.id }))).toEqual({
			code: 'conflict',
			message:
				'Later changes touch the same record: Archive Gamma; Rename to Gamma. Undo those first.'
		});
		expect(counts()).toEqual(before);
		expect(getCustomer(c.id)!.name).toBe('Gamma');
	});

	it('allows the earlier change once the later one is undone', () => {
		const { mkCustomer, run, last, undoRun, val, getCustomer } = setup();
		const c = mkCustomer('Acme');
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'Beta' })));
		const first = last();
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'Gamma' })));
		const second = last();
		val(undoRun({ batchId: second.id }));
		expect(getCustomer(c.id)!.name).toBe('Beta');
		val(undoRun({ batchId: first.id }));
		expect(getCustomer(c.id)!.name).toBe('Acme');
	});

	it('refuses removing a customer that a later batch gave a project', () => {
		const { mkCustomer, run, last, undoRun, val, counts, getCustomer, db } = setup();
		const created = mkCustomer('Acme');
		const b = db.select().from(batch).all()[0];
		val(run((w) => createProject(w, { customerId: created.id, name: 'Site' })));
		const before = counts();
		expect(last().id).not.toBe(b.id);
		expect(err(undoRun({ batchId: b.id }))).toEqual({
			code: 'conflict',
			message: 'Other records depend on this.'
		});
		expect(counts()).toEqual(before);
		expect(getCustomer(created.id)).toBeDefined();
	});

	it('refuses unarchiving a project whose customer was archived since', () => {
		const { mkCustomer, run, last, undoRun, val, counts, getProject } = setup();
		const c = mkCustomer('Acme');
		const p = val(run((w) => createProject(w, { customerId: c.id, name: 'Site' })));
		val(run((w) => archive(w, 'project', { id: p.id })));
		const archived = last();
		val(run((w) => archive(w, 'customer', { id: c.id })));
		const before = counts();
		expect(err(undoRun({ batchId: archived.id }))).toEqual({
			code: 'archived',
			message: 'The customer is archived.'
		});
		expect(counts()).toEqual(before);
		expect(getProject(p.id)!.archivedAt).not.toBeNull();
	});

	it('refuses a change written under an older shape', () => {
		const { mkCustomer, last, undoRun, db, counts } = setup();
		mkCustomer('Acme');
		const b = last();
		db.update(change).set({ shape: 0 }).where(eq(change.id, b.changes[0].id)).run();
		const before = counts();
		expect(err(undoRun({ batchId: b.id }))).toEqual({
			code: 'conflict',
			message: 'That change was made before an upgrade and cannot be undone.'
		});
		expect(counts()).toEqual(before);
	});

	it("treats unknown ids and another user's as not found", () => {
		const { mkCustomer, last, undoRun, other, counts } = setup();
		mkCustomer('Mine');
		const mine = last();
		mkCustomer('Theirs', other);
		const theirs = last();
		const before = counts();
		expect(err(undoRun({ batchId: theirs.id }))?.code).toBe('not_found');
		expect(err(undoRun({ batchId: 'nope' }))?.code).toBe('not_found');
		expect(err(undoRun({ changeIds: [theirs.changes[0].id] }))?.code).toBe('not_found');
		expect(err(undoRun({ changeIds: [mine.changes[0].id, 'nope'] }))?.code).toBe('not_found');
		expect(err(undoRun({ batchId: mine.id }, 'undo', other))?.code).toBe('not_found');
		expect(counts()).toEqual(before);
	});

	it('rejects malformed input as invalid', () => {
		const { undoRun } = setup();
		expect(err(undoRun({}))?.code).toBe('invalid');
		expect(err(undoRun(null))?.code).toBe('invalid');
		expect(err(undoRun({ changeIds: [] }))?.code).toBe('invalid');
		expect(err(undoRun({ changeIds: Array.from({ length: 1001 }, (_, i) => `c${i}`) }))?.code).toBe(
			'invalid'
		);
		expect(err(undoRun({ batchId: 'a', changeIds: ['b'] }))?.code).toBe('invalid');
	});
});

describe('undo across schema growth and clocks', () => {
	it('still undoes a change recorded before a column was added', () => {
		const { mkCustomer, run, last, undoRun, val, getCustomer, db } = setup();
		const c = mkCustomer('Acme');
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'Beta' })));
		const renamed = last().changes[0];
		// Simulate a column added later: the stored `after` lacks it.
		const after = JSON.parse(renamed.after!);
		delete after.archivedAt;
		db.update(change)
			.set({ after: JSON.stringify(after) })
			.where(eq(change.id, renamed.id))
			.run();
		val(undoRun({ changeIds: [renamed.id] }));
		expect(getCustomer(c.id)!.name).toBe('Acme');
	});

	it('refuses with a plain message when no standing later change explains the row', () => {
		const { mkCustomer, last, undoRun, db, counts } = setup();
		const c = mkCustomer('Acme');
		const created = last();
		db.update(customer).set({ name: 'Elsewhere' }).where(eq(customer.id, c.id)).run();
		const before = counts();
		expect(err(undoRun({ batchId: created.id }))).toEqual({
			code: 'conflict',
			message: 'That record has changed since; it cannot be undone.'
		});
		expect(counts()).toEqual(before);
	});

	it('orders same-millisecond batches by creation and undoes them together', () => {
		const { db, userId, val, getCustomer } = setup();
		const now = 5000;
		const a = val(
			runBatch(db, userId, 'ui', 'First', (w) => createCustomer(w, { name: 'A' }), now)
		);
		val(
			runBatch(
				db,
				userId,
				'ui',
				'Second',
				(w) => rename(w, 'customer', { id: a.id, name: 'B' }),
				now
			)
		);
		const h = val(listHistory(db, userId));
		expect(h.map((b) => b.label)).toEqual(['Second', 'First']);
		expect(h[0].createdAt).toBeGreaterThan(h[1].createdAt);
		const ids = [h[1].changes[0].id, h[0].changes[0].id];
		const r = val(runBatch(db, userId, 'ui', 'Undo', (w) => undo(w, { changeIds: ids }), now));
		expect(r.reverted).toEqual([h[0].changes[0].id, h[1].changes[0].id]);
		expect(getCustomer(a.id)).toBeUndefined();
	});
});

describe('redo', () => {
	it('restores the post-change state and shows the original as not undone', () => {
		const { mkCustomer, run, last, undoRun, val, getCustomer, db, userId } = setup();
		const c = mkCustomer('Acme');
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'Beta' }), 'Rename'));
		const original = last();
		val(undoRun({ batchId: original.id }, 'Undo "Rename"'));
		const undoBatch = last();
		expect(getCustomer(c.id)!.name).toBe('Acme');
		val(undoRun({ batchId: undoBatch.id }, 'Undo "Undo "Rename""'));
		const redo = last();
		expect(getCustomer(c.id)!.name).toBe('Beta');

		const history = val(listHistory(db, userId));
		const byId = new Map(history.map((b) => [b.id, b]));
		expect(byId.get(original.id)).toMatchObject({ undone: false, undoneBy: null });
		expect(byId.get(original.id)!.changes[0]).toMatchObject({ undone: false, undoneBy: null });
		expect(byId.get(undoBatch.id)).toMatchObject({ undone: true, undoneBy: redo.id });
		expect(byId.get(redo.id)).toMatchObject({ undone: false, undoneBy: null });

		// The original can be undone again after the redo.
		val(undoRun({ batchId: original.id }));
		expect(getCustomer(c.id)!.name).toBe('Acme');
	});
});

describe('undoLabel', () => {
	it('names the batch or counts the chosen changes', () => {
		expect(undoLabel({ batchId: 'b' }, 'Rename customer')).toBe('Undo "Rename customer"');
		expect(undoLabel({ changeIds: ['a', 'b', 'c'] })).toBe('Undo 3 changes');
		expect(undoLabel({ changeIds: ['a', 'a'] })).toBe('Undo 1 change');
	});
});
