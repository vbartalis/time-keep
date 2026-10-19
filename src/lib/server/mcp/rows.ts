/**
 * Rows as the agent reads them: no owner or name key, an entry's times with its own
 * zone's offset, every other instant as ISO UTC.
 */
import type { HistoryBatch } from '#lib/server/core/index.js';

const FORMATS = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
	let f = FORMATS.get(zone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23',
			timeZoneName: 'longOffset'
		});
		FORMATS.set(zone, f);
	}
	return f;
}

/** The instant as `YYYY-MM-DDTHH:mm:ss±HH:MM` in `zone`. */
export function isoAt(ms: number, zone: string): string {
	const p: Record<string, string> = {};
	for (const { type, value } of formatter(zone).formatToParts(ms)) p[type] = value;
	const offset = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.slice(3);
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
}

const utc = (ms: number) => new Date(ms).toISOString();

const HIDDEN = new Set(['userId', 'nameKey']);
const INSTANTS = ['createdAt', 'updatedAt', 'archivedAt'];

/** A live row for the agent. */
export function agentRow(row: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) if (!HIDDEN.has(key)) out[key] = value;
	for (const key of INSTANTS) {
		if (typeof out[key] === 'number') out[key] = utc(out[key]);
	}
	if (typeof row.startAt === 'number' && typeof row.startZone === 'string') {
		out.startAt = isoAt(row.startAt, row.startZone);
	}
	if (typeof row.endAt === 'number' && typeof row.endZone === 'string') {
		out.endAt = isoAt(row.endAt, row.endZone);
	}
	return out;
}

/** A batch without its changes, for the history list. */
export function batchSummary(b: HistoryBatch) {
	return {
		id: b.id,
		label: b.label,
		actor: b.actor,
		createdAt: utc(b.createdAt),
		changeCount: b.changes.length,
		undoneChanges: b.changes.filter((c) => c.undone).length,
		undone: b.undone,
		undoneBy: b.undoneBy
	};
}

/** A stored history row less the owner and name key. */
function stored(row: Record<string, unknown> | null): Record<string, unknown> | null {
	if (row === null) return null;
	const rest = { ...row };
	delete rest.userId;
	delete rest.nameKey;
	return rest;
}

/** A batch with its changes, whose ids `undo` and `redo` take. */
export function batchDetail(b: HistoryBatch) {
	return {
		...batchSummary(b),
		changes: b.changes.map((c) => ({
			id: c.id,
			entity: c.entity,
			entityId: c.entityId,
			op: c.op,
			before: stored(c.before),
			after: stored(c.after),
			undone: c.undone,
			undoneBy: c.undoneBy
		}))
	};
}
