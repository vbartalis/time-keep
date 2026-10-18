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
import { nameSchema } from './names';
import { fail, type Result } from './result';
import { undo, undoLabel } from './undo';
import { table, type Writer } from './write';

export type { Actor } from './batch';
export type { HistoryBatch, HistoryChange } from './history';
export type { Named, ProjectListItem, ProjectRow } from './reference';
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

/** Commands that run inside whatever batch is open. */
export type BatchCore = {
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

function commands(db: DB, userId: string, exec: Exec) {
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
	return {
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
	const own = commands(db, userId, alone);
	return {
		customers: { ...own.customers, list: (input) => listCustomers(db, userId, input) },
		projects: { ...own.projects, list: (input) => listProjects(db, userId, input) },
		activities: { ...own.activities, list: (input) => listActivities(db, userId, input) },
		locations: { ...own.locations, list: (input) => listLocations(db, userId, input) },
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
				(w) => fn(commands(db, userId, (_label, run) => run(w))),
				clock()
			);
		}
	};
}
