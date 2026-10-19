/**
 * Entries: create, edit, delete and read. Commands take a Writer (inside runBatch) and
 * untrusted input; reads take any database handle.
 */
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db/index';
import { change } from '../db/schema';
import type { Entry } from '../db/schema';
import { newId } from '../id';
import { fail, fromZod, ok, type CoreError, type Result, type Warning } from './result';
import { isTimeZone, parseTime } from './time';
import { registerBatchCheck, registerRules, table, type Row, type Tx, type Writer } from './write';

export type { Entry };
/** An entry with the names a list or a screen shows beside it. */
export type EntryItem = Entry & {
	projectName: string;
	customerId: string;
	customerName: string;
	activityName: string | null;
	locationName: string | null;
};

type Handle = Tx | DB;

const STALE = 'This was changed elsewhere; reload and try again.';
const END_AFTER_START = 'The end must be after the start.';
const UNKNOWN_ZONE = 'Unknown time zone.';
const BOTH = 'Give an end or a duration, not both.';
const INSTANT_MESSAGE = 'Use an instant with an offset, like 2026-10-18T09:00:00+02:00.';
const MINUTE = 60_000;
const DAY = 86_400_000;
const STARTED_LATER = 'The running timer on this project started later; stop it first.';
const IN_FUTURE = 'A timer cannot start in the future.';
const STOP_IN_FUTURE = 'A timer cannot stop in the future.';
const STOP_BEFORE_START = 'A timer cannot stop before it started.';
const NO_END_ZONE = 'A running entry has no end time zone.';

/** Refuses a running entry starting more than a minute after the batch's now. */
function futureStart(w: Writer, startAt: number): void {
	if (startAt > w.now + MINUTE) {
		w.refuse({ code: 'invalid', message: IN_FUTURE, fields: { start: IN_FUTURE } });
	}
}

/** The user's row of a reference kind by id, if it exists. */
function owned(
	tx: Handle,
	kind: 'project' | 'activity' | 'location',
	userId: string,
	id: string
): boolean {
	const t = table(kind);
	return (
		tx
			.select({ id: t.id })
			.from(t)
			.where(and(eq(t.id, id), eq(t.userId, userId)))
			.get() !== undefined
	);
}

/**
 * What every stored entry must satisfy: an end exactly when an end zone, after the
 * start, and references that exist and are the user's (archived ones allowed).
 */
function entryError(tx: Handle, row: Row): CoreError | null {
	const userId = row.userId as string;
	if ((row.endAt === null) !== (row.endZone === null)) {
		return { code: 'invalid', message: 'An end needs an end time zone, and only then.' };
	}
	if (row.endAt !== null && (row.endAt as number) <= (row.startAt as number)) {
		return { code: 'invalid', message: END_AFTER_START, fields: { end: END_AFTER_START } };
	}
	if (!owned(tx, 'project', userId, row.projectId as string)) {
		return { code: 'not_found', message: 'The project was not found.' };
	}
	if (row.activityId !== null && !owned(tx, 'activity', userId, row.activityId as string)) {
		return { code: 'not_found', message: 'The activity was not found.' };
	}
	if (row.locationId !== null && !owned(tx, 'location', userId, row.locationId as string)) {
		return { code: 'not_found', message: 'The location was not found.' };
	}
	return null;
}

registerRules('entry', [entryError]);

/**
 * Called before an entry on `projectId` becomes running at `startAt` (a create without
 * an end, an edit that removes the end, or one that moves a running entry): stops the
 * user's running entry on that project (other than `exceptId`) at `startAt`, in its
 * start zone. Throws `conflict` when that entry started at or after `startAt`.
 */
function beforeRunning(w: Writer, projectId: string, startAt: number, exceptId?: string): void {
	const e = table('entry');
	const running = w.tx
		.select()
		.from(e)
		.where(
			and(
				eq(e.userId, w.userId),
				eq(e.projectId, projectId),
				isNull(e.endAt),
				exceptId === undefined ? undefined : ne(e.id, exceptId)
			)
		)
		.all();
	for (const other of running) {
		if (other.startAt >= startAt) {
			w.refuse({ code: 'conflict', message: STARTED_LATER });
		}
		w.update('entry', other.id, { endAt: startAt, endZone: other.startZone });
	}
}

