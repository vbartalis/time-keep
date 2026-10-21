import { redirect, type Cookies } from '@sveltejs/kit';
import {
	nextDate,
	previousDate,
	type Core,
	type CoreError,
	type ProjectListItem,
	type Result
} from '../core/index';
import { readClock, readDate, readDuration, type Read } from '#lib/time-input.js';
import { flashAfter, setFlash } from './flash';

/** The rows of a list result; none when it failed. */
export const rows = <T>(r: Result<T[]>): T[] => (r.ok ? r.value : []);

/** A form field as posted; empty when absent. */
export const text = (form: FormData, name: string): string => {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
};

/** On success: the flash for the batch just written, and back to the screen it came from. */
export function done(core: Core, cookies: Cookies, result: Result<unknown>, back = '/'): never {
	setFlash(cookies, flashAfter(core, result.ok ? result.warnings : []));
	redirect(303, back);
}

/** A whole number when the text is one; else the text, for the core to refuse. */
export const wholeNumber = (text: string): number | string =>
	/^\d+$/.test(text) ? Number(text) : text;

/** A form field, trimmed; undefined when absent or blank. */
export function given(form: FormData, name: string): string | undefined {
	const value = form.get(name);
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

/**
 * The input of `entries.fromTemplate` from the template sheet. Blank fields (project,
 * activity, location, reference, description, times) are left out so the template's
 * apply. The device zone is sent only when the template has no zone of its own. The
 * date, times and duration are read as the entry form reads them (`9`, `900`, `1.5`);
 * one that does not read is sent as typed, for `sheetTimeRefusals` to have caught.
 * Changed times are local `HH:mm` on the date (today by default); an
 * end not after the start falls on the next day. A typed end without a typed start
 * sends the template's start too, on the day the core would pick (yesterday for an
 * overnight template whose start today is still ahead), so both share one day.
 */
export function fromTemplateInput(
	form: FormData,
	ctx: {
		zone: string;
		/** Today and the time now, local to the zone the template is read in. */
		today: string;
		nowTime: string;
		template: { timeZone: string | null; startTime: string | null; endTime: string | null };
	}
): Record<string, unknown> {
	const t = ctx.template;
	const input: Record<string, unknown> = { templateId: given(form, 'templateId') ?? '' };
	if (t.timeZone === null) input.timeZone = ctx.zone;
	for (const key of [
		'projectId',
		'activityId',
		'locationId',
		'reference',
		'description'
	] as const) {
		const value = given(form, key);
		if (value !== undefined) input[key] = value;
	}
	const date = readOr(given(form, 'date'), (text) => readDate(text, ctx.today));
	const typedStart = readOr(given(form, 'start'), readClock);
	const end = readOr(given(form, 'end'), readClock);
	const duration = readOr(given(form, 'duration'), readDuration);

	let start = typedStart;
	let day = date ?? ctx.today;
	if (start === undefined && end !== undefined && t.startTime !== null) {
		start = t.startTime;
		const overnight = t.endTime !== null && t.endTime <= t.startTime;
		if (date === undefined && overnight && t.startTime > ctx.nowTime) day = previousDate(day);
	}
	if (start !== undefined) input.start = `${day}T${start}`;
	else if (date !== undefined) input.date = date;
	if (end !== undefined) {
		input.end = `${start !== undefined && end <= start ? nextDate(day) : day}T${end}`;
	}
	if (duration !== undefined) input.durationMinutes = duration;
	return input;
}

/** The text's reading when it reads; else the text as typed (undefined stays so). */
function readOr<T>(text: string | undefined, read: (t: string) => Read<T>): T | string | undefined {
	if (text === undefined) return undefined;
	const r = read(text);
	return r.ok ? r.value : text;
}

/**
 * Why the template sheet's typed date, start, end or duration does not read, by field;
 * empty when each typed one reads. `today` completes a date typed without its year.
 */
export function sheetTimeRefusals(form: FormData, today: string): Record<string, string> {
	const readers: Record<string, (t: string) => Read<unknown>> = {
		date: (t) => readDate(t, today),
		start: readClock,
		end: readClock,
		duration: readDuration
	};
	const fields: Record<string, string> = {};
	for (const [name, read] of Object.entries(readers)) {
		const text = given(form, name);
		if (text === undefined) continue;
		const r = read(text);
		if (!r.ok) fields[name] = r.reason;
	}
	return fields;
}

/**
 * A core failure for a form: errors on the fields it shows stay beside them; the
 * others become the general message, since the screen has nowhere else to put them.
 */
export function formFailure(
	error: CoreError,
	shown: readonly string[]
): { error: string; fields: Record<string, string> } {
	const fields: Record<string, string> = {};
	const hidden: string[] = [];
	for (const [field, message] of Object.entries(error.fields ?? {})) {
		if (shown.includes(field)) fields[field] = message;
		else hidden.push(message);
	}
	return { error: hidden.length > 0 ? hidden.join(' ') : error.message, fields };
}

export type ProjectGroup = {
	customerId: string;
	customerName: string;
	projects: { id: string; name: string }[];
};

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Projects grouped under their customers, customers sorted by name. */
export function groupProjects(projects: ProjectListItem[]): ProjectGroup[] {
	const groups = new Map<string, ProjectGroup>();
	for (const p of projects) {
		let group = groups.get(p.customerId);
		if (!group) {
			group = { customerId: p.customerId, customerName: p.customerName, projects: [] };
			groups.set(p.customerId, group);
		}
		group.projects.push({ id: p.id, name: p.name });
	}
	return [...groups.values()].sort((a, b) => collator.compare(a.customerName, b.customerName));
}
