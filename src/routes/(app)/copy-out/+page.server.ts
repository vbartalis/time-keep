import { COLUMN_HEADS, formatDuration, type OutputRow } from '#lib/output.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import {
	copyOutQuery,
	monthRange,
	readCopyOut,
	sheetFor,
	type CopyOut
} from '#lib/server/screens/copy-out.js';
import { searchFilters } from '#lib/server/screens/entries.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const { copyOut, error, columnsError } = readCopyOut(url.searchParams, zone, now);

	let rows: OutputRow[] = [];
	let minutes = 0;
	let running = 0;
	let listError: string | null = null;
	if (error === null && columnsError === null) {
		const r = sheetFor(core, copyOut, zone);
		if (r.ok) ({ rows, minutes, running } = r.sheet);
		else listError = r.message;
	}

	/** This copy-out with From and To set to this month (0) or last month (1). */
	const month = (back: 0 | 1) =>
		`/copy-out?${copyOutQuery({ ...copyOut, search: { ...copyOut.search, ...monthRange(now, zone, back) } } satisfies CopyOut)}`;

	return {
		search: copyOut.search,
		filters: searchFilters(core),
		columns: copyOut.columns,
		options: copyOut.options,
		heads: copyOut.columns.map((c) => COLUMN_HEADS[c]),
		rows,
		total: formatDuration(minutes, copyOut.options.duration),
		running,
		thisMonth: month(0),
		lastMonth: month(1),
		csvHref: `/copy-out/csv?${copyOutQuery(copyOut)}`,
		error: error ?? listError,
		/** Whether the error belongs to the date fields. */
		dateError: error !== null,
		columnsError
	};
};
