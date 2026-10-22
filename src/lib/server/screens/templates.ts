import { durationText, minutesBetween, readClock, readDuration } from '#lib/time-input.js';
import type { EntryFormData, EntryFormValues } from '#lib/components/entry/types.js';
import type { Core, Template } from '../core/index';
import { given, rows } from './actions';
import { safeBack } from './back';
import { withCurrent } from './edit';
import { formPickers } from './entry-form';

/** Which of end and duration the form sends: the one named in `linked`, else the end if typed. */
function sentTime(form: FormData): 'end' | 'duration' | null {
	const end = given(form, 'end') !== undefined;
	const duration = given(form, 'duration') !== undefined;
	const linked = given(form, 'linked');
	if (linked === 'duration') return duration ? 'duration' : null;
	if (linked === 'end') return end ? 'end' : null;
	return end ? 'end' : duration ? 'duration' : null;
}

/** The duration the template form shows for `t`: its own, else the span of start and end. */
function shownDuration(t: Template): string {
	if (t.durationMinutes !== null) return durationText(t.durationMinutes);
	return t.startTime !== null && t.endTime !== null
		? durationText(minutesBetween(t.startTime, t.endTime))
		: '';
}

/**
 * The form with `linked` decided against the stored template `t` when the page posted
 * none (no script), as the entry form's no-JS update does: a changed duration over an
 * unchanged end (or a template with no end) is the one to keep; otherwise the end.
 */
export function withLinked(form: FormData, t: Template): FormData {
	if (given(form, 'linked') !== undefined) return form;
	const end = given(form, 'end') ?? '';
	const duration = given(form, 'duration') ?? '';
	const stored = t.endTime;
	const sameEnd = (a: string, b: string) => {
		const r = readClock(a);
		return (r.ok ? r.value : a) === b;
	};
	// A blank end leaves only the duration to keep; else the end, unless it is as stored.
	const endKept = end === '' || stored === null || sameEnd(end, stored);
	const changed = duration !== '' && readMinutes(duration) !== readMinutes(shownDuration(t));
	const linked = new FormData();
	for (const [k, v] of form.entries()) linked.append(k, v);
	linked.set('linked', end === '' || (endKept && changed) ? 'duration' : 'end');
	return linked;
}

const readMinutes = (text: string): number | null => {
	const r = readDuration(text);
	return r.ok ? r.value : null;
};

/**
 * The input of `templates.create` and, with `id` and `expectedVersion` added, of
 * `templates.update`, from the entry form in its template kind. The name goes as posted;
 * every other field is trimmed and a blank one is `null`, which clears it on an update.
 * Times are `HH:mm` read as the entry form reads them (a time that does not read goes on
 * as typed, for `templateUnread` to have caught); a template holds an end or a duration,
 * so only the one named in `linked` is sent. A project with no customer takes the
 * project's customer, as `templates.fromEntry` stores it; a customer alone is allowed
 * and the core still checks a pair.
 */
export function templateFromForm(
	form: FormData,
	customerOf: (projectId: string) => string | null
): Record<string, unknown> {
	const field = (name: string) => given(form, name) ?? null;
	const clock = (name: string) => {
		const typed = field(name);
		if (typed === null) return null;
		const r = readClock(typed);
		return r.ok ? r.value : typed;
	};
	const name = form.get('name');
	const projectId = field('projectId');
	const sent = sentTime(form);
	const typedDuration = field('duration');
	let duration: number | string | null = null;
	if (sent === 'duration' && typedDuration !== null) {
		const r = readDuration(typedDuration);
		duration = r.ok ? r.value : typedDuration;
	}
	let customerId = field('customerId');
	if (projectId !== null && customerId === null) customerId = customerOf(projectId);
	return {
		name: typeof name === 'string' ? name : '',
		customerId,
		projectId,
		activityId: field('activityId'),
		locationId: field('locationId'),
		startTime: clock('start'),
		endTime: sent === 'end' ? clock('end') : null,
		durationMinutes: duration,
		timeZone: field('timeZone'),
		reference: field('reference'),
		description: field('description')
	};
}

/**
 * The time fields of the template form that cannot be read, each with the reader's
 * message, keyed by the form's field names. Only the end or duration that is sent counts.
 */
export function templateUnread(form: FormData): Record<string, string> {
	const fields: Record<string, string> = {};
	const sent = sentTime(form);
	const check = (name: string, read: (text: string) => { ok: boolean; reason?: string }) => {
		const typed = given(form, name);
		if (typed === undefined) return;
		const r = read(typed);
		if (!r.ok) fields[name] = r.reason!;
	};
	check('start', readClock);
	if (sent === 'end') check('end', readClock);
	if (sent === 'duration') check('duration', readDuration);
	return fields;
}

/**
 * The template form (item 12's entry form in its template kind) for `t`, or a new
 * template when null. Times are of the day, with no date; a duration-only template shows
 * no end. The pickers hold the active rows plus the template's archived ones, marked.
 */
export function templateFormData(core: Core, t: Template | null, back: string): EntryFormData {
	const values: EntryFormValues = {
		id: t?.id ?? null,
		version: t === null ? '' : String(t.version),
		date: '',
		start: t?.startTime ?? '',
		end: t?.endTime ?? '',
		duration: t === null ? '' : shownDuration(t),
		endDays: t?.startTime != null && t.endTime != null && t.endTime <= t.startTime ? 1 : 0,
		endZone: null,
		startNow: '',
		timeZone: t?.timeZone ?? '',
		projectId: t?.projectId ?? '',
		activityId: t?.activityId ?? '',
		locationId: t?.locationId ?? '',
		reference: t?.reference ?? '',
		description: t?.description ?? '',
		running: false,
		name: t?.name ?? '',
		customerId: t?.customerId ?? ''
	};
	const pickers = formPickers(core, {
		projectId: values.projectId,
		activityId: t?.activityId ?? null,
		locationId: t?.locationId ?? null
	});
	const customers = withCurrent(
		rows(core.customers.list()),
		rows(core.customers.list({ includeArchived: true })),
		t?.customerId ?? null
	).map((c) => ({ id: c.id, name: c.name, archived: c.archived }));
	return {
		kind: 'template',
		mode: t === null ? 'new' : 'edit',
		values,
		...pickers,
		customers,
		templates: [],
		back: safeBack(back),
		zoneFixed: true,
		failure: null
	};
}

/** The customer of a project, archived or not; null for an unknown project. */
export const customerOf = (core: Core) => (projectId: string) =>
	rows(core.projects.list({ includeArchived: true })).find((p) => p.id === projectId)?.customerId ??
	null;
