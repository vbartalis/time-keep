import { overlapping } from '#lib/calendar/grid.js';
import type { TemplateCard } from '#lib/components/today/types.js';
import type { TableDay } from '#lib/components/timesheet/types.js';
import { colourOf } from '#lib/project-colour.js';
import { localParts, nextDate, parseTime, type Core } from '../core/index';
import { rows } from './actions';
import { labelOf, tableRow } from './timesheet';

/** The instant of local midnight on a date; the first valid hour if midnight is skipped. */
export function startOfDay(date: string, zone: string): number {
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

/**
 * The user's templates as Today's rows and the Templates screen's table show them, by
 * name: what each fills, its project's colour and whether a tap runs a timer. `colours`
 * is the projects' palette (`colourOf`), read here when not given.
 */
export function templateCards(
	core: Core,
	colours: Map<string, number> = colourOf(rows(core.projects.list({ includeArchived: true })))
): TemplateCard[] {
	return rows(core.templates.list())
		.map((t) => ({
			id: t.id,
			version: t.version,
			name: t.name,
			customerId: t.customerId,
			customerName: t.customerName,
			projectId: t.projectId,
			projectName: t.projectName,
			activityName: t.activityName,
			locationName: t.locationName,
			startTime: t.startTime,
			endTime: t.endTime,
			durationMinutes: t.durationMinutes,
			timeZone: t.timeZone,
			reference: t.reference,
			description: t.description,
			colour: t.projectId === null ? null : (colours.get(t.projectId) ?? null),
			runs: t.endTime === null && t.durationMinutes === null
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export type TodayData = { day: TableDay; templates: TemplateCard[] };

/**
 * Today's screen data: the entries touching the local day as timesheet rows, newest
 * start first, and the templates by name. Only rows that started today (in their start
 * zone) count in the total, a running one to `now`; an earlier start is marked `since`.
 * Overlaps are judged against all the user's entries from the earliest start shown on,
 * so a long entry that began days ago still counts.
 */
export function todayFor(core: Core, zone: string, now: number): TodayData {
	const range = todayRange(now, zone);
	const listed = rows(core.entries.list({ from: range.from, to: range.to }));
	const colours = colourOf(rows(core.projects.list({ includeArchived: true })));
	const earliest = listed.reduce((m, e) => Math.min(m, e.startAt), Date.parse(range.from));
	const overlaps = overlapping(rows(core.entries.list({ from: new Date(earliest).toISOString() })));

	let totalMs = 0;
	const dayRows = listed
		.map((e) => {
			const date = formatDate(e.startAt, e.startZone);
			if (date === range.date) totalMs += Math.max(0, (e.endAt ?? now) - e.startAt);
			return tableRow(e, { colours, overlaps, since: date === range.date ? null : date });
		})
		.sort((a, b) => b.startAt - a.startAt);

	const templates = templateCards(core, colours);

	return {
		day: { date: range.date, label: labelOf(range.date), totalMs, rows: dayRows },
		templates
	};
}
