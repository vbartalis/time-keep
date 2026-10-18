/**
 * The one recording write path. Every write to the time data goes through a Writer,
 * which records a change row per write and runs the entity's rules on the result.
 * No other module writes these tables (guard.test.ts enforces it).
 */
import { and, eq, getTableColumns } from 'drizzle-orm';
import type { DB } from '../db/index';
import { activity, batch, change, customer, entry, location, project } from '../db/schema';
import { newId } from '../id';
import type { CoreError, Warning } from './result';

export type Entity = 'customer' | 'project' | 'activity' | 'location' | 'entry';

/** Each entity's shape version: raise it when a migration renames, removes or retypes a column. */
export const SHAPES: Record<Entity, number> = {
	customer: 1,
	project: 1,
	activity: 1,
	location: 1,
	entry: 1
};

const TABLES = { customer, project, activity, location, entry } as const;
type Tables = typeof TABLES;
type AnyTable = Tables[Entity];

/** The drizzle table of an entity, for reads inside core/. */
export function table<E extends Entity>(entity: E): Tables[E] {
	return TABLES[entity];
}

export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export type Row = Record<string, unknown>;
export type Rule = (tx: Tx, row: Row) => CoreError | null;
type ChangeOp = 'create' | 'update' | 'archive' | 'unarchive' | 'delete';

export class CoreFailure extends Error {
	constructor(public error: CoreError) {
		super(error.message);
		this.name = 'CoreFailure';
	}
}

/** Runs once at the end of a batch on the rows it touched (deleted ones included), seeing its final state. */
export type BatchCheck = (
	tx: Tx,
	ctx: { userId: string; batchId: string; touched: string[]; now: number }
) => { error?: CoreError; warnings?: Warning[] } | null;

const batchChecks = new Map<Entity, BatchCheck[]>();

/** Adds a check run, in registration order, at the end of every batch that touched the entity. */
export function registerBatchCheck(entity: Entity, check: BatchCheck): void {
	batchChecks.set(entity, [...(batchChecks.get(entity) ?? []), check]);
}

/** Removes an entity's batch checks. Tests only. */
export function clearBatchChecks(entity: Entity): void {
	batchChecks.delete(entity);
}

/** The checks of an entity, in registration order. */
export function batchChecksOf(entity: Entity): readonly BatchCheck[] {
	return batchChecks.get(entity) ?? [];
}

const rules = new Map<Entity, Rule[]>();

/** Sets (replaces) the rules run on every write of an entity, undo included. */
export function registerRules(entity: Entity, list: Rule[]): void {
	rules.set(entity, [...list]);
}

/** A row as JSON with sorted keys, so equal rows always serialise identically. */
export function rowJson(row: Row): string {
	const sorted: Row = {};
	for (const key of Object.keys(row).sort()) sorted[key] = row[key];
	return JSON.stringify(sorted);
}

/** Records a batch row; runBatch calls this before any change of the batch. */
/** Whether a transaction is already open on the connection. */
export const inTransaction = (db: DB): boolean => db.$client.inTransaction;

export function insertBatch(tx: Tx, row: typeof batch.$inferInsert): void {
	tx.insert(batch).values(row).run();
}

/** Columns a patch may not set: identity and the writer's own bookkeeping. */
const MANAGED = new Set(['id', 'userId', 'version', 'createdAt', 'updatedAt']);

export class Writer {
	private seq = 0;
	private failed: { error: unknown } | undefined;
	private readonly touchedIds = new Map<Entity, Set<string>>();

	constructor(
		readonly tx: Tx,
		readonly batchId: string,
		readonly userId: string,
		readonly now: number
	) {}

	get changeCount(): number {
		return this.seq;
	}

	/** The ids written in this batch (inserted, updated, restored or deleted), per entity, once each. */
	get touched(): ReadonlyMap<Entity, readonly string[]> {
		return new Map([...this.touchedIds].map(([entity, ids]) => [entity, [...ids]]));
	}

	/**
	 * The first error any write of this writer threw (a `CoreFailure` or a driver
	 * error), or undefined. Once set, runBatch rolls the batch back even if the
	 * command caught the error and returned ok.
	 */
	get failure(): { error: unknown } | undefined {
		return this.failed;
	}

	/**
	 * Refuses the command: records the failure like a failed write, so the batch rolls
	 * back even if the command's caller catches the error, and throws it as `CoreFailure`.
	 */
	refuse(error: CoreError): never {
		const failure = new CoreFailure(error);
		this.failed ??= { error: failure };
		throw failure;
	}

	/** Runs one write, remembering the first error it throws before rethrowing it. */
	private guard<R>(write: () => R): R {
		try {
			return write();
		} catch (error) {
			this.failed ??= { error };
			throw error;
		}
	}

	/** Inserts a row owned by the batch's user, at version 1, and records a `create`. */
	insert(entity: Entity, row: Row): Row {
		return this.guard(() => this.doInsert(entity, row));
	}

