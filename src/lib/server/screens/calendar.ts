import { addDays, periodDays, type View } from '#lib/calendar/dates.js';
import { dayTotals, localDate, overlapping } from '#lib/calendar/grid.js';
import type { CalendarData, CalendarEntry } from '#lib/components/calendar/types.js';
import { matchesScope, scopeCount, scopeQuery, type Scope } from '#lib/filter/filter.js';
import { colourOf } from '#lib/project-colour.js';
import type { Core } from '../core/index';
import { rows, text } from './actions';
import { formatTime, startOfDay } from './today';

/**
 * The entries touching a calendar period (and the week holding its date, for the week
 * total), shaped for the Calendar. Midnight crossings and earlier-started timers come in.
 * Only entries matching `scope` are shown and counted; overlaps are found among every
 * entry, so a block keeps its mark when its partner is filtered out (call 38).
 */
export function calendarFor(
	core: Core,
	opts: { view: View; date: string; zone: string; now: number; scope: Scope }
): Omit<CalendarData, 'zoneSource' | 'flash' | 'back' | 'today' | 'options'> {
	const { view, date, zone, now, scope } = opts;
	const days = periodDays(view, date);
	const weekDays = periodDays('week', date);
	const first = [days[0], weekDays[0]].sort()[0];
	const last = [days[days.length - 1], weekDays[6]].sort().reverse()[0];
	const found = rows(
		core.entries.list({
			from: new Date(startOfDay(first, zone)).toISOString(),
			to: new Date(startOfDay(addDays(last, 1), zone)).toISOString(),
			order: 'asc'
		})
	);
	const colours = colourOf(rows(core.projects.list({ includeArchived: true })));
	const overlaps = overlapping(found);
	const shown = found.filter((e) => matchesScope(e, scope));
	// The week's entries are listed for its total only; the grid shows those touching the period.
	const from = startOfDay(days[0], zone);
	const to = startOfDay(addDays(days[days.length - 1], 1), zone);
	const inView = shown.filter((e) => e.startAt < to && (e.endAt === null || e.endAt > from));
	const entries: CalendarEntry[] = inView.map((e) => ({
		id: e.id,
		version: e.version,
		projectName: e.projectName,
		customerName: e.customerName,
		colour: colours.get(e.projectId) ?? 1,
		activityName: e.activityName,
		locationName: e.locationName,
		reference: e.reference,
		description: e.description,
		startAt: e.startAt,
		endAt: e.endAt,
		date: localDate(e.startAt, zone),
		startTime: formatTime(e.startAt, zone),
		endTime: e.endAt === null ? null : formatTime(e.endAt, zone),
		running: e.endAt === null,
		overlaps: overlaps.has(e.id)
	}));
	const minutes = dayTotals(shown, zone, now);
	const sum = (ds: string[]) => ds.reduce((n, d) => n + (minutes.get(d) ?? 0), 0);
	const totals: Record<string, number> = {};
	for (const d of days) if (minutes.has(d)) totals[d] = minutes.get(d)!;
	const month = date.slice(0, 7);
	return {
		view,
		date,
		zone,
		days,
		entries,
		totals,
		periodTotal: sum(view === 'month' ? days.filter((d) => d.startsWith(month)) : days),
		weekTotal: sum(weekDays),
		scope,
		scopeQuery: scopeQuery(scope),
		filtered: scopeCount(scope) > 0,
		now
	};
}

/**
 * The input of `entries.update` for a block dragged on the Calendar: the entry, the
 * version it was drawn with, and its new start and end as instants (so its zones stay).
 */
export function moveInput(
	form: FormData
):
	| { ok: true; input: { id: string; expectedVersion: number; start: string; end: string } }
	| { ok: false } {
	const [id, version, start, end] = ['id', 'version', 'start', 'end'].map((k) => text(form, k));
	if (!id || !/^\d+$/.test(version) || !start || !end) return { ok: false };
	return { ok: true, input: { id, expectedVersion: Number(version), start, end } };
}
