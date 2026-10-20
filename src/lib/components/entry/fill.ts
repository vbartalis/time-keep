import { durationText, endAfter, minutesBetween } from '#lib/time-input.js';
import type { EntryFormValues, FillTemplate } from './types';

/** What a template fills: shared by the server's `templateValues` and the form's Fill from. */
export type FillSource = Pick<
	FillTemplate,
	| 'timeZone'
	| 'startTime'
	| 'endTime'
	| 'durationMinutes'
	| 'projectId'
	| 'activityId'
	| 'locationId'
	| 'reference'
	| 'description'
>;

/**
 * `base` with every field the template holds filled in, its times on the base's date;
 * a field the template leaves blank keeps the base's value. A duration or an end time
 * is completed from the start (the template's, else the base's) when there is one.
 */
export function fillValues(t: FillSource, base: EntryFormValues): EntryFormValues {
	const v: EntryFormValues = {
		...base,
		timeZone: t.timeZone ?? base.timeZone,
		projectId: t.projectId ?? base.projectId,
		activityId: t.activityId ?? base.activityId,
		locationId: t.locationId ?? base.locationId,
		reference: t.reference ?? base.reference,
		description: t.description ?? base.description
	};
	if (t.startTime !== null) v.start = t.startTime;
	if (t.durationMinutes !== null) {
		v.duration = durationText(t.durationMinutes);
		if (v.start !== '') {
			const end = endAfter(v.start, t.durationMinutes);
			v.end = end.time;
			v.endDays = end.days;
		} else {
			v.end = '';
			v.endDays = 0;
		}
		v.endZone = null;
	} else if (t.endTime !== null && v.start !== '') {
		v.end = t.endTime;
		v.duration = durationText(minutesBetween(v.start, t.endTime));
		v.endDays = t.endTime <= v.start ? 1 : 0;
		v.endZone = null;
	}
	return v;
}
