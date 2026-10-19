/**
 * The core's public API: the only module outside core/ that may be imported. `openCore`
 * returns the commands and reads for one user. A command called on the core runs as its
 * own batch with a generated label; `core.batch` runs several as one batch.
 */
import { and, eq } from 'drizzle-orm';
import type { DB } from '../db/index';
import { batch } from '../db/schema';
import { runBatch, type Actor } from './batch';
import { listHistory } from './history';
import {
	archive,
	createActivity,
	createCustomer,
	createLocation,
	createProject,
	listActivities,
	listCustomers,
	listLocations,
	listProjects,
	rename,
	unarchive,
	type Kind,
	type Named,
	type ProjectListItem,
	type ProjectRow
} from './reference';
import {
	createEntry,
	deleteEntry,
	getEntry,
	listEntries,
	startTimer,
	stopTimer,
	updateEntry,
	type Entry,
	type EntryItem
} from './entries';
import { nameSchema } from './names';
import {
	createTemplate,
	deleteTemplate,
	entryFromTemplate,
	getTemplate,
	listTemplates,
	resolveFromTemplate,
	templateFromEntry,
	updateTemplate,
	type Template,
	type TemplateItem
} from './templates';
import { fail, type Result } from './result';
import { undo, undoLabel } from './undo';
import { table, type Writer } from './write';

export type { Actor } from './batch';
export type { HistoryBatch, HistoryChange } from './history';
export type { Named, ProjectListItem, ProjectRow } from './reference';
export type { Entry, EntryItem } from './entries';
export type { Template, TemplateItem } from './templates';
export type { CoreError, Result, Warning } from './result';

/** The commands and reads of one kind of reference data. */
export type Reference<Row, ListRow = Row, CreateInput = { name: string }> = {
	create(input: CreateInput): Result<Row>;
	rename(input: { id: string; name: string; expectedVersion?: number }): Result<Row>;
	archive(input: { id: string; expectedVersion?: number }): Result<Row>;
	unarchive(input: { id: string; expectedVersion?: number }): Result<Row>;
	list(input?: { includeArchived?: boolean }): Result<ListRow[]>;
};

export type ProjectReference = Omit<
	Reference<ProjectRow, ProjectListItem, { customerId: string; name: string }>,
	'list'
> & { list(input?: { includeArchived?: boolean; customerId?: string }): Result<ProjectListItem[]> };

export type UndoInput = { batchId: string } | { changeIds: string[] };

export type EntryCommands = {
	entries: {
		create(input: unknown): Result<Entry>;
		update(input: unknown): Result<Entry>;
		delete(input: unknown): Result<Entry>;
		fromTemplate(input: unknown): Result<Entry>;
	};
	timers: {
		start(input: unknown): Result<Entry>;
		stop(input: unknown): Result<Entry>;
	};
	templates: {
		create(input: unknown): Result<Template>;
		update(input: unknown): Result<Template>;
		delete(input: unknown): Result<Template>;
		fromEntry(input: unknown): Result<Template>;
	};
};

/** Commands that run inside whatever batch is open. */
export type BatchCore = EntryCommands & {
	customers: Omit<Reference<Named>, 'list'>;
	projects: Omit<ProjectReference, 'list'>;
	activities: Omit<Reference<Named>, 'list'>;
	locations: Omit<Reference<Named>, 'list'>;
	undo(input: UndoInput): Result<{ reverted: string[] }>;
};

export type Core = {
	customers: Reference<Named>;
	projects: ProjectReference;
	activities: Reference<Named>;
	locations: Reference<Named>;
	timers: BatchCore['timers'];
	entries: BatchCore['entries'] & {
		list(input?: unknown): Result<EntryItem[]>;
		get(input: unknown): Result<EntryItem>;
	};
	templates: BatchCore['templates'] & {
		list(): Result<TemplateItem[]>;
		get(input: unknown): Result<TemplateItem>;
	};
	history: {
		list: (input?: { before?: string; limit?: number }) => ReturnType<typeof listHistory>;
	};
	undo: BatchCore['undo'];
	batch<T>(label: string, fn: (c: BatchCore) => Result<T>): Result<T>;
};

