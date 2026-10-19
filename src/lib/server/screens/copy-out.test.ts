import { describe, expect, it } from 'vitest';
import { openCore, type EntryItem, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import {
	copyOutQuery,
	csvName,
	monthRange,
	outputRows,
	readCopyOut,
	sheetFor,
	type CopyOutOptions
} from './copy-out';
import type { Search } from './entries';

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

describe('readCopyOut', () => {
	const NOW = at('2026-10-19T10:00:00Z');
	const read = (query: string) => readCopyOut(new URLSearchParams(query), BUD, NOW);
	const ALL = [
		'date',
		'start',
		'end',
		'duration',
		'customer',
		'project',
		'activity',
		'location',
		'reference',
		'description'
	];

	it('defaults to every column, rounded, whole, as hours and minutes', () => {
		const { copyOut, error, columnsError } = read('');
		expect(error).toBeNull();
		expect(columnsError).toBeNull();
		expect(copyOut.columns).toEqual(ALL);
		expect(copyOut.options).toEqual({ round: true, split: false, duration: 'hm' });
		expect(copyOut.search).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
	});

	it('keeps the chosen columns in column order', () => {
		expect(read('show=1&col=project&col=date').copyOut.columns).toEqual(['date', 'project']);
	});

	it('takes each column once and ignores unknown ones', () => {
		expect(read('show=1&col=date&col=date&col=foo').copyOut.columns).toEqual(['date']);
	});

	it('asks for a column when none is chosen', () => {
		const { copyOut, columnsError } = read('show=1');
		expect(columnsError).toBe('Choose at least one column.');
		expect(copyOut.columns).toEqual([]);
	});

	it('turns round and split off unless sent', () => {
		expect(read('show=1&col=date').copyOut.options).toMatchObject({ round: false, split: false });
		expect(read('show=1&col=date&round=1&split=1').copyOut.options).toMatchObject({
			round: true,
			split: true
		});
	});

	it('reads the duration format, hm unless decimal', () => {
		expect(read('duration=decimal').copyOut.options.duration).toBe('decimal');
		expect(read('duration=weeks').copyOut.options.duration).toBe('hm');
	});

	it('carries the search errors', () => {
		expect(read('from=2026-10-09&to=2026-10-01').error).toBe('From must not be after To.');
	});

	it('round-trips a non-default choice through copyOutQuery', () => {
		const first = read(
			'show=1&from=2026-09-01&to=2026-09-30&projectId=p9&activity=none&text=x&col=description&col=date&split=1&duration=decimal'
		).copyOut;
		const query = copyOutQuery(first);
		expect(query).toContain('show=1');
		expect(query).not.toContain('round');
		expect(query).not.toContain('all=');
		expect(read(query).copyOut).toEqual(first);
	});
});

describe('monthRange', () => {
	const now = at('2026-01-15T10:00:00Z');
	it('is this month or last month in the zone', () => {
		expect(monthRange(now, BUD, 1)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
		expect(monthRange(now, BUD, 0)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
	});
});

describe('csvName', () => {
	const search = (from: string, to: string) => ({ from, to }) as Search;
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
	const query = (q: string) => readCopyOut(new URLSearchParams(q), BUD, at('2026-10-19T10:00:00Z'));

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
		const result = sheetFor(core, query('').copyOut, BUD);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.sheet.rows).toHaveLength(600);
	});

	it('gives the core message when the list is refused', () => {
		const result = sheetFor(core, query(`text=${'x'.repeat(201)}`).copyOut, BUD);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe('The input is not valid.');
	});
});