/** At most one running entry per project, over the projects of the touched entries. */
function oneRunningPerProject(tx: Tx, userId: string, rows: Entry[]) {
	const e = table('entry');
	const projects = [...new Set(rows.map((r) => r.projectId))];
	if (projects.length === 0) return null;
	const running = tx
		.select({ projectId: e.projectId })
		.from(e)
		.where(and(eq(e.userId, userId), isNull(e.endAt), inArray(e.projectId, projects)))
		.all();
	const seen = new Set<string>();
	for (const { projectId } of running) {
		if (seen.has(projectId)) {
			return { code: 'conflict' as const, message: 'Only one timer can run on a project.' };
		}
		seen.add(projectId);
	}
	return null;
}

/**
 * Whether this batch created the entry or changed its interval: its first recorded
 * `before` in the batch (null when created here) against its current row.
 */
function intervalChanged(tx: Tx, batchId: string, row: Entry): boolean {
	const first = tx
		.select({ before: change.before })
		.from(change)
		.where(
			and(eq(change.batchId, batchId), eq(change.entity, 'entry'), eq(change.entityId, row.id))
		)
		.orderBy(asc(change.seq))
		.get();
	if (!first || first.before === null) return true;
	const before = JSON.parse(first.before) as Row;
	return before.startAt !== row.startAt || before.endAt !== row.endAt;
}

/** `overlap` and `long` warnings for a finished entry whose interval the batch set. */
function entryWarnings(tx: Tx, userId: string, row: Entry): Warning[] {
	const endAt = row.endAt as number;
	const e = table('entry');
	const others = tx
		.select({ id: e.id })
		.from(e)
		.where(
			and(eq(e.userId, userId), ne(e.id, row.id), gt(e.endAt, row.startAt), lt(e.startAt, endAt))
		)
		.orderBy(asc(e.startAt), asc(e.id))
		.all()
		.map((o) => o.id);
	const found: Warning[] = [];
	if (others.length > 0) {
		const n = others.length;
		found.push({
			code: 'overlap',
			message: `Overlaps ${n} other ${n === 1 ? 'entry' : 'entries'}.`,
			subject: row.id,
			details: { with: others }
		});
	}
	if (endAt - row.startAt > DAY) {
		found.push({ code: 'long', message: 'Longer than 24 hours.', subject: row.id });
	}
	return found;
}

registerBatchCheck('entry', (tx, { userId, batchId, touched }) => {
	const e = table('entry');
	const rows = tx
		.select()
		.from(e)
		.where(and(eq(e.userId, userId), inArray(e.id, touched)))
		.all();
	const error = oneRunningPerProject(tx, userId, rows);
	if (error) return { error };
	const warnings = rows
		.filter((r) => r.endAt !== null && intervalChanged(tx, batchId, r))
		.flatMap((r) => entryWarnings(tx, userId, r));
	return { warnings };
});

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
const duration = z
	.number()
	.int('Use a whole number of minutes.')
	.positive('Use a positive number of minutes.')
	.max(2_628_000, 'Duration must be at most 5 years.');

const createSchema = z.object({
	projectId: id,
	activityId: id.nullable().optional(),
	locationId: id.nullable().optional(),
	start: z.string(),
	timeZone: z.string(),
	end: z.string().optional(),
	durationMinutes: duration.optional(),
	endTimeZone: z.string().optional(),
	reference: text(200),
	description: text(2000)
});

const updateSchema = z.object({
	id,
	expectedVersion: z.number().int().optional(),
	projectId: id.optional(),
	activityId: id.nullable().optional(),
	locationId: id.nullable().optional(),
	start: z.string().optional(),
	timeZone: z.string().optional(),
	end: z.string().nullable().optional(),
	durationMinutes: duration.optional(),
	endTimeZone: z.string().optional(),
	reference: text(200),
	description: text(2000)
});

const startSchema = z.object({
	projectId: id,
	activityId: id.nullable().optional(),
	locationId: id.nullable().optional(),
	start: z.string().optional(),
	timeZone: z.string(),
	reference: text(200),
	description: text(2000)
});

const stopSchema = z.object({
	id,
	expectedVersion: z.number().int().optional(),
	end: z.string().optional(),
	endTimeZone: z.string().optional()
});