/** Runs a command: `label` is only used when the command opens its own batch. */
type Exec = <T>(label: () => string, fn: (w: Writer) => Result<T>) => Result<T>;

const NOUN: Record<Kind, string> = {
	customer: 'customer',
	project: 'project',
	activity: 'activity',
	location: 'location'
};

/** A quoted name from untrusted input, as the command will store it. */
function inputName(input: unknown): string {
	const name = (input as { name?: unknown } | null)?.name;
	const parsed = nameSchema.safeParse(name);
	return parsed.success ? parsed.data : String(name ?? '');
}

function commands(db: DB, userId: string, exec: Exec, clock: () => number) {
	/** The stored name of a row, for labels; empty when it is not there. */
	const currentName = (kind: Kind, input: unknown): string => {
		const id = (input as { id?: unknown } | null)?.id;
		if (typeof id !== 'string') return '';
		const t = table(kind);
		const row = db
			.select({ name: t.name })
			.from(t)
			.where(and(eq(t.id, id), eq(t.userId, userId)))
			.get();
		return row?.name ?? '';
	};
	const reference = <Row>(
		kind: Kind,
		create: (w: Writer, input: unknown) => Result<Row>
	): Omit<Reference<Row>, 'list'> => ({
		create: (input) =>
			exec(
				() => `Create ${NOUN[kind]} "${inputName(input)}"`,
				(w) => create(w, input)
			),
		rename: (input) =>
			exec(
				() => `Rename ${NOUN[kind]} "${currentName(kind, input)}" to "${inputName(input)}"`,
				(w) => rename(w, kind, input) as Result<Row>
			),
		archive: (input) =>
			exec(
				() => `Archive ${NOUN[kind]} "${currentName(kind, input)}"`,
				(w) => archive(w, kind, input) as Result<Row>
			),
		unarchive: (input) =>
			exec(
				() => `Unarchive ${NOUN[kind]} "${currentName(kind, input)}"`,
				(w) => unarchive(w, kind, input) as Result<Row>
			)
	});
	/** The project name for a label: of `input.projectId` when given and found, else of the entry `input.id` names. */
	const entryProject = (input: unknown, byEntry: boolean): string => {
		const i = input as { id?: unknown; projectId?: unknown } | null;
		const p = table('project');
		const e = table('entry');
		const moved = byEntry && typeof i?.projectId === 'string' ? entryProject(input, false) : '';
		if (moved !== '') return moved;
		const key = byEntry ? i?.id : i?.projectId;
		if (typeof key !== 'string') return '';
		const row = byEntry
			? db
					.select({ name: p.name })
					.from(e)
					.innerJoin(p, eq(p.id, e.projectId))
					.where(and(eq(e.id, key), eq(e.userId, userId)))
					.get()
			: db
					.select({ name: p.name })
					.from(p)
					.where(and(eq(p.id, key), eq(p.userId, userId)))
					.get();
		return row?.name ?? '';
	};
	const entryCommand =
		(verb: string, byEntry: boolean, run: (w: Writer, input: unknown) => Result<Entry>) =>
		(input: unknown) =>
			exec(
				() => `${verb} on "${entryProject(input, byEntry)}"`,
				(w) => run(w, input)
			);
	/** The stored name of the template `input.id` or `input.templateId` names, for labels. */
	const templateName = (input: unknown): string => {
		const i = input as { id?: unknown; templateId?: unknown } | null;
		const key = typeof i?.id === 'string' ? i.id : i?.templateId;
		if (typeof key !== 'string') return '';
		const t = table('template');
		const row = db
			.select({ name: t.name })
			.from(t)
			.where(and(eq(t.id, key), eq(t.userId, userId)))
			.get();
		return row?.name ?? '';
	};
	/** Whether an entry made from the template now would be a running timer. */
	const runsFromTemplate = (input: unknown): boolean => {
		const r = resolveFromTemplate(db, userId, clock(), input);
		return r.ok && r.value.end === undefined && r.value.durationMinutes === undefined;
	};
	return {
		templates: {
			create: (input: unknown) =>
				exec(
					() => `Create template "${inputName(input)}"`,
					(w) => createTemplate(w, input)
				),
			update: (input: unknown) =>
				exec(
					() => `Edit template "${templateName(input)}"`,
					(w) => updateTemplate(w, input)
				),
			delete: (input: unknown) =>
				exec(
					() => `Delete template "${templateName(input)}"`,
					(w) => deleteTemplate(w, input)
				),
			fromEntry: (input: unknown) =>
				exec(
					() => `Save entry as template "${inputName(input)}"`,
					(w) => templateFromEntry(w, input)
				)
		},
		entries: {
			fromTemplate: (input: unknown) =>
				exec(
					() =>
						`${runsFromTemplate(input) ? 'Start timer' : 'Create entry'} from template "${templateName(input)}"`,
					(w) => entryFromTemplate(w, input)
				),
			create: entryCommand('Create entry', false, createEntry),
			update: entryCommand('Edit entry', true, updateEntry),
			delete: entryCommand('Delete entry', true, deleteEntry)
		},
		timers: {
			start: entryCommand('Start timer', false, startTimer),
			stop: entryCommand('Stop timer', true, stopTimer)
		},
		customers: reference<Named>('customer', createCustomer),
		projects: reference<ProjectRow>('project', createProject) as unknown as BatchCore['projects'],
		activities: reference<Named>('activity', createActivity),
		locations: reference<Named>('location', createLocation),
		undo: ((input) =>
			exec(
				() => {
					const id = (input as { batchId?: unknown } | null)?.batchId;
					const original =
						typeof id === 'string'
							? db
									.select({ label: batch.label })
									.from(batch)
									.where(and(eq(batch.id, id), eq(batch.userId, userId)))
									.get()
							: undefined;
					return undoLabel(input, original?.label);
				},
				(w) => undo(w, input)
			)) as BatchCore['undo']
	};
}

