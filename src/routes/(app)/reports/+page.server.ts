import { formatDuration } from '#lib/output.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { monthRange } from '#lib/server/screens/copy-out.js';
import { searchFilters } from '#lib/server/screens/entries.js';
import {
	emptyReport,
	readReport,
	reportFor,
	reportQuery,
	type Total
} from '#lib/server/screens/reports.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const { query, error } = readReport(url.searchParams, zone, now);

	let report = emptyReport();
	let listError: string | null = null;
	if (error === null) {
		const r = reportFor(core, query, zone);
		if (r.ok) report = r.report;
		else listError = r.message;
	}

	const { duration } = query.options;
	const rows = (totals: Total[]) =>
		totals.map((t) => ({
			key: t.key,
			label: t.label,
			duration: formatDuration(t.minutes, duration)
		}));

	/** This report with From and To set to this month (0) or last month (1). */
	const month = (back: 0 | 1) =>
		`/reports?${reportQuery({ ...query, search: { ...query.search, ...monthRange(now, zone, back) } })}`;

	return {
		search: query.search,
		filters: searchFilters(core),
		options: query.options,
		days: rows(report.days),
		weeks: rows(report.weeks),
		customers: rows(report.customers),
		projects: rows(report.projects),
		entries: report.entries,
		total: formatDuration(report.minutes, duration),
		running: report.running,
		thisMonth: month(0),
		lastMonth: month(1),
		error: error ?? listError,
		/** Whether the error belongs to the date fields. */
		dateError: error !== null
	};
};
