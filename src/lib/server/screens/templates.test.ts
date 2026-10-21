import { describe, expect, it } from 'vitest';
import { openCore, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import { customerOf, templateFormData, templateFromForm, templateUnread } from './templates';

const post = (fields: Record<string, string>) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
};
const none = () => null;

describe('templateFromForm', () => {
	const blank = {
		name: 'a',
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
	};

	it('sends the name as posted and every blank field as null', () => {
		expect(templateFromForm(post({ name: ' Standup ', start: '  ', reference: '' }), none)).toEqual(
			{ ...blank, name: ' Standup ' }
		);
	});

	it('reads times as HH:mm and sends the end when the end was typed last', () => {
		const input = templateFromForm(
			post({
				name: 'a',
				start: '09:30',
				end: '09:45',
				duration: '0:15',
				linked: 'end'
			}),
			none
		);
		expect(input).toMatchObject({ startTime: '09:30', endTime: '09:45', durationMinutes: null });
	});

	it('reads loose times of day', () => {
		const input = templateFromForm(
			post({ name: 'a', start: '930', end: '1015', linked: 'end' }),
			none
		);
		expect(input).toMatchObject({ startTime: '09:30', endTime: '10:15' });
	});

	it('sends the duration in minutes when the duration was typed last', () => {
		const input = templateFromForm(
			post({ name: 'a', start: '09:30', end: '10:00', duration: '0:30', linked: 'duration' }),
			none
		);
		expect(input).toMatchObject({ startTime: '09:30', endTime: null, durationMinutes: 30 });
	});

	it('sends only the end when both are posted without a link', () => {
		const input = templateFromForm(
			post({ name: 'a', start: '09:30', end: '10:00', duration: '0:30' }),
			none
		);
		expect(input).toMatchObject({ endTime: '10:00', durationMinutes: null });
	});

	it('sends a duration alone, a start alone', () => {
		expect(templateFromForm(post({ name: 'a', duration: '1:30' }), none)).toMatchObject({
			endTime: null,
			durationMinutes: 90
		});
		expect(templateFromForm(post({ name: 'a', start: '8' }), none)).toMatchObject({
			startTime: '08:00',
			endTime: null,
			durationMinutes: null
		});
	});

	it('trims the fields it sends', () => {
		const input = templateFromForm(
			post({ name: 'a', reference: ' PO-1 ', timeZone: ' Europe/Rome ' }),
			none
		);
		expect(input).toMatchObject({ reference: 'PO-1', timeZone: 'Europe/Rome' });
	});

	it("gives a project with no customer the project's customer", () => {
		const input = templateFromForm(post({ name: 'a', projectId: 'p1' }), (id) =>
			id === 'p1' ? 'c1' : null
		);
		expect(input).toMatchObject({ projectId: 'p1', customerId: 'c1' });
	});

	it('leaves the customer null when the project is unknown', () => {
		expect(templateFromForm(post({ name: 'a', projectId: 'p9' }), none).customerId).toBeNull();
	});

	it('sends a customer alone, with no project', () => {
		expect(templateFromForm(post({ name: 'a', customerId: 'c1' }), none)).toMatchObject({
			customerId: 'c1',
			projectId: null
		});
	});

	it('sends a customer that differs from the project as posted', () => {
		const input = templateFromForm(
			post({ name: 'a', projectId: 'p1', customerId: 'c2' }),
			() => 'c1'
		);
		expect(input).toMatchObject({ projectId: 'p1', customerId: 'c2' });
	});

	it('sends an unreadable time as typed for the core to refuse', () => {
		expect(templateFromForm(post({ name: 'a', start: 'soon' }), none).startTime).toBe('soon');
	});
});

describe('templateUnread', () => {
	it('names each time that cannot be read, beside its own field', () => {
		const fields = templateUnread(post({ name: 'a', start: 'soon', end: '25:00', linked: 'end' }));
		expect(Object.keys(fields).sort()).toEqual(['end', 'start']);
		expect(Object.keys(templateUnread(post({ name: 'a', duration: 'x' })))).toEqual(['duration']);
	});

	it('reads nothing wrong in blanks and good times', () => {
		expect(templateUnread(post({ name: 'a', start: '9', end: '', duration: '1:00' }))).toEqual({});
	});

	it('ignores the time that was not the one sent', () => {
		expect(
			templateUnread(post({ name: 'a', start: '9', end: '10', duration: 'x', linked: 'end' }))
		).toEqual({});
	});
});

