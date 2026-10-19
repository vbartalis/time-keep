/**
 * The MCP server over one user's core: the reads, then `change`, `undo` and `redo`.
 * Every tool answers JSON as text and as structured content; a core refusal is
 * `isError`, and so is an unexpected exception, logged and answered generically.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
	COMMANDS,
	commandSchemas,
	readSchemas,
	type Core,
	type CoreError,
	type Result,
	type UndoInput
} from '#lib/server/core/index.js';
import { ID_FIELDS, runChange } from './change';
import { agentRow, batchDetail, batchSummary } from './rows';

/** A tool's answer. */
export function answer(value: unknown): CallToolResult {
	return {
		content: [{ type: 'text', text: JSON.stringify(value) }],
		structuredContent: value as Record<string, unknown>
	};
}

/** A refusal: the core's code, message and fields as given, or `error` for the unexpected. */
export type Refusal = {
	code: CoreError['code'] | 'error';
	message: string;
	fields?: Record<string, string>;
	operation?: number;
};

/** A refusal, with the core's code, message and fields as given. */
export function refuse(error: Refusal): CallToolResult {
	return { ...answer(error), isError: true };
}

/** The value through `shape`, or the core's refusal. */
const reply = <T>(r: Result<T>, shape: (value: T) => unknown): CallToolResult =>
	r.ok ? answer(shape(r.value)) : refuse(r.error);

const items = (rows: Record<string, unknown>[]) => ({ items: rows.map(agentRow) });

/** The handler, answering an unexpected exception with a logged, generic refusal. */
function guarded<F>(handler: F): F {
	return (async (...args: unknown[]) => {
		try {
			return await (handler as (...a: unknown[]) => CallToolResult | Promise<CallToolResult>)(
				...args
			);
		} catch (error) {
			console.error(error);
			return refuse({ code: 'error', message: 'Something went wrong.' });
		}
	}) as F;
}

const READ = { readOnlyHint: true };
const WRITE = { destructiveHint: true };

const ENTRY_LIMIT = 500;
const HISTORY_LIMIT = 20;

const entriesSchema = readSchemas.entries.extend({
	limit: z.number().int().min(1).max(999).optional()
});

const changeSchema = z.object({
	label: z.string(),
	operations: z
		.array(
			z.object({
				command: z.enum(COMMANDS),
				input: z.record(z.string(), z.unknown()),
				as: z
					.string()
					.regex(/^[A-Za-z0-9_-]{1,40}$/)
					.optional()
			})
		)
		.min(1)
		.max(1000)
});

const revertSchema = z.object({
	batchId: z.string().optional(),
	changeIds: z.array(z.string()).optional()
});

/** Each command with its input as JSON Schema, written once. */
const COMMAND_INPUTS = COMMANDS.map(
	(name) =>
		`- ${name}: ${JSON.stringify(z.toJSONSchema(commandSchemas[name], { io: 'input', unrepresentable: 'any' }))}`
).join('\n');

const CHANGE_DESCRIPTION = `Runs operations in order as one change batch, labelled label (1–200 characters, shown in History); all of it is stored or none. One undo of the returned batchId reverts it all.

Each operation is { command, input, as? }. An operation may name its result with as (letters, digits, _ and -, up to 40); a later operation may then give { "ref": "<name>" } instead of an id in ${ID_FIELDS.join(', ')}, and it is replaced with that result's id. A ref to a name no earlier operation defines is refused before anything runs.

Returns { batchId, results, warnings }, results holding each operation's row; batchId is null, with message, when nothing changed. A refusal carries operation, the 0-based index of the failing operation.

Commands and their input (JSON Schema):
${COMMAND_INPUTS}`;

