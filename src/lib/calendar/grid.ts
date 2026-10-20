import { addDays, hm } from './dates.js';

export type Piece = { date: string; from: number; to: number; first: boolean; last: boolean };

type Span = { startAt: number; endAt: number | null };

const MINUTE = 60_000;
const formats = new Map<string, Intl.DateTimeFormat>();

const wall = (at: number, zone: string) => {
	let f = formats.get(zone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-CA', {
			timeZone: zone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
		formats.set(zone, f);
	}
	const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
	return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
};

export const localDate = (at: number, zone: string): string => wall(at, zone).date;

/** Wall-clock minutes since local midnight, 0-1439. */
export const localMinutes = (at: number, zone: string): number => wall(at, zone).minutes;

/** The first instant of a local date; where midnight is skipped, the first valid minute. */
function startOfDay(date: string, zone: string): number {
	const guess = Math.floor(Date.parse(`${date}T00:00:00Z`) / MINUTE);
	let lo = guess - 15 * 60; // a minute still on an earlier date
	let hi = guess + 15 * 60; // a minute already on a later one
	while (hi - lo > 1) {
		const mid = Math.floor((lo + hi) / 2);
		if (localDate(mid * MINUTE, zone) < date) lo = mid;
		else hi = mid;
	}
	return hi * MINUTE;
}

/**
 * The instant at a wall-clock time: `minutes` past midnight of a local date (any number,
 * running into earlier or later dates). A time skipped by a spring-forward lands after
 * the gap.
 */
export function instantAt(date: string, minutes: number, zone: string): number {
	const naive = Date.parse(`${date}T00:00:00Z`) + minutes * MINUTE;
	/** How far the zone's wall clock is ahead of UTC at an instant, ms. */
	const offset = (at: number) => {
		const w = wall(at, zone);
		const shown = Date.parse(`${w.date}T00:00:00Z`) + w.minutes * MINUTE;
		return shown - Math.floor(at / MINUTE) * MINUTE;
	};
	return naive - offset(naive - offset(naive));
}

export function piecesOf(e: Span, days: string[], zone: string, now: number): Piece[] {
	const end = e.endAt ?? now;
	const out: Piece[] = [];
	for (const date of days) {
		const dayStart = startOfDay(date, zone);
		const dayEnd = startOfDay(addDays(date, 1), zone);
		if (end <= dayStart || e.startAt >= dayEnd) continue;
		const first = e.startAt >= dayStart;
		const last = e.endAt !== null && end <= dayEnd;
		out.push({
			date,
			from: first ? localMinutes(e.startAt, zone) : 0,
			to: end < dayEnd ? localMinutes(end, zone) : 1440,
			first,
			last
		});
	}
	return out;
}

/** Side-by-side lanes for pieces of one day; each cluster of intersecting pieces shares a lane count. */
export function lanes<T extends { from: number; to: number }>(
	ps: T[]
): (T & { lane: number; lanes: number })[] {
	const order = ps.map((_, i) => i).sort((a, b) => ps[a].from - ps[b].from || ps[a].to - ps[b].to);
	const result = new Array<T & { lane: number; lanes: number }>(ps.length);
	let cluster: number[] = [];
	let laneEnds: number[] = [];
	let clusterEnd = -Infinity;
	const close = () => {
		for (const i of cluster) result[i].lanes = laneEnds.length;
		cluster = [];
		laneEnds = [];
	};
	for (const i of order) {
		const p = ps[i];
		if (p.from >= clusterEnd) {
			close();
			clusterEnd = -Infinity;
		}
		let lane = laneEnds.findIndex((end) => end <= p.from);
		if (lane === -1) lane = laneEnds.length;
		laneEnds[lane] = p.to;
		clusterEnd = Math.max(clusterEnd, p.to);
		result[i] = { ...p, lane, lanes: 0 };
		cluster.push(i);
	}
	close();
	return result;
}

/** Finished entries whose half-open intervals intersect another finished one. */
export function overlapping(
	es: { id: string; startAt: number; endAt: number | null }[]
): Set<string> {
	const done = es.filter(
		(e): e is { id: string; startAt: number; endAt: number } => e.endAt !== null
	);
	const out = new Set<string>();
	for (let i = 0; i < done.length; i++) {
		for (let j = i + 1; j < done.length; j++) {
			if (done[i].startAt < done[j].endAt && done[j].startAt < done[i].endAt) {
				out.add(done[i].id);
				out.add(done[j].id);
			}
		}
	}
	return out;
}

/**
 * Whole minutes in a span of ms, truncated as every screen counts them (Today, Entries,
 * the timer bar); none for a negative or non-finite span.
 */
export const wholeMinutes = (ms: number): number =>
	Number.isFinite(ms) ? Math.floor(Math.max(0, ms) / MINUTE) : 0;

/** A span of ms as `h:mm` in whole minutes: 1:40:31 is `1:40`. */
export const spanText = (ms: number): string => hm(wholeMinutes(ms));

/**
 * Milliseconds by the start's local date, exact: summed, then truncated only to be shown,
 * as Entries' total is. A running entry counts to `now`.
 */
export function dayTotals(es: Span[], zone: string, now: number): Map<string, number> {
	const totals = new Map<string, number>();
	for (const e of es) {
		const date = localDate(e.startAt, zone);
		const ms = Math.max(0, (e.endAt ?? now) - e.startAt);
		totals.set(date, (totals.get(date) ?? 0) + ms);
	}
	return totals;
}

export const snap = (minutes: number, step: number): number => Math.round(minutes / step) * step;

export function halfHourSlot(minutes: number): { from: number; to: number } {
	const from = Math.floor(minutes / 30) * 30;
	return { from, to: Math.min(from + 60, 1440) };
}

/**
 * A PC drag on empty time, in its day: the press holds the 5 minutes under it (a press a
 * hair below a line stays on that line), the moving end rounds to 5; five minutes at least.
 */
export function dragRange(press: number, at: number): { from: number; to: number } {
	const held = Math.min(Math.floor(press / 5) * 5, 1435);
	const moving = snap(at, 5);
	const from = Math.min(held, moving, 1435);
	return { from, to: Math.min(1440, Math.max(held, moving, from + 5)) };
}
