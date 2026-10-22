import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { batch, change, entry as entryTable, user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import { createEntry, startTimer, stopTimer, updateEntry } from './entries';
import { createCustomer, createProject } from './reference';
import { ok, type Result } from './result';
import { localParts } from './time';
import { undo } from './undo';

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
	/** Runs a batch at `now` (default: one millisecond after the last). */
	const run = <T>(fn: Parameters<typeof runBatch<T>>[4], now = clock + 1): Result<T> => {
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
	const entries = () => db.select().from(entryTable).all();
	const get = (id: string) => db.select().from(entryTable).where(eq(entryTable.id, id)).get();
	const running = () => entries().filter((e) => e.endAt === null);
	return { db, userId, run, val, p, q, entries, get, running };
}

/** The id of the newest batch. */
const lastBatch = (db: ReturnType<typeof createTestDb>) =>
	db.select().from(batch).orderBy(batch.createdAt).all().at(-1)!.id;

const err = <T>(r: Result<T>) => (r.ok ? null : r.error);

describe('startTimer', () => {
	it('starts now by default', () => {
		const { run, val, p } = setup();
		const now = T9 + 2 * H;
		const t = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), now));
		expect(t).toMatchObject({ projectId: p.id, startAt: now, startZone: 'UTC', endAt: null });
	});

	it('starts at a given time, up to a minute ahead, and refuses a later one', () => {
		const { run, val, p, q, entries } = setup();
		const now = T9 + 2 * H;
		const t = val(
			run(
				(w) => startTimer(w, { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T11:01:00Z' }),
				now
			)
		);
		expect(t.startAt).toBe(now + 60_000);
		const r = run(
			(w) => startTimer(w, { projectId: q.id, timeZone: 'UTC', start: '2026-10-18T11:01:01Z' }),
			now
		);
		expect(err(r)).toMatchObject({
			code: 'invalid',
			message: 'A timer cannot start in the future.',
			fields: { start: 'A timer cannot start in the future.' }
		});
		expect(entries()).toHaveLength(1);
	});

	it('lets a timer on another project keep running', () => {
		const { run, val, p, q, running } = setup();
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + H));
		val(run((w) => startTimer(w, { projectId: q.id, timeZone: 'UTC' }), T9 + 2 * H));
		expect(running()).toHaveLength(2);
	});

	it('stops the running timer of the project at the new start, in the same batch', () => {
		const { db, run, val, p, get } = setup();
		const a = val(
			run((w) => startTimer(w, { projectId: p.id, timeZone: 'Europe/Budapest' }), T9 + H)
		);
		const b = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 2 * H));
		expect(get(a.id)).toMatchObject({ endAt: T9 + 2 * H, endZone: 'Europe/Budapest' });
		expect(get(b.id)).toMatchObject({ endAt: null });
		const last = db
			.select()
			.from(change)
			.where(eq(change.batchId, lastBatch(db)))
			.orderBy(change.seq)
			.all();
		expect(last.map((c) => [c.entityId, c.op])).toEqual([
			[a.id, 'update'],
			[b.id, 'create']
		]);
	});

	it("a start in the running timer's minute, before it, starts just after it and stops it", () => {
		const { run, val, p, get } = setup();
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 27_000));
		const n = val(
			run(
				(w) => createEntry(w, { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T09:00' }),
				T9 + 40_000
			)
		);
		expect(n.startAt).toBe(T9 + 27_001);
		expect(get(a.id)).toMatchObject({ endAt: T9 + 27_001, endZone: 'UTC' });
	});

	it('the same late in the minute still reads that minute', () => {
		const { run, val, p } = setup();
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 59_998));
		const n = val(
			run(
				(w) => createEntry(w, { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T09:00' }),
				T9 + 59_999
			)
		);
		expect(n.startAt).toBe(T9 + 59_999);
		expect(localParts(n.startAt, 'UTC').time).toBe('09:00');
	});

	it('a start typed in an earlier minute is refused, naming the running start, writing nothing', () => {
		const { db, run, val, p, entries } = setup();
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 2 * H));
		const batches = db.select().from(batch).all().length;
		const M =
			"This project's timer has been running since 11:00. Start at 11:00 or later, or stop that timer first.";
		const r = run(
			(w) => createEntry(w, { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T10:50' }),
			T9 + 3 * H
		);
		expect(err(r)).toEqual({ code: 'conflict', message: M, fields: { start: M } });
		expect(entries()).toHaveLength(1);
		expect(entries()[0].endAt).toBeNull();
		expect(db.select().from(batch).all()).toHaveLength(batches);
	});

	it('names the running start with its date when the new start is on another day', () => {
		const { run, val, p } = setup();
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const r = run(
			(w) => createEntry(w, { projectId: p.id, timeZone: 'UTC', start: '2026-10-17T20:00' }),
			T9 + H
		);
		expect(err(r)?.message).toBe(
			"This project's timer has been running since 2026-10-18 09:00. Start at 2026-10-18 09:00 or later, or stop that timer first."
		);
	});

	it("reads the minute in the new entry's zone", () => {
		const { run, val, p } = setup();
		// 14:30:27 in Kolkata, 11:00:27 in Budapest: the zones differ by a half hour.
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'Asia/Kolkata' }), T9 + 27_000));
		const n = val(
			run(
				(w) =>
					createEntry(w, {
						projectId: p.id,
						timeZone: 'Europe/Budapest',
						start: '2026-10-18T11:00'
					}),
				T9 + 40_000
			)
		);
		expect(n.startAt).toBe(T9 + 27_001);
	});

	it("names the running timer's start in the new entry's zone", () => {
		const { run, val, p } = setup();
		// 18:00:27 in Tokyo, 11:00:27 in Budapest; the refusal leaves the timer running.
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'Asia/Tokyo' }), T9 + 27_000));
		const r = run(
			(w) =>
				createEntry(w, { projectId: p.id, timeZone: 'Europe/Budapest', start: '2026-10-18T10:50' }),
			T9 + 50_000
		);
		expect(err(r)?.message).toContain('since 11:00');
		expect(err(r)?.message).not.toContain('18:00');
	});

	it('an edit clearing an end, the running one later, is refused without a field', () => {
		const { run, val, p, get } = setup();
		const fin = val(
			run((w) =>
				createEntry(w, {
					projectId: p.id,
					timeZone: 'UTC',
					start: '2026-10-18T08:00',
					end: '2026-10-18T08:30'
				})
			)
		);
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const r = run((w) => updateEntry(w, { id: fin.id, end: null }), T9 + H);
		const e = err(r);
		expect(e).toEqual({
			code: 'conflict',
			message:
				"This project's timer has been running since 09:00. Start at 09:00 or later, or stop that timer first."
		});
		expect(get(fin.id)?.endAt).not.toBeNull();
		expect(get(a.id)?.endAt).toBeNull();
	});

	it('an edit giving an earlier start and clearing the end is refused on the start field', () => {
		const { run, val, p, get } = setup();
		const fin = val(
			run((w) =>
				createEntry(w, {
					projectId: p.id,
					timeZone: 'UTC',
					start: '2026-10-18T08:00',
					end: '2026-10-18T08:30'
				})
			)
		);
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const before = [get(fin.id), get(a.id)];
		const M =
			"This project's timer has been running since 09:00. Start at 09:00 or later, or stop that timer first.";
		const r = run(
			(w) => updateEntry(w, { id: fin.id, start: '2026-10-18T08:10', end: null }),
			T9 + H
		);
		expect(err(r)).toEqual({ code: 'conflict', message: M, fields: { start: M } });
		expect([get(fin.id), get(a.id)]).toEqual(before);
	});

	it('an edit clearing an end, starting in the running minute but before it, is refused', () => {
		const { db, run, val, p, get } = setup();
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 30_000));
		const fin = val(
			run((w) =>
				createEntry(w, {
					projectId: p.id,
					timeZone: 'UTC',
					start: '2026-10-18T08:00',
					end: '2026-10-18T08:30'
				})
			)
		);
		// move the saved start into the running timer's minute, before its second
		db.update(entryTable)
			.set({ startAt: T9 + 10_000, endAt: T9 + 20_000 })
			.where(eq(entryTable.id, fin.id))
			.run();
		const before = [get(fin.id), get(a.id)];
		const r = run((w) => updateEntry(w, { id: fin.id, end: null }), T9 + H);
		expect(err(r)).toMatchObject({ code: 'conflict' });
		expect(err(r)).not.toHaveProperty('fields');
		expect([get(fin.id), get(a.id)]).toEqual(before);
	});

	it('an edit clearing an end, after the running one, stops it at its start', () => {
		const { run, val, p, get } = setup();
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const fin = val(
			run((w) =>
				createEntry(w, {
					projectId: p.id,
					timeZone: 'UTC',
					start: '2026-10-18T09:30',
					end: '2026-10-18T10:00'
				})
			)
		);
		// the finished entry starts after the running one, so it stands beside it until the end is cleared
		val(run((w) => updateEntry(w, { id: fin.id, end: null }), T9 + H));
		expect(get(a.id)?.endAt).toBe(T9 + 30 * 60_000);
		expect(get(fin.id)?.startAt).toBe(T9 + 30 * 60_000);
	});
});

