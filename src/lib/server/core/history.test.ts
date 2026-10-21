import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import { getHistory, listHistory, pageHistory } from './history';
import { createCustomer, rename } from './reference';
import type { Result } from './result';
import { undo } from './undo';

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
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const mkCustomer = (name: string, uid = userId) =>
		val(runBatch(db, uid, 'ui', `Create ${name}`, (w) => createCustomer(w, { name }), clock++));
	return { db, userId, other, val, mkCustomer, tick: () => clock++ };
}

const err = <T>(r: Result<T>) => (r.ok ? null : r.error);

describe('listHistory', () => {
	it('lists the user’s batches newest first with parsed changes', () => {
		const { db, userId, other, val, mkCustomer, tick } = setup();
		const c = mkCustomer('Acme');
		mkCustomer('Theirs', other);
		val(
			runBatch(
				db,
				userId,
				'agent',
				'Rename',
				(w) => rename(w, 'customer', { id: c.id, name: 'Beta' }),
				tick()
			)
		);
		const h = val(listHistory(db, userId));
		expect(h.map((b) => b.label)).toEqual(['Rename', 'Create Acme']);
		expect(h[0]).toMatchObject({ actor: 'agent', undone: false, undoneBy: null });
		const ch = h[0].changes[0];
		expect(ch).toMatchObject({
			seq: 0,
			entity: 'customer',
			entityId: c.id,
			op: 'update',
			reverts: null,
			undone: false,
			undoneBy: null
		});
		expect(ch.before).toMatchObject({ name: 'Acme', version: 1 });
		expect(ch.after).toMatchObject({ name: 'Beta', version: 2 });
		expect(h[1].changes[0].before).toBeNull();
	});

	it('marks undone batches and changes with the undoing batch', () => {
		const { db, userId, val, mkCustomer, tick } = setup();
		mkCustomer('Acme');
		const [created] = val(listHistory(db, userId));
		val(runBatch(db, userId, 'ui', 'Undo', (w) => undo(w, { batchId: created.id }), tick()));
		const [u, orig] = val(listHistory(db, userId));
		expect(u.changes[0].reverts).toBe(orig.changes[0].id);
		expect(orig).toMatchObject({ undone: true, undoneBy: u.id });
		expect(orig.changes[0]).toMatchObject({ undone: true, undoneBy: u.id });
		expect(u).toMatchObject({ undone: false, undoneBy: null });
	});

	it('pages with before and limit', () => {
		const { db, userId, val, mkCustomer } = setup();
		for (let i = 0; i < 5; i++) mkCustomer(`C${i}`);
		const all = val(listHistory(db, userId));
		expect(all.map((b) => b.label)).toEqual([
			'Create C4',
			'Create C3',
			'Create C2',
			'Create C1',
			'Create C0'
		]);
		const page1 = val(listHistory(db, userId, { limit: 2 }));
		expect(page1.map((b) => b.label)).toEqual(['Create C4', 'Create C3']);
		const page2 = val(listHistory(db, userId, { before: page1[1].id, limit: 2 }));
		expect(page2.map((b) => b.label)).toEqual(['Create C2', 'Create C1']);
		const page3 = val(listHistory(db, userId, { before: page2[1].id, limit: 2 }));
		expect(page3.map((b) => b.label)).toEqual(['Create C0']);
	});

	it('defaults to 50 and caps the limit at 200', () => {
		const { db, userId, val, mkCustomer } = setup();
		for (let i = 0; i < 55; i++) mkCustomer(`C${i}`);
		expect(val(listHistory(db, userId))).toHaveLength(50);
		expect(val(listHistory(db, userId, { limit: 200 }))).toHaveLength(55);
		expect(err(listHistory(db, userId, { limit: 201 }))?.code).toBe('invalid');
		expect(err(listHistory(db, userId, { limit: 0 }))?.code).toBe('invalid');
	});

	it("treats an unknown or another user's before as not found", () => {
		const { db, userId, other, val, mkCustomer } = setup();
		mkCustomer('Theirs', other);
		const [theirs] = val(listHistory(db, other));
		expect(err(listHistory(db, userId, { before: theirs.id }))?.code).toBe('not_found');
		expect(err(listHistory(db, userId, { before: 'nope' }))?.code).toBe('not_found');
	});
});

