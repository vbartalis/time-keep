import { addDays } from '#lib/calendar/dates.js';
import { overlapping } from '#lib/calendar/grid.js';
import type { PickerOption, PickerProject } from '#lib/components/entry/types.js';
import type {
	FilterOptions,
	TableDay,
	TableRow,
	Timesheet
} from '#lib/components/timesheet/types.js';
import type { Filter } from '#lib/filter/filter.js';
import { colourOf } from '#lib/project-colour.js';
import type { Core, EntryItem, Named } from '../core/index';
import { formFailure, rows } from './actions';
import { formatDate, formatTime, startOfDay } from './today';

/** Rows shown; one more is asked for to know whether there were more. */
const LIMIT = 500;

const instant = (date: string, zone: string) => new Date(startOfDay(date, zone)).toISOString();

/** The `entries.list` input of a filter: entries that started in its days, newest first. */
export function listInput(filter: Filter, zone: string): Record<string, unknown> {
	const input: Record<string, unknown> = { startedIn: true, order: 'desc', limit: LIMIT + 1 };
	if (filter.from !== '') input.from = instant(filter.from, zone);
	if (filter.to !== '') input.to = instant(addDays(filter.to, 1), zone);
	if (filter.project !== '') input.projectId = filter.project;
	if (filter.customer !== '') input.customerId = filter.customer;
	if (filter.activity !== 'any' && filter.activity !== '')
		input.activityId = filter.activity === 'none' ? null : filter.activity;
	if (filter.location !== 'any' && filter.location !== '')
		input.locationId = filter.location === 'none' ? null : filter.location;
	if (filter.q !== '') input.text = filter.q;
	return input;
}

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const labelOf = (date: string) =>
	`${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${date}`;

/**
 * One entry as a table row: times in its own zones, its project's colour, and whether it
 * overlaps. `since` is the start date when it is before the day shown (Today), else null.
 */
export function tableRow(
	e: EntryItem,
	ctx: { colours: Map<string, number>; overlaps: Set<string>; since: string | null }
): TableRow {
	const date = formatDate(e.startAt, e.startZone);
	return {
		id: e.id,
		version: e.version,
		startAt: e.startAt,
		endAt: e.endAt,
		start: formatTime(e.startAt, e.startZone),
		end: e.endAt === null ? null : formatTime(e.endAt, e.endZone ?? e.startZone),
		plusDays:
			e.endAt === null
				? 0
				: dayNumber(formatDate(e.endAt, e.endZone ?? e.startZone)) - dayNumber(date),
		running: e.endAt === null,
		customer: e.customerName,
		project: e.projectName,
		colour: ctx.colours.get(e.projectId) ?? 1,
		activity: e.activityName,
		location: e.locationName,
		reference: e.reference,
		description: e.description,
		overlaps: ctx.overlaps.has(e.id),
		since: ctx.since
	};
}

/**
 * The filtered entries as days of rows, newest first. A row's day is its start date in
 * its start zone and it counts whole there; a running entry counts to `now`. A row
 * overlaps when another entry does, whether or not the filter shows that one. A refused
 * read (a search over 200 characters) is an empty sheet carrying the core's message.
 */
export function timesheetFor(core: Core, filter: Filter, zone: string, now: number): Timesheet {
	const read = core.entries.list(listInput(filter, zone));
	if (!read.ok) {
		// The field's own message ("Use 1–200 characters."), not the core's general one.
		const { error } = formFailure(read.error, []);
		return { days: [], count: 0, totalMs: 0, truncated: false, error };
	}
	const listed = read.value;
	const truncated = listed.length > LIMIT;
	const found = truncated ? listed.slice(0, LIMIT) : listed;
	const all = rows(
		core.entries.list({
			...(filter.from !== '' && { from: instant(addDays(filter.from, -1), zone) }),
			...(filter.to !== '' && { to: instant(addDays(filter.to, 2), zone) })
		})
	);
	const overlaps = overlapping(all);
	const colours = colourOf(rows(core.projects.list({ includeArchived: true })));

	const days = new Map<string, TableDay>();
	let totalMs = 0;
	for (const e of found) {
		const date = formatDate(e.startAt, e.startZone);
		let day = days.get(date);
		if (!day) {
			day = { date, label: labelOf(date), totalMs: 0, rows: [] };
			days.set(date, day);
		}
		const ms = Math.max(0, (e.endAt ?? now) - e.startAt);
		day.totalMs += ms;
		totalMs += ms;
		day.rows.push(tableRow(e, { colours, overlaps, since: null }));
	}
	const ordered = [...days.values()]
		.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
		.map((d) => ({ ...d, rows: d.rows.sort((a, b) => b.startAt - a.startAt) }));
	return { days: ordered, count: found.length, totalMs, truncated, error: null };
}

/**
 * The filter's pickers: projects (with customer and colour), activities and locations;
 * archived rows are included and flagged only when asked.
 */
export function filterOptions(core: Core, opts: { archived: boolean }): FilterOptions {
	const includeArchived = opts.archived;
	const customers = rows(core.customers.list({ includeArchived: true }));
	const archivedCustomers = new Set(
		customers.filter((c) => c.archivedAt !== null).map((c) => c.id)
	);
	const everyProject = rows(core.projects.list({ includeArchived: true }));
	const colours = colourOf(everyProject);
	const projects: PickerProject[] = everyProject
		.map((p) => ({
			id: p.id,
			name: p.name,
			customerId: p.customerId,
			customerName: p.customerName,
			colour: colours.get(p.id) ?? 1,
			archived: p.archivedAt !== null || archivedCustomers.has(p.customerId)
		}))
		.filter((p) => includeArchived || !p.archived);
	const options = (list: Named[]): PickerOption[] =>
		list
			.map((r) => ({ id: r.id, name: r.name, archived: r.archivedAt !== null }))
			.filter((r) => includeArchived || !r.archived);
	return {
		projects,
		activities: options(rows(core.activities.list({ includeArchived: true }))),
		locations: options(rows(core.locations.list({ includeArchived: true })))
	};
}
