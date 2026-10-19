import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import { openCore, type Core, type Result } from '#lib/server/core/index.js';
import { user } from '#lib/server/db/schema.js';
import { newId } from '#lib/server/id.js';
import { createTestDb } from '#lib/server/testing/db.js';
import { createMcpServer } from './server';

const READS = [
	'list_customers',
	'list_projects',
	'list_activities',
	'list_locations',
	'list_entries',
	'get_entry',
	'list_templates',
	'get_template',
	'list_history',
	'get_batch'
];

async function setup() {
	const db = createTestDb();
	const mkUser = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const userId = mkUser('u');
	const otherId = mkUser('o');
	let now = Date.parse('2026-10-19T12:00:00Z');
	const clock = () => now++;
	const core = openCore(db, userId, 'agent', clock);
	const other = openCore(db, otherId, 'ui', clock);
	const client = new Client({ name: 'test', version: '0.0.0' });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await createMcpServer(core).connect(serverSide);
	await client.connect(clientSide);
	const call = async (name: string, args: Record<string, unknown> = {}) =>
		(await client.callTool({ name, arguments: args })) as CallToolResult;
	const body = async (name: string, args: Record<string, unknown> = {}) => {
		const r = await call(name, args);
		if (r.isError) throw new Error(JSON.stringify(r.content));
		return r.structuredContent as Record<string, unknown> & { items: Record<string, unknown>[] };
	};
	return { client, core, other, call, body };
}

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.value;
};

function project(core: Core, name = 'Site') {
	const c = val(core.customers.create({ name: `${name} customer` }));
	return val(core.projects.create({ customerId: c.id, name }));
}

describe('the read tools', () => {
	it('lists the ten reads, each read-only', async () => {
		const { client } = await setup();
		const { tools } = await client.listTools();
		for (const name of READS) {
			const tool = tools.find((t) => t.name === name);
			expect(tool, name).toBeDefined();
			expect(tool!.annotations?.readOnlyHint, name).toBe(true);
			expect(tool!.description, name).toBeTruthy();
		}
	});

	it('lists the user’s customers, not another user’s', async () => {
		const { core, other, body } = await setup();
		val(core.customers.create({ name: 'Mine' }));
		val(other.customers.create({ name: 'Theirs' }));
		const { items } = await body('list_customers');
		expect(items.map((c) => c.name)).toEqual(['Mine']);
		expect(items[0]).not.toHaveProperty('userId');
		expect(items[0]).not.toHaveProperty('nameKey');
		expect(items[0].createdAt).toBe('2026-10-19T12:00:00.000Z');
	});

	it('lists projects, activities and locations', async () => {
		const { core, body } = await setup();
		project(core, 'Site');
		val(core.activities.create({ name: 'Dev' }));
		val(core.locations.create({ name: 'Home' }));
		expect((await body('list_projects')).items.map((p) => p.name)).toEqual(['Site']);
		expect((await body('list_activities')).items.map((a) => a.name)).toEqual(['Dev']);
		expect((await body('list_locations')).items.map((l) => l.name)).toEqual(['Home']);
	});

	it('caps entries at the limit and says when more matched', async () => {
		const { core, body } = await setup();
		const p = project(core);
		for (const day of ['16', '17', '18']) {
			val(
				core.entries.create({
					projectId: p.id,
					timeZone: 'UTC',
					start: `2026-10-${day}T09:00`,
					durationMinutes: 60
				})
			);
		}
		const two = await body('list_entries', { limit: 2 });
		expect(two.items).toHaveLength(2);
		expect(two.truncated).toBe(true);
		const three = await body('list_entries', { limit: 3 });
		expect(three.items).toHaveLength(3);
		expect(three.truncated).toBe(false);
		const all = await body('list_entries');
		expect(all.items).toHaveLength(3);
		expect(all.truncated).toBe(false);
	});

	it('refuses a limit over 999', async () => {
		const { call } = await setup();
		expect((await call('list_entries', { limit: 1000 })).isError).toBe(true);
	});

	it('writes an entry’s start with its own zone’s offset', async () => {
		const { core, body } = await setup();
		const p = project(core);
		const e = val(
			core.entries.create({
				projectId: p.id,
				timeZone: 'Europe/Budapest',
				start: '2026-10-19T09:00',
				durationMinutes: 30
			})
		);
		const row = await body('get_entry', { id: e.id });
		expect(row).toMatchObject({
			id: e.id,
			startAt: '2026-10-19T09:00:00+02:00',
			endAt: '2026-10-19T09:30:00+02:00',
			projectName: 'Site'
		});
		expect(row).not.toHaveProperty('userId');
		const listed = await body('list_entries');
		expect(listed.items[0].startAt).toBe('2026-10-19T09:00:00+02:00');
	});

	it('refuses another user’s entry as not found', async () => {
		const { other, call } = await setup();
		const e = val(
			other.entries.create({
				projectId: project(other).id,
				timeZone: 'UTC',
				start: '2026-10-18T09:00',
				durationMinutes: 60
			})
		);
		const r = await call('get_entry', { id: e.id });
		expect(r.isError).toBe(true);
		expect(r.structuredContent).toMatchObject({ code: 'not_found' });
		expect(JSON.parse((r.content[0] as { text: string }).text)).toMatchObject({
			code: 'not_found'
		});
	});

	it('lists and gets templates', async () => {
		const { core, body } = await setup();
		const t = val(core.templates.create({ name: 'Standup', durationMinutes: 15 }));
		const { items } = await body('list_templates');
		expect(items.map((i) => i.name)).toEqual(['Standup']);
		expect(items[0]).not.toHaveProperty('nameKey');
		expect(await body('get_template', { id: t.id })).toMatchObject({ id: t.id, name: 'Standup' });
	});

	it('lists 20 history summaries by default, without changes', async () => {
		const { core, body } = await setup();
		for (let i = 0; i < 25; i++) val(core.customers.create({ name: `C${i}` }));
		const { items } = await body('list_history');
		expect(items).toHaveLength(20);
		expect(items[0]).toMatchObject({
			label: 'Create customer "C24"',
			actor: 'agent',
			changeCount: 1,
			undoneChanges: 0,
			undone: false,
			undoneBy: null
		});
		expect(items[0]).not.toHaveProperty('changes');
		const older = await body('list_history', { before: items[19].id as string, limit: 10 });
		expect(older.items).toHaveLength(5);
	});

	it('gets a batch with its change ids', async () => {
		const { core, body } = await setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const [summary] = (await body('list_history')).items;
		const detail = await body('get_batch', { batchId: summary.id as string });
		expect(detail).toMatchObject({ id: summary.id, changeCount: 1 });
		const changes = detail.changes as Record<string, unknown>[];
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ entity: 'customer', entityId: c.id, op: 'create' });
		expect(changes[0].id).toEqual(expect.any(String));
		expect(changes[0].after).toMatchObject({ id: c.id, name: 'Acme' });
		expect(changes[0].after).not.toHaveProperty('userId');
		expect(changes[0].after).not.toHaveProperty('nameKey');
	});
});

