import { colourOf } from '#lib/project-colour.js';
import {
	durationText,
	endAfter,
	minutesBetween,
	readClock,
	readDate,
	readDuration,
	type Read
} from '#lib/time-input.js';
import { fillValues } from '#lib/components/entry/fill.js';
import type {
	EntryFormData,
	EntryFormFailure,
	EntryFormValues,
	FillTemplate,
	PickerOption
} from '#lib/components/entry/types.js';
import {
	isTimeZone,
	localParts,
	nextDate,
	parseTime,
	type Core,
	type CoreError,
	type EntryItem,
	type TemplateItem
} from '../core/index';
import { formFailure, given, rows, wholeNumber } from './actions';
import { safeBack } from './back';
import { formatDate, formatTime, startOfDay } from './today';

const DAY = 86_400_000;

/** Calendar days from one `YYYY-MM-DD` date to another. */
const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/** The calendar day `days` after a `YYYY-MM-DD` date. */
const addDays = (date: string, days: number) =>
	new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);

/** An existing entry's fields as the form shows them, each time in its own zone. */
export function valuesFromEntry(e: EntryItem): EntryFormValues {
	const date = formatDate(e.startAt, e.startZone);
	const endZone = e.endZone ?? e.startZone;
	const finished = e.endAt !== null;
	return {
		id: e.id,
		version: String(e.version),
		date,
		start: formatTime(e.startAt, e.startZone),
		end: finished ? formatTime(e.endAt!, endZone) : '',
		duration: finished ? durationText(Math.floor((e.endAt! - e.startAt) / 60_000)) : '',
		endDays: finished ? daysBetween(date, formatDate(e.endAt!, endZone)) : 0,
		endZone: finished && endZone !== e.startZone ? endZone : null,
		timeZone: e.startZone,
		projectId: e.projectId,
		activityId: e.activityId ?? '',
		locationId: e.locationId ?? '',
		reference: e.reference ?? '',
		description: e.description ?? '',
		running: !finished,
		name: '',
		customerId: ''
	};
}

/** A new entry's form: empty but for the date, the zone and the start when given. */
export function newValues(opts: { date: string; zone: string; start?: string }): EntryFormValues {
	return {
		id: null,
		version: '',
		date: opts.date,
		start: opts.start ?? '',
		end: '',
		duration: '',
		endDays: 0,
		endZone: null,
		timeZone: opts.zone,
		projectId: '',
		activityId: '',
		locationId: '',
		reference: '',
		description: '',
		running: false,
		name: '',
		customerId: ''
	};
}

/** A new entry holding every field of `e`, its date and times included. */
export function copyValues(e: EntryItem): EntryFormValues {
	const v: EntryFormValues = { ...valuesFromEntry(e), id: null, version: '', running: false };
	// A new entry has one zone: its end is shown, and read back, in the start zone.
	if (e.endAt !== null) {
		v.end = formatTime(e.endAt, e.startZone);
		v.endDays = daysBetween(v.date, formatDate(e.endAt, e.startZone));
		v.endZone = null;
		// Under a minute shows as 0:00, which no new entry may have: copy it as one minute.
		if (Math.floor((e.endAt - e.startAt) / 60_000) < 1) {
			const end = endAfter(v.start, 1);
			v.end = end.time;
			v.endDays = end.days;
			v.duration = durationText(1);
		}
	}
	return v;
}

/** `base` filled from a template (`fillValues`, shared with the form's Fill from). */
export function templateValues(t: TemplateItem, base: EntryFormValues): EntryFormValues {
	return fillValues(t, base);
}

