import { eq, max } from 'drizzle-orm';
import type { DB } from '../db/index';
import { batch } from '../db/schema';
import { newId } from '../id';
import { fail, type Result, type Warning } from './result';
import { batchChecksOf, CoreFailure, inTransaction, insertBatch, Writer } from './write';

export type Actor = 'ui' | 'agent' | 'system';

/** Thrown inside the transaction to roll it back; never escapes runBatch. */
const ROLLBACK = Symbol('rollback');

/** The SQLite error code of an error or of any error in its cause chain. */
function sqliteCode(error: unknown): string | undefined {
	for (let e = error; e instanceof Error; e = e.cause) {
		const code = (e as { code?: unknown }).code;
		if (typeof code === 'string' && code.startsWith('SQLITE_')) return code;
	}
	return undefined;
}

/** Drops later warnings with the same code and subject as an earlier one. */
function uniqueWarnings(list: Warning[]): Warning[] {
	const seen = new Set<string>();
	return list.filter((w) => {
		const key = JSON.stringify([w.code, w.subject]);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Runs `fn` as one batch: one transaction, one batch row, every change in order.
 * A returned failure, a rule violation or a constraint failure rolls everything back;
 * a batch that changed nothing is rolled back too, so no empty batch is stored.
 */
export function runBatch<T>(
	db: DB,
	userId: string,
	actor: Actor,
	label: string,
	fn: (w: Writer) => Result<T>,
	now: number = Date.now()
): Result<T> {
	// better-sqlite3 would turn a nested transaction into a savepoint and commit a second batch.
	if (inTransaction(db)) {
		throw new Error('A batch is already open: use the core passed to batch().');
	}
	let result: Result<T> | undefined;
	let writer: Writer | undefined;
	try {
		db.transaction((tx) => {
			const batchId = newId();
			// Batch times strictly increase per user, so history and undo order is exact.
			const latest = tx
				.select({ at: max(batch.createdAt) })
				.from(batch)
				.where(eq(batch.userId, userId))
				.get()?.at;
			const at = latest == null ? now : Math.max(now, latest + 1);
			insertBatch(tx, { id: batchId, userId, actor, label, createdAt: at });
			const w = (writer = new Writer(tx, batchId, userId, at));
			result = fn(w);
			// A write that failed rolls the batch back even if the command caught it.
			if (w.failure) throw w.failure.error;
			if (!result.ok || w.changeCount === 0) throw ROLLBACK;
			// Checks judge the batch as a whole, once, after its last write.
			const found: Warning[] = [];
			for (const [entity, touched] of w.touched) {
				for (const check of batchChecksOf(entity)) {
					const outcome = check(tx, { userId, batchId, touched: [...touched], now: at });
					if (outcome?.error) {
						result = { ok: false, error: outcome.error };
						throw ROLLBACK;
					}
					found.push(...(outcome?.warnings ?? []));
				}
			}
			result = { ...result, warnings: uniqueWarnings([...result.warnings, ...found]) };
		});
	} catch (thrown) {
		if (thrown === ROLLBACK) return result!;
		// The writer's first failure wins over whatever the command threw after catching it.
		const error = writer?.failure ? writer.failure.error : thrown;
		if (error instanceof CoreFailure) return { ok: false, error: error.error };
		const code = sqliteCode(error);
		if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
			return fail('conflict', 'Other records depend on this.');
		}
		if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
			return fail('conflict', 'That name is already taken.', {
				name: 'That name is already taken.'
			});
		}
		throw error;
	}
	return result!;
}
