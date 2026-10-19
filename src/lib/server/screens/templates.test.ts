import { describe, expect, it } from 'vitest';
import { openCore, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { customerOf, templateChoices, templateInput } from './templates';

const post = (fields: Record<string, string>) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
};
const none = () => undefined;

describe('templateInput', () => {
	it('sends the name as posted and every blank field as null', () => {
		const input = templateInput(post({ name: ' Standup ', startTime: '  ', reference: '' }), none);
		expect(input).toEqual({
			name: ' Standup ',
			customerId: null,
			projectId: null,
			activityId: null,
			locationId: null,
			startTime: null,
			endTime: null,
			durationMinutes: null,
			timeZone: null,
			reference: null,
			description: null
		});
	});

	it('trims the fields it sends', () => {
		const input = templateInput(
			post({ name: 'a', reference: ' PO-1 ', timeZone: ' Europe/Rome ' }),
			none
		);
		expect(input).toMatchObject({ reference: 'PO-1', timeZone: 'Europe/Rome' });
	});

	it('sends a whole number of minutes as a number and anything else as typed', () => {
		expect(templateInput(post({ name: 'a', durationMinutes: '90' }), none).durationMinutes).toBe(
			90
		);
		expect(templateInput(post({ name: 'a', durationMinutes: '1.5' }), none).durationMinutes).toBe(
			'1.5'
		);
	});

	it("gives a project with no customer the project's customer", () => {
		const input = templateInput(post({ name: 'a', projectId: 'p1' }), (id) =>
			id === 'p1' ? 'c1' : undefined
		);
		expect(input).toMatchObject({ projectId: 'p1', customerId: 'c1' });
	});

	it('leaves the customer null when the project is unknown', () => {
		expect(templateInput(post({ name: 'a', projectId: 'p9' }), none).customerId).toBeNull();
	});

	it('sends a customer that differs from the project as posted', () => {
		const input = templateInput(post({ name: 'a', projectId: 'p1', customerId: 'c2' }), () => 'c1');
		expect(input).toMatchObject({ projectId: 'p1', customerId: 'c2' });
	});
});

describe('templateChoices and customerOf', () => {
	const db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const core = openCore(db, id, 'ui');
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(r.error.message);
		return r.value;
	};

	const live = val(core.customers.create({ name: 'Live' }));
	const dead = val(core.customers.create({ name: 'Dead' }));
	const liveProject = val(core.projects.create({ customerId: live.id, name: 'Site' }));
	const oldProject = val(core.projects.create({ customerId: live.id, name: 'Old' }));
	const deadProject = val(core.projects.create({ customerId: dead.id, name: 'Legacy' }));
	const activity = val(core.activities.create({ name: 'Build' }));
	const oldActivity = val(core.activities.create({ name: 'Old build' }));
	const otherActivity = val(core.activities.create({ name: 'Gone build' }));
	const oldLocation = val(core.locations.create({ name: 'Old office' }));
	val(core.projects.archive({ id: oldProject.id }));
	val(core.customers.archive({ id: dead.id }));
	val(core.activities.archive({ id: oldActivity.id }));
	val(core.activities.archive({ id: otherActivity.id }));
	val(core.locations.archive({ id: oldLocation.id }));

	const names = (options: { name: string }[]) => options.map((o) => o.name);
	const projectNames = (c: ReturnType<typeof templateChoices>) =>
		c.projects.flatMap((g) => g.projects.map((p) => p.name));

	it('lists only active rows for a new template', () => {
		const c = templateChoices(core);
		expect(names(c.customers)).toEqual(['Live']);
		expect(projectNames(c)).toEqual(['Site']);
		expect(names(c.activities)).toEqual(['Build']);
		expect(c.locations).toEqual([]);
	});

	it("adds the template's archived current rows, marked, and no other archived row", () => {
		const c = templateChoices(core, {
			customerId: live.id,
			projectId: oldProject.id,
			activityId: oldActivity.id,
			locationId: oldLocation.id
		});
		expect(projectNames(c)).toEqual(['Site', 'Old (archived)']);
		expect(names(c.activities)).toEqual(['Build', 'Old build (archived)']);
		expect(names(c.locations)).toEqual(['Old office (archived)']);
		expect(names(c.customers)).toEqual(['Live']);
		expect(c.activities.map((a) => a.id)).not.toContain(otherActivity.id);
		expect(c.activities.map((a) => a.id)).toContain(activity.id);
	});

	it('still lists an archived project of an archived customer when it is current', () => {
		const c = templateChoices(core, {
			customerId: dead.id,
			projectId: deadProject.id,
			activityId: null,
			locationId: null
		});
		expect(names(c.customers)).toEqual(['Live', 'Dead (archived)']);
		expect(projectNames(c)).toEqual(['Legacy (archived)', 'Site']);
		expect(c.projects.map((g) => g.customerName)).toContain('Dead');
	});

	it("finds a project's customer, archived or not, and none for an unknown project", () => {
		expect(customerOf(core)(liveProject.id)).toBe(live.id);
		expect(customerOf(core)(deadProject.id)).toBe(dead.id);
		expect(customerOf(core)('nope')).toBeUndefined();
	});
});
