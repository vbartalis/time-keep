/**
 * The history: the user's batches with their changes, each saying whether it is undone
 * and by which batch. Read-only; history rows are never updated or deleted.
 */
import { and, desc, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db/index';
import { batch, change } from '../db/schema';
import { fail, fromZod, ok, type Result } from './result';
import type { Row, Tx } from './write';

type Handle = Tx | DB;

export type HistoryChange = {
	id: string;
	seq: number;
	entity: string;
	entityId: string;
	op: 'create' | 'update' | 'archive' | 'unarchive' | 'delete';
	before: Row | null;
	after: Row | null;
	reverts: string | null;
	undone: boolean;
	undoneBy: string | null;
};

export type HistoryBatch = {
	id: string;
	actor: 'ui' | 'agent' | 'system';
	label: string;
	createdAt: number;
	undone: boolean;
	undoneBy: string | null;
	changes: HistoryChange[];
};

/** The standing change that undid a change, with its batch's id and creation time. */
export type UndoneBy = { batchId: string; changeId: string; createdAt: number };

/** SQLite caps bound parameters; stay well under the limit. */
const CHUNK = 500;

/**
 * For each change id, the batch whose change reverts it and stands (is not itself
 * undone), or null when the change is not undone. Loads the reverts chain one level per
 * query, so the cost grows with the depth of undo/redo, not with the number of changes.
 */
export function undoneBy(db: Handle, ids: string[]): Map<string, UndoneBy | null> {
	const reverters = new Map<string, UndoneBy[]>();
	const seen = new Set(ids);
	let frontier = [...seen];
	while (frontier.length > 0) {
		const next: string[] = [];
		for (let i = 0; i < frontier.length; i += CHUNK) {
			const rows = db
				.select({
					id: change.id,
					reverts: change.reverts,
					batchId: change.batchId,
					createdAt: batch.createdAt
				})
				.from(change)
				.innerJoin(batch, eq(batch.id, change.batchId))
				.where(
					and(isNotNull(change.reverts), inArray(change.reverts, frontier.slice(i, i + CHUNK)))
				)
				.all();
			for (const r of rows) {
				const list = reverters.get(r.reverts!) ?? [];
				list.push({ changeId: r.id, batchId: r.batchId, createdAt: r.createdAt });
				reverters.set(r.reverts!, list);
				if (!seen.has(r.id)) {
					seen.add(r.id);
					next.push(r.id);
				}
			}
		}
		frontier = next;
	}
	const memo = new Map<string, UndoneBy | null>();
	const resolve = (id: string): UndoneBy | null => {
		const known = memo.get(id);
		if (known !== undefined) return known;
		let by: UndoneBy | null = null;
		for (const r of reverters.get(id) ?? []) {
			if (resolve(r.changeId) === null) {
				by = r;
				break;
			}
		}
		memo.set(id, by);
		return by;
	};
	return new Map(ids.map((id) => [id, resolve(id)]));
}

type Stamp = Pick<UndoneBy, 'batchId' | 'createdAt'>;

/** Whether batch `a` is newer than batch `b` (by creation time, then id). */
export const newer = (a: Stamp, b: Stamp): boolean =>
	a.createdAt !== b.createdAt ? a.createdAt > b.createdAt : a.batchId > b.batchId;

const listSchema = z.object({
	before: z.string().min(1).optional(),
	limit: z.number().int().min(1).max(200).optional()
});

const parse = (json: string | null): Row | null => (json === null ? null : JSON.parse(json));

/** The user's batches newest first, `limit` (default 50, max 200) from before batch `before`. */
export function listHistory(
	db: Handle,
	userId: string,
	input?: { before?: string; limit?: number }
): Result<HistoryBatch[]> {
	const parsed = listSchema.safeParse(input ?? {});
	if (!parsed.success) return fromZod(parsed.error);
	const { before, limit = 50 } = parsed.data;
	let older;
	if (before !== undefined) {
		const from = db
			.select()
			.from(batch)
			.where(and(eq(batch.id, before), eq(batch.userId, userId)))
			.get();
		if (!from) return fail('not_found', 'Not found.');
		older = or(
			lt(batch.createdAt, from.createdAt),
			and(eq(batch.createdAt, from.createdAt), lt(batch.id, from.id))
		);
	}
	const batches = db
		.select()
		.from(batch)
		.where(and(eq(batch.userId, userId), older))
		.orderBy(desc(batch.createdAt), desc(batch.id))
		.limit(limit)
		.all();
	if (batches.length === 0) return ok([]);
	const changes = db
		.select()
		.from(change)
		.where(
			inArray(
				change.batchId,
				batches.map((b) => b.id)
			)
		)
		.orderBy(change.seq)
		.all();
	const status = undoneBy(
		db,
		changes.map((c) => c.id)
	);
	const byBatch = new Map<string, HistoryChange[]>();
	const lastBy = new Map<string, UndoneBy | null>();
	for (const c of changes) {
		const by = status.get(c.id) ?? null;
		const list = byBatch.get(c.batchId) ?? [];
		list.push({
			id: c.id,
			seq: c.seq,
			entity: c.entity,
			entityId: c.entityId,
			op: c.op,
			before: parse(c.before),
			after: parse(c.after),
			reverts: c.reverts,
			undone: by !== null,
			undoneBy: by?.batchId ?? null
		});
		byBatch.set(c.batchId, list);
		// A batch is undone when every change is; the newest undoing batch names it.
		const prev = lastBy.get(c.batchId);
		if (prev === null) continue;
		lastBy.set(c.batchId, by === null ? null : prev && !newer(by, prev) ? prev : by);
	}
	return ok(
		batches.map((b) => {
			const by = lastBy.get(b.id) ?? null;
			return {
				id: b.id,
				actor: b.actor,
				label: b.label,
				createdAt: b.createdAt,
				undone: by !== null,
				undoneBy: by?.batchId ?? null,
				changes: byBatch.get(b.id) ?? []
			};
		})
	);
}
