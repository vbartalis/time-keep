import { addDays } from './dates.js';
import { instantAt, localDate, localMinutes, snap } from './grid.js';

/** A block's whole move, or a stretch of its start or its end. */
export type DragKind = 'move' | 'start' | 'end';

const MINUTE = 60_000;
/** Every PC drag snaps to this, and leaves an entry at least this long, minutes. */
const STEP = 5;

/** An instant moved by whole days and minutes on the zone's wall clock, snapped. */
function shifted(at: number, delta: { days: number; minutes: number }, zone: string): number {
	const date = addDays(localDate(at, zone), delta.days);
	return instantAt(date, snap(localMinutes(at, zone) + delta.minutes, STEP), zone);
}

/**
 * Where a drag drops an entry: moved by wall-clock days and minutes in `zone`, the moved
 * edge snapped to 5 minutes. A move keeps the duration; a stretch keeps the other end
 * and leaves at least 5 minutes. No movement keeps the times as they are.
 */
export function dropTimes(
	e: { startAt: number; endAt: number },
	kind: DragKind,
	delta: { days: number; minutes: number },
	zone: string
): { startAt: number; endAt: number } {
	if (delta.days === 0 && delta.minutes === 0) return { startAt: e.startAt, endAt: e.endAt };
	if (kind === 'move') {
		const startAt = shifted(e.startAt, delta, zone);
		return { startAt, endAt: startAt + (e.endAt - e.startAt) };
	}
	if (kind === 'start') {
		return {
			startAt: Math.min(shifted(e.startAt, delta, zone), e.endAt - STEP * MINUTE),
			endAt: e.endAt
		};
	}
	return {
		startAt: e.startAt,
		endAt: Math.max(shifted(e.endAt, delta, zone), e.startAt + STEP * MINUTE)
	};
}

/** A column index kept inside the period's `count` days. */
export const clampDay = (index: number, count: number): number =>
	Math.min(Math.max(index, 0), count - 1);

/**
 * A drop kept in the period shown, `first` to `last` (dates): a moved or stretched start
 * from 00:00 of the first day to 23:55 of the last, a stretched end to 24:00 of the last.
 * An entry already reaching outside is never pushed further out than it was.
 */
export function keepIn(
	drop: { startAt: number; endAt: number },
	from: { startAt: number; endAt: number },
	kind: DragKind,
	period: { first: string; last: string },
	zone: string
): { startAt: number; endAt: number } {
	const lo = Math.min(from.startAt, instantAt(period.first, 0, zone));
	const clampStart = (at: number) =>
		Math.min(Math.max(at, lo), Math.max(from.startAt, instantAt(period.last, 1440 - STEP, zone)));
	if (kind === 'move') {
		const startAt = clampStart(drop.startAt);
		return { startAt, endAt: startAt + (from.endAt - from.startAt) };
	}
	if (kind === 'start') {
		return {
			startAt: Math.min(clampStart(drop.startAt), from.endAt - STEP * MINUTE),
			endAt: from.endAt
		};
	}
	const hi = Math.max(from.endAt, instantAt(addDays(period.last, 1), 0, zone));
	return { startAt: from.startAt, endAt: Math.min(drop.endAt, hi) };
}
