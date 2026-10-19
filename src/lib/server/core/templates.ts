/**
 * Templates: saved starting points for entries. Commands take a Writer (inside
 * runBatch) and untrusted input; reads take any database handle. A template is the
 * user's own convenience, not reference data: it can be deleted (undoably), not archived.
 */
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db/index';
import type { Template } from '../db/schema';
import { newId } from '../id';
import { createEntry, type Entry } from './entries';
import { nameKey, nameSchema } from './names';
import { fail, fromZod, ok, type CoreError, type Result } from './result';
import { isTimeZone, localParts, nextDate, parseTime, previousDate } from './time';
import { registerRules, table, type Row, type Tx, type Writer } from './write';

export type { Template };
/** A template with the names of what it points at. */
export type TemplateItem = Template & {
	customerName: string | null;
	projectName: string | null;
	activityName: string | null;
	locationName: string | null;
};

type Handle = Tx | DB;

const STALE = 'This was changed elsewhere; reload and try again.';
const DUPLICATE = 'A template with this name already exists.';
const PROJECT_MISMATCH = "That project is not this customer's.";
const NEEDS_START = 'An end time needs a start time.';
const BOTH = 'Give an end time or a duration, not both.';
const UNKNOWN_ZONE = 'Unknown time zone.';
const PICK_ZONE = 'Pick a time zone.';
const PICK_PROJECT = 'Pick a project.';
const END_NEEDS_START = 'An end needs a start.';
const DATE_NEEDS_START = 'A date needs a start time on the template.';
const END_AFTER_START = 'The end must be after the start.';
const MINUTE = 60_000;

const KINDS = ['customer', 'project', 'activity', 'location'] as const;

const invalid = (message: string, fields: Record<string, string>): CoreError => ({
	code: 'invalid',
	message,
	fields
});

/**
 * What every stored template must satisfy: references that exist and are the user's
 * (archived ones allowed), a project that belongs to the customer, an end time only
 * with a start time and never beside a duration, and a known zone.
 */
function templateError(tx: Handle, row: Row): CoreError | null {
	const userId = row.userId as string;
	const refs = {
		customer: row.customerId,
		project: row.projectId,
		activity: row.activityId,
		location: row.locationId
	} as Record<(typeof KINDS)[number], string | null>;
	for (const kind of KINDS) {
		const id = refs[kind];
		if (id === null) continue;
		const t = table(kind);
		const found = tx
			.select({ id: t.id })
			.from(t)
			.where(and(eq(t.id, id), eq(t.userId, userId)))
			.get();
		if (!found) return { code: 'not_found', message: `The ${kind} was not found.` };
	}
	if (refs.customer !== null && refs.project !== null) {
		const p = table('project');
		const project = tx
			.select({ customerId: p.customerId })
			.from(p)
			.where(eq(p.id, refs.project))
			.get();
		if (project?.customerId !== refs.customer) {
			return invalid(PROJECT_MISMATCH, { projectId: PROJECT_MISMATCH });
		}
	}
	if (row.endTime !== null && row.startTime === null) {
		return invalid(NEEDS_START, { endTime: NEEDS_START });
	}
	if (row.endTime !== null && row.durationMinutes !== null) {
		return invalid(BOTH, { endTime: BOTH, durationMinutes: BOTH });
	}
	if (row.timeZone !== null && !isTimeZone(row.timeZone as string)) {
		return invalid(UNKNOWN_ZONE, { timeZone: UNKNOWN_ZONE });
	}
	return null;
}

registerRules('template', [templateError]);

/** Trimmed optional text; blank becomes null. */
const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max, `Use at most ${max} characters.`)
		.nullable()
		.optional()
		.transform((v) => (v === '' ? null : v));

const id = z.string().min(1);
const refId = id.nullable().optional();
const time = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:00.')
	.nullable()
	.optional();
const duration = z
	.number()
	.int('Use a whole number of minutes.')
	.positive('Use a positive number of minutes.')
	.max(2_628_000, 'Duration must be at most 5 years.')
	.nullable()
	.optional();
const zone = z
	.string()
	.trim()
	.nullable()
	.optional()
	.transform((v) => (v === '' ? null : v));

