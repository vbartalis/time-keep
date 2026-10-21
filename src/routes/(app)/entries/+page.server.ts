import { fail } from '@sveltejs/kit';
import type { BulkEdit, BulkFailure, Chosen } from '#lib/components/timesheet/types.js';
import type { Timesheet } from '#lib/components/timesheet/types.js';
import { filterQuery, PRESETS, readFilter } from '#lib/filter/filter.js';
import {
	localParts,
	openCore,
	type Core,
	type CoreError,
	type EntryItem
} from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, formFailure, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import {
	bulkUpdates,
	deleteLabel,
	editLabel,
	readBulk,
	runBulk,
	selection
} from '#lib/server/screens/entries.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import { presetHints } from '#lib/server/screens/output.js';
import { filterOptions, timesheetFor } from '#lib/server/screens/timesheet.js';
import { formatDate, formatTime } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

const RANGE_COOKIE = 'entries_range';

/** The change form's fields, as the core names them; a message for any other is general. */
const FIELDS = ['projectId', 'activityId', 'locationId', 'reference', 'description'] as const;

/** The change form's fields as posted. */
const VALUES = [
	'projectId',
	'activity',
	'location',
	'reference',
	'clearReference',
	'find',
	'replace'
] as const;

export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const today = localParts(now, zone).date;
	const { filter, error } = readFilter(url.searchParams, cookies.get(RANGE_COOKIE), today);

	// Kept when the address names a preset (call 37), and on a first visit with neither
	// address nor cookie, where this month is the choice made. Never for custom, nor
	// when the range was read from the cookie.
	const asked = url.searchParams.get('range');
	const first = asked === null && cookies.get(RANGE_COOKIE) === undefined;
	if (first || PRESETS.some((p) => p.preset === asked)) {
		cookies.set(RANGE_COOKIE, filter.range, {
			path: '/',
			maxAge: 400 * 24 * 60 * 60,
			sameSite: 'lax',
			httpOnly: true
		});
	}

	const sheet: Timesheet =
		error === null
			? timesheetFor(core, filter, zone, now)
			: { days: [], count: 0, totalMs: 0, truncated: false, error: null };

	return {
		filter,
		error,
		/** Whether the error belongs to the date fields. */
		dateError: error !== null,
		sheet,
		options: filterOptions(core, { archived: true }),
		choices: filterOptions(core, { archived: false }),
		hints: presetHints(today),
		flash: takeFlash(cookies),
		back: `/entries?${filterQuery(filter)}`,
		today,
		now,
		select: url.searchParams.get('select') === '1',
		all: url.searchParams.get('all') === '1'
	};
};

/** The user's core, the posted selection (first of each id wins) and where to return. */
async function posted(request: Request, locals: App.Locals) {
	const form = await request.formData();
	const now = Date.now();
	const core = openCore(getDb(), requireUser(locals).id, 'ui', () => now);
	const seen = new Set<string>();
	const chosen = selection(form).filter((c) => !seen.has(c.id) && seen.add(c.id));
	// What a refusal puts back: the form, and the selection with the versions as posted.
	const kept = {
		values: Object.fromEntries(VALUES.map((k) => [k, text(form, k)])),
		selected: chosen.map((c) => c.id),
		versions: Object.fromEntries(chosen.map((c) => [c.id, text(form, `version.${c.id}`)]))
	};
	return { form, core, chosen, kept, back: safeBack(text(form, 'back')) };
}

type Kept = Pick<BulkFailure, 'values' | 'selected' | 'versions'>;

/** A refusal of the screen's own: nothing selected, or nothing to change. */
const plain = (action: BulkFailure['action'], error: string, kept: Kept) =>
	fail(400, { action, error, fields: {}, conflict: false, ...kept } satisfies BulkFailure);

/**
 * The core's refusal of a bulk change, naming the entry it came from when that is
 * known: "2026-10-07 09:00, CompA › ProjC: <message>", in the entry's own start zone.
 */
function refusal(
	action: BulkFailure['action'],
	err: CoreError,
	failed: EntryItem | undefined,
	kept: Kept
) {
	const { error, fields } = formFailure(err, action === 'apply' ? FIELDS : []);
	const where = failed
		? `${formatDate(failed.startAt, failed.startZone)} ${formatTime(failed.startAt, failed.startZone)}, ${failed.customerName} › ${failed.projectName}: `
		: '';
	// Only a stale row is helped by a reload; other conflicts (a later timer on the
	// project) are read like any refusal.
	const stale = failed !== undefined && kept.versions[failed.id] !== String(failed.version);
	return fail(400, {
		action,
		error: `${where}${error}`,
		fields,
		conflict: err.code === 'conflict' && Object.keys(fields).length === 0 && stale,
		...kept
	} satisfies BulkFailure);
}

/** The entries as they are now, by id; ids the core does not know are left out. */
function current(core: Core, ids: string[]): Map<string, EntryItem> {
	const map = new Map<string, EntryItem>();
	for (const id of ids) {
		const r = core.entries.get({ id });
		if (r.ok) map.set(id, r.value);
	}
	return map;
}

export const actions: Actions = {
	apply: async ({ request, locals, cookies }) => {
		const { form, core, chosen, kept, back } = await posted(request, locals);
		if (chosen.length === 0) return plain('apply', 'Select at least one entry.', kept);
		const entries = current(core, kept.selected);
		const inputs = bulkUpdates(readBulk(form), chosen, entries);
		if (inputs.length === 0) return plain('apply', 'Nothing to change.', kept);
		const { result, failedId } = runBulk(core, editLabel(inputs.length), inputs, 'update');
		if (result.ok) done(core, cookies, result, back);
		return refusal('apply', result.error, entries.get(failedId ?? ''), kept);
	},

	// Edit without JavaScript: the page opens the bulk form for the ticked entries.
	edit: async ({ request, locals }) => {
		const { chosen, kept } = await posted(request, locals);
		if (chosen.length === 0) return plain('edit', 'Select at least one entry.', kept);
		return {
			action: 'edit',
			chosen: chosen.map((c): Chosen => ({ id: c.id, version: kept.versions[c.id] }))
		} satisfies BulkEdit;
	},

	// Delete at once; the undo strip is the way back (call 8).
	delete: async ({ request, locals, cookies }) => {
		const { core, chosen, kept, back } = await posted(request, locals);
		if (chosen.length === 0) return plain('delete', 'Select at least one entry.', kept);
		const inputs = chosen.map(({ id, version }) => ({ id, expectedVersion: version }));
		const { result, failedId } = runBulk(core, deleteLabel(inputs.length), inputs, 'delete');
		if (result.ok) done(core, cookies, result, back);
		const failed = failedId === null ? null : core.entries.get({ id: failedId });
		return refusal('delete', result.error, failed?.ok ? failed.value : undefined, kept);
	}
};
