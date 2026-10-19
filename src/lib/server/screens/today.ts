import { localParts, nextDate, parseTime } from '../core/index';

/** The instant of local midnight on a date; the first valid hour if midnight is skipped. */
function startOfDay(date: string, zone: string): number {
	for (const hour of ['00', '01', '02']) {
		const p = parseTime(`${date}T${hour}:00`, zone);
		if (p.ok) return p.at;
	}
	return Date.parse(`${date}T00:00:00Z`);
}

/** The local day containing `now` in `zone`, as ISO instants of its two midnights. */
export function todayRange(now: number, zone: string): { from: string; to: string; date: string } {
	const { date } = localParts(now, zone);
	return {
		from: new Date(startOfDay(date, zone)).toISOString(),
		to: new Date(startOfDay(nextDate(date), zone)).toISOString(),
		date
	};
}

export const formatTime = (at: number, zone: string): string => localParts(at, zone).time;

export const formatDate = (at: number, zone: string): string => localParts(at, zone).date;

/** `YYYY-MM-DD` of a start in its zone when that is not the day of `now` there; else null. */
export function earlierDate(at: number, zone: string, now: number): string | null {
	const date = formatDate(at, zone);
	return date === formatDate(now, zone) ? null : date;
}

/** The value for an `<input type="datetime-local">`. */
export const toLocalInput = (at: number, zone: string): string => {
	const { date, time } = localParts(at, zone);
	return `${date}T${time}`;
};

/** A duration as `h:mm`, minutes truncated; `0:00` for a negative or non-finite one. */
export function formatHours(ms: number): string {
	const minutes = Number.isFinite(ms) ? Math.floor(Math.max(0, ms) / 60_000) : 0;
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
