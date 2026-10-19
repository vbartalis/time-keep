import { given, wholeNumber } from './actions';
import { toLocalInput } from './today';

/** The entry's times as stored, which the form's values are compared with. */
export type EditedTimes = {
	startAt: number;
	startZone: string;
	endAt: number | null;
	endZone: string | null;
};

/**
 * The input of `entries.update` from the edit form. Times read in the entry's own
 * zones, and a time left as the form showed it is not sent, so its seconds are kept.
 * A cleared end makes a finished entry running. Pickers and text are always sent;
 * blank clears them. A version that is not a whole number goes on for the core to
 * refuse.
 */
export function editInput(form: FormData, id: string, entry: EditedTimes): Record<string, unknown> {
	const version = given(form, 'version') ?? '';
	const input: Record<string, unknown> = {
		id,
		expectedVersion: wholeNumber(version),
		timeZone: entry.startZone,
		projectId: given(form, 'projectId') ?? '',
		activityId: given(form, 'activityId') ?? null,
		locationId: given(form, 'locationId') ?? null,
		reference: given(form, 'reference') ?? null,
		description: given(form, 'description') ?? null
	};
	const start = given(form, 'start') ?? '';
	if (start !== toLocalInput(entry.startAt, entry.startZone)) input.start = start;

	const end = given(form, 'end');
	const endZone = entry.endZone ?? entry.startZone;
	if (end === undefined) {
		if (entry.endAt !== null) input.end = null;
	} else if (entry.endAt === null || end !== toLocalInput(entry.endAt, endZone)) {
		input.end = end;
		input.endTimeZone = endZone;
	}
	return input;
}

/**
 * A picker's options: the active rows, plus the entry's current one when it is
 * archived (found in `all`), so an edit never blanks it.
 */
export function withCurrent<T extends { id: string; name: string }>(
	active: T[],
	all: T[],
	currentId: string | null
): (T & { archived: boolean })[] {
	const options = active.map((row) => ({ ...row, archived: false }));
	if (currentId === null || active.some((row) => row.id === currentId)) return options;
	const current = all.find((row) => row.id === currentId);
	return current ? [...options, { ...current, archived: true }] : options;
}

/**
 * What a refused form puts back: the named fields as posted, and the posted version.
 * Without JavaScript the page reloads after a refusal; echoing the version keeps the
 * form from taking the entry's newer one, so it keeps refusing until the user reloads.
 */
export function postedValues(form: FormData, names: readonly string[]): Record<string, string> {
	const text = (name: string) => {
		const value = form.get(name);
		return typeof value === 'string' ? value : '';
	};
	return Object.fromEntries(['version', ...names].map((name) => [name, text(name)]));
}