const deleteSchema = z.object({ id, expectedVersion: z.number().int().optional() });
const getSchema = z.object({ id });
const listSchema = z.object({
	from: z.string().optional(),
	to: z.string().optional(),
	projectId: id.optional(),
	customerId: id.optional(),
	running: z.boolean().optional(),
	activityId: id.nullable().optional(),
	locationId: id.nullable().optional(),
	text: z
		.string()
		.trim()
		.min(1, 'Use 1–200 characters.')
		.max(200, 'Use 1–200 characters.')
		.optional(),
	startedIn: z.boolean().optional(),
	order: z.enum(['asc', 'desc']).optional(),
	limit: z.number().int().min(1).max(1000).optional()
});

/** Checks the given zones; the first unknown one is `invalid` on its field. */
function zonesError(zones: Record<string, string | undefined>): Result<never> | null {
	for (const [field, zone] of Object.entries(zones)) {
		if (zone !== undefined && !isTimeZone(zone)) {
			return fail('invalid', UNKNOWN_ZONE, { [field]: UNKNOWN_ZONE });
		}
	}
	return null;
}

/** A time read in `zone` (a known one), or `invalid` on `field`. */
function readTime(field: string, value: string, zone: string): Result<number> {
	const parsed = parseTime(value, zone);
	if (!parsed.ok) return fail('invalid', parsed.message, { [field]: parsed.message });
	return ok(parsed.at);
}

/** An instant with `Z` or an offset, or `invalid` on `field`. */
function readInstant(field: string, value: string): Result<number> {
	if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
		return fail('invalid', INSTANT_MESSAGE, { [field]: INSTANT_MESSAGE });
	}
	return readTime(field, value, 'UTC');
}

const bothGiven = () => fail('invalid', BOTH, { end: BOTH, durationMinutes: BOTH });

export function createEntry(w: Writer, input: unknown): Result<Entry> {
	const parsed = createSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	if (data.end !== undefined && data.durationMinutes !== undefined) return bothGiven();
	const zones = zonesError({ timeZone: data.timeZone, endTimeZone: data.endTimeZone });
	if (zones) return zones;
	const start = readTime('start', data.start, data.timeZone);
	if (!start.ok) return start;
	const startAt = start.value;
	const endZone = data.endTimeZone ?? data.timeZone;
	let endAt: number | null = null;
	if (data.end !== undefined) {
		const end = readTime('end', data.end, endZone);
		if (!end.ok) return end;
		endAt = end.value;
	} else if (data.durationMinutes !== undefined) {
		endAt = startAt + data.durationMinutes * MINUTE;
	}
	const row: Row = {
		id: newId(),
		userId: w.userId,
		projectId: data.projectId,
		activityId: data.activityId ?? null,
		locationId: data.locationId ?? null,
		startAt,
		startZone: data.timeZone,
		endAt,
		endZone: endAt === null ? null : endZone,
		reference: data.reference ?? null,
		description: data.description ?? null
	};
	return insertEntry(w, row);
}

/** Checks and inserts a new entry, first stopping its project's timer when it runs. */
function insertEntry(w: Writer, row: Row): Result<Entry> {
	if (row.endAt === null) {
		futureStart(w, row.startAt as number);
	}
	const error = entryError(w.tx, row);
	if (error) return { ok: false, error };
	if (row.endAt === null) beforeRunning(w, row.projectId as string, row.startAt as number);
	return ok(w.insert('entry', row) as Entry);
}

/**
 * Starts a timer: a running entry from `start` (default now, at most a minute ahead),
 * stopping the project's running timer at that point.
 */
export function startTimer(w: Writer, input: unknown): Result<Entry> {
	const parsed = startSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	const zones = zonesError({ timeZone: data.timeZone });
	if (zones) return zones;
	let startAt = w.now;
	if (data.start !== undefined) {
		const start = readTime('start', data.start, data.timeZone);
		if (!start.ok) return start;
		startAt = start.value;
	}
	return insertEntry(w, {
		id: newId(),
		userId: w.userId,
		projectId: data.projectId,
		activityId: data.activityId ?? null,
		locationId: data.locationId ?? null,
		startAt,
		startZone: data.timeZone,
		endAt: null,
		endZone: null,
		reference: data.reference ?? null,
		description: data.description ?? null
	});
}