describe('stopTimer', () => {
	it('stops now by default in the start zone', () => {
		const { run, val, p } = setup();
		const t = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'Europe/Budapest' }), T9));
		const s = val(run((w) => stopTimer(w, { id: t.id, expectedVersion: 1 }), T9 + H));
		expect(s).toMatchObject({ endAt: T9 + H, endZone: 'Europe/Budapest', version: 2 });
	});

	it('stops at a given end in the given end zone', () => {
		const { run, val, p } = setup();
		const t = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const s = val(
			run(
				(w) => stopTimer(w, { id: t.id, end: '2026-10-18T10:30', endTimeZone: 'Europe/London' }),
				T9 + 2 * H
			)
		);
		expect(s).toMatchObject({ endAt: T9 + 0.5 * H, endZone: 'Europe/London' });
	});

	it('refuses to stop a timer before it started', () => {
		const { run, val, p } = setup();
		const t = val(
			run(
				(w) => startTimer(w, { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T09:00:30' }),
				T9
			)
		);
		for (const input of [{}, { end: '2026-10-18T08:00' }, { end: '2026-10-18T09:00:30' }]) {
			expect(err(run((w) => stopTimer(w, { id: t.id, ...input }), T9))).toMatchObject({
				code: 'invalid',
				fields: { end: 'A timer cannot stop before it started.' }
			});
		}
	});

	it('refuses a stopped timer, a stale version and an unknown id', () => {
		const { run, val, p } = setup();
		const t = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		expect(err(run((w) => stopTimer(w, { id: t.id, expectedVersion: 2 }), T9 + H))).toMatchObject({
			code: 'conflict',
			message: 'This was changed elsewhere; reload and try again.'
		});
		val(run((w) => stopTimer(w, { id: t.id }), T9 + H));
		expect(err(run((w) => stopTimer(w, { id: t.id }), T9 + 2 * H))).toEqual({
			code: 'conflict',
			message: 'That timer is already stopped.'
		});
		expect(err(run((w) => stopTimer(w, { id: 'nope' })))).toMatchObject({ code: 'not_found' });
	});
});