describe('the write tools', () => {
	it('lists change, undo and redo as destructive, 13 tools in all', async () => {
		const { client } = await setup();
		const { tools } = await client.listTools();
		expect(tools).toHaveLength(13);
		for (const name of ['change', 'undo', 'redo']) {
			const tool = tools.find((t) => t.name === name);
			expect(tool, name).toBeDefined();
			expect(tool!.annotations?.destructiveHint, name).toBe(true);
		}
		expect(tools.find((t) => t.name === 'change')!.description).toContain('entries.create');
	});

	it('changes, undoes and redoes a batch', async () => {
		const { body } = await setup();
		const changed = await body('change', {
			label: 'Add Acme',
			operations: [
				{ command: 'customers.create', input: { name: 'Acme' }, as: 'c' },
				{ command: 'projects.create', input: { customerId: { ref: 'c' }, name: 'Web' } }
			]
		});
		expect(changed.batchId).toEqual(expect.any(String));
		const results = changed.results as Record<string, unknown>[];
		expect(results[0]).toMatchObject({ name: 'Acme', createdAt: '2026-10-19T12:00:00.000Z' });
		expect(results[0]).not.toHaveProperty('userId');
		expect(changed.warnings).toEqual([]);

		const undone = await body('undo', { batchId: changed.batchId });
		expect(undone.batchId).toEqual(expect.any(String));
		expect(undone.batchId).not.toBe(changed.batchId);
		expect(undone.reverted).toHaveLength(2);
		expect((await body('list_customers')).items).toEqual([]);

		const redone = await body('redo', { batchId: changed.batchId });
		expect(redone.batchId).not.toBe(undone.batchId);
		expect((await body('list_customers')).items.map((c) => c.name)).toEqual(['Acme']);
	});

	it('undoes one change of a batch by its id', async () => {
		const { body } = await setup();
		const changed = await body('change', {
			label: 'Add Acme',
			operations: [
				{ command: 'customers.create', input: { name: 'Acme' }, as: 'c' },
				{ command: 'projects.create', input: { customerId: { ref: 'c' }, name: 'Web' } }
			]
		});
		const detail = await body('get_batch', { batchId: changed.batchId as string });
		const changes = detail.changes as Record<string, unknown>[];
		const project = changes.find((c) => c.entity === 'project')!;
		const undone = await body('undo', { changeIds: [project.id as string] });
		expect(undone.reverted).toEqual([project.id]);
		expect((await body('list_projects')).items).toEqual([]);
		expect((await body('list_customers')).items.map((c) => c.name)).toEqual(['Acme']);
	});

	it('says when a change changed nothing', async () => {
		const { core, body } = await setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const r = await body('change', {
			label: 'Same',
			operations: [{ command: 'customers.rename', input: { id: c.id, name: 'Acme' } }]
		});
		expect(r).toMatchObject({ batchId: null, message: 'Nothing changed.' });
	});

	it('refuses a change at the failing operation', async () => {
		const { call } = await setup();
		const r = await call('change', {
			label: 'Bad',
			operations: [
				{ command: 'customers.create', input: { name: 'A' } },
				{ command: 'customers.create', input: { name: '' } }
			]
		});
		expect(r.isError).toBe(true);
		expect(r.structuredContent).toMatchObject({ code: 'invalid', operation: 1 });
	});

	it('refuses an undo without a batch or changes', async () => {
		const { call } = await setup();
		const r = await call('undo', {});
		expect(r.isError).toBe(true);
		expect(r.structuredContent).toMatchObject({ code: 'invalid' });
	});

	it('refuses another user’s batch as not found', async () => {
		const { other, call } = await setup();
		val(other.customers.create({ name: 'Theirs' }));
		const [theirs] = val(other.history.list({ limit: 1 }));
		const r = await call('undo', { batchId: theirs.id });
		expect(r.isError).toBe(true);
		expect(r.structuredContent).toMatchObject({ code: 'not_found' });
	});

	it('answers an unexpected exception with a generic refusal, logged', async () => {
		const { core, call } = await setup();
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		core.customers.list = () => {
			throw new Error('boom');
		};
		try {
			const r = await call('list_customers');
			expect(r.isError).toBe(true);
			expect(r.structuredContent).toEqual({ code: 'error', message: 'Something went wrong.' });
			expect(error).toHaveBeenCalledOnce();
		} finally {
			error.mockRestore();
		}
	});
});