/** Stops a running entry at `end` (default now), read in `endTimeZone` or its start zone. */
export function stopTimer(w: Writer, input: unknown): Result<Entry> {
	const parsed = stopSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	const loaded = load(w, data.id, data.expectedVersion);
	if (!loaded.ok) return loaded;
	const row = loaded.value;
	if (row.endAt !== null) return fail('conflict', 'That timer is already stopped.');
	const zones = zonesError({ endTimeZone: data.endTimeZone });
	if (zones) return zones;
	const endZone = data.endTimeZone ?? row.startZone;
	let endAt = w.now;
	if (data.end !== undefined) {
		const end = readTime('end', data.end, endZone);
		if (!end.ok) return end;
		endAt = end.value;
	}
	if (endAt > w.now + MINUTE) {
		w.refuse({ code: 'invalid', message: STOP_IN_FUTURE, fields: { end: STOP_IN_FUTURE } });
	}
	if (endAt <= row.startAt) return fail('invalid', STOP_BEFORE_START, { end: STOP_BEFORE_START });
	const next: Row = { ...row, endAt, endZone };
	const error = entryError(w.tx, next);
	if (error) return { ok: false, error };
	return ok((w.update('entry', row.id, next) ?? row) as Entry);
}

/** The user's entry, checked against the caller's expected version. */
function load(w: Writer, id: string, expectedVersion: number | undefined): Result<Entry> {
	const t = table('entry');
	const row = w.tx
		.select()
		.from(t)
		.where(and(eq(t.id, id), eq(t.userId, w.userId)))
		.get();
	if (!row) return fail('not_found', 'Not found.');
	if (expectedVersion !== undefined && row.version !== expectedVersion) {
		return fail('conflict', STALE);
	}
	return ok(row);
}

/**
 * A partial edit. `end: null` makes the entry running; `durationMinutes` sets the end
 * from the (possibly new) start. Whenever the end is (re)computed its zone is
 * `endTimeZone`, else `timeZone`, else the kept end zone, else the start zone; a local
 * `end` is read in that zone. Changing only `timeZone` relabels the start zone.
 */
export function updateEntry(w: Writer, input: unknown): Result<Entry> {
	const parsed = updateSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	if (data.end !== undefined && data.durationMinutes !== undefined) return bothGiven();
	const loaded = load(w, data.id, data.expectedVersion);
	if (!loaded.ok) return loaded;
	const row = loaded.value;
	const zones = zonesError({ timeZone: data.timeZone, endTimeZone: data.endTimeZone });
	if (zones) return zones;
	const startZone = data.timeZone ?? row.startZone;
	let startAt = row.startAt;
	if (data.start !== undefined) {
		const start = readTime('start', data.start, startZone);
		if (!start.ok) return start;
		startAt = start.value;
	}
	const newEndZone = data.endTimeZone ?? data.timeZone ?? row.endZone ?? startZone;
	let endAt = row.endAt;
	let endZone = row.endAt === null ? null : (data.endTimeZone ?? row.endZone);
	if (data.end === null) {
		endAt = null;
		endZone = null;
	} else if (data.end !== undefined) {
		const end = readTime('end', data.end, newEndZone);
		if (!end.ok) return end;
		endAt = end.value;
		endZone = newEndZone;
	} else if (data.durationMinutes !== undefined) {
		endAt = startAt + data.durationMinutes * MINUTE;
		endZone = newEndZone;
	}
	if (endAt === null && data.endTimeZone !== undefined) {
		return fail('invalid', NO_END_ZONE, { endTimeZone: NO_END_ZONE });
	}
	const next: Row = {
		...row,
		projectId: data.projectId ?? row.projectId,
		activityId: data.activityId === undefined ? row.activityId : data.activityId,
		locationId: data.locationId === undefined ? row.locationId : data.locationId,
		startAt,
		startZone,
		endAt,
		endZone,
		reference: data.reference === undefined ? row.reference : data.reference,
		description: data.description === undefined ? row.description : data.description
	};
	const startOnly =
		data.start !== undefined && data.end === undefined && data.durationMinutes === undefined;
	if (startOnly && endAt !== null && endAt <= startAt) {
		return fail('invalid', END_AFTER_START, { start: END_AFTER_START, end: END_AFTER_START });
	}
	if (endAt === null && (row.endAt !== null || startAt !== row.startAt)) {
		futureStart(w, startAt);
	}
	const error = entryError(w.tx, next);
	if (error) return { ok: false, error };
	if (endAt === null && (row.endAt !== null || next.projectId !== row.projectId)) {
		beforeRunning(w, next.projectId as string, startAt, row.id);
	}
	return ok((w.update('entry', row.id, next) ?? row) as Entry);
}