describe('running entries stay out of the future', () => {
	const FUTURE = { code: 'invalid', message: 'A timer cannot start in the future.' };

	it('refuses a create without an end starting over a minute ahead, not a finished one', () => {
		const { run, val, p, entries } = setup();
		const input = { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T09:01:01Z' };
		const r = run((w) => createEntry(w, input), T9 + 1);
		expect(err(r)).toEqual({ ...FUTURE, fields: { start: FUTURE.message } });
		expect(entries()).toHaveLength(0);
		val(run((w) => createEntry(w, { ...input, start: '2026-10-18T09:01:00Z' }), T9 + 2));
		val(run((w) => createEntry(w, { ...input, start: '2026-10-19T09:00Z', durationMinutes: 30 })));
	});

	it('refuses an update that makes an entry running, or moves a running start, too far ahead', () => {
		const { run, val, p } = setup();
		const f = val(
			run((w) =>
				createEntry(w, {
					projectId: p.id,
					timeZone: 'UTC',
					start: '2026-10-18T12:00Z',
					durationMinutes: 30
				})
			)
		);
		expect(err(run((w) => updateEntry(w, { id: f.id, end: null }), T9 + H))).toMatchObject({
			...FUTURE,
			fields: { start: FUTURE.message }
		});
		const t = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 2 * H));
		expect(
			err(run((w) => updateEntry(w, { id: t.id, start: '2026-10-18T11:01:01Z' }), T9 + 2 * H))
		).toMatchObject({ ...FUTURE, fields: { start: FUTURE.message } });
		val(run((w) => updateEntry(w, { id: t.id, description: 'Still fine' }), T9 + 2 * H));
	});

	it('refuses stopping a timer over a minute ahead', () => {
		const { run, val, p, running } = setup();
		const t = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const r = run((w) => stopTimer(w, { id: t.id, end: '2026-10-18T10:01:01Z' }), T9 + H);
		expect(err(r)).toEqual({
			code: 'invalid',
			message: 'A timer cannot stop in the future.',
			fields: { end: 'A timer cannot stop in the future.' }
		});
		expect(running()).toHaveLength(1);
		val(run((w) => stopTimer(w, { id: t.id, end: '2026-10-18T10:01:00Z' }), T9 + H + 1));
	});
});

