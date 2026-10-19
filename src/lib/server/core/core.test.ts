import { describe, expect, it } from 'vitest';
import { batch, change, user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { COMMANDS, commandSchemas, openCore, type Result } from './index';

function setup() {
	const db = createTestDb();
	const mkUser = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const userId = mkUser('u');
	const otherId = mkUser('o');
	let clock = 1000;
	const tick = () => clock++;
	const core = openCore(db, userId, 'ui', tick);
	const other = openCore(db, otherId, 'agent', tick);
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const batches = () => db.select().from(batch).all();
	const changes = () => db.select().from(change).all();
	return { db, core, other, val, batches, changes };
}

describe('a lone command', () => {
	it('makes one batch with the generated label and the actor', () => {
		const { core, val, batches, changes } = setup();
		val(core.customers.create({ name: ' Acme ' }));
		expect(batches()).toHaveLength(1);
		expect(batches()[0]).toMatchObject({ label: 'Create customer "Acme"', actor: 'ui' });
		expect(changes()).toHaveLength(1);
	});

	it('labels each command with the current names', () => {
		const { core, val, batches } = setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const p = val(core.projects.create({ customerId: c.id, name: 'Old' }));
		val(core.projects.rename({ id: p.id, name: ' New ' }));
		val(core.projects.archive({ id: p.id }));
		val(core.projects.unarchive({ id: p.id }));
		const a = val(core.activities.create({ name: 'Dev' }));
		val(core.activities.archive({ id: a.id }));
		const l = val(core.locations.create({ name: 'Home' }));
		val(core.locations.archive({ id: l.id }));
		val(core.locations.unarchive({ id: l.id }));
		val(core.customers.rename({ id: c.id, name: 'Acme 2' }));
		expect(batches().map((b) => b.label)).toEqual([
			'Create customer "Acme"',
			'Create project "Old"',
			'Rename project "Old" to "New"',
			'Archive project "New"',
			'Unarchive project "New"',
			'Create activity "Dev"',
			'Archive activity "Dev"',
			'Create location "Home"',
			'Archive location "Home"',
			'Unarchive location "Home"',
			'Rename customer "Acme" to "Acme 2"'
		]);
	});

	it('stores nothing when the command fails', () => {
		const { core, val, batches } = setup();
		val(core.customers.create({ name: 'Acme' }));
		expect(core.customers.create({ name: 'acme' }).ok).toBe(false);
		expect(core.customers.rename({ id: 'nope', name: 'X' }).ok).toBe(false);
		expect(core.customers.archive({ id: 'nope' }).ok).toBe(false);
		expect(core.customers.create({ name: '' }).ok).toBe(false);
		expect(batches()).toHaveLength(1);
	});

	it('lists through the core', () => {
		const { core, val } = setup();
		val(core.customers.create({ name: 'B' }));
		val(core.customers.create({ name: 'A' }));
		expect(val(core.customers.list()).map((c) => c.name)).toEqual(['A', 'B']);
		expect(val(core.history.list())).toHaveLength(2);
	});
});

describe('batch', () => {
	const setUp = (c: ReturnType<typeof setup>['core']) =>
		c.batch('Set up', (b) => {
			const cust = b.customers.create({ name: 'Acme' });
			if (!cust.ok) return cust;
			const one = b.projects.create({ customerId: cust.value.id, name: 'One' });
			if (!one.ok) return one;
			return b.projects.create({ customerId: cust.value.id, name: 'Two' });
		});

	it('makes one batch with all its changes', () => {
		const { core, val, batches, changes } = setup();
		val(setUp(core));
		expect(batches()).toHaveLength(1);
		expect(batches()[0]).toMatchObject({ label: 'Set up', actor: 'ui' });
		expect(changes()).toHaveLength(3);
	});

	it('writes nothing when the third command fails', () => {
		const { core, batches, changes } = setup();
		const r = core.batch('Set up', (b) => {
			const cust = b.customers.create({ name: 'Acme' });
			if (!cust.ok) return cust;
			const one = b.projects.create({ customerId: cust.value.id, name: 'One' });
			if (!one.ok) return one;
			return b.projects.create({ customerId: cust.value.id, name: 'one' });
		});
		expect(r.ok).toBe(false);
		expect(batches()).toHaveLength(0);
		expect(changes()).toHaveLength(0);
		expect(core.customers.list()).toEqual({ ok: true, value: [], warnings: [] });
	});

	it('is undone as a whole by one new batch', () => {
		const { core, val, batches, changes, db } = setup();
		val(setUp(core));
		const original = batches()[0];
		val(core.undo({ batchId: original.id }));
		expect(batches()).toHaveLength(2);
		expect(batches().find((b) => b.id !== original.id)!.label).toBe('Undo "Set up"');
		expect(changes()).toHaveLength(6);
		expect(val(core.customers.list({ includeArchived: true }))).toEqual([]);
		expect(val(core.projects.list({ includeArchived: true }))).toEqual([]);
		const history = val(core.history.list());
		expect(history.find((h) => h.id === original.id)!.undone).toBe(true);
		void db;
	});

	it('labels an undo of chosen changes by count', () => {
		const { core, val, batches, changes } = setup();
		val(core.customers.create({ name: 'Acme' }));
		val(core.undo({ changeIds: [changes()[0].id] }));
		expect(batches().map((b) => b.label)).toEqual(['Create customer "Acme"', 'Undo 1 change']);
	});

	it('refuses the outer core inside a batch and writes nothing', () => {
		const { core, batches, changes } = setup();
		expect(() =>
			core.batch('outer', () => {
				core.customers.create({ name: 'Acme' });
				return core.customers.create({ name: 'Beta' });
			})
		).toThrow('A batch is already open: use the core passed to batch().');
		expect(batches()).toHaveLength(0);
		expect(changes()).toHaveLength(0);
	});

	it('validates the label', () => {
		const { core, batches } = setup();
		for (const label of ['', '   ', 'x'.repeat(201)]) {
			const r = core.batch(label, (b) => b.customers.create({ name: 'Acme' }));
			expect(r).toMatchObject({
				ok: false,
				error: { code: 'invalid', fields: { label: 'Label must be 1–200 characters.' } }
			});
		}
		expect(core.batch(' ok ', (b) => b.customers.create({ name: 'Acme' })).ok).toBe(true);
		expect(batches().map((b) => b.label)).toEqual(['ok']);
	});

	it('fails an undo of an unknown batch without storing one', () => {
		const { core, batches } = setup();
		const r = core.undo({ batchId: 'nope' });
		expect(r.ok).toBe(false);
		expect(batches()).toHaveLength(0);
	});
});

describe('entries and timers', () => {
	function withProject() {
		const t = setup();
		const c = t.val(t.core.customers.create({ name: 'Acme' }));
		const p = t.val(t.core.projects.create({ customerId: c.id, name: 'Web' }));
		return { ...t, p };
	}
	const labels = (b: { batches: () => { label: string }[] }) => b.batches().map((x) => x.label);

	it('labels each command with the project name', () => {
		const t = withProject();
		const { core, val, p } = t;
		const e = val(
			core.entries.create({
				projectId: p.id,
				timeZone: 'UTC',
				start: '2026-10-18T09:00',
				durationMinutes: 30
			})
		);
		val(core.entries.update({ id: e.id, description: 'x' }));
		val(core.entries.delete({ id: e.id }));
		const timer = val(core.timers.start({ projectId: p.id, timeZone: 'UTC' }));
		val(core.timers.stop({ id: timer.id }));
		expect(labels(t).slice(2)).toEqual([
			'Create entry on "Web"',
			'Edit entry on "Web"',
			'Delete entry on "Web"',
			'Start timer on "Web"',
			'Stop timer on "Web"'
		]);
	});

	it('labels an edit that moves an entry with the new project', () => {
		const t = withProject();
		const { core, val, p } = t;
		const q = val(core.projects.create({ customerId: p.customerId, name: 'App' }));
		const e = val(
			core.entries.create({
				projectId: p.id,
				timeZone: 'UTC',
				start: '2026-10-18T09:00',
				durationMinutes: 30
			})
		);
		val(core.entries.update({ id: e.id, projectId: q.id }));
		expect(labels(t).at(-1)).toBe('Edit entry on "App"');
	});

	it('reads entries through the core', () => {
		const { core, val, p } = withProject();
		const e = val(
			core.entries.create({
				projectId: p.id,
				timeZone: 'UTC',
				start: '2026-10-18T09:00',
				durationMinutes: 30
			})
		);
		expect(val(core.entries.get({ id: e.id }))).toMatchObject({ projectName: 'Web' });
		expect(val(core.entries.list()).map((x) => x.id)).toEqual([e.id]);
	});

	it('returns warnings through the core and merges them in a batch', () => {
		const { core, val, p } = withProject();
		const input = { projectId: p.id, timeZone: 'UTC', start: '2026-10-18T09:00' };
		val(core.entries.create({ ...input, durationMinutes: 60 }));
		const overlap = core.entries.create({ ...input, durationMinutes: 30 });
		expect(overlap.ok && overlap.warnings.map((w) => w.code)).toEqual(['overlap']);
		const r = core.batch('Both', (c) => {
			const a = c.entries.create({ ...input, durationMinutes: 45 });
			if (!a.ok) return a;
			return c.timers.start({ projectId: p.id, timeZone: 'UTC' });
		});
		expect(r.ok && r.warnings.map((w) => w.code)).toEqual(['overlap']);
	});
});

describe('users are separate', () => {
	it("cannot see or undo another user's data", () => {
		const { core, other, val, batches } = setup();
		val(core.customers.create({ name: 'Acme' }));
		const mine = batches()[0];
		expect(val(other.customers.list())).toEqual([]);
		expect(val(other.history.list())).toEqual([]);
		const r = other.undo({ batchId: mine.id });
		expect(r.ok).toBe(false);
		expect(!r.ok && r.error.code).toBe('not_found');
		expect(other.customers.rename({ id: val(core.customers.list())[0].id, name: 'X' }).ok).toBe(
			false
		);
		expect(val(core.customers.list())).toHaveLength(1);
		expect(batches()).toHaveLength(1);
	});
});

describe('templates', () => {
	it('labels each template command', () => {
		const { core, val, batches } = setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const p = val(core.projects.create({ customerId: c.id, name: 'Web' }));
		const t = val(core.templates.create({ name: ' Standup ', projectId: p.id, timeZone: 'UTC' }));
		val(core.templates.update({ id: t.id, name: 'Daily' }));
		const e = val(
			core.entries.create({
				projectId: p.id,
				timeZone: 'UTC',
				start: '2026-10-18T09:00',
				durationMinutes: 30
			})
		);
		val(core.templates.fromEntry({ entryId: e.id, name: ' Saved ' }));
		val(
			core.entries.fromTemplate({
				templateId: t.id,
				start: '2026-10-18T10:00',
				end: '2026-10-18T11:00'
			})
		);
		val(core.entries.fromTemplate({ templateId: t.id }));
		expect(val(core.templates.list()).map((x) => x.name)).toEqual(['Daily', 'Saved']);
		expect(val(core.templates.get({ id: t.id })).projectName).toBe('Web');
		val(core.templates.delete({ id: t.id }));
		expect(
			batches()
				.map((b) => b.label)
				.slice(2)
		).toEqual([
			'Create template "Standup"',
			'Edit template "Standup"',
			'Create entry on "Web"',
			'Save entry as template "Saved"',
			'Create entry from template "Daily"',
			'Start timer from template "Daily"',
			'Delete template "Daily"'
		]);
	});

	it('stores no batch for a failed command and labels inside a batch', () => {
		const { core, val, batches } = setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const p = val(core.projects.create({ customerId: c.id, name: 'Web' }));
		const t = val(core.templates.create({ name: 'T', projectId: p.id, timeZone: 'UTC' }));
		const before = batches().length;
		expect(core.entries.fromTemplate({ templateId: t.id, end: '2026-10-18T10:00' }).ok).toBe(false);
		expect(batches()).toHaveLength(before);
		val(core.batch('Morning', (b) => b.entries.fromTemplate({ templateId: t.id })));
		expect(batches().at(-1)?.label).toBe('Morning');
	});

	it('returns warnings from entries.fromTemplate', () => {
		const { core, val } = setup();
		const c = val(core.customers.create({ name: 'Acme' }));
		const p = val(core.projects.create({ customerId: c.id, name: 'Web' }));
		const t = val(
			core.templates.create({ name: 'T', projectId: p.id, timeZone: 'UTC', durationMinutes: 60 })
		);
		const input = { templateId: t.id, start: '2026-10-18T09:00' };
		val(core.entries.fromTemplate(input));
		const r = core.entries.fromTemplate(input);
		expect(r.ok && r.warnings.map((w) => w.code)).toEqual(['overlap']);
	});
});

describe('exposed to callers', () => {
	it('gives core.batch the id of its batch', () => {
		const { core, val } = setup();
		let seen = '';
		val(
			core.batch('L', (c) => {
				seen = c.batchId;
				return c.customers.create({ name: 'A' });
			})
		);
		expect(seen).toBe(val(core.history.list({ limit: 1 }))[0].id);
	});

	it('names every command with the schema it parses by', () => {
		const names = ['customers', 'projects', 'activities', 'locations'].flatMap((k) =>
			['create', 'rename', 'archive', 'unarchive'].map((v) => `${k}.${v}`)
		);
		const expected = [
			...names,
			'entries.create',
			'entries.update',
			'entries.delete',
			'entries.fromTemplate',
			'timers.start',
			'timers.stop',
			'templates.create',
			'templates.update',
			'templates.delete',
			'templates.fromEntry'
		];
		expect(COMMANDS).toHaveLength(26);
		expect([...COMMANDS]).toEqual(expected);
		expect(Object.keys(commandSchemas).sort()).toEqual([...expected].sort());
		expect(commandSchemas['customers.create'].safeParse({ name: ' ' }).success).toBe(false);
	});
});
