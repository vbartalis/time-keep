import { describe, expect, it } from 'vitest';
import {
	dayTotals,
	dragRange,
	growShared,
	halfHourSlot,
	lanes,
	layoutDay,
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

const box = (from: number, to: number, running = false) => ({ from, to, running });

describe('layoutDay', () => {
	it('a lone box takes the full width', () => {
		const { shown, chips } = layoutDay([box(360, 380)], 2);
		expect(shown).toMatchObject([{ lane: 0, lanes: 1, group: 0 }]);
		expect(chips).toEqual([]);
	});

	it('boxes that only touch do not share', () => {
		const { shown } = layoutDay([box(360, 380), box(380, 400)], 2);
		expect(shown.map((b) => b.lanes)).toEqual([1, 1]);
	});

	it('a crowded minute does not split the day', () => {
		const { shown } = layoutDay(
			[
				box(372, 397),
				box(372, 397),
				box(372, 397),
				box(420, 445),
				box(480, 810),
				box(540, 630),
				box(780, 930)
			],
			Infinity
		);
		expect(shown.slice(0, 3).map((b) => b.lanes)).toEqual([3, 3, 3]);
		expect(shown[3].lanes).toBe(1);
		expect([shown[4].lanes, shown[5].lanes]).toEqual([2, 2]);
		expect([shown[4].lane, shown[5].lane]).toEqual([0, 1]);
		expect(shown[6].lanes).toBe(2);
		expect(shown[6].group).toBe(shown[4].group);
	});

	it('more than fit: the last lane holds a chip', () => {
		const { shown, chips } = layoutDay(
			Array.from({ length: 5 }, () => box(372, 397)),
			2
		);
		expect(shown).toHaveLength(1);
		expect(shown[0]).toMatchObject({ lane: 0, lanes: 2 });
		expect(chips).toEqual([{ from: 372, to: 397, lane: 1, lanes: 2, count: 4, group: 0 }]);
	});

	it('running blocks take the first lanes', () => {
		const { shown, chips } = layoutDay([box(372, 397), box(372, 397), box(372, 500, true)], 2);
		expect(shown).toHaveLength(1);
		expect(shown[0]).toMatchObject({ running: true, lane: 0 });
		expect(chips).toEqual([{ from: 372, to: 397, lane: 1, lanes: 2, count: 2, group: 0 }]);
	});

	it('one chip per run', () => {
		const { shown, chips } = layoutDay(
			[box(480, 1000), box(500, 525), box(500, 525), box(900, 925), box(900, 925)],
			2
		);
		expect(shown).toMatchObject([{ from: 480, lane: 0 }]);
		expect(chips).toMatchObject([
			{ from: 500, to: 525, count: 2, lane: 1 },
			{ from: 900, to: 925, count: 2, lane: 1 }
		]);
	});

	it('hides only the crowded stretch: a chip-lane block clear of the hidden is drawn', () => {
		// 08:00–13:30, three at 08:40, 09:00–10:30 and 13:00–15:30, two lanes fit.
		const boxes = [
			box(480, 810),
			box(520, 545),
			box(520, 545),
			box(520, 545),
			box(540, 630),
			box(780, 930)
		];
		const { shown, chips } = layoutDay(boxes, 2);
		expect(shown.map((b) => [b.from, b.lane, b.lanes])).toEqual([
			[480, 0, 2],
			[780, 1, 2]
		]);
		expect(chips).toEqual([{ from: 520, to: 630, lane: 1, lanes: 2, count: 4, group: 0 }]);
	});

	it('each chip-lane block meeting a hidden one is hidden too', () => {
		// Lane 1: 500–560 then 560–620; lane 2: 540–600 (meets both), so both go behind the chip.
		const { shown, chips } = layoutDay(
			[box(480, 700), box(500, 560), box(540, 600), box(560, 620), box(650, 680)],
			2
		);
		expect(shown.map((b) => [b.from, b.lane])).toEqual([
			[480, 0],
			[650, 1]
		]);
		expect(chips).toEqual([{ from: 500, to: 620, lane: 1, lanes: 2, count: 3, group: 0 }]);
	});

	it('a chip never meets a drawn block', () => {
		const boxes = [
			box(480, 810),
			box(520, 545),
			box(520, 545),
			box(540, 630),
			box(600, 700),
			box(780, 930)
		];
		const { shown, chips } = layoutDay(boxes, 2);
		for (const c of chips)
			for (const b of shown)
				if (b.lane === c.lane) expect(b.to <= c.from || c.to <= b.from).toBe(true);
	});

	it('the longest are drawn, the shortest go into the chip (the gate’s day)', () => {
		const shorts = Array.from({ length: 5 }, () => box(612, 637));
		const { shown, chips } = layoutDay(
			[box(480, 810), box(493, 613), box(540, 630), box(780, 930), ...shorts],
			2
		);
		expect(shown.map((b) => [b.from, b.to, b.lane])).toEqual([
			[480, 810, 0],
			[780, 930, 1]
		]);
		expect(chips).toEqual([{ from: 493, to: 637, lane: 1, lanes: 2, count: 7, group: 0 }]);
	});

	it('a long block moved an hour later stays drawn', () => {
		const shorts = Array.from({ length: 5 }, () => box(612, 637));
		const { shown, chips } = layoutDay(
			[box(540, 870), box(493, 613), box(540, 630), box(780, 930), ...shorts],
			2
		);
		expect(shown.map((b) => [b.from, b.to, b.lane])).toEqual([
			[540, 870, 0],
			[780, 930, 1]
		]);
		expect(chips).toMatchObject([{ from: 493, to: 637, lane: 1, count: 7 }]);
	});

	it('ranks running, then longest, then by start and end, at any fit', () => {
		const { shown } = layoutDay([box(500, 520), box(480, 600), box(490, 530, true)], Infinity);
		expect(shown.map((b) => b.lane)).toEqual([2, 1, 0]);
	});

	it('fit of one', () => {
		const { shown, chips } = layoutDay([box(360, 420), box(380, 440)], 1);
		expect(shown).toEqual([]);
		expect(chips).toEqual([{ from: 360, to: 440, lane: 0, lanes: 1, count: 2, group: 0 }]);
		expect(layoutDay([box(360, 420)], 1).shown).toHaveLength(1);
	});

	it('fit Infinity never hides', () => {
		const { shown, chips } = layoutDay(
			Array.from({ length: 10 }, () => box(372, 397)),
			Infinity
		);
		expect(shown).toHaveLength(10);
		expect(shown.every((b) => b.lanes === 10)).toBe(true);
		expect(chips).toEqual([]);
	});
});

describe('growShared', () => {
	const day = () => layoutDay([box(480, 810), box(540, 630), box(780, 930)], Infinity).shown;

	it('grows into free time in its lane', () => {
		const grown = growShared(day(), [], (b) => (b.from === 540 ? 120 : 0));
		expect(grown[1].to).toBe(660);
		expect(grown[0].to).toBe(810);
	});

	it('growth stops at the next block', () => {
		const shown = layoutDay([box(480, 505), box(480, 505), box(520, 545)], Infinity).shown;
		const grown = growShared(shown, [], () => 90);
		expect(grown[0].to).toBe(520);
		expect(grown[1].to).toBe(520);
	});

	it('a chip in its lane takes its whole span', () => {
		const { shown, chips } = layoutDay(
			[box(480, 505), box(470, 700), box(520, 600), box(520, 600)],
			2
		);
		expect(chips).toMatchObject([{ from: 520, to: 600, lane: 1 }]);
		const grown = growShared(shown, chips, () => 200);
		expect(grown.find((b) => b.from === 480)!.to).toBe(520);
		// A block whose end falls inside a chip's span does not grow at all.
		const inside = growShared(
			[{ from: 500, to: 540, lane: 1, lanes: 2, group: 0 }],
			[{ from: 520, to: 600, lane: 1, lanes: 2, count: 2, group: 0 }],
			() => 200
		);
		expect(inside[0].to).toBe(540);
	});

	it('never shrinks and leaves lone blocks alone', () => {
		const shown = layoutDay([box(480, 600), box(500, 600), box(700, 725)], Infinity).shown;
		const grown = growShared(shown, [], () => 10);
		expect(grown.map((b) => b.to)).toEqual([600, 600, 725]);
		const lone = growShared(shown, [], () => 500);
		expect(lone[2].to).toBe(725);
	});
});