/** Opens the core for one user. `clock` returns epoch milliseconds (tests inject it). */
export function openCore(
	db: DB,
	userId: string,
	actor: Actor,
	clock: () => number = Date.now
): Core {
	const alone: Exec = (label, fn) => runBatch(db, userId, actor, label(), fn, clock());
	const own = commands(db, userId, alone, clock);
	return {
		customers: { ...own.customers, list: (input) => listCustomers(db, userId, input) },
		projects: { ...own.projects, list: (input) => listProjects(db, userId, input) },
		activities: { ...own.activities, list: (input) => listActivities(db, userId, input) },
		locations: { ...own.locations, list: (input) => listLocations(db, userId, input) },
		entries: {
			...own.entries,
			list: (input) => listEntries(db, userId, input, clock()),
			get: (input) => getEntry(db, userId, input)
		},
		timers: own.timers,
		templates: {
			...own.templates,
			list: () => listTemplates(db, userId),
			get: (input) => getTemplate(db, userId, input)
		},
		history: { list: (input) => listHistory(db, userId, input) },
		undo: own.undo,
		batch: (label, fn) => {
			const trimmed = typeof label === 'string' ? label.trim() : '';
			if (trimmed.length < 1 || trimmed.length > 200) {
				return fail('invalid', 'The input is not valid.', {
					label: 'Label must be 1–200 characters.'
				});
			}
			return runBatch(
				db,
				userId,
				actor,
				trimmed,
				(w) => fn(commands(db, userId, (_label, run) => run(w), clock)),
				clock()
			);
		}
	};
}

export { isTimeZone, localParts, nextDate, parseTime, previousDate } from './time';
