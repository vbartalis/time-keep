/**
 * Undo: reverts a batch, or chosen changes, by writing each change's `before` back
 * through the Writer, newest first. An undo is itself a batch, so redo is undo of it.
 */
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { batch, change } from '../db/schema';
import { newer, undoneBy } from './history';
// Register the entity rules, so a restore is always checked by them.
import './entries';
import './reference';
import { fail, fromZod, ok, type Result } from './result';
import { rowJson, SHAPES, table, type Entity, type Row, type Writer } from './write';

const inputSchema = z.union([
	z.object({ batchId: z.string().min(1) }).strict(),
	z.object({ changeIds: z.array(z.string().min(1)).min(1).max(1000) }).strict()
]);

/** Columns every write bumps; ignored when checking that a row still matches. */
const BOOKKEEPING = ['version', 'updatedAt'];

/**
 * Whether the current row still is the recorded `after`: absent when `after` is null,
 * else equal on the columns `after` recorded (a column added since is not compared),
 * ignoring the bookkeeping columns.
 */
function stillMatches(current: Row | undefined, after: Row | null): boolean {
	if (after === null) return current === undefined;
	if (current === undefined) return false;
	const recorded: Row = {};
	const now: Row = {};
	for (const key of Object.keys(after)) {
		if (BOOKKEEPING.includes(key)) continue;
		if (!Object.hasOwn(current, key)) return false;
		recorded[key] = after[key];
		now[key] = current[key];
	}
	return rowJson(recorded) === rowJson(now);
}

const parse = (json: string | null): Row | null => (json === null ? null : JSON.parse(json));

type Found = typeof change.$inferSelect & { createdAt: number };

/** The user's changes the input names, newest first, or null when any is unknown. */
function resolve(w: Writer, input: z.infer<typeof inputSchema>): Found[] | null {
	const where =
		'batchId' in input
			? eq(change.batchId, input.batchId)
			: inArray(change.id, [...new Set(input.changeIds)]);
	const rows = w.tx
		.select({ change, createdAt: batch.createdAt })
		.from(change)
		.innerJoin(batch, eq(batch.id, change.batchId))
		.where(and(eq(batch.userId, w.userId), where))
		.orderBy(desc(batch.createdAt), desc(batch.id), desc(change.seq))
		.all()
		.map((r) => ({ ...r.change, createdAt: r.createdAt }));
	if (rows.length === 0) return null;
	if ('changeIds' in input && rows.length !== new Set(input.changeIds).size) return null;
	return rows;
}

/** Labels of the batches newer than `c`'s that touched its row, newest first. */
function laterLabels(w: Writer, c: Found): string[] {
	const rows = w.tx
		.select({ id: change.id, batchId: batch.id, createdAt: batch.createdAt, label: batch.label })
		.from(change)
		.innerJoin(batch, eq(batch.id, change.batchId))
		.where(
			and(
				eq(batch.userId, w.userId),
				eq(change.entity, c.entity),
				eq(change.entityId, c.entityId),
				ne(batch.id, w.batchId)
			)
		)
		.orderBy(desc(batch.createdAt), desc(batch.id))
		.all()
		.filter((r) => newer(r, { batchId: c.batchId, createdAt: c.createdAt }));
	const status = undoneBy(
		w.tx,
		rows.map((r) => r.id)
	);
	const standing = rows.filter((r) => status.get(r.id) === null);
	return [...new Set(standing.map((r) => r.label))];
}

/**
 * Undoes `{ batchId }` (every change of the batch) or `{ changeIds }` (1–1000 chosen
 * changes), newest first. Refused with `conflict` when a chosen change (or a whole batch) is already undone, was
 * written under an older shape, or its row has changed since; rules and foreign keys
 * apply through the Writer and runBatch.
 */
export function undo(w: Writer, input: unknown): Result<{ reverted: string[] }> {
	const parsed = inputSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const changes = resolve(w, parsed.data);
	if (!changes) return fail('not_found', 'Not found.');
	const status = undoneBy(
		w.tx,
		changes.map((c) => c.id)
	);
	const reverted: string[] = [];
	const whole = 'batchId' in parsed.data;
	if (whole && changes.every((c) => status.get(c.id) !== null)) {
		return fail('conflict', 'That batch is already undone.');
	}
	for (const c of changes) {
		if (status.get(c.id) !== null) {
			// A batch undo finishes what a partial undo left; chosen changes are strict.
			if (whole) continue;
			return fail('conflict', 'That change is already undone.');
		}
		const entity = c.entity as Entity;
		if (!Object.hasOwn(SHAPES, entity) || c.shape !== SHAPES[entity]) {
			return fail('conflict', 'That change was made before an upgrade and cannot be undone.');
		}
		const t = table(entity);
		const current = w.tx
			.select()
			.from(t)
			.where(and(eq(t.id, c.entityId), eq(t.userId, w.userId)))
			.get() as Row | undefined;
		if (!stillMatches(current, parse(c.after))) {
			const labels = laterLabels(w, c);
			if (labels.length === 0) {
				return fail('conflict', 'That record has changed since; it cannot be undone.');
			}
			return fail(
				'conflict',
				`Later changes touch the same record: ${labels.join('; ')}. Undo those first.`
			);
		}
		w.restore(entity, c.entityId, parse(c.before), c.id);
		reverted.push(c.id);
	}
	return ok({ reverted });
}

/** The label of an undo batch: the original batch's label quoted, or the change count. */
export function undoLabel(input: unknown, originalLabel?: string): string {
	const parsed = inputSchema.safeParse(input);
	if (!parsed.success) return 'Undo';
	if ('batchId' in parsed.data) return `Undo "${originalLabel ?? ''}"`;
	const n = new Set(parsed.data.changeIds).size;
	return `Undo ${n} change${n === 1 ? '' : 's'}`;
}
