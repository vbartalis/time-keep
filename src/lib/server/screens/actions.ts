import { redirect, type Cookies } from '@sveltejs/kit';
import {
	nextDate,
	previousDate,
	type Core,
	type CoreError,
	type ProjectListItem,
	type Result
} from '../core/index';
import { flashAfter, setFlash } from './flash';

/** The rows of a list result; none when it failed. */
export const rows = <T>(r: Result<T[]>): T[] => (r.ok ? r.value : []);

/** A form field as posted; empty when absent. */
export const text = (form: FormData, name: string): string => {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
};

/** On success: the flash for the batch just written, and back to Today. */
export function done(core: Core, cookies: Cookies, result: Result<unknown>): never {
	setFlash(cookies, flashAfter(core, result.ok ? result.warnings : []));
	redirect(303, '/');
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
 * The input of `entries.fromTemplate` from the template sheet. Blank fields are left
 * out so the template's apply. The device zone is sent only when the template has no
 * zone of its own. Changed times are local `HH:mm` on the date (today by default); an
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
	for (const key of ['projectId', 'reference', 'description'] as const) {
		const value = given(form, key);
		if (value !== undefined) input[key] = value;
	}
	const date = given(form, 'date');
	const typedStart = given(form, 'start');
	const end = given(form, 'end');
	const duration = given(form, 'durationMinutes');

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
	if (duration !== undefined) input.durationMinutes = wholeNumber(duration);
	return input;
}

/** The input of `timers.start` from the start-a-timer form. */
export function startInput(form: FormData, zone: string): Record<string, unknown> {
	const input: Record<string, unknown> = {
		projectId: given(form, 'projectId') ?? '',
		timeZone: zone
	};
	const description = given(form, 'description');
	if (description !== undefined) input.description = description;
	return input;
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