/** Active rows, plus the current one marked when it is archived. */
function withArchived<T extends { id: string; archivedAt: number | null }>(
	all: T[],
	currentId: string | null | undefined
): (T & { archived: boolean })[] {
	return all
		.filter((row) => row.archivedAt === null || row.id === currentId)
		.map((row) => ({ ...row, archived: row.archivedAt !== null }));
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * The form's pickers and its "Fill from" templates: active rows, plus the current
 * entry's archived ones, marked; projects by customer then name, templates by name.
 */
export function formPickers(
	core: Core,
	current?: { projectId: string; activityId: string | null; locationId: string | null }
): Pick<EntryFormData, 'projects' | 'activities' | 'locations' | 'templates'> {
	const allProjects = rows(core.projects.list({ includeArchived: true }));
	const colours = colourOf(allProjects);
	const active = new Set(rows(core.projects.list()).map((p) => p.id));
	const projects = allProjects
		.filter((p) => active.has(p.id) || p.id === current?.projectId)
		.map((p) => ({
			id: p.id,
			name: p.name,
			customerId: p.customerId,
			customerName: p.customerName,
			colour: colours.get(p.id) ?? 1,
			archived: !active.has(p.id)
		}))
		.sort(
			(a, b) =>
				collator.compare(a.customerName, b.customerName) ||
				a.customerId.localeCompare(b.customerId) ||
				collator.compare(a.name, b.name)
		);
	const option = (r: { id: string; name: string; archived: boolean }): PickerOption => ({
		id: r.id,
		name: r.name,
		archived: r.archived
	});
	const byId = new Map(allProjects.map((p) => [p.id, p]));
	const templates = rows(core.templates.list()).map((t): FillTemplate => {
		const project = t.projectId === null ? undefined : byId.get(t.projectId);
		return {
			id: t.id,
			name: t.name,
			colour: project ? (colours.get(project.id) ?? null) : null,
			label: project ? `${project.customerName} › ${project.name}` : null,
			timeZone: t.timeZone,
			startTime: t.startTime,
			endTime: t.endTime,
			durationMinutes: t.durationMinutes,
			projectId: t.projectId,
			activityId: t.activityId,
			locationId: t.locationId,
			reference: t.reference,
			description: t.description
		};
	});
	return {
		projects,
		activities: withArchived(
			rows(core.activities.list({ includeArchived: true })),
			current?.activityId
		).map(option),
		locations: withArchived(
			rows(core.locations.list({ includeArchived: true })),
			current?.locationId
		).map(option),
		templates
	};
}

export type FormRead =
	{ ok: true; input: Record<string, unknown> } | { ok: false; fields: Record<string, string> };

/**
 * The form's date, start, end and duration, each read or refused beside its field. A
 * duration posted as the form showed it (`kept`) is its minutes, unread: an entry under
 * a minute shows `0:00`, which reading refuses.
 */
function readTimes(form: FormData, zone: string, kept?: { text: string; minutes: number }) {
	const fields: Record<string, string> = {};
	const read = <T>(name: string, r: Read<T>): T | undefined => {
		if (r.ok) return r.value;
		fields[name] = r.reason;
		return undefined;
	};
	const today = localParts(Date.now(), isTimeZone(zone) ? zone : 'UTC').date;
	const endText = given(form, 'end');
	const durationTyped = given(form, 'duration');
	return {
		fields,
		date: read('date', readDate(given(form, 'date') ?? '', today)),
		start: read('start', readClock(given(form, 'start') ?? '')),
		end: endText === undefined ? null : read('end', readClock(endText)),
		duration:
			durationTyped === undefined
				? null
				: kept !== undefined && durationTyped === kept.text
					? kept.minutes
					: read('duration', readDuration(durationTyped))
	};
}

/** `HH:mm` on `date` as a local time, on the next day when not after `start`. */
const endOn = (date: string, start: string, end: string) =>
	`${end <= start ? nextDate(date) : date}T${end}`;

/** The local `HH:mm` `minutes` after `start` on `date` in `zone`; null when unreadable. */
function endsAt(date: string, start: string, zone: string, minutes: number): string | null {
	if (!isTimeZone(zone)) return null;
	const at = parseTime(`${date}T${start}`, zone);
	return at.ok ? localParts(at.at + minutes * 60_000, zone).time : null;
}

/**
 * The input of `entries.create` from the entry form. Times are local `HH:mm` on the
 * date, read in the posted zone; an end at or before the start falls on the next day.
 * An end and a duration that agree (in the zone, across DST) send the duration, so a span of days keeps them;
 * otherwise the end wins. Neither makes a running timer. Blank pickers and text are
 * left out.
 */
export function createInput(form: FormData): FormRead {
	const timeZone = given(form, 'timeZone') ?? '';
	const t = readTimes(form, timeZone);
	if (Object.keys(t.fields).length > 0) return { ok: false, fields: t.fields };
	const date = t.date!;
	const start = t.start!;
	const input: Record<string, unknown> = {
		projectId: given(form, 'projectId') ?? '',
		start: `${date}T${start}`,
		timeZone
	};
	const agrees =
		t.end != null && t.duration != null && endsAt(date, start, timeZone, t.duration) === t.end;
	if (t.end != null && !agrees) input.end = endOn(date, start, t.end);
	else if (t.duration != null) input.durationMinutes = t.duration;
	for (const key of ['activityId', 'locationId', 'reference', 'description'] as const) {
		const value = given(form, key);
		if (value !== undefined) input[key] = value;
	}
	return { ok: true, input };
}

/**
 * The input of `entries.update` from the entry form. A field is changed when what was
 * posted reads differently from what the form showed (`9` is `09:00`). A changed start
 * or date is sent in the start zone; an unchanged end is never re-sent, so its instant
 * (seconds, days and zone) holds, except when the date moved, which moves the whole
 * entry. A changed end is sent in the end zone; a changed duration only when the end is
 * unchanged, or over a changed end that agrees with it (the form links one from the other),
 * so a span of days holds; a duration that only follows a moved start, the end held, is
 * no change. Emptying both makes a finished entry running. Pickers and text are always
 * sent; blank clears them.
 */
export function updateInput(form: FormData, entry: EntryItem): FormRead {
	const shown = valuesFromEntry(entry);
	const t = readTimes(
		form,
		entry.startZone,
		entry.endAt === null
			? undefined
			: { text: shown.duration, minutes: Math.floor((entry.endAt - entry.startAt) / 60_000) }
	);
	if (Object.keys(t.fields).length > 0) return { ok: false, fields: t.fields };
	const date = t.date!;
	const start = t.start!;
	const end = t.end ?? '';
	const duration = t.duration ?? null;
	const input: Record<string, unknown> = {
		id: entry.id,
		expectedVersion: wholeNumber(given(form, 'version') ?? ''),
		timeZone: entry.startZone,
		projectId: given(form, 'projectId') ?? '',
		activityId: given(form, 'activityId') ?? null,
		locationId: given(form, 'locationId') ?? null,
		reference: given(form, 'reference') ?? null,
		description: given(form, 'description') ?? null
	};
	const dateMoved = date !== shown.date;
	if (dateMoved || start !== shown.start) input.start = `${date}T${start}`;

	const endZone = entry.endZone ?? entry.startZone;
	const endChanged = end !== shown.end;
	// The end the entry keeps when its end is not typed: moved with the date, else as stored.
	const keptEnd =
		entry.endAt === null
			? null
			: dateMoved
				? parseTime(`${addDays(date, shown.endDays)}T${shown.end}`, endZone)
				: { ok: true as const, at: entry.endAt };
	const startAt = parseTime(`${date}T${start}`, entry.startZone);
	// A duration the form only recomputed from a moved start, the end holding, is no change.
	const followed =
		keptEnd?.ok && startAt.ok && duration === Math.floor((keptEnd.at - startAt.at) / 60_000);
	const durationChanged =
		(duration === null ? '' : durationText(duration)) !== shown.duration && !followed;
	// A typed duration the form linked the end from: the duration keeps a span of days.
	const linked =
		end !== '' &&
		duration !== null &&
		endZone === entry.startZone &&
		endsAt(date, start, entry.startZone, duration) === end;
	if (end !== '' && endChanged && linked) {
		input.durationMinutes = duration;
	} else if (end !== '' && endChanged) {
		input.end = endOn(date, start, end);
		input.endTimeZone = endZone;
	} else if (duration !== null && durationChanged) {
		input.durationMinutes = duration;
	} else if (end === '' && duration === null) {
		if (entry.endAt !== null) input.end = null;
	} else if (dateMoved && entry.endAt !== null) {
		input.end = `${addDays(date, shown.endDays)}T${shown.end}`;
		input.endTimeZone = endZone;
	}
	return { ok: true, input };
}

/**
 * The end (`HH:mm` in `zone`) of the latest finished entry that ends on `date` there,
 * at or before `before` when given; null when there is none.
 */
export function previousEnd(
	core: Core,
	date: string,
	zone: string,
	before: string | null
): string | null {
	const from = startOfDay(date, zone);
	const to = startOfDay(nextDate(date), zone);
	const ends = rows(
		core.entries.list({
			from: new Date(from).toISOString(),
			to: new Date(to).toISOString(),
			running: false
		})
	)
		.map((e) => e.endAt)
		.filter((at): at is number => at !== null && at >= from && at < to)
		.filter((at) => before === null || formatTime(at, zone) <= before);
	return ends.length === 0 ? null : formatTime(Math.max(...ends), zone);
}

/**
 * The new-entry form for the page's query: `copy=<id>` holds every field of that entry;
 * `template=<id>` is filled from it; `date`, `start` and `end` (with a start) set those (read forgivingly,
 * dropped when unreadable). `timer=1` starts now, today in `zone`, with no end, the
 * template's times ignored. Null when the entry or template to copy is gone.
 */
export function newEntryValues(
	core: Core,
	query: URLSearchParams,
	zone: string,
	now: number
): EntryFormValues | null {
	const here = localParts(now, zone);
	const copyId = query.get('copy');
	if (copyId !== null) {
		const r = core.entries.get({ id: copyId });
		return r.ok ? copyValues(r.value) : null;
	}
	const timer = query.get('timer') === '1';
	const date = readDate(query.get('date') ?? '', here.date);
	const start = readClock(query.get('start') ?? '');
	const end = readClock(query.get('end') ?? '');
	// An end needs a start; one not after it falls on the next day.
	const withEnd = (v: EntryFormValues): EntryFormValues =>
		start.ok && end.ok
			? {
					...v,
					start: start.value,
					end: end.value,
					duration: durationText(minutesBetween(start.value, end.value)),
					endDays: end.value <= start.value ? 1 : 0
				}
			: v;
	const base = timer
		? newValues({ date: here.date, zone, start: here.time })
		: withEnd(
				newValues({
					date: date.ok ? date.value : here.date,
					zone,
					...(start.ok ? { start: start.value } : {})
				})
			);
	const templateId = query.get('template');
	if (templateId === null) return base;
	const t = core.templates.get({ id: templateId });
	if (!t.ok) return null;
	if (!timer) return withEnd(templateValues(t.value, base));
	return {
		...templateValues(t.value, base),
		date: base.date,
		start: base.start,
		end: '',
		duration: '',
		endDays: 0,
		endZone: null,
		timeZone: zone
	};
}

/**
 * Whether the new-entry form's zone is fixed for the query: a copy keeps its entry's
 * zone, a template with its own zone keeps that (a timer starts in the device's zone).
 */
export function newEntryZoneFixed(core: Core, query: URLSearchParams): boolean {
	if (query.get('copy') !== null) return true;
	const templateId = query.get('template');
	if (templateId === null || query.get('timer') === '1') return false;
	const t = core.templates.get({ id: templateId });
	return t.ok && t.value.timeZone !== null;
}

/** `previousEnd` for the form's query (`date`, `zone`, `before`); an unreadable `before` is left out. */
export function previousEndFor(core: Core, query: URLSearchParams, now: number): string | null {
	const zone = query.get('zone') ?? '';
	if (!isTimeZone(zone)) return null;
	const date = readDate(query.get('date') ?? '', localParts(now, zone).date);
	if (!date.ok) return null;
	const before = readClock(query.get('before') ?? '');
	return previousEnd(core, date.value, zone, before.ok ? before.value : null);
}

/** The fields the entry form shows, by the names it posts. */
const FORM_FIELDS = [
	'date',
	'start',
	'end',
	'duration',
	'projectId',
	'activityId',
	'locationId',
	'reference',
	'description'
] as const;

/** The core's names for fields the form names otherwise. */
const CORE_FIELDS: Record<string, string> = {
	durationMinutes: 'duration',
	startTime: 'start',
	endTime: 'end'
};

/** The fields the template form shows, by the names it posts. */
const TEMPLATE_FORM_FIELDS = [
	'name',
	'customerId',
	'projectId',
	'activityId',
	'locationId',
	'start',
	'end',
	'duration',
	'timeZone',
	'reference',
	'description'
] as const;

/** What a refusal is about: the entry form, or the template form. */
export type FormKind = EntryFormData['kind'];

/**
 * The form as posted, for a refusal to put back: every field it shows, its version and
 * zone, and `extra` (a template's name).
 */
function postedForm(
	form: FormData,
	extra: readonly string[] = [],
	kind: FormKind = 'entry'
): Record<string, string> {
	const names =
		kind === 'template' ? [...TEMPLATE_FORM_FIELDS, 'linked'] : [...FORM_FIELDS, ...extra];
	return Object.fromEntries(
		[...names, 'version', 'timeZone'].map((name) => {
			const value = form.get(name);
			return [name, typeof value === 'string' ? value : ''];
		})
	);
}

/** The posted `back`, checked; Today when absent or not a path here. */
const postedBack = (form: FormData) => {
	const value = form.get('back');
	return safeBack(typeof value === 'string' ? value : null);
};

/** A form that could not be read: each message beside its field. */
export function unreadFailure(
	fields: Record<string, string>,
	form: FormData,
	kind: FormKind = 'entry'
): EntryFormFailure {
	return {
		action: 'save',
		error: 'The input is not valid.',
		fields,
		conflict: false,
		gone: false,
		values: postedForm(form, [], kind),
		back: postedBack(form)
	};
}

/** The refusal for an entry (or template) deleted elsewhere. */
export function goneFailure(
	action: EntryFormFailure['action'],
	form: FormData,
	kind: FormKind = 'entry'
): EntryFormFailure {
	return {
		action,
		error:
			kind === 'template'
				? 'This template was deleted elsewhere.'
				: 'This entry was deleted elsewhere.',
		fields: {},
		conflict: false,
		gone: true,
		values: postedForm(form, action === 'saveAsTemplate' ? ['name'] : [], kind),
		back: postedBack(form)
	};
}

/**
 * A core refusal for the form: errors on its fields stay beside them, the others become
 * the general message. Only a stale form gets a conflict (the form offers a reload);
 * other conflicts (a timer that started later) read like any refusal.
 */
export function coreFailure(
	action: EntryFormFailure['action'],
	error: CoreError,
	form: FormData,
	opts: { stale?: boolean; kind?: FormKind } = {}
): EntryFormFailure {
	const kind = opts.kind ?? 'entry';
	const values = postedForm(form, action === 'saveAsTemplate' ? ['name'] : [], kind);
	const back = postedBack(form);
	if (error.code === 'conflict' && opts.stale === true) {
		return { action, error: error.message, fields: {}, conflict: true, gone: false, values, back };
	}
	const shown: readonly string[] =
		action === 'saveAsTemplate'
			? ['name']
			: kind === 'template'
				? TEMPLATE_FORM_FIELDS
				: FORM_FIELDS;
	const renamed = Object.fromEntries(
		Object.entries(error.fields ?? {}).map(([k, v]) => [CORE_FIELDS[k] ?? k, v])
	);
	return {
		action,
		...formFailure({ ...error, fields: renamed }, shown),
		conflict: false,
		gone: false,
		values,
		back
	};
}