	private doInsert(entity: Entity, row: Row): Row {
		const t = TABLES[entity];
		const id = row.id as string;
		const values: Row = {
			...row,
			userId: this.userId,
			version: 1,
			createdAt: this.now,
			updatedAt: this.now
		};
		this.tx
			.insert(t)
			.values(values as never)
			.run();
		const after = this.read(t, id)!;
		this.record(entity, id, 'create', null, after);
		return after;
	}

	/**
	 * Applies a patch to the user's row. Returns null and records nothing when the patch
	 * changes no column; otherwise raises `version`, sets `updatedAt` and records `op`.
	 */
	update(
		entity: Entity,
		id: string,
		patch: Row,
		op: 'update' | 'archive' | 'unarchive' = 'update'
	): Row | null {
		return this.guard(() => this.doUpdate(entity, id, patch, op));
	}

	private doUpdate(
		entity: Entity,
		id: string,
		patch: Row,
		op: 'update' | 'archive' | 'unarchive'
	): Row | null {
		const t = TABLES[entity];
		const columns = getTableColumns(t);
		const before = this.read(t, id);
		if (!before) throw new CoreFailure({ code: 'not_found', message: 'Not found.' });
		const changed: Row = {};
		for (const [key, value] of Object.entries(patch)) {
			if (value === undefined || MANAGED.has(key) || !Object.hasOwn(columns, key)) continue;
			if (!Object.is(before[key], value)) changed[key] = value;
		}
		if (Object.keys(changed).length === 0) return null;
		this.set(t, id, {
			...changed,
			version: (before.version as number) + 1,
			updatedAt: this.now
		});
		const after = this.read(t, id)!;
		this.record(entity, id, op, before, after);
		return after;
	}

	/** Deletes the user's row and records a `delete`; returns the row as it was. */
	remove(entity: Entity, id: string): Row {
		return this.guard(() => this.doRemove(entity, id));
	}

	private doRemove(entity: Entity, id: string): Row {
		const t = TABLES[entity];
		const before = this.read(t, id);
		if (!before) throw new CoreFailure({ code: 'not_found', message: 'Not found.' });
		this.tx
			.delete(t)
			.where(and(eq(t.id, id), eq(t.userId, this.userId)))
			.run();
		this.record(entity, id, 'delete', before, null);
		return before;
	}

	/**
	 * Writes `before` back, reverting change `reverts`: deletes the row when `before` is
	 * null, inserts it when absent, else updates it to the stored columns. Either way
	 * `version` is raised (above the current, or the stored, one) and `updatedAt` set,
	 * so a version is never reused for different content.
	 */
	restore(entity: Entity, id: string, before: Row | null, reverts: string): void {
		this.guard(() => this.doRestore(entity, id, before, reverts));
	}

	private doRestore(entity: Entity, id: string, before: Row | null, reverts: string): void {
		const t = TABLES[entity];
		const current = this.read(t, id);
		if (before === null) {
			if (!current) return;
			this.tx
				.delete(t)
				.where(and(eq(t.id, id), eq(t.userId, this.userId)))
				.run();
			this.record(entity, id, 'delete', current, null, reverts);
			return;
		}
		if (before.id !== id || before.userId !== this.userId) {
			throw new Error(`restore: row ${id} does not match the stored row`);
		}
		if (!current) {
			this.tx
				.insert(t)
				.values({
					...before,
					version: (before.version as number) + 1,
					updatedAt: this.now
				} as never)
				.run();
			this.record(entity, id, 'create', null, this.read(t, id)!, reverts);
			return;
		}
		const columns: Row = { ...before };
		delete columns.id;
		this.set(t, id, {
			...columns,
			version: (current.version as number) + 1,
			updatedAt: this.now
		});
		this.record(entity, id, 'update', current, this.read(t, id)!, reverts);
	}

	private read(t: AnyTable, id: string): Row | undefined {
		return this.tx
			.select()
			.from(t)
			.where(and(eq(t.id, id), eq(t.userId, this.userId)))
			.get() as Row | undefined;
	}

	private set(t: AnyTable, id: string, values: Row): void {
		this.tx
			.update(t)
			.set(values as never)
			.where(and(eq(t.id, id), eq(t.userId, this.userId)))
			.run();
	}

	private record(
		entity: Entity,
		entityId: string,
		op: ChangeOp,
		before: Row | null,
		after: Row | null,
		reverts: string | null = null
	): void {
		let ids = this.touchedIds.get(entity);
		if (!ids) this.touchedIds.set(entity, (ids = new Set()));
		ids.add(entityId);
		this.tx
			.insert(change)
			.values({
				id: newId(),
				batchId: this.batchId,
				seq: this.seq++,
				entity,
				entityId,
				op,
				before: before && rowJson(before),
				after: after && rowJson(after),
				shape: SHAPES[entity],
				reverts
			})
			.run();
		if (after) this.check(entity, after);
	}

	private check(entity: Entity, row: Row): void {
		for (const rule of rules.get(entity) ?? []) {
			const error = rule(this.tx, row);
			if (error) throw new CoreFailure(error);
		}
	}
}
