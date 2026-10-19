import { localParts, nextDate, previousDate, type Core, type EntryItem } from '../core/index';
import {
	COLUMNS,
	formatDuration,
	safeText,
	type Column,
	type DurationFormat,
	type OutputRow
} from '#lib/output.js';
import { readSearch, searchInput, type Search } from './entries';
import { startOfDay } from './today';

export type CopyOutOptions = { round: boolean; split: boolean; duration: DurationFormat };

/** The rows of a copy-out: `minutes` summed over them, `running` the entries left out for having no end. */
export type Sheet = { rows: OutputRow[]; minutes: number; running: number };

const MINUTE = 60_000;
const FIVE_MINUTES = 300_000;

/** An instant to the nearest 5 minutes (2:30 up), or cut to the minute. */
const adjust = (at: number, round: boolean): number =>
	round
		? Math.floor((at + 150_000) / FIVE_MINUTES) * FIVE_MINUTES
		: Math.floor(at / MINUTE) * MINUTE;

/** The end as written beside a row's date: a time, `24:00` for the next midnight, else date and time. */
function endText(at: number, zone: string, rowDate: string): string {
	const end = localParts(at, zone);
	if (end.date === rowDate) return end.time;
	if (end.date === nextDate(rowDate) && end.time === '00:00') return '24:00';
	return `${end.date} ${end.time}`;
}

/** One day's (or the whole entry's) share of an entry, rounded or cut: `date` is its start in `startZone`. */
export type Piece = {
	entry: EntryItem;
	date: string;
	from: number;
	to: number;
	endZone: string;
	minutes: number;
};

/** Entries as pieces, in their order; rounding and splitting happen here. `running` counts entries with no end. */
export function outputPieces(
	entries: EntryItem[],
	options: Pick<CopyOutOptions, 'round' | 'split'>
): { pieces: Piece[]; running: number } {
	const pieces: Piece[] = [];
	let running = 0;

	for (const entry of entries) {
		if (entry.endAt === null) {
			running++;
			continue;
		}
		const zone = entry.startZone;
		const start = adjust(entry.startAt, options.round);
		const end = Math.max(start, adjust(entry.endAt, options.round));

		const cuts: { from: number; to: number; endZone: string }[] = [];
		if (options.split) {
			let from = start;
			let boundary = startOfDay(nextDate(localParts(from, zone).date), zone);
			while (boundary < end) {
				cuts.push({ from, to: boundary, endZone: zone });
				from = boundary;
				boundary = startOfDay(nextDate(localParts(from, zone).date), zone);
			}
			cuts.push({ from, to: end, endZone: zone });
		} else {
			cuts.push({ from: start, to: end, endZone: entry.endZone ?? zone });
		}

		for (const cut of cuts) {
			pieces.push({
				entry,
				date: localParts(cut.from, zone).date,
				...cut,
				minutes: (cut.to - cut.from) / MINUTE
			});
		}
	}
	return { pieces, running };
}

/** Entries as output rows, in their order. */
export function outputRows(entries: EntryItem[], options: CopyOutOptions): Sheet {
	const { pieces, running } = outputPieces(entries, options);
	let minutes = 0;
	const rows = pieces.map((piece) => {
		const { entry } = piece;
		const begin = localParts(piece.from, entry.startZone);
		minutes += piece.minutes;
		return {
			date: begin.date,
			start: begin.time,
			end: endText(piece.to, piece.endZone, begin.date),
			duration: formatDuration(piece.minutes, options.duration),
			customer: safeText(entry.customerName),
			project: safeText(entry.projectName),
			activity: safeText(entry.activityName ?? ''),
			location: safeText(entry.locationName ?? ''),
			reference: safeText(entry.reference ?? ''),
			description: safeText(entry.description ?? '')
		};
	});
	return { rows, minutes, running };
}

/** What the Copy-out screen shows: the search, the columns to write and how to write them. */
export type CopyOut = { search: Search; columns: Column[]; options: CopyOutOptions };

/** The switches a query string asks for; with `show` they are what was sent, without it the defaults. */
export function readOptions(params: URLSearchParams): CopyOutOptions {
	const shown = params.has('show');
	return {
		round: shown ? params.get('round') === '1' : true,
		split: shown && params.get('split') === '1',
		duration: params.get('duration') === 'decimal' ? 'decimal' : 'hm'
	};
}

/**
 * The copy-out a query string asks for. The form sends a hidden `show=1`; with it the
 * columns and switches are what was sent, without it they are the defaults.
 */
export function readCopyOut(
	params: URLSearchParams,
	zone: string,
	now: number
): { copyOut: CopyOut; error: string | null; columnsError: string | null } {
	const { search, error } = readSearch(params, zone, now);
	const shown = params.has('show');
	const sent = new Set(params.getAll('col'));
	const columns = shown ? COLUMNS.filter((column) => sent.has(column)) : [...COLUMNS];
	return {
		copyOut: { search, columns, options: readOptions(params) },
		error,
		columnsError: shown && columns.length === 0 ? 'Choose at least one column.' : null
	};
}

/** `show=1`, the search and the switches as a query; no columns. */
export function optionsQuery(search: Search, options: CopyOutOptions): URLSearchParams {
	const query = new URLSearchParams({ show: '1', from: search.from, to: search.to });
	if (search.customerId !== '') query.set('customerId', search.customerId);
	if (search.projectId !== '') query.set('projectId', search.projectId);
	if (search.activity !== 'any') query.set('activity', search.activity);
	if (search.location !== 'any') query.set('location', search.location);
	if (search.text !== '') query.set('text', search.text);
	if (options.round) query.set('round', '1');
	if (options.split) query.set('split', '1');
	if (options.duration === 'decimal') query.set('duration', 'decimal');
	return query;
}

/** The full query string (no `?`) that reads back as `copyOut`. */
export function copyOutQuery(copyOut: CopyOut): string {
	const { search, columns, options } = copyOut;
	const query = optionsQuery(search, options);
	for (const column of columns) query.append('col', column);
	return query.toString();
}

/** This month's (`back` 0) or last month's (`back` 1) first and last day in `zone`. */
export function monthRange(now: number, zone: string, back: 0 | 1): { from: string; to: string } {
	const today = localParts(now, zone).date;
	const first = new Date(
		Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - back, 1)
	);
	const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
	return {
		from: first.toISOString().slice(0, 10),
		to: previousDate(next.toISOString().slice(0, 10))
	};
}

/** The download's file name: `time-keep-<from|all>-<to|all>.csv`. */
export const csvName = (search: Search): string =>
	`time-keep-${search.from || 'all'}-${search.to || 'all'}.csv`;

/** The rows of every entry the search matches, with no page limit; a refused list is its message. */
export function sheetFor(
	core: Core,
	copyOut: CopyOut,
	zone: string
): { ok: true; sheet: Sheet } | { ok: false; message: string } {
	const input = searchInput(copyOut.search, zone);
	delete input.limit;
	const listed = core.entries.list(input);
	if (!listed.ok) return { ok: false, message: listed.error.message };
	return { ok: true, sheet: outputRows(listed.value, copyOut.options) };
}