describe('customerOf', () => {
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
	const deadProject = val(core.projects.create({ customerId: dead.id, name: 'Legacy' }));
	val(core.customers.archive({ id: dead.id }));

	it("finds a project's customer, archived or not, and none for an unknown project", () => {
		expect(customerOf(core)(liveProject.id)).toBe(live.id);
		expect(customerOf(core)(deadProject.id)).toBe(dead.id);
		expect(customerOf(core)('nope')).toBeNull();
	});
});

describe('templateFormData', () => {
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
	const customer = val(core.customers.create({ name: 'Acme' }));
	const project = val(core.projects.create({ customerId: customer.id, name: 'Web' }));
	const oldProject = val(core.projects.create({ customerId: customer.id, name: 'Old' }));
	const oldActivity = val(core.activities.create({ name: 'Old build' }));
	const oldLocation = val(core.locations.create({ name: 'Old office' }));
	val(core.projects.archive({ id: oldProject.id }));
	val(core.activities.archive({ id: oldActivity.id }));
	val(core.locations.archive({ id: oldLocation.id }));
	const template = val(
		core.templates.create({
			name: 'Stand',
			customerId: customer.id,
			projectId: oldProject.id,
			activityId: oldActivity.id,
			locationId: oldLocation.id,
			startTime: '23:30',
			endTime: '00:15',
			timeZone: 'Europe/Rome',
			reference: 'R',
			description: 'D'
		})
	);

	it('is an empty template form for a new template', () => {
		const d = templateFormData(core, null, '/templates');
		expect(d).toMatchObject({
			kind: 'template',
			mode: 'new',
			back: '/templates',
			zoneFixed: true,
			failure: null,
			templates: []
		});
		expect(d.values).toMatchObject({
			id: null,
			version: '',
			name: '',
			customerId: '',
			date: '',
			start: '',
			end: '',
			duration: '',
			timeZone: '',
			projectId: ''
		});
		expect(d.projects.map((p) => p.name)).toEqual(['Web']);
	});

	it("shows a template's times of day with no date, its zone and its next-day end", () => {
		const d = templateFormData(core, template, '/');
		expect(d).toMatchObject({ kind: 'template', mode: 'edit' });
		expect(d.values).toMatchObject({
			id: template.id,
			version: String(template.version),
			name: 'Stand',
			customerId: customer.id,
			projectId: oldProject.id,
			date: '',
			start: '23:30',
			end: '00:15',
			duration: '0:45',
			endDays: 1,
			timeZone: 'Europe/Rome',
			reference: 'R',
			description: 'D',
			running: false
		});
	});

	it("includes the template's archived references, marked", () => {
		const d = templateFormData(core, template, '/');
		expect(d.projects.find((p) => p.id === oldProject.id)).toMatchObject({ archived: true });
		expect(d.projects.find((p) => p.id === project.id)).toMatchObject({ archived: false });
		expect(d.activities).toEqual([{ id: oldActivity.id, name: 'Old build', archived: true }]);
		expect(d.locations).toEqual([{ id: oldLocation.id, name: 'Old office', archived: true }]);
	});

	it('shows a duration-only template with the end unset', () => {
		const t = val(core.templates.create({ name: 'Dur', startTime: '09:00', durationMinutes: 90 }));
		expect(templateFormData(core, t, '/').values).toMatchObject({
			start: '09:00',
			end: '',
			duration: '1:30',
			endDays: 0,
			timeZone: ''
		});
	});

	it('checks back', () => {
		expect(templateFormData(core, null, '//evil.example').back).toBe('/');
	});

	it('offers the active customers, and a customer alone with no active project', () => {
		const lone = val(core.customers.create({ name: 'Lone' }));
		const t = val(core.templates.create({ name: 'Only customer', customerId: lone.id }));
		const d = templateFormData(core, t, '/');
		expect(d.values).toMatchObject({ customerId: lone.id, projectId: '' });
		expect(d.projects.some((p) => p.customerId === lone.id)).toBe(false);
		expect(d.customers).toContainEqual({ id: lone.id, name: 'Lone', archived: false });
		expect(d.customers).toContainEqual({ id: customer.id, name: 'Acme', archived: false });
	});

	it("includes the template's own archived customer, marked, and no other", () => {
		const gone = val(core.customers.create({ name: 'Gone' }));
		const other = val(core.customers.create({ name: 'Other gone' }));
		val(core.customers.archive({ id: gone.id }));
		val(core.customers.archive({ id: other.id }));
		const t = val(core.templates.create({ name: 'Old customer', customerId: gone.id }));
		const ids = templateFormData(core, t, '/').customers!;
		expect(ids).toContainEqual({ id: gone.id, name: 'Gone', archived: true });
		expect(ids.map((c) => c.id)).not.toContain(other.id);
		expect(templateFormData(core, null, '/').customers!.map((c) => c.id)).not.toContain(gone.id);
	});
});
