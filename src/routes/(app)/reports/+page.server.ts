import { formatDuration } from '#lib/output.js';
import { localParts, openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import {
	keepOutput,
	OUTPUT_CHOICE_COOKIE,
	OUTPUT_RANGE_COOKIE,
	outputQuery,
	presetHints,
	readOutput
} from '#lib/server/screens/output.js';
import { emptyReport, reportFor, type Total } from '#lib/server/screens/reports.js';
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

	let report = emptyReport();
	let listError: string | null = null;
	// The columns do not shape a report, so a missing column does not stop it.
	if (error === null) {
		const r = reportFor(core, view, zone);
		if (r.ok) report = r.report;
		else listError = r.message;
	}

	const { duration } = view.choice.options;
	const options = filterOptions(core, { archived: true });
	const colours = new Map(options.projects.map((p) => [p.id, p.colour]));
	const rows = (totals: Total[]) =>
		totals.map((t) => ({
			key: t.key,
			label: t.label,
			duration: formatDuration(t.minutes, duration)
		}));

	return {
		filter: view.filter,
		/** The date fields' error, else the core's refusal of the list. */
		error: error ?? listError,
		/** Whether the error belongs to the date fields. */
		dateError: error !== null,
		choice: view.choice,
		columnsError,
		options,
		hints: presetHints(today),
		query: outputQuery(view),
		days: rows(report.days),
		weeks: rows(report.weeks),
		customers: rows(report.customers),
		projects: report.projects.map((t) => ({
			key: t.key,
			label: t.label,
			customer: t.customer ?? '',
			project: t.project ?? t.label,
			colour: colours.get(t.key) ?? 1,
			duration: formatDuration(t.minutes, duration)
		})),
		entries: report.entries,
		count: report.entries,
		total: formatDuration(report.minutes, duration),
		running: report.running
	};
};
