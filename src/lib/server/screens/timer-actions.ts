import type { EntryItem, TemplateItem } from '../core/index';

/** Project, activity, location, reference and description, leaving out what is not held. */
function fieldsOf(r: {
	projectId: string | null;
	activityId: string | null;
	locationId: string | null;
	reference: string | null;
	description: string | null;
}): Record<string, unknown> {
	const input: Record<string, unknown> = { projectId: r.projectId ?? '' };
	for (const key of ['activityId', 'locationId', 'reference', 'description'] as const) {
		const value = r[key];
		if (value !== null) input[key] = value;
	}
	return input;
}

/**
 * The input of `timers.start` from a template in the bar's start list: a timer now,
 * in the given zone, with the template's fields; its times and its zone are ignored.
 * A typed description wins; blank keeps the template's.
 */
export function startFromTemplateInput(
	t: TemplateItem,
	description: string | undefined,
	zone: string
): Record<string, unknown> {
	const typed = description?.trim();
	return {
		...fieldsOf({ ...t, description: typed ? typed : t.description }),
		timeZone: zone
	};
}

/** The input of `timers.start` that restarts `e` now: its fields, in its start zone. */
export function restartInput(e: EntryItem): Record<string, unknown> {
	return { ...fieldsOf(e), timeZone: e.startZone };
}
