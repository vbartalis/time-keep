import type { Cookies } from '@sveltejs/kit';
import {
	filterQuery,
	presetHint,
	PRESETS,
	readFilter,
	type Filter,
	type Preset
} from '#lib/filter/filter.js';
import { choiceQuery, readChoice, type OutputChoice } from '#lib/filter/output.js';
import { listInput } from './timesheet.js';

export const OUTPUT_RANGE_COOKIE = 'output_range';
export const OUTPUT_CHOICE_COOKIE = 'output_choice';

/** What Copy-out and Reports show: the entries to take and how to write them. */
export type OutputView = { filter: Filter; choice: OutputChoice };

/**
 * The view an address asks for, the kept range and choice filling what it lacks.
 * `keepRange` is the preset to remember, decided as Entries does: a named preset, or a
 * first visit with neither an address range nor a cookie. `keepChoice` is the choice to
 * remember: only when the address names part of it and leaves no column error.
 */
export function readOutput(
	params: URLSearchParams,
	cookies: { range?: string; choice?: string },
	today: string
): {
	view: OutputView;
	error: string | null;
	columnsError: string | null;
	keepRange: Preset | null;
	keepChoice: string | null;
} {
	const { filter, error } = readFilter(params, cookies.range, today);
	const { choice, named, columnsError } = readChoice(params, cookies.choice);
	const asked = params.get('range');
	const first = asked === null && cookies.range === undefined;
	const keepRange =
		(first || PRESETS.some((p) => p.preset === asked)) && filter.range !== 'custom'
			? filter.range
			: null;
	return {
		view: { filter, choice },
		error,
		columnsError,
		keepRange,
		keepChoice: named && columnsError === null ? choiceQuery(choice) : null
	};
}

/** Writes the cookies `readOutput` asks to keep. */
export function keepOutput(
	cookies: Cookies,
	keep: { keepRange: Preset | null; keepChoice: string | null }
): void {
	const options = {
		path: '/',
		maxAge: 400 * 24 * 60 * 60,
		sameSite: 'lax',
		httpOnly: true
	} as const;
	if (keep.keepRange !== null) cookies.set(OUTPUT_RANGE_COOKIE, keep.keepRange, options);
	if (keep.keepChoice !== null) cookies.set(OUTPUT_CHOICE_COOKIE, keep.keepChoice, options);
}

/** The view as a query string that reads back as the same view. */
export const outputQuery = (view: OutputView): string =>
	`${filterQuery(view.filter)}&${choiceQuery(view.choice)}`;

/** The `entries.list` input of every entry in the filter, oldest first, with no page limit. */
export function outputInput(filter: Filter, zone: string): Record<string, unknown> {
	const input: Record<string, unknown> = { ...listInput(filter, zone), order: 'asc' };
	delete input.limit;
	return input;
}

/** What each preset means today, as Entries shows it beside the preset. */
export const presetHints = (today: string): Record<Preset, string> =>
	Object.fromEntries(PRESETS.map((p) => [p.preset, presetHint(p.preset, today)])) as Record<
		Preset,
		string
	>;
