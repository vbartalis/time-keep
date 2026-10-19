import { type Core, type EntryItem } from '../core/index';
import {
	optionsQuery,
	outputPieces,
	readOptions,
	type CopyOutOptions,
	type Piece
} from './copy-out';
import { readSearch, searchInput, type Search } from './entries';

/** One row of a table: `key` identifies it, `minutes` is the pieces' sum. */
export type Total = { key: string; label: string; minutes: number };

/** The four tables, each summing to `minutes`; `entries` the finished entries counted, `running` those left out. */
export type Report = {
	days: Total[];
	weeks: Total[];
	customers: Total[];
	projects: Total[];
	minutes: number;
	entries: number;
	running: number;
};

/** A report of nothing. */
export const emptyReport = (): Report => ({
	days: [],
	weeks: [],
	customers: [],
	projects: [],
	minutes: 0,
	entries: 0,
	running: 0
});

const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const utcDay = (date: string): number => Date.parse(`${date}T00:00:00Z`);
const dateOf = (day: number): string => new Date(day).toISOString().slice(0, 10);

/** The ISO week a `YYYY-MM-DD` date falls in, with its Monday and Sunday. */
export function isoWeek(date: string): { week: number; monday: string; sunday: string } {
	const day = utcDay(date);
	const monday = day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
	// The week belongs to the year of its Thursday.
	const thursday = monday + 3 * DAY;
	const jan1 = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
	return {
		week: Math.floor((thursday - jan1) / (7 * DAY)) + 1,
		monday: dateOf(monday),
		sunday: dateOf(monday + 6 * DAY)
	};
}

const byText = (a: string, b: string): number => a.localeCompare(b, 'en', { sensitivity: 'base' });

/** Adds each piece to the row `place` names for it; rows come out ordered by `order`. */
function tally(
	pieces: Piece[],
	place: (piece: Piece) => { key: string; label: string; sort: string },
	order: (a: string, b: string) => number
): Total[] {
	const rows = new Map<string, Total & { sort: string }>();
	for (const piece of pieces) {
		const { key, label, sort } = place(piece);
		const row = rows.get(key) ?? { key, label, sort, minutes: 0 };
		row.minutes += piece.minutes;
		rows.set(key, row);
	}
	return [...rows.values()]
		.sort((a, b) => order(a.sort, b.sort) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
		.map(({ key, label, minutes }) => ({ key, label, minutes }));
}

const plain = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Totals per day, week, customer and project, from the pieces a copy-out writes its rows from. */
export function reportTotals(
	entries: EntryItem[],
	options: Pick<CopyOutOptions, 'round' | 'split'>
): Report {
	const { pieces, running } = outputPieces(entries, options);
	return {
		days: tally(
			pieces,
			({ date }) => ({
				key: date,
				label: `${date} ${WEEKDAYS[new Date(utcDay(date)).getUTCDay()]}`,
				sort: date
			}),
			plain
		),
		weeks: tally(
			pieces,
			({ date }) => {
				const { week, monday, sunday } = isoWeek(date);
				return {
					key: monday,
					label: `W${String(week).padStart(2, '0')} ${monday} – ${sunday}`,
					sort: monday
				};
			},
			plain
		),
		customers: tally(
			pieces,
			({ entry }) => ({
				key: entry.customerId,
				label: entry.customerName,
				sort: entry.customerName
			}),
			byText
		),
		projects: tally(
			pieces,
			({ entry }) => {
				const label = `${entry.customerName} › ${entry.projectName}`;
				return { key: entry.projectId, label, sort: label };
			},
			byText
		),
		minutes: pieces.reduce((sum, piece) => sum + piece.minutes, 0),
		entries: entries.length - running,
		running
	};
}

/** What the Reports screen shows: the search and the switches the pieces are cut by. */
export type ReportQuery = { search: Search; options: CopyOutOptions };

/** The report a query string asks for; a bad date gives `error` and the default search. */
export function readReport(
	params: URLSearchParams,
	zone: string,
	now: number
): { query: ReportQuery; error: string | null } {
	const { search, error } = readSearch(params, zone, now);
	return { query: { search, options: readOptions(params) }, error };
}

/** The totals of every entry the search matches, with no page limit; a refused list is its message. */
export function reportFor(
	core: Core,
	query: ReportQuery,
	zone: string
): { ok: true; report: Report } | { ok: false; message: string } {
	const input = searchInput(query.search, zone);
	delete input.limit;
	const listed = core.entries.list(input);
	if (!listed.ok) return { ok: false, message: listed.error.message };
	return { ok: true, report: reportTotals(listed.value, query.options) };
}

/** The query string (no `?`) that reads back as `query`. */
export const reportQuery = (query: ReportQuery): string =>
	optionsQuery(query.search, query.options).toString();