describe('timers across edits and undo', () => {
	it("moving a running entry onto a project stops that project's timer", () => {
		const { run, val, p, q, get } = setup();
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const b = val(run((w) => startTimer(w, { projectId: q.id, timeZone: 'UTC' }), T9 + H));
		val(run((w) => updateEntry(w, { id: b.id, projectId: p.id }), T9 + 2 * H));
		expect(get(a.id)).toMatchObject({ endAt: T9 + H, endZone: 'UTC' });
		expect(get(b.id)).toMatchObject({ projectId: p.id, endAt: null });
	});

	it('making an entry running again stops the project timer at its start', () => {
		const { run, val, p, get } = setup();
		const b = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + H));
		const a = val(
			run((w) =>
				createEntry(w, {
					projectId: p.id,
					timeZone: 'UTC',
					start: '2026-10-18T11:00Z',
					durationMinutes: 30
				})
			)
		);
		val(run((w) => updateEntry(w, { id: a.id, end: null }), T9 + 3 * H));
		expect(get(a.id)!.endAt).toBeNull();
		expect(get(b.id)).toMatchObject({ endAt: T9 + 2 * H, endZone: 'UTC' });
	});

	it('undoing the auto-stop batch restores both entries', () => {
		const { db, run, val, p, get, entries } = setup();
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		const b = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + H));
		const batchId = db.select().from(change).where(eq(change.entityId, b.id)).get()!.batchId;
		val(run((w) => undo(w, { batchId })));
		expect(entries()).toHaveLength(1);
		expect(get(a.id)).toMatchObject({ endAt: null, endZone: null });
	});

	it('refuses an undo that would leave two timers running on one project', () => {
		const { db, run, val, p, running } = setup();
		const a = val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9));
		val(run((w) => stopTimer(w, { id: a.id }), T9 + H));
		const stop = lastBatch(db);
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 2 * H));
		expect(err(run((w) => undo(w, { batchId: stop })))).toEqual({
			code: 'conflict',
			message: 'Only one timer can run on a project.'
		});
		expect(running()).toHaveLength(1);
	});
});

describe('a refusal caught inside a batch', () => {
	it('still rolls the batch back and returns the conflict', () => {
		const { run, val, p, entries } = setup();
		val(run((w) => startTimer(w, { projectId: p.id, timeZone: 'UTC' }), T9 + 2 * H));
		const before = entries();
		const r = run(
			(w) => {
				try {
					startTimer(w, { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T10:00Z' });
				} catch {
					// swallowed on purpose
				}
				return ok(1);
			},
			T9 + 3 * H
		);
		expect(err(r)).toMatchObject({ code: 'conflict' });
		expect(entries()).toEqual(before);
	});
});
