import { COLUMN_HEADS, formatDuration, type OutputRow } from '#lib/output.js';
import { localParts, openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { sheetFor } from '#lib/server/screens/copy-out.js';
import {
	keepOutput,
	OUTPUT_CHOICE_COOKIE,
	OUTPUT_RANGE_COOKIE,
	outputQuery,
	presetHints,
	readOutput
} from '#lib/server/screens/output.js';
import { filterOptions } from '#lib/server/screens/timesheet.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const today = localParts(now, zone).date;
	const { view, error, columnsError, keepRange, keepChoice } = readOutput(
		url.searchParams,
		{ range: cookies.get(OUTPUT_RANGE_COOKIE), choice: cookies.get(OUTPUT_CHOICE_COOKIE) },
		today
	);
	keepOutput(cookies, { keepRange, keepChoice });

	let rows: OutputRow[] = [];
	let minutes = 0;
	let running = 0;
	let listError: string | null = null;
	// With no column on the rows are still read: the toolbar counts and totals the range.
	if (error === null) {
		const r = sheetFor(core, view, zone);
		if (r.ok) ({ rows, minutes, running } = r.sheet);
		else listError = r.message;
	}

	const query = outputQuery(view);
	return {
		filter: view.filter,
		/** The date fields' error, else the core's refusal of the list. */
		error: error ?? listError,
		/** Whether the error belongs to the date fields. */
		dateError: error !== null,
		choice: view.choice,
		columnsError,
		options: filterOptions(core, { archived: true }),
		hints: presetHints(today),
		query,
		heads: view.choice.columns.map((c) => COLUMN_HEADS[c]),
		rows,
		count: rows.length,
		total: formatDuration(minutes, view.choice.options.duration),
		running,
		csvHref: `/copy-out/csv?${query}`
	};
};