const fields = {
	customerId: refId,
	projectId: refId,
	activityId: refId,
	locationId: refId,
	startTime: time,
	endTime: time,
	durationMinutes: duration,
	timeZone: zone,
	reference: text(200),
	description: text(2000)
};
export const createSchema = z.object({ name: nameSchema, ...fields });
export const updateSchema = z.object({
	id,
	expectedVersion: z.number().int().optional(),
	name: nameSchema.optional(),
	...fields
});
export const deleteSchema = z.object({ id, expectedVersion: z.number().int().optional() });
export const getSchema = z.object({ id });

const COLUMNS = Object.keys(fields) as (keyof typeof fields)[];

const duplicate = () => fail('conflict', DUPLICATE, { name: DUPLICATE });

/** Whether another of the user's templates has the key. */
function taken(tx: Handle, userId: string, key: string, exceptId?: string): boolean {
	const t = table('template');
	return tx
		.select({ id: t.id })
		.from(t)
		.where(and(eq(t.userId, userId), eq(t.nameKey, key)))
		.all()
		.some((r) => r.id !== exceptId);
}

export function createTemplate(w: Writer, input: unknown): Result<Template> {
	const parsed = createSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	const key = nameKey(data.name);
	if (taken(w.tx, w.userId, key)) return duplicate();
	const row: Row = { id: newId(), userId: w.userId, name: data.name, nameKey: key };
	for (const c of COLUMNS) row[c] = data[c] ?? null;
	const error = templateError(w.tx, row);
	if (error) return { ok: false, error };
	return ok(w.insert('template', row) as Template);
}

/** The user's template, checked against the caller's expected version. */
function load(
	db: Handle,
	userId: string,
	rowId: string,
	expectedVersion: number | undefined
): Result<Template> {
	const t = table('template');
	const row = db
		.select()
		.from(t)
		.where(and(eq(t.id, rowId), eq(t.userId, userId)))
		.get();
	if (!row) return fail('not_found', 'Not found.');
	if (expectedVersion !== undefined && row.version !== expectedVersion) {
		return fail('conflict', STALE);
	}
	return ok(row);
}

/** A partial edit: a field left out is kept, one set to null is cleared. */
export function updateTemplate(w: Writer, input: unknown): Result<Template> {
	const parsed = updateSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	const loaded = load(w.tx, w.userId, data.id, data.expectedVersion);
	if (!loaded.ok) return loaded;
	const row = loaded.value;
	const next: Row = { ...row };
	if (data.name !== undefined) {
		next.name = data.name;
		next.nameKey = nameKey(data.name);
		if (taken(w.tx, w.userId, next.nameKey as string, row.id)) return duplicate();
	}
	for (const c of COLUMNS) if (data[c] !== undefined) next[c] = data[c];
	const error = templateError(w.tx, next);
	if (error) return { ok: false, error };
	return ok((w.update('template', row.id, next) ?? row) as Template);
}