/** Deletes an entry, recorded with op `delete` so undo puts it back; returns it as it was. */
export function deleteEntry(w: Writer, input: unknown): Result<Entry> {
	const parsed = deleteSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const loaded = load(w, parsed.data.id, parsed.data.expectedVersion);
	if (!loaded.ok) return loaded;
	return ok(w.remove('entry', loaded.value.id) as Entry);
}

/** Entries with their names, newest start first unless `order` is `asc`. */
function selectItems(
	db: Handle,
	where: ReturnType<typeof and>,
	order: 'asc' | 'desc' = 'desc'
): EntryItem[] {
	const e = table('entry');
	const p = table('project');
	const c = table('customer');
	const a = table('activity');
	const l = table('location');
	return db
		.select({
			entry: e,
			projectName: p.name,
			customerId: c.id,
			customerName: c.name,
			activityName: a.name,
			locationName: l.name
		})
		.from(e)
		.innerJoin(p, eq(p.id, e.projectId))
		.innerJoin(c, eq(c.id, p.customerId))
		.leftJoin(a, eq(a.id, e.activityId))
		.leftJoin(l, eq(l.id, e.locationId))
		.where(where)
		.orderBy(...(order === 'asc' ? [asc(e.startAt), asc(e.id)] : [desc(e.startAt), desc(e.id)]))
		.all()
		.map(({ entry, ...names }) => ({ ...entry, ...names }));
}

/** One of the user's entries with its names. */
export function getEntry(db: Handle, userId: string, input: unknown): Result<EntryItem> {
	const parsed = getSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const e = table('entry');
	const [item] = selectItems(db, and(eq(e.userId, userId), eq(e.id, parsed.data.id)));
	return item ? ok(item) : fail('not_found', 'Not found.');
}

/** Text as the list compares it: NFC, then lowercased in English. */
const fold = (s: string) => s.normalize('NFC').toLocaleLowerCase('en');

/**
 * The user's entries whose interval touches `[from, to)` (instants with an offset; a
 * running entry reaches `now`; with `startedIn`, whose start lies in it), filtered by
 * project, customer, activity, location (null: none), running and text (in the
 * reference, description, project or customer name, case-insensitive and literal),
 * newest start first unless `order` is `asc`, at most `limit`, each with its names.
 */
export function listEntries(
	db: Handle,
	userId: string,
	input: unknown,
	now: number
): Result<EntryItem[]> {
	const parsed = listSchema.safeParse(input ?? {});
	if (!parsed.success) return fromZod(parsed.error);
	const data = parsed.data;
	const e = table('entry');
	const p = table('project');
	let from: number | undefined;
	let to: number | undefined;
	if (data.from !== undefined) {
		const r = readInstant('from', data.from);
		if (!r.ok) return r;
		from = r.value;
	}
	if (data.to !== undefined) {
		const r = readInstant('to', data.to);
		if (!r.ok) return r;
		to = r.value;
	}
	const reachesFrom =
		from === undefined
			? undefined
			: data.startedIn
				? gte(e.startAt, from)
				: now > from
					? or(gt(e.endAt, from), isNull(e.endAt))
					: gt(e.endAt, from);
	const match = (v: string | null, needle: string) => v !== null && fold(v).includes(needle);
	const needle = data.text === undefined ? undefined : fold(data.text);
	const items = selectItems(
		db,
		and(
			eq(e.userId, userId),
			reachesFrom,
			to === undefined ? undefined : lt(e.startAt, to),
			data.projectId === undefined ? undefined : eq(e.projectId, data.projectId),
			data.customerId === undefined ? undefined : eq(p.customerId, data.customerId),
			data.running === undefined ? undefined : data.running ? isNull(e.endAt) : isNotNull(e.endAt),
			data.activityId === undefined
				? undefined
				: data.activityId === null
					? isNull(e.activityId)
					: eq(e.activityId, data.activityId),
			data.locationId === undefined
				? undefined
				: data.locationId === null
					? isNull(e.locationId)
					: eq(e.locationId, data.locationId)
		),
		data.order
	);
	const found =
		needle === undefined
			? items
			: items.filter(
					(i) =>
						match(i.reference, needle) ||
						match(i.description, needle) ||
						match(i.projectName, needle) ||
						match(i.customerName, needle)
				);
	return ok(data.limit === undefined ? found : found.slice(0, data.limit));
}
