import { type Core, type EntryItem, type Result } from '../core/index';
import { given, text, wholeNumber } from './actions';

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
