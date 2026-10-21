import { localParts, nextDate, type Core, type EntryItem } from '../core/index';
import { formatDuration, safeText, type OutputRow } from '#lib/output.js';
import type { OutputOptions } from '#lib/filter/output.js';
import { formFailure } from './actions';
import { outputInput, type OutputView } from './output';
import { startOfDay } from './today';

export type CopyOutOptions = OutputOptions;

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

/** The download's file name: `time-keep-<from|all>-<to|all>.csv`. */
export const csvName = (search: { from: string; to: string }): string =>
	`time-keep-${search.from || 'all'}-${search.to || 'all'}.csv`;

/** The rows of every entry the filter matches, with no page limit; a refused list is its message, said as Entries says it. */
export function sheetFor(
	core: Core,
	view: OutputView,
	zone: string
): { ok: true; sheet: Sheet } | { ok: false; message: string } {
	const listed = core.entries.list(outputInput(view.filter, zone));
	if (!listed.ok) return { ok: false, message: formFailure(listed.error, []).error };
	return { ok: true, sheet: outputRows(listed.value, view.choice.options) };
}
