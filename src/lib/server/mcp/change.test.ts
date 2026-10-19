import { describe, expect, it } from 'vitest';
import { openCore, type Core, type Result } from '#lib/server/core/index.js';
import { user } from '#lib/server/db/schema.js';
import { newId } from '#lib/server/id.js';
import { createTestDb } from '#lib/server/testing/db.js';
import { checkRefs, runChange, type Operation } from './change';

function setup() {
	const db = createTestDb();
	const userId = newId();
	db.insert(user)
		.values({ id: userId, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	let now = Date.parse('2026-10-19T12:00:00Z');
	const clock = () => now++;
	const core = openCore(db, userId, 'agent', clock);
	const history = () => val(core.history.list({ limit: 200 }));
	return { core, history };
}

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(JSON.stringify(r.error));
	return r.value;
};

function project(core: Core, name = 'Site') {
	const c = val(core.customers.create({ name: `${name} customer` }));
	return val(core.projects.create({ customerId: c.id, name }));
}

const entry = (projectId: unknown, day = '18') => ({
	projectId,
	timeZone: 'UTC',
	start: `2026-10-${day}T09:00`,
	durationMinutes: 60
});

describe('runChange', () => {
	it('runs operations as one batch, refs replaced by the named result’s id', () => {
		const { core, history } = setup();
		const r = runChange(core, 'Import Acme', [
			{ command: 'customers.create', input: { name: 'Acme' }, as: 'c' },
			{ command: 'projects.create', input: { customerId: { ref: 'c' }, name: 'Web' }, as: 'p' },
			{ command: 'entries.create', input: entry({ ref: 'p' }, '17') },
			{ command: 'entries.create', input: entry({ ref: 'p' }, '18') }
		]);
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		const [c, p, e1, e2] = r.results as Record<string, unknown>[];
		expect(p.customerId).toBe(c.id);
		expect(e1.projectId).toBe(p.id);
		expect(e2.projectId).toBe(p.id);
		const batches = history();
		expect(batches).toHaveLength(1);
		expect(batches[0]).toMatchObject({ id: r.batchId, actor: 'agent', label: 'Import Acme' });
		expect(batches[0].changes).toHaveLength(4);
	});

	it('moves existing entries to a new project, undone in one step', () => {
		const { core, history } = setup();
		const old = project(core, 'Old');
		const a = val(core.entries.create(entry(old.id, '16')));
		const b = val(core.entries.create(entry(old.id, '17')));
		const before = history().length;
		const r = runChange(core, 'Move to New', [
			{ command: 'projects.create', input: { customerId: old.customerId, name: 'New' }, as: 'p' },
			{ command: 'entries.update', input: { id: a.id, projectId: { ref: 'p' } } },
			{ command: 'entries.update', input: { id: b.id, projectId: { ref: 'p' } } }
		]);
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		expect(history()).toHaveLength(before + 1);
		const moved = val(core.entries.list());
		expect(moved.every((e) => e.projectName === 'New')).toBe(true);
		val(core.undo({ batchId: r.batchId! }));
		const back = val(core.entries.list());
		expect(back.map((e) => e.projectId)).toEqual([old.id, old.id]);
		expect(val(core.projects.list()).map((p) => p.name)).toEqual(['Old']);
	});

	it('refuses at the failing operation and stores nothing', () => {
		const { core, history } = setup();
		const r = runChange(core, 'Three', [
			{ command: 'customers.create', input: { name: 'A' } },
			{ command: 'entries.create', input: { timeZone: 'UTC', start: '2026-10-18T09:00' } },
			{ command: 'customers.create', input: { name: 'B' } }
		]);
		expect(r).toMatchObject({ ok: false, error: { code: 'invalid', operation: 1 } });
		expect(history()).toHaveLength(0);
	});

	it('names the operation of a refusal thrown inside a command', () => {
		const { core, history } = setup();
		const p = project(core);
		val(core.timers.start({ projectId: p.id, timeZone: 'UTC' }));
		const before = history().length;
		const r = runChange(core, 'Backdate', [
			{ command: 'customers.create', input: { name: 'X' } },
			{
				command: 'timers.start',
				input: { projectId: p.id, timeZone: 'UTC', start: '2026-10-19T11:00' }
			}
		]);
		expect(r).toMatchObject({ ok: false, error: { code: 'conflict', operation: 1 } });
		expect(history()).toHaveLength(before);
		expect(val(core.customers.list()).map((c) => c.name)).not.toContain('X');
	});

	it('names no operation when the batch as a whole is refused after every one succeeded', () => {
		const { core, history } = setup();
		const p = project(core);
		const before = history().length;
		// The commands keep one timer per project themselves, so the batch check that
		// backs them up cannot be tripped through them: stand in for its refusal.
		const checked: Core = {
			...core,
			batch: (label, fn) =>
				core.batch(label, (c) => {
					const r = fn(c);
					if (!r.ok) return r;
					return {
						ok: false,
						error: { code: 'conflict', message: 'Only one timer can run on a project.' }
					};
				})
		};
		const r = runChange(checked, 'Two running', [
			{ command: 'timers.start', input: { projectId: p.id, timeZone: 'UTC' } },
			{ command: 'customers.create', input: { name: 'X' } }
		]);
		expect(r).toEqual({
			ok: false,
			error: { code: 'conflict', message: 'Only one timer can run on a project.' }
		});
		expect(history()).toHaveLength(before);
	});

	it('refuses an unknown ref before anything runs', () => {
		const { core, history } = setup();
		const r = runChange(core, 'Bad ref', [
			{ command: 'projects.create', input: { customerId: { ref: 'x' }, name: 'Web' } }
		]);
		expect(r).toEqual({
			ok: false,
			error: {
				code: 'invalid',
				message: 'Unknown ref "x".',
				fields: { customerId: 'Unknown ref "x".' },
				operation: 0
			}
		});
		expect(history()).toHaveLength(0);
	});

	it('refuses a ref to a later operation’s name', () => {
		const ops: Operation[] = [
			{ command: 'projects.create', input: { customerId: { ref: 'c' }, name: 'Web' } },
			{ command: 'customers.create', input: { name: 'Acme' }, as: 'c' }
		];
		expect(checkRefs(ops)).toMatchObject({
			code: 'invalid',
			message: 'Unknown ref "c".',
			operation: 0
		});
	});

	it('refuses a name used twice, at the second', () => {
		const { core, history } = setup();
		const r = runChange(core, 'Twice', [
			{ command: 'customers.create', input: { name: 'A' }, as: 'a' },
			{ command: 'customers.create', input: { name: 'B' }, as: 'a' }
		]);
		expect(r).toMatchObject({
			ok: false,
			error: { code: 'invalid', message: 'Name "a" is used twice.', operation: 1 }
		});
		expect(history()).toHaveLength(0);
	});

	it('passes a ref outside the id fields unchanged, for the core to refuse', () => {
		const { core } = setup();
		const p = project(core);
		const r = runChange(core, 'Ref as text', [
			{ command: 'customers.create', input: { name: 'Acme' }, as: 'c' },
			{ command: 'entries.create', input: { ...entry(p.id), description: { ref: 'c' } } }
		]);
		expect(r).toMatchObject({ ok: false, error: { code: 'invalid', operation: 1 } });
	});

	it('answers a null batch id when nothing changed', () => {
		const { core, history } = setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const before = history().length;
		const r = runChange(core, 'Same name', [
			{ command: 'customers.rename', input: { id: c.id, name: 'Acme' } }
		]);
		expect(r).toMatchObject({ ok: true, batchId: null });
		expect(history()).toHaveLength(before);
	});

	it('refuses a blank label without an operation', () => {
		const { core } = setup();
		const r = runChange(core, '  ', [{ command: 'customers.create', input: { name: 'A' } }]);
		if (r.ok) throw new Error('expected a refusal');
		expect(r.error.code).toBe('invalid');
		expect(r.error.fields).toHaveProperty('label');
		expect(r.error).not.toHaveProperty('operation');
	});

	it('returns the batch’s warnings', () => {
		const { core } = setup();
		const p = project(core);
		const r = runChange(core, 'Overlap', [
			{ command: 'entries.create', input: entry(p.id) },
			{ command: 'entries.create', input: { ...entry(p.id), durationMinutes: 30 } }
		]);
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		expect(r.warnings.map((w) => w.code)).toContain('overlap');
	});
});
