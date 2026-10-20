import { describe, expect, it } from 'vitest';
import {
	dayTotals,
	dragRange,
	halfHourSlot,
	lanes,
	localDate,
	localMinutes,
	overlapping,
	piecesOf,
	snap,
	spanText,
	wholeMinutes
} from './grid';

const zone = 'Europe/Budapest';
const at = (local: string) => Date.parse(`${local}:00+02:00`); // CEST
const week = [
	'2026-10-12',
	'2026-10-13',
	'2026-10-14',
	'2026-10-15',
	'2026-10-16',
	'2026-10-17',
	'2026-10-18'
];

describe('localDate and localMinutes', () => {
	it('read wall-clock time in the zone', () => {
		const t = Date.parse('2026-10-14T22:30:00Z'); // 00:30 next day in Budapest
		expect(localDate(t, zone)).toBe('2026-10-15');
		expect(localMinutes(t, zone)).toBe(30);
	});

	it('never reports 24:00 for midnight', () => {
		expect(localMinutes(at('2026-10-14T00:00'), zone)).toBe(0);
	});
});

describe('piecesOf', () => {
	it('keeps a same-day entry in one piece', () => {
		const e = { startAt: at('2026-10-14T09:00'), endAt: at('2026-10-14T10:30') };
		expect(piecesOf(e, week, zone, 0)).toEqual([
			{ date: '2026-10-14', from: 540, to: 630, first: true, last: true }
		]);
	});

	it('cuts an entry at each local midnight', () => {
		const e = { startAt: at('2026-10-13T22:00'), endAt: at('2026-10-15T02:00') };
		expect(piecesOf(e, week, zone, 0)).toEqual([
			{ date: '2026-10-13', from: 1320, to: 1440, first: true, last: false },
			{ date: '2026-10-14', from: 0, to: 1440, first: false, last: false },
			{ date: '2026-10-15', from: 0, to: 120, first: false, last: true }
		]);
	});

	it('runs a running entry to now, never last', () => {
		const e = { startAt: at('2026-10-13T23:00'), endAt: null };
		const ps = piecesOf(e, week, zone, at('2026-10-14T09:30'));
		expect(ps.map((p) => [p.date, p.from, p.to, p.first, p.last])).toEqual([
			['2026-10-13', 1380, 1440, true, false],
			['2026-10-14', 0, 570, false, false]
		]);
	});

	it('ignores days outside the entry', () => {
		const e = { startAt: at('2026-10-14T09:00'), endAt: at('2026-10-14T10:00') };
		expect(piecesOf(e, ['2026-10-13', '2026-10-15'], zone, 0)).toEqual([]);
	});

	it('reads wall minutes on the spring-forward day', () => {
		const e = {
			startAt: Date.parse('2026-03-29T03:30:00+02:00'),
			endAt: Date.parse('2026-03-29T04:00:00+02:00')
		};
		expect(piecesOf(e, ['2026-03-29'], zone, 0)).toEqual([
			{ date: '2026-03-29', from: 210, to: 240, first: true, last: true }
		]);
	});

	it('spans the whole fall-back day', () => {
		const e = {
			startAt: Date.parse('2026-10-24T20:00:00Z'),
			endAt: Date.parse('2026-10-26T00:00:00Z')
		};
		const ps = piecesOf(e, ['2026-10-25'], zone, 0);
		expect(ps).toEqual([{ date: '2026-10-25', from: 0, to: 1440, first: false, last: false }]);
	});
});

describe('lanes', () => {
	const p = (from: number, to: number) => ({ from, to });

	it('puts two intersecting pieces side by side', () => {
		const out = lanes([p(600, 780), p(630, 690)]);
		expect(out.map((x) => [x.lane, x.lanes])).toEqual([
			[0, 2],
			[1, 2]
		]);
	});

	it('gives three mutual intersections three lanes', () => {
		const out = lanes([p(600, 780), p(610, 770), p(620, 760)]);
		expect(out.map((x) => [x.lane, x.lanes])).toEqual([
			[0, 3],
			[1, 3],
			[2, 3]
		]);
	});

	it('starts a new cluster after a gap', () => {
		const out = lanes([p(600, 780), p(630, 690), p(810, 840)]);
		expect(out[2]).toMatchObject({ lane: 0, lanes: 1 });
	});

	it('does not treat touching pieces as intersecting', () => {
		const out = lanes([p(600, 660), p(660, 720)]);
		expect(out.map((x) => [x.lane, x.lanes])).toEqual([
			[0, 1],
			[0, 1]
		]);
	});

	it('reuses a freed lane', () => {
		const out = lanes([p(600, 700), p(610, 900), p(700, 800)]);
		expect(out.map((x) => x.lane)).toEqual([0, 1, 0]);
	});
});

