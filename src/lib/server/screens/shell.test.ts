import { describe, expect, it } from 'vitest';
import { openCore, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { shellTemplates, shellTimers } from './shell';

const BUD = 'Europe/Budapest';
/** 2026-10-20 12:00 in Budapest. */
const NOW = Date.parse('2026-10-20T10:00:00Z');

function setup() {
	const db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	let clock = NOW;
	const core = openCore(db, id, 'ui', () => clock);
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const customer = val(core.customers.create({ name: 'Acme' }));
	/** Projects get distinct creation times, in call order. */
	const project = (name: string) => {
		clock += 1000;
		return val(core.projects.create({ customerId: customer.id, name }));
	};
	const start = (projectId: string, at: string) => {
		clock = NOW;
		return val(core.timers.start({ projectId, start: at, timeZone: BUD }));
	};
	return { core, val, project, start };
}

describe('shellTimers', () => {
	it('lists the newest start first, in the start zone', () => {
		const { core, project, start } = setup();
		start(project('A').id, '2026-10-20T09:00');
		start(project('B').id, '2026-10-20T10:00');
		const timers = shellTimers(core, NOW);
		expect(timers.map((t) => t.start)).toEqual(['10:00', '09:00']);
		expect(timers[0]).toMatchObject({ projectName: 'B', customerName: 'Acme', activityName: null });
	});

	it('gives the start date only for a timer started before today', () => {
		const { core, project, start } = setup();
		start(project('A').id, '2026-10-19T22:00');
		start(project('B').id, '2026-10-20T08:00');
		const timers = shellTimers(core, NOW);
		expect(timers.map((t) => t.startDate)).toEqual([null, '2026-10-19']);
	});

	it('colours by project creation order', () => {
		const { core, project, start } = setup();
		const a = project('A');
		const b = project('B');
		start(b.id, '2026-10-20T09:00');
		start(a.id, '2026-10-20T10:00');
		const byProject = Object.fromEntries(
			shellTimers(core, NOW).map((t) => [t.projectName, t.colour])
		);
		expect(byProject).toEqual({ A: 1, B: 2 });
	});

	it('does not list a stopped entry', () => {
		const { core, val, project, start } = setup();
		const e = start(project('A').id, '2026-10-20T09:00');
		start(project('B').id, '2026-10-20T10:00');
		val(core.timers.stop({ id: e.id }));
		expect(shellTimers(core, NOW).map((t) => t.projectName)).toEqual(['B']);
	});
});

describe('shellTemplates', () => {
	it('lists by name, with colour, label and what each needs', () => {
		const { core, val, project } = setup();
		const a = project('A');
		const b = project('B');
		const customerId = a.customerId;
		val(core.templates.create({ name: 'zeta', customerId, projectId: b.id }));
		val(
			core.templates.create({ name: 'Alpha', customerId, projectId: a.id, description: 'Daily' })
		);
		val(core.templates.create({ name: 'mid', description: '  ' }));
		expect(shellTemplates(core)).toEqual([
			{
				id: expect.any(String),
				name: 'Alpha',
				colour: 1,
				label: 'Acme › A',
				hasProject: true,
				hasDescription: true
			},
			{
				id: expect.any(String),
				name: 'mid',
				colour: null,
				label: null,
				hasProject: false,
				hasDescription: false
			},
			{
				id: expect.any(String),
				name: 'zeta',
				colour: 2,
				label: 'Acme › B',
				hasProject: true,
				hasDescription: false
			}
		]);
	});
});
