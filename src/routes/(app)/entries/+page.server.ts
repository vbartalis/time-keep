import { fail } from '@sveltejs/kit';
import type { BulkFailure, Chosen, DeleteConfirm, ListRow } from '#lib/components/entries/types.js';
import {
	openCore,
	type Core,
	type CoreError,
	type EntryItem,
	type Named
} from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, formFailure, groupProjects, rows, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import {
	bulkUpdates,
	deleteLabel,
	editLabel,
	readBulk,
	readSearch,
	runBulk,
	searchInput,
	searchPath,
	selection
} from '#lib/server/screens/entries.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import { formatDate, formatHours, formatTime } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

/** The most rows the screen lists; the search asks the core for one more to know there are more. */
const SHOWN = 500;

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

const archived = (name: string, isArchived: boolean) => (isArchived ? `${name} (archived)` : name);

/** Every row of a kind, archived ones marked, for the filters. */
const marked = (list: Named[]) =>
	list.map((r) => ({ id: r.id, name: archived(r.name, r.archivedAt !== null) }));

export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const { search, error } = readSearch(url.searchParams, zone, now);

	let listed: EntryItem[] = [];
	let listError: string | null = null;
	if (error === null) {
		const r = core.entries.list(searchInput(search, zone));
		if (r.ok) listed = r.value;
		else listError = r.error.message;
	}
	const truncated = listed.length > SHOWN;
	const shown = listed.slice(0, SHOWN);

	const entries: ListRow[] = shown.map((e) => ({
		id: e.id,
		version: e.version,
		date: formatDate(e.startAt, e.startZone),
		in: formatTime(e.startAt, e.startZone),
		out: e.endAt === null ? null : formatTime(e.endAt, e.endZone ?? e.startZone),
		hours: formatHours((e.endAt ?? now) - e.startAt),
		customer: e.customerName,
		project: e.projectName,
		activity: e.activityName,
		location: e.locationName,
		reference: e.reference,
		description: e.description,
		checked: search.all
	}));
	const total = shown.reduce((sum, e) => sum + Math.max(0, (e.endAt ?? now) - e.startAt), 0);

	const customers = rows(core.customers.list({ includeArchived: true }));
	const archivedCustomers = new Set(
		customers.filter((c) => c.archivedAt !== null).map((c) => c.id)
	);
	const allProjects = rows(core.projects.list({ includeArchived: true })).map((p) => ({
		...p,
		name: archived(p.name, p.archivedAt !== null || archivedCustomers.has(p.customerId)),
		customerName: archived(p.customerName, archivedCustomers.has(p.customerId))
	}));

	return {
		search,
		error: error ?? listError,
		/** Whether the error belongs to the date fields. */
		dateError: error !== null,
		entries,
		truncated,
		count: entries.length,
		total: formatHours(total),
		filters: {
			customers: marked(customers),
			projects: groupProjects(allProjects),
			activities: marked(rows(core.activities.list({ includeArchived: true }))),
			locations: marked(rows(core.locations.list({ includeArchived: true })))
		},
		choices: {
			projects: groupProjects(rows(core.projects.list())),
			activities: rows(core.activities.list()).map(({ id, name }) => ({ id, name })),
			locations: rows(core.locations.list()).map(({ id, name }) => ({ id, name }))
		},
		flash: takeFlash(cookies),
		back: searchPath(search)
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

	// The first press only asks, on the page; the confirm form posts to confirmDelete.
	delete: async ({ request, locals }) => {
		const { chosen, kept } = await posted(request, locals);
		if (chosen.length === 0) return plain('delete', 'Select at least one entry.', kept);
		const confirm: DeleteConfirm = {
			action: 'delete',
			confirm: true,
			chosen: chosen.map((c): Chosen => ({ id: c.id, version: kept.versions[c.id] }))
		};
		return confirm;
	},

	confirmDelete: async ({ request, locals, cookies }) => {
		const { core, chosen, kept, back } = await posted(request, locals);
		if (chosen.length === 0) return plain('confirmDelete', 'Select at least one entry.', kept);
		const inputs = chosen.map(({ id, version }) => ({ id, expectedVersion: version }));
		const { result, failedId } = runBulk(core, deleteLabel(inputs.length), inputs, 'delete');
		if (result.ok) done(core, cookies, result, back);
		const failed = failedId === null ? null : core.entries.get({ id: failedId });
		return refusal('confirmDelete', result.error, failed?.ok ? failed.value : undefined, kept);
	}
};