describe('overlapping', () => {
	it('marks both of an intersecting pair', () => {
		const es = [
			{ id: 'a', startAt: 0, endAt: 100 },
			{ id: 'b', startAt: 50, endAt: 150 },
			{ id: 'c', startAt: 200, endAt: 300 }
		];
		expect(overlapping(es)).toEqual(new Set(['a', 'b']));
	});

	it('leaves a touching pair alone', () => {
		const es = [
			{ id: 'a', startAt: 0, endAt: 100 },
			{ id: 'b', startAt: 100, endAt: 200 }
		];
		expect(overlapping(es).size).toBe(0);
	});

	it('never marks a running entry', () => {
		const es = [
			{ id: 'a', startAt: 0, endAt: 100 },
			{ id: 'b', startAt: 50, endAt: null }
		];
		expect(overlapping(es).size).toBe(0);
	});
});

describe('dayTotals', () => {
	const MIN = 60_000;

	it('books an entry on its start date only, in ms', () => {
		const e = { startAt: at('2026-10-14T23:00'), endAt: at('2026-10-15T01:00') };
		expect(dayTotals([e], zone, 0)).toEqual(new Map([['2026-10-14', 120 * MIN]]));
	});

	it('sums a day and runs a running entry to now', () => {
		const es = [
			{ startAt: at('2026-10-14T09:00'), endAt: at('2026-10-14T10:00') },
			{ startAt: at('2026-10-14T11:00'), endAt: null }
		];
		expect(dayTotals(es, zone, at('2026-10-14T11:30')).get('2026-10-14')).toBe(90 * MIN);
	});

	it('sums the exact time, sub-minute parts included, and truncates once (as Entries does)', () => {
		// Two timer-made entries of 30:40 each: 61:20 together, so 1:01, not 1:02 (rounded
		// each) nor 1:00 (truncated each).
		const nine = at('2026-10-14T09:00');
		const es = [
			{ startAt: nine, endAt: nine + 30 * MIN + 40_000 },
			{ startAt: nine + 60 * MIN, endAt: nine + 90 * MIN + 40_000 }
		];
		const total = dayTotals(es, zone, 0).get('2026-10-14')!;
		expect(total).toBe(61 * MIN + 20_000);
		expect(wholeMinutes(total)).toBe(61);
		expect(spanText(total)).toBe('1:01');
	});

	it('counts nothing for an entry ending before it starts', () => {
		const e = { startAt: at('2026-10-14T09:00'), endAt: at('2026-10-14T08:00') };
		expect(dayTotals([e], zone, 0).get('2026-10-14')).toBe(0);
	});
});

describe('wholeMinutes and spanText', () => {
	it("truncate a running entry's time as the timer bar does: 1:40:31 is 1:40", () => {
		const started = at('2026-10-14T09:00');
		const now = started + (100 * 60 + 31) * 1000;
		expect(wholeMinutes(now - started)).toBe(100);
		expect(spanText(now - started)).toBe('1:40');
	});

	it('read 59.9 s as no minute, and a negative or non-finite span as 0:00', () => {
		expect(wholeMinutes(59_999)).toBe(0);
		expect(spanText(-5000)).toBe('0:00');
		expect(spanText(Number.NaN)).toBe('0:00');
		expect(spanText(27 * 3_600_000 + 45 * 60_000)).toBe('27:45');
	});
});

describe('snap and halfHourSlot', () => {
	it('snaps to the nearest step', () => {
		expect(snap(62, 5)).toBe(60);
		expect(snap(63, 5)).toBe(65);
	});

	it('makes an hour slot from the half hour below', () => {
		expect(halfHourSlot(1079)).toEqual({ from: 1050, to: 1110 });
		expect(halfHourSlot(1430)).toEqual({ from: 1410, to: 1440 });
	});
});

describe('dragRange', () => {
	it('starts on the 5 minutes under the press and rounds the moving end', () => {
		// A press 2 px under the 16:00 line (16:02) dragged to 17:29.
		expect(dragRange(962, 1049)).toEqual({ from: 960, to: 1050 });
	});

	it('keeps the press under its block when dragged upward', () => {
		expect(dragRange(962, 901)).toEqual({ from: 900, to: 960 });
	});

	it('keeps five minutes at least, inside the day', () => {
		expect(dragRange(600, 601)).toEqual({ from: 600, to: 605 });
		expect(dragRange(1439, 1440)).toEqual({ from: 1435, to: 1440 });
	});
});
