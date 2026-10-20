import { describe, expect, it } from 'vitest';
import { clampDay, dropTimes, keepIn } from './drag';

const zone = 'Europe/Budapest';
const at = (local: string, offset = '+02:00') => Date.parse(`${local}:00${offset}`);
const MINUTE = 60_000;

describe('dropTimes', () => {
	const e = { startAt: at('2026-10-13T13:30'), endAt: at('2026-10-13T14:45') };

	it('moves by days and minutes, keeping the duration', () => {
		expect(dropTimes(e, 'move', { days: 3, minutes: 45 }, zone)).toEqual({
			startAt: at('2026-10-16T14:15'),
			endAt: at('2026-10-16T15:30')
		});
	});

	it('moves back a day and up past midnight', () => {
		expect(dropTimes(e, 'move', { days: -1, minutes: -14 * 60 }, zone)).toEqual({
			startAt: at('2026-10-11T23:30'),
			endAt: at('2026-10-12T00:45')
		});
	});

	it('snaps the moved edge to 5 minutes', () => {
		const odd = { startAt: at('2026-10-13T13:32'), endAt: at('2026-10-13T14:32') };
		expect(dropTimes(odd, 'move', { days: 0, minutes: 30 }, zone)).toEqual({
			startAt: at('2026-10-13T14:00'),
			endAt: at('2026-10-13T15:00')
		});
	});

	it('leaves the times alone for no movement', () => {
		const odd = { startAt: at('2026-10-13T13:32'), endAt: at('2026-10-13T14:32') };
		expect(dropTimes(odd, 'move', { days: 0, minutes: 0 }, zone)).toEqual(odd);
	});

	it('resizes the start, keeping the end, five minutes at least', () => {
		expect(dropTimes(e, 'start', { days: 0, minutes: -30 }, zone)).toEqual({
			startAt: at('2026-10-13T13:00'),
			endAt: e.endAt
		});
		expect(dropTimes(e, 'start', { days: 0, minutes: 120 }, zone)).toEqual({
			startAt: e.endAt - 5 * MINUTE,
			endAt: e.endAt
		});
	});

	it("resizes the end, never before the start's five minutes", () => {
		expect(dropTimes(e, 'end', { days: 0, minutes: 75 }, zone)).toEqual({
			startAt: e.startAt,
			endAt: at('2026-10-13T16:00')
		});
		expect(dropTimes(e, 'end', { days: 0, minutes: -300 }, zone)).toEqual({
			startAt: e.startAt,
			endAt: e.startAt + 5 * MINUTE
		});
		expect(dropTimes(e, 'end', { days: -1, minutes: 0 }, zone).endAt).toBe(e.startAt + 5 * MINUTE);
	});

	it('keeps the wall times across a daylight-saving change', () => {
		// Budapest falls back on 2026-10-25: the Saturday is CEST, the Sunday CET.
		const sat = { startAt: at('2026-10-24T09:00'), endAt: at('2026-10-24T10:00') };
		expect(dropTimes(sat, 'move', { days: 1, minutes: 0 }, zone)).toEqual({
			startAt: at('2026-10-25T09:00', '+01:00'),
			endAt: at('2026-10-25T10:00', '+01:00')
		});
		// And springs forward on 2026-03-29.
		const spring = {
			startAt: at('2026-03-28T13:30', '+01:00'),
			endAt: at('2026-03-28T14:00', '+01:00')
		};
		expect(dropTimes(spring, 'move', { days: 1, minutes: 15 }, zone)).toEqual({
			startAt: at('2026-03-29T13:45'),
			endAt: at('2026-03-29T14:15')
		});
	});

	it('moves an entry longer than a day whole', () => {
		const long = { startAt: at('2026-10-13T22:00'), endAt: at('2026-10-15T02:00') };
		expect(dropTimes(long, 'move', { days: 1, minutes: 60 }, zone)).toEqual({
			startAt: at('2026-10-14T23:00'),
			endAt: at('2026-10-16T03:00')
		});
	});
});

describe('clampDay', () => {
	it("keeps an index inside the period's days", () => {
		expect(clampDay(-2, 7)).toBe(0);
		expect(clampDay(3, 7)).toBe(3);
		expect(clampDay(9, 7)).toBe(6);
		expect(clampDay(4, 1)).toBe(0);
	});
});

describe('keepIn', () => {
	const period = { first: '2026-10-12', last: '2026-10-18' };
	const monday = { startAt: at('2026-10-12T13:30'), endAt: at('2026-10-12T15:00') };
	const sunday = { startAt: at('2026-10-18T13:30'), endAt: at('2026-10-18T15:00') };

	it("keeps a move's start from the first day's 00:00", () => {
		const drop = dropTimes(monday, 'move', { days: 0, minutes: -885 }, zone);
		expect(drop.startAt).toBe(at('2026-10-11T22:45'));
		expect(keepIn(drop, monday, 'move', period, zone)).toEqual({
			startAt: at('2026-10-12T00:00'),
			endAt: at('2026-10-12T01:30')
		});
	});

	it("keeps a move's start to the last day's 23:55", () => {
		const drop = dropTimes(sunday, 'move', { days: 0, minutes: 700 }, zone);
		expect(keepIn(drop, sunday, 'move', period, zone)).toEqual({
			startAt: at('2026-10-18T23:55'),
			endAt: at('2026-10-19T01:25')
		});
	});

	it('keeps a day view’s move in its day', () => {
		const day = { first: '2026-10-18', last: '2026-10-18' };
		const drop = dropTimes(sunday, 'move', { days: 0, minutes: -900 }, zone);
		expect(keepIn(drop, sunday, 'move', day, zone).startAt).toBe(at('2026-10-18T00:00'));
	});

	it('keeps a stretched end to the last day’s 24:00', () => {
		const drop = dropTimes(sunday, 'end', { days: 0, minutes: 700 }, zone);
		expect(keepIn(drop, sunday, 'end', period, zone).endAt).toBe(at('2026-10-19T00:00'));
	});

	it('never pushes an entry already reaching outside further out', () => {
		const early = { startAt: at('2026-10-11T23:00'), endAt: at('2026-10-12T01:00') };
		const drop = dropTimes(early, 'move', { days: 0, minutes: 30 }, zone);
		expect(keepIn(drop, early, 'move', period, zone)).toEqual(drop);
		const back = dropTimes(early, 'move', { days: 0, minutes: -30 }, zone);
		expect(keepIn(back, early, 'move', period, zone).startAt).toBe(early.startAt);
	});
});
