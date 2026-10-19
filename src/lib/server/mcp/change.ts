/**
 * The `change` tool's work: many core commands as one batch, an operation naming its
 * result with `as` and a later one using its id through `{ "ref": "<name>" }`.
 */
import type {
	BatchCore,
	CommandName,
	Core,
	CoreError,
	Result,
	Warning
} from '#lib/server/core/index.js';

export type Operation = { command: CommandName; input: Record<string, unknown>; as?: string };

/** The only input fields a ref may stand in. */
export const ID_FIELDS = [
	'id',
	'customerId',
	'projectId',
	'activityId',
	'locationId',
	'entryId',
	'templateId'
] as const;

type Refusal = CoreError & { operation?: number };

/** The name a ref object points at, or undefined when the value is not one. */
function refName(value: unknown): string | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const ref = (value as { ref?: unknown }).ref;
	return typeof ref === 'string' ? ref : undefined;
}

/** Refuses a name used twice or a ref to no earlier operation's name, before anything runs. */
export function checkRefs(ops: Operation[]): (CoreError & { operation: number }) | null {
	const named = new Set<string>();
	for (const [operation, op] of ops.entries()) {
		for (const field of ID_FIELDS) {
			const name = refName(op.input[field]);
			if (name !== undefined && !named.has(name)) {
				const message = `Unknown ref "${name}".`;
				return { code: 'invalid', message, fields: { [field]: message }, operation };
			}
		}
		if (op.as === undefined) continue;
		if (named.has(op.as)) {
			return { code: 'invalid', message: `Name "${op.as}" is used twice.`, operation };
		}
		named.add(op.as);
	}
	return null;
}

/** The input with each ref in an id field replaced by the named result's id. */
function resolveRefs(input: Record<string, unknown>, ids: Map<string, unknown>) {
	const out = { ...input };
	for (const field of ID_FIELDS) {
		const name = refName(input[field]);
		if (name !== undefined) out[field] = ids.get(name);
	}
	return out;
}

type Command = (input: unknown) => Result<unknown>;

/** The batch core's command for a name like `entries.create`. */
function commandOf(c: BatchCore, name: CommandName): Command {
	const [group, verb] = name.split('.') as [keyof BatchCore, string];
	return (c[group] as unknown as Record<string, Command>)[verb];
}

/**
 * Runs the operations in order as one batch labelled `label`. `batchId` is null when
 * nothing changed (no batch is stored); a refusal names the failing operation's index,
 * except one of the label or of the batch as a whole, after every operation succeeded.
 */
export function runChange(
	core: Core,
	label: string,
	ops: Operation[]
):
	| { ok: true; batchId: string | null; results: unknown[]; warnings: Warning[] }
	| { ok: false; error: Refusal } {
	const bad = checkRefs(ops);
	if (bad) return { ok: false, error: bad };
	let current: number | undefined;
	let finished = false;
	let opened: string | undefined;
	const r = core.batch(label, (c) => {
		opened = c.batchId;
		const results: unknown[] = [];
		const warnings: Warning[] = [];
		const ids = new Map<string, unknown>();
		for (const [i, op] of ops.entries()) {
			current = i;
			const done = commandOf(c, op.command)(resolveRefs(op.input, ids));
			if (!done.ok) return done;
			results.push(done.value);
			warnings.push(...done.warnings);
			if (op.as !== undefined) ids.set(op.as, (done.value as { id?: unknown }).id);
		}
		finished = true;
		return { ok: true, value: results, warnings };
	});
	if (!r.ok) {
		return {
			ok: false,
			error: current === undefined || finished ? r.error : { ...r.error, operation: current }
		};
	}
	const stored = opened !== undefined && core.history.get({ batchId: opened }).ok;
	return {
		ok: true,
		batchId: stored ? opened! : null,
		results: r.value,
		warnings: r.warnings
	};
}
