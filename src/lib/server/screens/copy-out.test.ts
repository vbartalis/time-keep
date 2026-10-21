import { describe, expect, it } from 'vitest';
import { openCore, type EntryItem, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { csvName, outputPieces, outputRows, sheetFor, type CopyOutOptions } from './copy-out';
import { formatDuration } from '#lib/output.js';
import { readOutput } from './output';

const BUD = 'Europe/Budapest';
const at = (iso: string) => Date.parse(iso);

function entry(start: string, end: string | null, over: Partial<EntryItem> = {}): EntryItem {
	return {
		id: 'e1',
		userId: 'u1',
		projectId: 'p1',
		activityId: null,
		locationId: null,
		startAt: at(start),
		startZone: BUD,
		endAt: end === null ? null : at(end),
		endZone: end === null ? null : BUD,
		reference: null,
		description: null,
		version: 1,
		createdAt: 0,
		updatedAt: 0,
		projectName: 'Site',
		customerId: 'c1',
		customerName: 'Acme',
		activityName: null,
		locationName: null,
		...over
	};
}

const base: CopyOutOptions = { round: true, split: false, duration: 'hm' };
const one = (e: EntryItem, o: Partial<CopyOutOptions> = {}) =>
	outputRows([e], { ...base, ...o }).rows;
const times = (rows: { date: string; start: string; end: string; duration: string }[]) =>
	rows.map((r) => [r.date, r.start, r.end, r.duration].join(' '));

describe('rounding', () => {
	it('rounds both ends to the nearest 5 minutes, 2.5 up', () => {
		const [r] = one(entry('2026-10-07T09:02:30+02:00', '2026-10-07T10:27:29+02:00'));
		expect([r.start, r.end, r.duration]).toEqual(['09:05', '10:25', '1:20']);
	});
	it('keeps one 0:00 row for an entry that rounds to nothing', () => {
		const rows = one(entry('2026-10-07T09:01:00+02:00', '2026-10-07T09:02:00+02:00'));
		expect(rows).toHaveLength(1);
		expect([rows[0].start, rows[0].end, rows[0].duration]).toEqual(['09:00', '09:00', '0:00']);
	});
	it('cuts to the minute without rounding', () => {
		const [r] = one(entry('2026-10-07T09:00:40+02:00', '2026-10-07T09:30:10+02:00'), {
			round: false
		});
		expect([r.start, r.end, r.duration]).toEqual(['09:00', '09:30', '0:30']);
	});
});

describe('end', () => {
	it('is the time on the same day', () => {
		expect(one(entry('2026-10-07T09:00:00+02:00', '2026-10-07T10:00:00+02:00'))[0].end).toBe(
			'10:00'
		);
	});
	it('is 24:00 at the next midnight', () => {
		expect(one(entry('2026-10-07T22:00:00+02:00', '2026-10-08T00:00:00+02:00'))[0].end).toBe(
			'24:00'
		);
	});
	it('carries the date when unsplit and later', () => {
		expect(one(entry('2026-10-07T22:00:00+02:00', '2026-10-08T02:00:00+02:00'))[0].end).toBe(
			'2026-10-08 02:00'
		);
	});
	it('is read in the end zone', () => {
		const e = entry('2026-10-07T09:00:00+02:00', '2026-10-07T12:00:00+02:00', {
			endZone: 'Europe/London'
		});
		expect(one(e)[0].end).toBe('11:00');
	});
});

describe('splitting', () => {
	const split = { split: true };
	it('cuts at midnight', () => {
		expect(
			times(one(entry('2026-10-07T22:00:00+02:00', '2026-10-08T02:00:00+02:00'), split))
		).toEqual(['2026-10-07 22:00 24:00 2:00', '2026-10-08 00:00 02:00 2:00']);
	});
	it('gives a whole middle day', () => {
		expect(
			times(one(entry('2026-10-07T22:00:00+02:00', '2026-10-09T01:00:00+02:00'), split))
		).toEqual([
			'2026-10-07 22:00 24:00 2:00',
			'2026-10-08 00:00 24:00 24:00',
			'2026-10-09 00:00 01:00 1:00'
		]);
	});
	it('writes one row for an entry ending at midnight', () => {
		expect(
			times(one(entry('2026-10-07T22:00:00+02:00', '2026-10-08T00:00:00+02:00'), split))
		).toEqual(['2026-10-07 22:00 24:00 2:00']);
	});
	it('dates an entry that rounds to midnight by its rounded start', () => {
		expect(
			times(one(entry('2026-10-07T23:57:40+02:00', '2026-10-08T00:00:00+02:00'), split))
		).toEqual(['2026-10-08 00:00 00:00 0:00']);
	});
	it('makes a 25-hour day on the fall-back date', () => {
		const rows = one(entry('2026-10-24T22:00:00+02:00', '2026-10-26T01:00:00+01:00'), split);
		expect(times(rows)[1]).toBe('2026-10-25 00:00 24:00 25:00');
		expect(rows).toHaveLength(3);
	});
	it('makes a 23-hour day on the spring-forward date', () => {
		const rows = one(entry('2026-03-28T22:00:00+01:00', '2026-03-30T01:00:00+02:00'), split);
		expect(times(rows)[1]).toBe('2026-03-29 00:00 24:00 23:00');
		expect(rows).toHaveLength(3);
	});
	it('dates the second row across a month end', () => {
		const rows = one(entry('2026-10-31T22:00:00+01:00', '2026-11-01T02:00:00+01:00'), split);
		expect(rows.map((r) => r.date)).toEqual(['2026-10-31', '2026-11-01']);
	});
});

describe('outputPieces', () => {
	const night = entry('2026-10-07T22:00:00+02:00', '2026-10-08T02:00:00+02:00');
	it('gives one piece unsplit', () => {
		const { pieces } = outputPieces([night], { round: true, split: false });
		expect(pieces.map((p) => [p.date, p.minutes])).toEqual([['2026-10-07', 240]]);
	});
	it('gives a piece a day split', () => {
		const { pieces } = outputPieces([night], { round: true, split: true });
		expect(pieces.map((p) => [p.date, p.minutes])).toEqual([
			['2026-10-07', 120],
			['2026-10-08', 120]
		]);
	});
	it('counts a running entry, with no piece', () => {
		expect(outputPieces([entry('2026-10-07T09:00:00+02:00', null)], base)).toEqual({
			pieces: [],
			running: 1
		});
	});
	it('agrees with the rows', () => {
		const list = [
			night,
			entry('2026-10-07T09:02:30+02:00', '2026-10-07T10:27:29+02:00'),
			entry('2026-10-07T09:01:00+02:00', '2026-10-07T09:02:00+02:00'),
			entry('2026-10-24T22:00:00+02:00', '2026-10-26T01:00:00+01:00')
		];
		for (const round of [true, false]) {
			for (const split of [true, false]) {
				const { pieces } = outputPieces(list, { round, split });
				const sheet = outputRows(list, { round, split, duration: 'hm' });
				expect(pieces.map((p) => [p.date, formatDuration(p.minutes, 'hm')])).toEqual(
					sheet.rows.map((r) => [r.date, r.duration])
				);
				expect(pieces.reduce((sum, p) => sum + p.minutes, 0)).toBe(sheet.minutes);
			}
		}
	});
});

describe('sheet', () => {
	it('leaves out running entries and sums the rows', () => {
		const sheet = outputRows(
			[
				entry('2026-10-07T09:00:00+02:00', '2026-10-07T10:00:00+02:00'),
				entry('2026-10-07T11:00:00+02:00', null),
				entry('2026-10-07T12:00:00+02:00', '2026-10-07T12:30:00+02:00')
			],
			base
		);
		expect(sheet.rows).toHaveLength(2);
		expect(sheet.running).toBe(1);
		expect(sheet.minutes).toBe(90);
	});
	it('makes values formula-safe but never durations', () => {
		const [r] = one(
			entry('2026-10-07T09:00:00+02:00', '2026-10-07T10:00:00+02:00', {
				description: '- fixed the export'
			})
		);
		expect(r.description).toBe("'- fixed the export");
		expect(r.activity).toBe('');
		expect(r.duration).toBe('1:00');
	});
	it('writes decimal durations', () => {
		const [r] = one(entry('2026-10-07T09:00:00+02:00', '2026-10-07T10:20:00+02:00'), {
			duration: 'decimal'
		});
		expect(r.duration).toBe('1.33');
	});
});

describe('csvName', () => {
	const search = (from: string, to: string) => ({ from, to });
	it('names the file by its dates, all for a blank bound', () => {
		expect(csvName(search('2026-10-01', '2026-10-31'))).toBe('time-keep-2026-10-01-2026-10-31.csv');
		expect(csvName(search('', '2026-10-31'))).toBe('time-keep-all-2026-10-31.csv');
		expect(csvName(search('', ''))).toBe('time-keep-all-all.csv');
	});
});

describe('sheetFor', () => {
	const db = createTestDb();
	const uid = newId();
	db.insert(user)
		.values({ id: uid, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const core = openCore(db, uid, 'ui');
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(r.error.message);
		return r.value;
	};
	const customer = val(core.customers.create({ name: 'C' }));
	const project = val(core.projects.create({ customerId: customer.id, name: 'P' }));
	const query = (q: string) => readOutput(new URLSearchParams(q), {}, '2026-10-19').view;

	it('returns every matching row, not a capped page', () => {
		for (let i = 0; i < 600; i++) {
			const minute = String(i % 60).padStart(2, '0');
			const hour = String(Math.floor(i / 60)).padStart(2, '0');
			val(
				core.entries.create({
					projectId: project.id,
					start: `2026-10-05T${hour}:${minute}`,
					end: '2026-10-05T23:59',
					timeZone: BUD
				})
			);
		}
		const result = sheetFor(core, query(''), BUD);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.sheet.rows).toHaveLength(600);
	});

	it('gives the field message when the list is refused', () => {
		const result = sheetFor(core, query(`q=${'x'.repeat(201)}`), BUD);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe('Use 1–200 characters.');
	});
});
