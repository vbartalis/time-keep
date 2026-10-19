import {
	localParts,
	nextDate,
	previousDate,
	type Core,
	type EntryItem,
	type Named,
	type Result
} from '../core/index';
import { given, groupProjects, rows, text, wholeNumber } from './actions';
import { startOfDay } from './today';

/** A picker's choice: any row, none, or the id of one. */
export type Pick = 'any' | 'none' | string;

/** The filters of the Entries screen; a blank string is not set, dates are `YYYY-MM-DD`. */
export type Search = {
	from: string;
	to: string;
	customerId: string;
	projectId: string;
	activity: Pick;
	location: Pick;
	text: string;
	all: boolean;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day: month 13 and day 32 are not dates, nor does 02-30 roll over. */
const isDate = (value: string): boolean => {
	if (!DATE.test(value)) return false;
	const day = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
};

/**
 * The search a query string asks for. With neither From nor To present it is the
 * current month in `zone`; a key present but blank leaves that side unbound.
 */
export function readSearch(
	params: URLSearchParams,
	zone: string,
	now: number
): { search: Search; error: string | null } {
	let from = params.get('from') ?? '';
	let to = params.get('to') ?? '';
	if (!params.has('from') && !params.has('to')) {
		const today = localParts(now, zone).date;
		from = `${today.slice(0, 8)}01`;
		const firstOfNext = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
		to = previousDate(firstOfNext.toISOString().slice(0, 10));
	}
	const search: Search = {
		from: from.trim(),
		to: to.trim(),
		customerId: (params.get('customerId') ?? '').trim(),
		projectId: (params.get('projectId') ?? '').trim(),
		activity: (params.get('activity') ?? '').trim() || 'any',
		location: (params.get('location') ?? '').trim() || 'any',
		text: (params.get('text') ?? '').trim(),
		all: params.get('all') === '1'
	};
	let error: string | null = null;
	if ((search.from !== '' && !isDate(search.from)) || (search.to !== '' && !isDate(search.to))) {
		error = 'Use dates like 2026-10-01.';
	} else if (search.from !== '' && search.to !== '' && search.from > search.to) {
		error = 'From must not be after To.';
	}
	return { search, error };
}

const archived = (name: string, isArchived: boolean) => (isArchived ? `${name} (archived)` : name);

/** Every row of a kind, archived ones marked. */
const marked = (list: Named[]) =>
	list.map((r) => ({ id: r.id, name: archived(r.name, r.archivedAt !== null) }));

/**
 * The filter bar's pickers: every customer, project (grouped by customer), activity and
 * location, archived ones included and marked "(archived)".
 */
export function searchFilters(core: Core) {
	const customers = rows(core.customers.list({ includeArchived: true }));
	const archivedCustomers = new Set(
		customers.filter((c) => c.archivedAt !== null).map((c) => c.id)
	);
	const projects = rows(core.projects.list({ includeArchived: true })).map((p) => ({
		...p,
		name: archived(p.name, p.archivedAt !== null || archivedCustomers.has(p.customerId)),
		customerName: archived(p.customerName, archivedCustomers.has(p.customerId))
	}));
	return {
		customers: marked(customers),
		projects: groupProjects(projects),
		activities: marked(rows(core.activities.list({ includeArchived: true }))),
		locations: marked(rows(core.locations.list({ includeArchived: true })))
	};
}

/** The `entries.list` input of a search: entries that started from From's day to To's, oldest first. */
export function searchInput(search: Search, zone: string): Record<string, unknown> {
	const input: Record<string, unknown> = { startedIn: true, order: 'asc', limit: 501 };
	if (search.from !== '') input.from = new Date(startOfDay(search.from, zone)).toISOString();
	if (search.to !== '') input.to = new Date(startOfDay(nextDate(search.to), zone)).toISOString();
	if (search.projectId !== '') input.projectId = search.projectId;
	if (search.customerId !== '') input.customerId = search.customerId;
	if (search.activity !== 'any')
		input.activityId = search.activity === 'none' ? null : search.activity;
	if (search.location !== 'any')
		input.locationId = search.location === 'none' ? null : search.location;
	if (search.text !== '') input.text = search.text;
	return input;
}

/** The screen's address for a search, without `all`; the `back` of every action. */
export function searchPath(search: Search): string {
	const query = new URLSearchParams({ from: search.from, to: search.to });
	if (search.customerId !== '') query.set('customerId', search.customerId);
	if (search.projectId !== '') query.set('projectId', search.projectId);
	if (search.activity !== 'any') query.set('activity', search.activity);
	if (search.location !== 'any') query.set('location', search.location);
	if (search.text !== '') query.set('text', search.text);
	return `/entries?${query}`;
}

/** What Change selected sets; `keep` and blank leave a field as it is. */
export type BulkForm = {
	projectId: string;
	activity: 'keep' | 'none' | string;
	location: 'keep' | 'none' | string;
	reference: string;
	clearReference: boolean;
	find: string;
	replace: string;
};

/** Change selected as posted. Find and Replace are raw; a Find of only spaces is blank. */
export function readBulk(form: FormData): BulkForm {
	const find = text(form, 'find');
	return {
		projectId: given(form, 'projectId') ?? '',
		activity: given(form, 'activity') ?? 'keep',
		location: given(form, 'location') ?? 'keep',
		reference: given(form, 'reference') ?? '',
		clearReference: form.get('clearReference') !== null,
		find: find.trim() === '' ? '' : find,
		replace: text(form, 'replace')
	};
}

/** Every posted entry with the version posted beside it; a missing one goes on as `''`. */
export function selection(form: FormData): { id: string; version: number | string }[] {
	return form
		.getAll('id')
		.filter((id): id is string => typeof id === 'string')
		.map((id) => ({ id, version: wholeNumber(text(form, `version.${id}`)) }));
}

/**
 * The `entries.update` inputs the form would make, oldest start first so running
 * entries moved onto one project stop each other in time order. Only the fields that
 * differ go; an entry with none is left out. An id not in `current` goes last with the
 * set fields, for the core to refuse.
 */
export function bulkUpdates(
	bulk: BulkForm,
	chosen: { id: string; version: number | string }[],
	current: Map<string, EntryItem>
): Record<string, unknown>[] {
	const known = chosen
		.filter((c) => current.has(c.id))
		.sort((a, b) => {
			const x = current.get(a.id)!;
			const y = current.get(b.id)!;
			return x.startAt - y.startAt || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
		});
	const unknown = chosen.filter((c) => !current.has(c.id));
	const updates: Record<string, unknown>[] = [];
	for (const { id, version } of [...known, ...unknown]) {
		const entry = current.get(id);
		const input: Record<string, unknown> = { id, expectedVersion: version };
		if (bulk.projectId !== '' && bulk.projectId !== entry?.projectId)
			input.projectId = bulk.projectId;
		for (const key of ['activity', 'location'] as const) {
			if (bulk[key] === 'keep') continue;
			const value = bulk[key] === 'none' ? null : bulk[key];
			const field = `${key}Id` as const;
			if (value !== (entry?.[field] ?? null) || entry === undefined) input[field] = value;
		}
		if (bulk.clearReference) {
			if (entry === undefined || entry.reference !== null) input.reference = null;
		} else if (bulk.reference.trim() !== '' && bulk.reference.trim() !== entry?.reference) {
			input.reference = bulk.reference.trim();
		}
		if (bulk.find !== '' && entry?.description) {
			const next = entry.description.replaceAll(bulk.find, bulk.replace).trim();
			if (next !== entry.description.trim()) input.description = next === '' ? null : next;
		}
		if (Object.keys(input).length > 2) updates.push(input);
	}
	return updates;
}

export const editLabel = (n: number): string => `Edit ${n} ${n === 1 ? 'entry' : 'entries'}`;

export const deleteLabel = (n: number): string => `Delete ${n} ${n === 1 ? 'entry' : 'entries'}`;

/**
 * One batch of an update or delete per input, in order. The first refusal, a returned
 * failure or a thrown rule violation, refuses the whole batch; `failedId` is that
 * input's id, null when the batch went through.
 */
export function runBulk(
	core: Core,
	label: string,
	inputs: Record<string, unknown>[],
	command: 'update' | 'delete'
): { result: Result<unknown>; failedId: string | null } {
	let inFlight: string | null = null;
	let failedId: string | null = null;
	const result = core.batch(label, (c) => {
		let last: Result<unknown> = { ok: true, value: null, warnings: [] };
		for (const input of inputs) {
			inFlight = String(input.id);
			const r = c.entries[command](input);
			if (!r.ok) {
				failedId = inFlight;
				return r;
			}
			last = r;
		}
		return last as Result<never>;
	});
	if (!result.ok) failedId = inFlight;
	return { result, failedId: result.ok ? null : failedId };
}
