import { afterEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { batch, change, customer, user } from '../db/schema';
import { newId } from '../id';
import { nameKey } from './names';
import { fail, ok, type Warning } from './result';
import { clearBatchChecks, registerBatchCheck, type BatchCheck } from './write';
import { runBatch } from './batch';

function setup() {
	const db = createTestDb();
	const userId = newId();
	db.insert(user)
		.values({ id: userId, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const named = (name: string) => ({ id: newId(), userId, name, nameKey: nameKey(name) });
	return { db, userId, named };
}

afterEach(() => {
	for (const e of ['customer', 'project', 'activity', 'location'] as const) clearBatchChecks(e);
});

const warn = (code: string, subject: string): Warning => ({ code, message: code, subject });

describe('batch checks', () => {
	it('sees the final state of the batch', () => {
		const { db, userId, named } = setup();
		let seen = -1;
		registerBatchCheck('customer', (tx) => {
			seen = tx.select().from(customer).all().length;
			return null;
		});
		const res = runBatch(db, userId, 'ui', 'x', (w) => {
			w.insert('customer', named('A'));
			w.insert('customer', named('B'));
			return ok(null);
		});
		expect(res.ok).toBe(true);
		expect(seen).toBe(2);
	});

	it('rolls everything back on a check error', () => {
		const { db, userId, named } = setup();
		registerBatchCheck('customer', () => ({ error: { code: 'conflict', message: 'No.' } }));
		const res = runBatch(db, userId, 'ui', 'x', (w) => {
			w.insert('customer', named('A'));
			return ok(null);
		});
		expect(res).toEqual({ ok: false, error: { code: 'conflict', message: 'No.' } });
		expect(db.select().from(customer).all()).toHaveLength(0);
		expect(db.select().from(batch).all()).toHaveLength(0);
	});

	it('merges warnings after the command own, unique by code and subject', () => {
		const { db, userId, named } = setup();
		registerBatchCheck('customer', () => ({
			warnings: [warn('a', 's1'), warn('a', 's1'), warn('a', 's2')]
		}));
		const res = runBatch(db, userId, 'ui', 'x', (w) => {
			w.insert('customer', named('A'));
			return ok(null, [warn('a', 's2'), warn('b', 's2')]);
		});
		expect(res.ok && res.warnings).toEqual([warn('a', 's2'), warn('b', 's2'), warn('a', 's1')]);
	});

	it('runs no check for a batch without changes or a failed command', () => {
		const { db, userId, named } = setup();
		let runs = 0;
		registerBatchCheck('customer', () => {
			runs++;
			return null;
		});
		runBatch(db, userId, 'ui', 'x', () => ok(null));
		runBatch(db, userId, 'ui', 'x', (w) => {
			w.insert('customer', named('A'));
			return fail('invalid', 'no');
		});
		expect(runs).toBe(0);
	});

	it('passes each touched id once, in registration order, only for touched entities', () => {
		const { db, userId, named } = setup();
		const order: string[] = [];
		let ctx: Parameters<BatchCheck>[1] | undefined;
		registerBatchCheck('customer', (_tx, c) => {
			order.push('first');
			ctx = c;
			return null;
		});
		registerBatchCheck('customer', () => {
			order.push('second');
			return null;
		});
		registerBatchCheck('project', () => {
			order.push('project');
			return null;
		});
		const a = named('A');
		runBatch(
			db,
			userId,
			'ui',
			'x',
			(w) => {
				w.insert('customer', a);
				w.update('customer', a.id, { name: 'B', nameKey: nameKey('B') });
				w.update('customer', a.id, { name: 'C', nameKey: nameKey('C') });
				return ok(null);
			},
			500
		);
		expect(order).toEqual(['first', 'second']);
		expect(ctx).toMatchObject({ userId, touched: [a.id], now: 500 });
		expect(typeof ctx!.batchId).toBe('string');
	});

	it('counts a deleted row as touched', () => {
		const { db, userId, named } = setup();
		const a = named('A');
		runBatch(db, userId, 'ui', 'x', (w) => ok(w.insert('customer', a)));
		const created = db.select().from(change).get()!.id;
		let touched: string[] = [];
		registerBatchCheck('customer', (_tx, c) => {
			touched = c.touched;
			return null;
		});
		runBatch(db, userId, 'ui', 'x', (w) => {
			w.restore('customer', a.id, null, created);
			return ok(null);
		});
		expect(touched).toEqual([a.id]);
	});

	it('collapses subject-less warnings with the same code', () => {
		const { db, userId, named } = setup();
		const bare = (code: string): Warning => ({ code, message: code });
		registerBatchCheck('customer', () => ({ warnings: [bare('a'), bare('a'), bare('b')] }));
		const res = runBatch(db, userId, 'ui', 'x', (w) => {
			w.insert('customer', named('A'));
			return ok(null);
		});
		expect(res.ok && res.warnings).toEqual([bare('a'), bare('b')]);
	});

	it('refuses with the check error even when the command returned warnings', () => {
		const { db, userId, named } = setup();
		registerBatchCheck('customer', () => ({ error: { code: 'conflict', message: 'No.' } }));
		const res = runBatch(db, userId, 'ui', 'x', (w) => {
			w.insert('customer', named('A'));
			return ok(null, [warn('a', 's')]);
		});
		expect(res).toEqual({ ok: false, error: { code: 'conflict', message: 'No.' } });
		expect(db.select().from(customer).all()).toHaveLength(0);
		expect(db.select().from(batch).all()).toHaveLength(0);
	});

	it('rolls back and propagates when a check throws', () => {
		const { db, userId, named } = setup();
		registerBatchCheck('customer', () => {
			throw new Error('boom');
		});
		expect(() =>
			runBatch(db, userId, 'ui', 'x', (w) => {
				w.insert('customer', named('A'));
				return ok(null);
			})
		).toThrow('boom');
		expect(db.select().from(customer).all()).toHaveLength(0);
		expect(db.select().from(batch).all()).toHaveLength(0);
	});
});