/** Deletes a template, recorded with op `delete` so undo puts it back; returns it as it was. */
export function deleteTemplate(w: Writer, input: unknown): Result<Template> {
	const parsed = deleteSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const loaded = load(w.tx, w.userId, parsed.data.id, parsed.data.expectedVersion);
	if (!loaded.ok) return loaded;
	return ok(w.remove('template', loaded.value.id) as Template);
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** The user's templates with the names they point at. */
function selectItems(db: Handle, userId: string, rowId?: string): TemplateItem[] {
	const t = table('template');
	const c = table('customer');
	const p = table('project');
	const a = table('activity');
	const l = table('location');
	return db
		.select({
			template: t,
			customerName: c.name,
			projectName: p.name,
			activityName: a.name,
			locationName: l.name
		})
		.from(t)
		.leftJoin(c, and(eq(c.id, t.customerId), eq(c.userId, userId)))
		.leftJoin(p, and(eq(p.id, t.projectId), eq(p.userId, userId)))
		.leftJoin(a, and(eq(a.id, t.activityId), eq(a.userId, userId)))
		.leftJoin(l, and(eq(l.id, t.locationId), eq(l.userId, userId)))
		.where(and(eq(t.userId, userId), rowId === undefined ? undefined : eq(t.id, rowId)))
		.all()
		.map(({ template, ...names }) => ({ ...template, ...names }));
}

/** One of the user's templates with its names. */
export function getTemplate(db: Handle, userId: string, input: unknown): Result<TemplateItem> {
	const parsed = getSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const [item] = selectItems(db, userId, parsed.data.id);
	return item ? ok(item) : fail('not_found', 'Not found.');
}

/** The user's templates sorted by name for people, each with its names. */
export function listTemplates(db: Handle, userId: string): Result<TemplateItem[]> {
	return ok(selectItems(db, userId).sort((a, b) => collator.compare(a.name, b.name)));
}

export const fromTemplateSchema = z.object({
	templateId: id,
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-18.')
		.optional(),
	start: z.string().optional(),
	timeZone: z.string().optional(),
	end: z.string().optional(),
	durationMinutes: duration.unwrap().unwrap().optional(),
	endTimeZone: z.string().optional(),
	projectId: id.optional(),
	activityId: refId,
	locationId: refId,
	reference: z.string().nullable().optional(),
	description: z.string().nullable().optional()
});

const iso = (at: number) => new Date(at).toISOString();

/**
 * The local date a template's start time is used on when no date is given: today in
 * the zone, or yesterday for an overnight template (end time not after start time)
 * whose start today is still ahead, so a tap after a night shift logs that shift.
 */
function startDate(startTime: string, endTime: string | null, now: number, zone: string) {
	const today = localParts(now, zone).date;
	if (endTime === null || endTime > startTime) return today;
	const todayStart = parseTime(`${today}T${startTime}`, zone);
	return todayStart.ok && todayStart.at > now ? previousDate(today) : today;
}

/**
 * Resolves the input of `createEntry` for an entry made from a template; running it
 * through `createEntry` applies every entry rule, the timer auto-stop, the future
 * limit and the warnings. Given fields win over the template's; blank given text
 * counts as not given.
 *
 * Start: the given `start`; else the template's `startTime` on `date` (default today
 * in the zone, or yesterday for an overnight template whose start today is still
 * ahead); else, with a known duration, a given `end` or now less that duration; else
 * it runs from now. A `date` needs a template start time.
 *
 * End: the given `end` or `durationMinutes`; else the template's `endTime` on the
 * start's local date, or on the next date when that is not after the start (a time
 * in a daylight-saving gap is refused, never rolled over); else its duration.
 */
export function resolveFromTemplate(
	db: Handle,
	userId: string,
	now: number,
	input: unknown
): Result<Record<string, unknown>> {
	const parsed = fromTemplateSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	const loaded = load(db, userId, data.templateId, undefined);
	if (!loaded.ok) return loaded;
	const t = loaded.value;

	const zone = data.timeZone ?? t.timeZone;
	if (zone === null) return fail('invalid', PICK_ZONE, { timeZone: PICK_ZONE });
	if (!isTimeZone(zone)) return fail('invalid', UNKNOWN_ZONE, { timeZone: UNKNOWN_ZONE });
	const endZone = data.endTimeZone ?? zone;
	if (!isTimeZone(endZone)) {
		return fail('invalid', UNKNOWN_ZONE, { endTimeZone: UNKNOWN_ZONE });
	}

	const projectId = data.projectId ?? t.projectId;
	if (projectId === null) return fail('invalid', PICK_PROJECT, { projectId: PICK_PROJECT });
	if (data.projectId !== undefined && t.customerId !== null) {
		const p = table('project');
		const project = db
			.select({ customerId: p.customerId })
			.from(p)
			.where(and(eq(p.id, projectId), eq(p.userId, userId)))
			.get();
		// A project that is not the user's is left to createEntry's not_found.
		if (project && project.customerId !== t.customerId) {
			return fail('invalid', PROJECT_MISMATCH, { projectId: PROJECT_MISMATCH });
		}
	}

	const pick = <K extends 'activityId' | 'locationId'>(key: K) =>
		data[key] === undefined ? t[key] : data[key];
	// Blank text counts as not given; only an explicit null clears the template's.
	const pickText = (key: 'reference' | 'description') => {
		const given = data[key];
		return given === undefined || given?.trim() === '' ? t[key] : given;
	};
	const built: Record<string, unknown> = {
		projectId,
		activityId: pick('activityId'),
		locationId: pick('locationId'),
		reference: pickText('reference'),
		description: pickText('description'),
		timeZone: zone,
		endTimeZone: data.endTimeZone
	};

	let start = data.start;
	if (start === undefined && t.startTime !== null) {
		start = `${data.date ?? startDate(t.startTime, t.endTime, now, zone)}T${t.startTime}`;
	}
	if (start === undefined) {
		if (data.date !== undefined) {
			return fail('invalid', DATE_NEEDS_START, { date: DATE_NEEDS_START });
		}
		const minutes = data.durationMinutes ?? t.durationMinutes;
		if (data.end !== undefined) {
			if (minutes === null) {
				return fail('invalid', END_NEEDS_START, { start: END_NEEDS_START });
			}
			const endAt = parseTime(data.end, endZone);
			if (!endAt.ok) return fail('invalid', endAt.message, { end: endAt.message });
			return ok({ ...built, start: iso(endAt.at - minutes * MINUTE), end: data.end });
		}
		// A tap usually logs work just done: a known duration ends now.
		if (minutes === null) return ok({ ...built, start: iso(now) });
		return ok({ ...built, start: iso(now - minutes * MINUTE), end: iso(now) });
	}
	built.start = start;

	if (data.end !== undefined || data.durationMinutes !== undefined) {
		return ok({ ...built, end: data.end, durationMinutes: data.durationMinutes });
	}
	if (t.endTime !== null) {
		const startAt = parseTime(start, zone);
		if (!startAt.ok) return fail('invalid', startAt.message, { start: startAt.message });
		const onDate = localParts(startAt.at, zone).date;
		// The end time on the start's date; the next date only when that exists and is
		// not after the start. One in a daylight-saving gap is refused, not rolled over.
		let end = `${onDate}T${t.endTime}`;
		let endAt = parseTime(end, endZone);
		if (endAt.ok && endAt.at <= startAt.at) {
			end = `${nextDate(onDate)}T${t.endTime}`;
			endAt = parseTime(end, endZone);
		}
		if (!endAt.ok) return fail('invalid', endAt.message, { end: endAt.message });
		if (endAt.at <= startAt.at) {
			return fail('invalid', END_AFTER_START, { end: END_AFTER_START });
		}
		return ok({ ...built, end });
	}
	if (t.durationMinutes !== null) {
		return ok({ ...built, durationMinutes: t.durationMinutes });
	}
	return ok(built);
}

/** Creates an entry from a template through `createEntry` (see `resolveFromTemplate`). */
export function entryFromTemplate(w: Writer, input: unknown): Result<Entry> {
	const resolved = resolveFromTemplate(w.tx, w.userId, w.now, input);
	return resolved.ok ? createEntry(w, resolved.value) : resolved;
}

export const fromEntrySchema = z.object({ entryId: id, name: z.unknown() });

/**
 * Saves an entry as a template: its references, texts and start zone, its start as a
 * local time, and its end as a local time when it ends later on the same local date
 * or on the next date at a time of day not after the start's (an overnight entry),
 * else as a duration; a running entry gives no end.
 */
export function templateFromEntry(w: Writer, input: unknown): Result<Template> {
	const parsed = fromEntrySchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const e = table('entry');
	const row = w.tx
		.select()
		.from(e)
		.where(and(eq(e.id, parsed.data.entryId), eq(e.userId, w.userId)))
		.get();
	if (!row) return fail('not_found', 'Not found.');
	const p = table('project');
	const project = w.tx
		.select({ customerId: p.customerId })
		.from(p)
		.where(and(eq(p.id, row.projectId), eq(p.userId, w.userId)))
		.get();
	const start = localParts(row.startAt, row.startZone);
	let endTime: string | null = null;
	let durationMinutes: number | null = null;
	if (row.endAt !== null) {
		const end = localParts(row.endAt, row.startZone);
		const sameDay = end.date === start.date && end.time > start.time;
		const overnight = end.date === nextDate(start.date) && end.time <= start.time;
		// Anything else (within a minute, a clock change, a day or more) keeps a duration.
		if (sameDay || overnight) endTime = end.time;
		else durationMinutes = Math.max(1, Math.round((row.endAt - row.startAt) / MINUTE));
	}
	return createTemplate(w, {
		name: parsed.data.name,
		customerId: project?.customerId ?? null,
		projectId: row.projectId,
		activityId: row.activityId,
		locationId: row.locationId,
		startTime: start.time,
		endTime,
		durationMinutes,
		timeZone: row.startZone,
		reference: row.reference,
		description: row.description
	});
}
