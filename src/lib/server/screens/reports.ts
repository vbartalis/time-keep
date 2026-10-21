import { type Core, type EntryItem } from '../core/index';
import { outputPieces, type CopyOutOptions, type Piece } from './copy-out';
import { outputInput, type OutputView } from './output';
import { formFailure } from './actions';
import { labelOf } from './timesheet';

/**
 * One row of a table: `key` identifies it, `minutes` is the pieces' sum. A Projects row
 * also names its customer and project apart (`customer`, `project`).
 */
export type Total = {
	key: string;
	label: string;
	minutes: number;
	customer?: string;
	project?: string;
};

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

/**
 * "W40 · 2026-09-28 – 10-04": the ISO week, its Monday, and its Sunday without the year,
 * or in full when the Sunday falls in the next year ("W53 · 2026-12-28 – 2027-01-03").
 */
export function weekLabel(date: string): string {
	const { week, monday, sunday } = isoWeek(date);
	const end = sunday.slice(0, 4) === monday.slice(0, 4) ? sunday.slice(5) : sunday;
	return `W${String(week).padStart(2, '0')} · ${monday} – ${end}`;
}

/** Adds each piece to the row `place` names for it; rows come out ordered by `order`. */
function tally(
	pieces: Piece[],
	place: (piece: Piece) => { sort: string; row: Omit<Total, 'minutes'> },
	order: (a: string, b: string) => number
): Total[] {
	const rows = new Map<string, { sort: string; total: Total }>();
	for (const piece of pieces) {
		const { sort, row } = place(piece);
		const found = rows.get(row.key) ?? { sort, total: { ...row, minutes: 0 } };
		found.total.minutes += piece.minutes;
		rows.set(row.key, found);
	}
	return [...rows.values()]
		.sort(
			(a, b) =>
				order(a.sort, b.sort) ||
				(a.total.key < b.total.key ? -1 : a.total.key > b.total.key ? 1 : 0)
		)
		.map(({ total }) => total);
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
			({ date }) => ({ sort: date, row: { key: date, label: labelOf(date) } }),
			plain
		),
		weeks: tally(
			pieces,
			({ date }) => {
				const { monday } = isoWeek(date);
				return { sort: monday, row: { key: monday, label: weekLabel(date) } };
			},
			plain
		),
		customers: tally(
			pieces,
			({ entry }) => ({
				sort: entry.customerName,
				row: { key: entry.customerId, label: entry.customerName }
			}),
			byText
		),
		projects: tally(
			pieces,
			({ entry }) => {
				const label = `${entry.customerName} › ${entry.projectName}`;
				return {
					sort: label,
					row: {
						key: entry.projectId,
						label,
						customer: entry.customerName,
						project: entry.projectName
					}
				};
			},
			byText
		),
		minutes: pieces.reduce((sum, piece) => sum + piece.minutes, 0),
		entries: entries.length - running,
		running
	};
}

/** The totals of every entry the filter matches, with no page limit; a refused list is its message. */
export function reportFor(
	core: Core,
	view: OutputView,
	zone: string
): { ok: true; report: Report } | { ok: false; message: string } {
	const listed = core.entries.list(outputInput(view.filter, zone));
	if (!listed.ok) return { ok: false, message: formFailure(listed.error, []).error };
	return { ok: true, report: reportTotals(listed.value, view.choice.options) };
}