describe('getHistory', () => {
	it('answers the batch exactly as the list builds it', () => {
		const { db, userId, val, tick } = setup();
		const made = val(
			runBatch(
				db,
				userId,
				'ui',
				'Two',
				(w) => {
					const a = createCustomer(w, { name: 'A' });
					return a.ok ? createCustomer(w, { name: 'B' }) : a;
				},
				tick()
			)
		);
		expect(made).toBeTruthy();
		const [two] = val(listHistory(db, userId));
		val(
			runBatch(
				db,
				userId,
				'ui',
				'Undo one',
				(w) => undo(w, { changeIds: [two.changes[0].id] }),
				tick()
			)
		);
		const listed = val(listHistory(db, userId)).find((b) => b.id === two.id);
		expect(listed?.changes).toHaveLength(2);
		expect(listed?.changes.map((c) => c.undone)).toEqual([true, false]);
		expect(val(getHistory(db, userId, { batchId: two.id }))).toEqual(listed);
	});

	it('does not find unknown or another user’s batches', () => {
		const { db, userId, other, val, mkCustomer } = setup();
		mkCustomer('Theirs', other);
		const [theirs] = val(listHistory(db, other));
		expect(getHistory(db, userId, { batchId: theirs.id })).toMatchObject({
			ok: false,
			error: { code: 'not_found', message: 'Not found.' }
		});
		expect(getHistory(db, userId, { batchId: 'nope' })).toMatchObject({
			ok: false,
			error: { code: 'not_found' }
		});
	});

	it('rejects input without a batch id', () => {
		const { db, userId } = setup();
		expect(getHistory(db, userId, {})).toMatchObject({ ok: false, error: { code: 'invalid' } });
	});
});

describe('history.page', () => {
	/** n batches; ids newest first, so ids[k - 1] is the k-th newest. */
	function many(n: number) {
		const s = setup();
		for (let i = 0; i < n; i++) s.mkCustomer(`C${i}`);
		const ids = s.val(listHistory(s.db, s.userId, { limit: 200 })).map((b) => b.id);
		return { ...s, ids };
	}

	it('is empty with no batches', () => {
		const { db, userId, val } = setup();
		expect(val(pageHistory(db, userId))).toEqual({
			total: 0,
			position: 1,
			hasNewer: false,
			newerBefore: null
		});
	});

	it('is the newest page with no before', () => {
		const { db, userId, val } = many(120);
		expect(val(pageHistory(db, userId))).toEqual({
			total: 120,
			position: 1,
			hasNewer: false,
			newerBefore: null
		});
	});

	it('places a page by its before', () => {
		const { db, userId, val, ids } = many(120);
		expect(val(pageHistory(db, userId, { before: ids[49] }))).toEqual({
			total: 120,
			position: 51,
			hasNewer: true,
			newerBefore: null
		});
		expect(val(pageHistory(db, userId, { before: ids[99] }))).toEqual({
			total: 120,
			position: 101,
			hasNewer: true,
			newerBefore: ids[49]
		});
	});

	it('honours limit and clamps to the newest page', () => {
		const { db, userId, val, ids } = many(120);
		expect(val(pageHistory(db, userId, { before: ids[29], limit: 20 }))).toMatchObject({
			position: 31,
			hasNewer: true,
			newerBefore: ids[9]
		});
		expect(val(pageHistory(db, userId, { before: ids[44] }))).toMatchObject({
			position: 46,
			hasNewer: true,
			newerBefore: null
		});
	});

	it('does not count or accept another user’s batches', () => {
		const { db, userId, other, val, mkCustomer } = setup();
		mkCustomer('Mine');
		mkCustomer('Theirs', other);
		const theirs = val(listHistory(db, other))[0];
		expect(val(pageHistory(db, userId)).total).toBe(1);
		expect(err(pageHistory(db, userId, { before: theirs.id }))).toMatchObject({
			code: 'not_found'
		});
	});
});
