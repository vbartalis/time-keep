import { describe, expect, it } from 'vitest';
import { colourOf } from '#lib/project-colour.js';
import { newId } from '../id';
import { user } from '../db/schema';
import { createTestDb } from '../testing/db';
import { openCore, type Core, type EntryItem, type Result } from '../core/index';
import type { EntryFormValues } from '#lib/components/entry/types.js';
import {
	copyValues,
	coreFailure,
	createInput,
	type FormRead,
	formPickers,
	goneFailure,
	newEntryValues,
	newEntryZoneFixed,
	newValues,
	previousEnd,
	previousEndFor,
	templateValues,
	unreadFailure,
	updateInput,
	valuesFromEntry
} from './entry-form';

const zone = 'Europe/Budapest';
const NOW = Date.parse('2026-10-20T10:00:00Z');

const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};

const val = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r.error)}`);
	return r.value;
};

function setup() {
	const db = createTestDb();
	const id = newId();
	db.insert(user)
		.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const core = openCore(db, id, 'ui', () => NOW);
	const customer = val(core.customers.create({ name: 'Acme' }));
	const project = val(core.projects.create({ customerId: customer.id, name: 'Web' }));
	const activity = val(core.activities.create({ name: 'Dev' }));
	const location = val(core.locations.create({ name: 'Home' }));
	const entry = (input: Record<string, unknown>): EntryItem =>
		val(
			core.entries.get({
				id: val(core.entries.create({ projectId: project.id, timeZone: zone, ...input })).id
			})
		);
	return { core, customer, project, activity, location, entry };
}

/** The input a read produced; throws when it refused. */
const sent = (r: FormRead): Record<string, unknown> => {
	if (!r.ok) throw new Error(`expected a read: ${JSON.stringify(r.fields)}`);
	return r.input;
};

/** The form as it was shown for `values`, with `changes` typed over it. */
const posted = (values: EntryFormValues, changes: Record<string, string> = {}) =>
	form({
		version: values.version,
		date: values.date,
		start: values.start,
		end: values.end,
		duration: values.duration,
		timeZone: values.timeZone,
		projectId: values.projectId,
		activityId: values.activityId,
		locationId: values.locationId,
		reference: values.reference,
		description: values.description,
		...changes
	});

describe('createInput', () => {
	const base = { date: '2026-10-19', timeZone: zone, projectId: 'p1' };

	it('reads the date and forgiving times into local times', () => {
		expect(createInput(form({ ...base, start: '9', end: '1430' }))).toEqual({
			ok: true,
			input: {
				projectId: 'p1',
				start: '2026-10-19T09:00',
				end: '2026-10-19T14:30',
				timeZone: zone
			}
		});
	});
	it('puts an end at or before the start on the next day', () => {
		const r = createInput(form({ ...base, start: '22:00', end: '06:00' }));
		expect(sent(r).end).toBe('2026-10-20T06:00');
	});
	it('sends a duration without an end', () => {
		const r = createInput(form({ ...base, start: '13', duration: '5.5' }));
		expect(sent(r)).toMatchObject({ start: '2026-10-19T13:00', durationMinutes: 330 });
		expect(sent(r)).not.toHaveProperty('end');
	});
	it('sends neither end nor duration when both are empty (a running timer)', () => {
		const r = createInput(form({ ...base, start: '9', end: '', duration: '' }));
		expect(r.ok).toBe(true);
		expect(sent(r)).not.toHaveProperty('end');
		expect(sent(r)).not.toHaveProperty('durationMinutes');
	});
	it('sends the duration when end and duration agree, so a long span keeps its days', () => {
		const r = createInput(form({ ...base, start: '22:00', end: '07:15', duration: '33:15' }));
		expect(sent(r)).toMatchObject({ durationMinutes: 1995 });
		expect(sent(r)).not.toHaveProperty('end');
	});
	it('refuses a time it cannot read, beside the field', () => {
		expect(createInput(form({ ...base, start: '17.5' }))).toEqual({
			ok: false,
			fields: { start: 'Type 17:30 or 17:05.' }
		});
		expect(createInput(form({ ...base, start: '' }))).toEqual({
			ok: false,
			fields: { start: 'Not a time. Type 9, 900, 9:00 or 1330.' }
		});
	});
	it('refuses an end and a duration it cannot read', () => {
		const r = createInput(form({ ...base, start: '9', end: '25', duration: '0' }));
		expect(r).toEqual({
			ok: false,
			fields: { end: 'Not a time of day.', duration: 'A duration is more than zero.' }
		});
	});
	it('reads the date through readDate', () => {
		const r = createInput(form({ ...base, date: '20261018', start: '9' }));
		expect(sent(r).start).toBe('2026-10-18T09:00');
		const bad = createInput(form({ ...base, date: '2026-13-01', start: '9' }));
		expect(bad).toEqual({
			ok: false,
			fields: { date: 'Not a date. Type 2026-10-18, 20261018 or 10.18.' }
		});
	});
	it('leaves blank pickers and text out and never sends an end zone', () => {
		const r = createInput(
			form({
				...base,
				start: '9',
				end: '10',
				activityId: '',
				locationId: ' ',
				reference: '',
				description: '  '
			})
		);
		expect(Object.keys(sent(r)).sort()).toEqual(['end', 'projectId', 'start', 'timeZone']);
	});
	it('sends filled pickers and text, trimmed', () => {
		const r = createInput(
			form({
				...base,
				start: '9',
				activityId: 'a1',
				locationId: 'l1',
				reference: ' WEB-1 ',
				description: 'Call'
			})
		);
		expect(sent(r)).toMatchObject({
			activityId: 'a1',
			locationId: 'l1',
			reference: 'WEB-1',
			description: 'Call'
		});
	});
	it('makes input the core accepts', () => {
		const { core, project } = setup();
		const r = createInput(form({ ...base, projectId: project.id, start: '22:00', end: '06:00' }));
		const made = val(core.entries.create(sent(r)));
		expect(made.startAt).toBe(Date.parse('2026-10-19T20:00:00Z'));
		expect(made.endAt).toBe(Date.parse('2026-10-20T04:00:00Z'));
	});
});

describe('updateInput', () => {
	function finished() {
		const s = setup();
		const e = s.entry({
			start: '2026-10-19T09:00',
			end: '2026-10-19T14:30',
			activityId: s.activity.id,
			reference: 'WEB-1',
			description: 'Build'
		});
		return { ...s, e, values: valuesFromEntry(e) };
	}

	it('always sends the id, version, start zone, pickers and texts (blank as null)', () => {
		const { e, values, project, activity } = finished();
		const r = updateInput(posted(values, { reference: ' ' }), e);
		expect(r).toEqual({
			ok: true,
			input: {
				id: e.id,
				expectedVersion: e.version,
				timeZone: zone,
				projectId: project.id,
				activityId: activity.id,
				locationId: null,
				reference: null,
				description: 'Build'
			}
		});
	});
	it('sends a moved start alone, so the end holds', () => {
		const { core, e, values } = finished();
		const r = updateInput(posted(values, { start: '930' }), e);
		expect(sent(r).start).toBe('2026-10-19T09:30');
		expect(sent(r)).not.toHaveProperty('end');
		expect(sent(r)).not.toHaveProperty('durationMinutes');
		const saved = val(core.entries.update(sent(r)));
		expect(saved.endAt).toBe(e.endAt);
	});
	it('treats a start typed in another form as unchanged', () => {
		const { e, values } = finished();
		const r = updateInput(posted(values, { start: '9', end: '1430', duration: '5.5' }), e);
		expect(sent(r)).not.toHaveProperty('start');
		expect(sent(r)).not.toHaveProperty('end');
		expect(sent(r)).not.toHaveProperty('durationMinutes');
	});
	it('sends a changed duration when the end is unchanged', () => {
		const { e, values } = finished();
		const r = updateInput(posted(values, { duration: '2:00' }), e);
		expect(sent(r)).toMatchObject({ durationMinutes: 120 });
		expect(sent(r)).not.toHaveProperty('end');
		expect(sent(r)).not.toHaveProperty('start');
	});
	it('sends a changed end over a changed duration', () => {
		const { e, values } = finished();
		const r = updateInput(posted(values, { end: '15', duration: '1:00' }), e);
		expect(sent(r)).toMatchObject({ end: '2026-10-19T15:00', endTimeZone: zone });
		expect(sent(r)).not.toHaveProperty('durationMinutes');
	});
	it('sends a typed duration of days that the end was linked from', () => {
		// The form fills the end from a typed 30:00: 15:00 on the day after next.
		const { core, e, values } = finished();
		const r = updateInput(posted(values, { end: '15:00', duration: '30:00' }), e);
		expect(sent(r)).toMatchObject({ durationMinutes: 1800 });
		expect(sent(r)).not.toHaveProperty('end');
		const saved = val(core.entries.update(sent(r)));
		expect(saved.endAt).toBe(Date.parse('2026-10-20T13:00:00Z'));
	});
	it('keeps the end when the duration only followed a moved start', () => {
		// The form shows 5:00 after the start moves to 09:30, the end holding.
		const { core, e, values } = finished();
		const r = updateInput(posted(values, { start: '09:30', duration: '5:00' }), e);
		expect(sent(r).start).toBe('2026-10-19T09:30');
		expect(sent(r)).not.toHaveProperty('durationMinutes');
		expect(sent(r)).not.toHaveProperty('end');
		expect(val(core.entries.update(sent(r))).endAt).toBe(e.endAt);
	});
	it('makes the entry running when end and duration are emptied', () => {
		const { e, values } = finished();
		const r = updateInput(posted(values, { end: '', duration: '' }), e);
		expect(sent(r).end).toBeNull();
		expect(sent(r)).not.toHaveProperty('endTimeZone');
	});
	it('puts a typed end before the start on the next day, in the end zone', () => {
		const { e, values } = finished();
		const r = updateInput(posted(values, { end: '08:00' }), e);
		expect(sent(r)).toMatchObject({ end: '2026-10-20T08:00', endTimeZone: zone });
	});
	it('sends no times when nothing changed', () => {
		const { e, values } = finished();
		const r = updateInput(posted(values), e);
		expect(sent(r)).not.toHaveProperty('start');
		expect(sent(r)).not.toHaveProperty('end');
		expect(sent(r)).not.toHaveProperty('durationMinutes');
	});
	it('moves the whole entry to a changed date, keeping its times of day', () => {
		const { core, e, values } = finished();
		const r = updateInput(posted(values, { date: '2026-10-18' }), e);
		expect(sent(r)).toMatchObject({
			start: '2026-10-18T09:00',
			end: '2026-10-18T14:30',
			endTimeZone: zone
		});
		expect(val(core.entries.update(sent(r))).endAt).toBe(Date.parse('2026-10-18T12:30:00Z'));
	});
	it('refuses times it cannot read', () => {
		const { e, values } = finished();
		expect(updateInput(posted(values, { start: '', duration: ':0' }), e)).toEqual({
			ok: false,
			fields: {
				start: 'Not a time. Type 9, 900, 9:00 or 1330.',
				duration: 'A duration is more than zero.'
			}
		});
	});
	it('ends a running entry in its start zone', () => {
		const s = setup();
		const e = s.entry({ start: '2026-10-20T09:00' });
		const r = updateInput(posted(valuesFromEntry(e), { end: '11:00' }), e);
		expect(sent(r)).toMatchObject({ end: '2026-10-20T11:00', endTimeZone: zone });
	});
	it('leaves a running entry running when end and duration stay empty', () => {
		const s = setup();
		const e = s.entry({ start: '2026-10-20T09:00' });
		const r = updateInput(posted(valuesFromEntry(e), { description: 'x' }), e);
		expect(sent(r)).not.toHaveProperty('end');
	});
	it('keeps an untouched end', () => {
		const { core, entry } = setup();
		const e = entry({
			start: '2026-10-17T22:00',
			end: '2026-10-19T07:15:30',
			endTimeZone: 'America/New_York'
		});
		const values = valuesFromEntry(e);
		expect(values).toMatchObject({ endDays: 2, endZone: 'America/New_York', end: '07:15' });
		const r = updateInput(posted(values, { description: 'Night shift' }), e);
		expect(sent(r)).not.toHaveProperty('end');
		expect(sent(r)).not.toHaveProperty('durationMinutes');
		expect(sent(r)).not.toHaveProperty('start');
		const saved = val(core.entries.update(sent(r)));
		expect(saved).toMatchObject({
			startAt: e.startAt,
			endAt: e.endAt,
			endZone: 'America/New_York',
			description: 'Night shift'
		});
	});
});

describe('an entry under one minute long', () => {
	it('saves a new description, its 0:00 duration unchanged', () => {
		const { core, entry } = setup();
		const e = entry({ start: '2026-10-19T09:00:10', end: '2026-10-19T09:00:30' });
		const values = valuesFromEntry(e);
		expect(values.duration).toBe('0:00');
		const input = sent(updateInput(posted(values, { description: 'Oops' }), e));
		expect(input).not.toHaveProperty('start');
		expect(input).not.toHaveProperty('end');
		expect(input).not.toHaveProperty('durationMinutes');
		const saved = val(core.entries.update(input));
		expect(saved).toMatchObject({ startAt: e.startAt, endAt: e.endAt, description: 'Oops' });
	});
	it('still refuses a 0:00 duration typed over another', () => {
		const { entry } = setup();
		const e = entry({ start: '2026-10-19T09:00', end: '2026-10-19T10:00' });
		const r = updateInput(posted(valuesFromEntry(e), { duration: '0:00' }), e);
		expect(r).toEqual({ ok: false, fields: { duration: 'A duration is more than zero.' } });
	});
	it('copies as one minute, which saves', () => {
		const { core, entry } = setup();
		const e = entry({ start: '2026-10-19T23:59:10', end: '2026-10-19T23:59:30' });
		const copy = copyValues(e);
		expect(copy).toMatchObject({ start: '23:59', end: '00:00', endDays: 1, duration: '0:01' });
		const made = val(core.entries.create(sent(createInput(posted(copy)))));
		expect(made.endAt! - made.startAt).toBe(60_000);
	});
});

describe('valuesFromEntry', () => {
	it('shows a finished entry in its zones', () => {
		const { entry, project } = setup();
		const e = entry({ start: '2026-10-19T22:00', end: '2026-10-20T06:30', reference: 'R' });
		expect(valuesFromEntry(e)).toEqual({
			id: e.id,
			version: String(e.version),
			date: '2026-10-19',
			start: '22:00',
			end: '06:30',
			duration: '8:30',
			endDays: 1,
			endZone: null,
			timeZone: zone,
			projectId: project.id,
			activityId: '',
			locationId: '',
			reference: 'R',
			description: '',
			running: false,
			name: '',
			customerId: ''
		});
	});
	it('shows a running entry with no end or duration', () => {
		const { entry } = setup();
		const values = valuesFromEntry(entry({ start: '2026-10-20T09:00' }));
		expect(values).toMatchObject({ end: '', duration: '', running: true, endDays: 0 });
	});
	it('copies an entry as a new one', () => {
		const { entry } = setup();
		const e = entry({ start: '2026-10-20T09:00' });
		expect(copyValues(e)).toEqual({
			...valuesFromEntry(e),
			id: null,
			version: '',
			running: false
		});
	});
});

describe('a copy saved as a new entry', () => {
	it('shows a two-zone end in the start zone and saves the same end', () => {
		const { core, entry } = setup();
		const e = entry({
			start: '2026-10-19T09:00',
			end: '2026-10-19T10:00',
			endTimeZone: 'America/New_York'
		});
		const copy = copyValues(e);
		expect(copy).toMatchObject({ end: '16:00', endZone: null, endDays: 0, duration: '7:00' });
		const made = val(core.entries.create(sent(createInput(posted(copy)))));
		expect(made).toMatchObject({ startAt: e.startAt, endAt: e.endAt });
	});
	it('keeps the days of a span across a DST change', () => {
		const { core, entry } = setup();
		const e = entry({ start: '2026-10-24T22:00', end: '2026-10-26T07:00' });
		const copy = copyValues(e);
		expect(copy).toMatchObject({ end: '07:00', endDays: 2, duration: '34:00' });
		const input = sent(createInput(posted(copy)));
		expect(input).toMatchObject({ durationMinutes: 2040 });
		expect(input).not.toHaveProperty('end');
		expect(val(core.entries.create(input)).endAt).toBe(e.endAt);
	});
});

describe('newValues and templateValues', () => {
	it('starts a new entry on the date and zone, with the start when given', () => {
		expect(newValues({ date: '2026-10-19', zone, start: '10:05' })).toEqual({
			id: null,
			version: '',
			date: '2026-10-19',
			start: '10:05',
			end: '',
			duration: '',
			endDays: 0,
			endZone: null,
			timeZone: zone,
			projectId: '',
			activityId: '',
			locationId: '',
			reference: '',
			description: '',
			running: false,
			name: '',
			customerId: ''
		});
		expect(newValues({ date: '2026-10-19', zone }).start).toBe('');
	});
	it('fills every field the template holds', () => {
		const { core, project, activity, location } = setup();
		const t = val(
			core.templates.get({
				id: val(
					core.templates.create({
						name: 'Standup',
						projectId: project.id,
						activityId: activity.id,
						locationId: location.id,
						startTime: '09:00',
						durationMinutes: 15,
						reference: 'MEET',
						description: 'Standup'
					})
				).id
			})
		);
		expect(templateValues(t, newValues({ date: '2026-10-19', zone }))).toMatchObject({
			date: '2026-10-19',
			start: '09:00',
			end: '09:15',
			duration: '0:15',
			endDays: 0,
			projectId: project.id,
			activityId: activity.id,
			locationId: location.id,
			reference: 'MEET',
			description: 'Standup'
		});
	});
	it('fills an end time and its duration, overnight on the next day', () => {
		const { core } = setup();
		const t = val(
			core.templates.get({
				id: val(core.templates.create({ name: 'Night', startTime: '22:00', endTime: '06:00' })).id
			})
		);
		expect(templateValues(t, newValues({ date: '2026-10-19', zone }))).toMatchObject({
			start: '22:00',
			end: '06:00',
			duration: '8:00',
			endDays: 1
		});
	});
	it("leaves the base's values where the template is blank", () => {
		const { core } = setup();
		const t = val(
			core.templates.get({
				id: val(core.templates.create({ name: 'Just a note', description: 'Note' })).id
			})
		);
		const base = {
			...newValues({ date: '2026-10-19', zone, start: '10:05' }),
			projectId: 'p1',
			reference: 'R'
		};
		expect(templateValues(t, base)).toEqual({ ...base, description: 'Note' });
	});
	it("ends a duration-only template from the base's start", () => {
		const { core } = setup();
		const t = val(
			core.templates.get({
				id: val(core.templates.create({ name: 'Half', durationMinutes: 30 })).id
			})
		);
		const base = newValues({ date: '2026-10-19', zone, start: '10:05' });
		expect(templateValues(t, base)).toMatchObject({
			start: '10:05',
			end: '10:35',
			duration: '0:30'
		});
	});
});

describe('previousEnd', () => {
	function day(): Core {
		const { core, entry, customer } = setup();
		entry({ start: '2026-10-19T08:00', end: '2026-10-19T08:50' });
		entry({ start: '2026-10-19T12:00', end: '2026-10-19T12:30' });
		entry({ start: '2026-10-19T17:00', end: '2026-10-19T17:40' });
		const other = val(core.projects.create({ customerId: customer.id, name: 'Other' }));
		val(core.entries.create({ projectId: other.id, start: '2026-10-19T18:00', timeZone: zone }));
		return core;
	}

	it('gives the latest end on the date, ignoring a running entry', () => {
		expect(previousEnd(day(), '2026-10-19', zone, null)).toBe('17:40');
	});
	it('gives the latest end at or before the typed start', () => {
		expect(previousEnd(day(), '2026-10-19', zone, '12:00')).toBe('08:50');
		expect(previousEnd(day(), '2026-10-19', zone, '12:30')).toBe('12:30');
	});
	it('gives null on a day without finished entries', () => {
		expect(previousEnd(day(), '2026-10-18', zone, null)).toBeNull();
		expect(previousEnd(day(), '2026-10-19', zone, '08:00')).toBeNull();
	});
});

describe('formPickers', () => {
	it('offers active rows sorted, plus the current archived ones marked', () => {
		const { core, customer, project, activity, location } = setup();
		const zeta = val(core.customers.create({ name: 'Zeta' }));
		const later = val(core.projects.create({ customerId: zeta.id, name: 'Alpha' }));
		const app = val(core.projects.create({ customerId: customer.id, name: 'App' }));
		const old = val(core.projects.create({ customerId: customer.id, name: 'Old' }));
		val(core.projects.archive({ id: old.id }));
		val(core.activities.archive({ id: activity.id }));
		val(core.templates.create({ name: 'B', projectId: project.id }));
		val(core.templates.create({ name: 'A' }));

		const colours = colourOf(val(core.projects.list({ includeArchived: true })));
		const pickers = formPickers(core, {
			projectId: old.id,
			activityId: activity.id,
			locationId: null
		});
		expect(pickers.projects.map((p) => [p.customerName, p.name, p.archived])).toEqual([
			['Acme', 'App', false],
			['Acme', 'Old', true],
			['Acme', 'Web', false],
			['Zeta', 'Alpha', false]
		]);
		for (const p of pickers.projects) expect(p.colour).toBe(colours.get(p.id));
		expect(pickers.projects.find((p) => p.id === later.id)).toMatchObject({
			customerId: zeta.id,
			customerName: 'Zeta'
		});
		expect(pickers.activities).toEqual([{ id: activity.id, name: 'Dev', archived: true }]);
		expect(pickers.locations).toEqual([{ id: location.id, name: 'Home', archived: false }]);
		expect(pickers.templates.map((t) => t.name)).toEqual(['A', 'B']);
		expect(pickers.templates[1]).toMatchObject({
			label: 'Acme › Web',
			colour: colours.get(project.id),
			projectId: project.id
		});
		expect(pickers.templates[0]).toMatchObject({ label: null, colour: null });
		expect(pickers.projects.some((p) => p.id === app.id)).toBe(true);
	});
	it('leaves archived rows out without a current entry', () => {
		const { core, activity } = setup();
		val(core.activities.archive({ id: activity.id }));
		expect(formPickers(core).activities).toEqual([]);
	});
});

describe('newEntryValues', () => {
	const q = (query: string) => new URLSearchParams(query);
	// NOW is 12:00 on 2026-10-20 in Budapest.

	it('opens on today with no start by default', () => {
		const { core } = setup();
		expect(newEntryValues(core, q(''), zone, NOW)).toEqual(newValues({ date: '2026-10-20', zone }));
	});
	it('reads the date and start forgivingly, dropping what it cannot read', () => {
		const { core } = setup();
		expect(newEntryValues(core, q('date=20261018&start=9'), zone, NOW)).toMatchObject({
			date: '2026-10-18',
			start: '09:00'
		});
		expect(newEntryValues(core, q('date=nope&start=25:99'), zone, NOW)).toMatchObject({
			date: '2026-10-20',
			start: ''
		});
	});
	it('reads an end with the start and fills the duration', () => {
		const { core } = setup();
		expect(
			newEntryValues(core, q('date=2026-10-15&start=16:00&end=17:30'), zone, NOW)
		).toMatchObject({
			start: '16:00',
			end: '17:30',
			duration: '1:30',
			endDays: 0
		});
		expect(newEntryValues(core, q('start=23:00&end=01:00'), zone, NOW)).toMatchObject({
			end: '01:00',
			duration: '2:00',
			endDays: 1
		});
	});
	it('ignores a bad end, and an end without a start', () => {
		const { core } = setup();
		expect(newEntryValues(core, q('start=16:00&end=nope'), zone, NOW)).toMatchObject({
			start: '16:00',
			end: '',
			duration: ''
		});
		expect(newEntryValues(core, q('end=17:00'), zone, NOW)).toMatchObject({ end: '' });
	});
	it('starts a timer now, today in the zone, with no end', () => {
		const { core } = setup();
		expect(newEntryValues(core, q('timer=1&date=2026-10-01&start=8'), zone, NOW)).toMatchObject({
			date: '2026-10-20',
			start: '12:00',
			end: '',
			duration: ''
		});
	});
	it("fills from a template, and in timer mode ignores the template's times", () => {
		const { core, activity } = setup();
		const t = val(
			core.templates.create({
				name: 'Night',
				activityId: activity.id,
				startTime: '22:00',
				endTime: '06:00',
				timeZone: 'Asia/Tokyo',
				description: 'Watch'
			})
		);
		expect(newEntryValues(core, q(`template=${t.id}&date=2026-10-19`), zone, NOW)).toMatchObject({
			date: '2026-10-19',
			start: '22:00',
			end: '06:00',
			endDays: 1,
			activityId: activity.id,
			description: 'Watch'
		});
		expect(newEntryValues(core, q(`template=${t.id}&timer=1`), zone, NOW)).toMatchObject({
			date: '2026-10-20',
			start: '12:00',
			end: '',
			duration: '',
			endDays: 0,
			timeZone: zone,
			activityId: activity.id,
			description: 'Watch'
		});
	});
	it('copies an entry, and gives null for a copy or template that is gone', () => {
		const { core, entry } = setup();
		const e = entry({ start: '2026-10-19T08:00', end: '2026-10-19T09:30', description: 'X' });
		expect(newEntryValues(core, q(`copy=${e.id}`), zone, NOW)).toEqual(copyValues(e));
		expect(newEntryValues(core, q('copy=missing'), zone, NOW)).toBeNull();
		expect(newEntryValues(core, q('template=missing'), zone, NOW)).toBeNull();
	});
});

describe('newEntryZoneFixed', () => {
	it("holds a copy's zone and a template's own zone, not the device's", () => {
		const { core, entry } = setup();
		const e = entry({ start: '2026-10-19T09:00', end: '2026-10-19T10:00' });
		const zoned = val(core.templates.create({ name: 'Zoned', timeZone: 'America/New_York' }));
		const plain = val(core.templates.create({ name: 'Plain' }));
		const q = (s: string) => new URLSearchParams(s);
		expect(newEntryZoneFixed(core, q(`copy=${e.id}`))).toBe(true);
		expect(newEntryZoneFixed(core, q(`template=${zoned.id}`))).toBe(true);
		expect(newEntryZoneFixed(core, q(`template=${plain.id}`))).toBe(false);
		// A timer from a template starts in the device's zone.
		expect(newEntryZoneFixed(core, q(`template=${zoned.id}&timer=1`))).toBe(false);
		expect(newEntryZoneFixed(core, q(''))).toBe(false);
	});
});

describe('previousEndFor', () => {
	const q = (query: string) => new URLSearchParams(query);

	it('reads the query, treating an unreadable before as absent', () => {
		const { core, entry } = setup();
		entry({ start: '2026-10-19T08:00', end: '2026-10-19T08:50' });
		entry({ start: '2026-10-19T12:00', end: '2026-10-19T12:30' });
		const z = encodeURIComponent(zone);
		expect(previousEndFor(core, q(`date=2026-10-19&zone=${z}&before=1200`), NOW)).toBe('08:50');
		expect(previousEndFor(core, q(`date=2026-10-19&zone=${z}&before=nope`), NOW)).toBe('12:30');
		expect(previousEndFor(core, q(`date=2026-10-19&zone=${z}`), NOW)).toBe('12:30');
	});
	it('gives null for an unknown zone or an unreadable date', () => {
		const { core } = setup();
		expect(previousEndFor(core, q('date=2026-10-19&zone=Mars/Base'), NOW)).toBeNull();
		expect(previousEndFor(core, q(`date=nope&zone=${encodeURIComponent(zone)}`), NOW)).toBeNull();
	});
});

describe('the form refusals', () => {
	const posted = form({ date: '2026-10-19', start: 'x', version: '3', projectId: 'p1' });

	it('puts an unread form back with each message beside its field', () => {
		expect(unreadFailure({ start: 'Not a time.' }, posted)).toMatchObject({
			action: 'save',
			fields: { start: 'Not a time.' },
			conflict: false,
			gone: false,
			values: { date: '2026-10-19', start: 'x', version: '3', projectId: 'p1', end: '' }
		});
	});
	it('offers a reload only for a stale form', () => {
		const err = { code: 'conflict' as const, message: 'Changed elsewhere.' };
		expect(coreFailure('save', err, posted, { stale: true })).toMatchObject({
			conflict: true,
			error: 'Changed elsewhere.',
			fields: {}
		});
		expect(coreFailure('save', err, posted)).toMatchObject({ conflict: false });
	});
	it("keeps the core's field errors beside the form's fields, the rest general", () => {
		const err = {
			code: 'invalid' as const,
			message: 'The input is not valid.',
			fields: { durationMinutes: 'Too long.', timeZone: 'Unknown time zone.' }
		};
		expect(coreFailure('save', err, posted)).toMatchObject({
			fields: { duration: 'Too long.' },
			error: 'Unknown time zone.'
		});
	});
	it('keeps the posted back on every refusal, so a page without JavaScript returns there', () => {
		const back = form({ back: '/entries?from=2026-10-01' });
		const err = { code: 'invalid' as const, message: 'No.' };
		expect(unreadFailure({ start: 'x' }, back).back).toBe('/entries?from=2026-10-01');
		for (const action of ['save', 'delete', 'saveAsTemplate'] as const) {
			expect(goneFailure(action, back).back).toBe('/entries?from=2026-10-01');
			expect(coreFailure(action, err, back).back).toBe('/entries?from=2026-10-01');
		}
		expect(coreFailure('save', err, form({ back: '//evil.example' })).back).toBe('/');
	});
	it('marks a vanished entry gone and keeps a typed template name', () => {
		expect(goneFailure('saveAsTemplate', form({ name: 'Mine' }))).toMatchObject({
			action: 'saveAsTemplate',
			gone: true,
			error: 'This entry was deleted elsewhere.',
			values: { name: 'Mine' }
		});
	});
});