export function createMcpServer(core: Core): McpServer {
	const mcp = new McpServer({ name: 'time-keep', version: '0.0.1' });
	// Every tool registers through here, so every handler is guarded.
	const server = {
		registerTool: ((name, config, handler) =>
			mcp.registerTool(name, config, guarded(handler))) as McpServer['registerTool']
	};

	const references = [
		['list_customers', 'customers'],
		['list_activities', 'activities'],
		['list_locations', 'locations']
	] as const;
	for (const [name, kind] of references) {
		server.registerTool(
			name,
			{
				description: `Lists your ${kind}, active ones only unless includeArchived is true. Returns { items }.`,
				inputSchema: readSchemas[kind],
				annotations: READ
			},
			(input) => reply(core[kind].list(input), items)
		);
	}

	server.registerTool(
		'list_projects',
		{
			description:
				'Lists your projects with their customer, optionally of one customer, active ones only unless includeArchived is true. Returns { items }.',
			inputSchema: readSchemas.projects,
			annotations: READ
		},
		(input) => reply(core.projects.list(input), items)
	);

	server.registerTool(
		'list_entries',
		{
			description:
				'Lists your time entries matching the filters, newest start first, at most limit (default 500); truncated is true when more matched. Times carry their own zone’s offset, like 2026-10-19T09:00:00+02:00.',
			inputSchema: entriesSchema,
			annotations: READ
		},
		(input) => {
			const limit = input.limit ?? ENTRY_LIMIT;
			return reply(core.entries.list({ ...input, limit: limit + 1 }), (found) => ({
				items: found.slice(0, limit).map(agentRow),
				truncated: found.length > limit
			}));
		}
	);

	server.registerTool(
		'get_entry',
		{
			description:
				'Gets one of your time entries by id, with its project, customer, activity and location names.',
			inputSchema: readSchemas.entry,
			annotations: READ
		},
		(input) => reply(core.entries.get(input), agentRow)
	);

	server.registerTool(
		'list_templates',
		{
			description: 'Lists your entry templates. Returns { items }.',
			annotations: READ
		},
		() => reply(core.templates.list(), items)
	);

	server.registerTool(
		'get_template',
		{
			description: 'Gets one of your entry templates by id.',
			inputSchema: readSchemas.template,
			annotations: READ
		},
		(input) => reply(core.templates.get(input), agentRow)
	);

	server.registerTool(
		'list_history',
		{
			description:
				'Lists your change batches newest first, limit (default 20) of them before batch before, each summarised without its changes. Returns { items }.',
			inputSchema: readSchemas.history,
			annotations: READ
		},
		(input) =>
			reply(core.history.list({ ...input, limit: input.limit ?? HISTORY_LIMIT }), (batches) => ({
				items: batches.map(batchSummary)
			}))
	);

	server.registerTool(
		'get_batch',
		{
			description:
				'Gets one change batch with its changes, each with the row before and after. Its change ids are what undo and redo take.',
			inputSchema: readSchemas.batch,
			annotations: READ
		},
		(input) => reply(core.history.get(input), batchDetail)
	);

	server.registerTool(
		'change',
		{
			description: CHANGE_DESCRIPTION,
			inputSchema: changeSchema,
			annotations: WRITE
		},
		({ label, operations }) => {
			const r = runChange(core, label, operations);
			if (!r.ok) return refuse(r.error);
			return answer({
				batchId: r.batchId,
				results: r.results.map((row) => agentRow(row as Record<string, unknown>)),
				warnings: r.warnings,
				...(r.batchId === null ? { message: 'Nothing changed.' } : {})
			});
		}
	);

	const reverts = [
		[
			'undo',
			'Undoes a change batch (batchId) or chosen changes (changeIds, from get_batch), as one new batch. Give exactly one of the two. Returns { batchId, reverted, warnings }, batchId the new batch.'
		],
		[
			'redo',
			'Redoes an undone batch (its batchId) or undone changes (changeIds), as one new batch. Give exactly one of the two. Returns { batchId, reverted, warnings }, batchId the new batch.'
		]
	] as const;
	for (const [name, description] of reverts) {
		server.registerTool(
			name,
			{ description, inputSchema: revertSchema, annotations: WRITE },
			(input) => {
				const given: Record<string, unknown> = {};
				if (input.batchId !== undefined) given.batchId = input.batchId;
				if (input.changeIds !== undefined) given.changeIds = input.changeIds;
				const r = core[name](given as UndoInput);
				if (!r.ok) return refuse(r.error);
				// The newest batch is the one just written: a user's batch times strictly increase and
				// nothing awaits between the revert and this read.
				const newest = core.history.list({ limit: 1 });
				return answer({
					batchId: newest.ok ? (newest.value[0]?.id ?? null) : null,
					reverted: r.value.reverted,
					warnings: r.warnings
				});
			}
		);
	}

	return mcp;
}
