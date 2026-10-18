import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import { createEntry, deleteEntry, startTimer, updateEntry } from './entries';
import { createCustomer, createProject } from './reference';
import type { Result } from './result';
import { undo } from './undo';
import type { Writer } from './write';

const H = 3_600_000;
/** 2026-10-18T09:00:00Z. */
const T9 = Date.UTC(2026, 9, 18, 9);

function setup() {
	const db = createTestDb();
	const userId = newId();
	db.insert(user)
		.values({ id: userId, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	let clock = T9;
	const run = <T>(fn: (w: Writer) => Result<T>, now = clock + 1): Result<T> => {
		clock = Math.max(clock + 1, now);
		return runBatch(db, userId, 'ui', 'test', fn, now);
	};
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const project = (name: string) =>
		val(
			run((w) => {
				const c = createCustomer(w, { name: `${name} customer` });
				if (!c.ok) return c;
				return createProject(w, { customerId: c.value.id, name });
			})
		);
	const p = project('Web');
	const q = project('App');
	/** A finished entry on `p` from `start` (UTC) lasting `minutes`. */
	const log = (w: Writer, start: string, minutes: number, projectId = p.id) =>
		createEntry(w, { projectId, timeZone: 'UTC', start, durationMinutes: minutes });
	return { db, run, val, p, q, log };
}

const warnings = <T>(r: Result<T>) => {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.warnings;
};

describe('overlap warnings', () => {
	it('names the entry and the entries it overlaps', () => {
		const { run, val, log, q } = setup();
		const a = val(run((w) => log(w, '2026-10-18T09:00Z', 60)));
		const b = run((w) => log(w, '2026-10-18T09:30Z', 60, q.id));
		expect(warnings(b)).toEqual([
			{
				code: 'overlap',
				message: 'Overlaps 1 other entry.',
				subject: val(b).id,
				details: { with: [a.id] }
			}
		]);
		const c = run((w) => log(w, '2026-10-18T08:00Z', 4 * 60));
		expect(warnings(c)).toEqual([
			{
				code: 'overlap',
				message: 'Overlaps 2 other entries.',
				subject: val(c).id,
				details: { with: [a.id, val(b).id] }
			}
		]);
	});

	it('treats touching intervals as not overlapping', () => {
		const { run, val, log } = setup();
		val(run((w) => log(w, '2026-10-18T09:00Z', 60)));
		expect(warnings(run((w) => log(w, '2026-10-18T10:00Z', 60)))).toEqual([]);
	});

	it('never warns about a running timer, nor about logging while one runs', () => {
		const { run, val, log, q } = setup();
		val(run((w) => log(w, '2026-10-18T09:00Z', 60)));
		const t = run((w) => startTimer(w, { projectId: q.id, timeZone: 'UTC' }), T9 + 0.5 * H);
		expect(warnings(t)).toEqual([]);
		expect(warnings(run((w) => log(w, '2026-10-18T10:00Z', 15), T9 + 2 * H))).toEqual([]);
	});

	it('does not warn when an overlapping entry is only reworded', () => {
		const { run, val, log, q } = setup();
		val(run((w) => log(w, '2026-10-18T09:00Z', 60)));
		const b = val(run((w) => log(w, '2026-10-18T09:30Z', 60, q.id)));
		const r = run((w) => updateEntry(w, { id: b.id, description: 'Reworded', projectId: q.id }));
		expect(warnings(r)).toEqual([]);
	});

	it('judges a batch that swaps two entries by its end state', () => {
		const { run, val, log } = setup();
		const a = val(run((w) => log(w, '2026-10-18T09:00Z', 60)));
		const b = val(run((w) => log(w, '2026-10-18T10:00Z', 60)));
		const r = run((w) => {
			const x = updateEntry(w, { id: a.id, start: '2026-10-18T10:00Z', durationMinutes: 60 });
			if (!x.ok) return x;
			return updateEntry(w, { id: b.id, start: '2026-10-18T09:00Z', durationMinutes: 60 });
		});
		expect(warnings(r)).toEqual([]);
	});

	it('warns when an undo brings an overlap back', () => {
		const { run, val, log } = setup();
		val(run((w) => log(w, '2026-10-18T09:00Z', 60)));
		const b = val(run((w) => log(w, '2026-10-18T09:30Z', 60)));
		let deleteBatch = '';
		const del = run((w) => {
			deleteBatch = w.batchId;
			return deleteEntry(w, { id: b.id });
		});
		expect(warnings(del)).toEqual([]);
		const r = run((w) => undo(w, { batchId: deleteBatch }));
		expect(warnings(r)).toMatchObject([{ code: 'overlap', subject: b.id }]);
	});

	it('gives one warning per entry however often the batch wrote it, none for a deleted one', () => {
		const { run, val, log } = setup();
		const a = val(run((w) => log(w, '2026-10-18T09:00Z', 60)));
		const r = run((w) => {
			const b = log(w, '2026-10-18T09:15Z', 60);
			if (!b.ok) return b;
			const u = updateEntry(w, { id: b.value.id, start: '2026-10-18T09:30Z', durationMinutes: 60 });
			if (!u.ok) return u;
			const c = log(w, '2026-10-18T09:45Z', 5);
			if (!c.ok) return c;
			return deleteEntry(w, { id: c.value.id });
		});
		expect(warnings(r)).toEqual([
			expect.objectContaining({ code: 'overlap', details: { with: [a.id] } })
		]);
	});
});

describe('long warnings', () => {
	it('warns about a finished entry longer than 24 hours', () => {
		const { run, val, log } = setup();
		expect(warnings(run((w) => log(w, '2026-10-01T09:00Z', 24 * 60)))).toEqual([]);
		const r = run((w) => log(w, '2026-10-05T09:00Z', 24 * 60 + 1));
		expect(warnings(r)).toEqual([
			{ code: 'long', message: 'Longer than 24 hours.', subject: val(r).id }
		]);
	});
});
