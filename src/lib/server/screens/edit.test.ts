import { describe, expect, it } from 'vitest';
import { newId } from '../id';
import { user } from '../db/schema';
import { createTestDb } from '../testing/db';
import { openCore } from '../core/index';
import { editInput, postedValues, withCurrent } from './edit';

const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};

const zone = 'Europe/Budapest';
// 2026-10-18 09:00:37 and 17:30 in Budapest (UTC+2).
const finished = {
	startAt: Date.parse('2026-10-18T07:00:37Z'),
	startZone: zone,
	endAt: Date.parse('2026-10-18T15:30:00Z'),
	endZone: 'Europe/London'
};
const running = { ...finished, endAt: null, endZone: null };

const unchanged = {
	version: '3',
	start: '2026-10-18T09:00',
	end: '2026-10-18T16:30',
	projectId: 'p1',
	activityId: 'a1',
	locationId: '',
	reference: 'WEB-1',
	description: 'Fixed the build'
};

describe('editInput', () => {
	it('sends the version, the pickers and the text, and leaves unchanged times out', () => {
		expect(editInput(form(unchanged), 'e1', finished)).toEqual({
			id: 'e1',
			expectedVersion: 3,
			timeZone: zone,
			projectId: 'p1',
			activityId: 'a1',
			locationId: null,
			reference: 'WEB-1',
			description: 'Fixed the build'
		});
	});
	it('trims the text and clears blank text and pickers', () => {
		const input = editInput(
			form({ ...unchanged, activityId: '', reference: ' ', description: '  Call  ' }),
			'e1',
			finished
		);
		expect(input).toMatchObject({ activityId: null, reference: null, description: 'Call' });
	});
	it('sends a changed start as a local time in the start zone', () => {
		const input = editInput(form({ ...unchanged, start: '2026-10-18T08:15' }), 'e1', finished);
		expect(input).toMatchObject({ start: '2026-10-18T08:15', timeZone: zone });
		expect(input).not.toHaveProperty('end');
	});
	it('sends a changed end with the end zone', () => {
		const input = editInput(form({ ...unchanged, end: '2026-10-18T17:00' }), 'e1', finished);
		expect(input).toMatchObject({ end: '2026-10-18T17:00', endTimeZone: 'Europe/London' });
		expect(input).not.toHaveProperty('start');
	});
	it('makes a finished entry running when the end is cleared', () => {
		const input = editInput(form({ ...unchanged, end: '' }), 'e1', finished);
		expect(input.end).toBeNull();
		expect(input).not.toHaveProperty('endTimeZone');
	});
	it('leaves a running entry running when the end stays blank', () => {
		const input = editInput(
			form({ ...unchanged, start: '2026-10-18T09:00', end: '' }),
			'e1',
			running
		);
		expect(input).not.toHaveProperty('end');
		expect(input).not.toHaveProperty('endTimeZone');
	});
	it('ends a running entry in its start zone', () => {
		const input = editInput(form({ ...unchanged, end: '2026-10-18T12:00' }), 'e1', running);
		expect(input).toMatchObject({ end: '2026-10-18T12:00', endTimeZone: zone });
	});
	it('sends a blank start for the core to refuse beside the field', () => {
		expect(editInput(form({ ...unchanged, start: '' }), 'e1', finished).start).toBe('');
	});
	it('passes a version that is not a whole number on for the core to refuse', () => {
		expect(editInput(form({ ...unchanged, version: 'x' }), 'e1', finished).expectedVersion).toBe(
			'x'
		);
	});
	it('sends an empty project for the core to refuse', () => {
		expect(editInput(form({ ...unchanged, projectId: '' }), 'e1', finished).projectId).toBe('');
	});
});

describe('withCurrent', () => {
	const active = [
		{ id: 'a', name: 'Alpha' },
		{ id: 'b', name: 'Beta' }
	];
	const all = [...active, { id: 'z', name: 'Zeta' }];

	it('keeps the active list when the current one is in it or there is none', () => {
		expect(withCurrent(active, all, 'a')).toEqual([
			{ id: 'a', name: 'Alpha', archived: false },
			{ id: 'b', name: 'Beta', archived: false }
		]);
		expect(withCurrent(active, all, null)).toHaveLength(2);
	});
	it('adds the current archived one, marked', () => {
		expect(withCurrent(active, all, 'z')).toEqual([
			{ id: 'a', name: 'Alpha', archived: false },
			{ id: 'b', name: 'Beta', archived: false },
			{ id: 'z', name: 'Zeta', archived: true }
		]);
	});
	it('ignores a current id that is nowhere', () => {
		expect(withCurrent(active, all, 'gone')).toHaveLength(2);
	});
});

describe('editInput against the core', () => {
	function setup() {
		const db = createTestDb();
		const id = newId();
		db.insert(user)
			.values({ id, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
			.run();
		const c = openCore(db, id, 'ui', () => Date.UTC(2027, 0, 1));
		const val = <T>(r: { ok: boolean; value?: T }) => {
			if (!r.ok) throw new Error('expected ok');
			return r.value as T;
		};
		const customer = val(c.customers.create({ name: 'Acme' }));
		const project = val(c.projects.create({ customerId: customer.id, name: 'Web' }));
		const activity = val(c.activities.create({ name: 'Dev' }));
		const location = val(c.locations.create({ name: 'Home' }));
		const entry = val(
			c.entries.create({
				projectId: project.id,
				activityId: activity.id,
				locationId: location.id,
				start: '2026-10-18T09:00:37',
				end: '2026-10-18T10:00',
				timeZone: zone
			})
		);
		return { c, project, activity, location, entry, val };
	}
	const posted = (e: {
		version: number;
		projectId: string;
		activityId: string | null;
		locationId: string | null;
	}) => ({
		version: String(e.version),
		start: '2026-10-18T09:00',
		end: '2026-10-18T10:00',
		projectId: e.projectId,
		activityId: e.activityId ?? '',
		locationId: e.locationId ?? '',
		reference: '',
		description: 'Edited'
	});

	it('saves an entry whose project, activity and location are archived, keeping them', () => {
		const { c, project, activity, location, entry, val } = setup();
		c.projects.archive({ id: project.id });
		c.activities.archive({ id: activity.id });
		c.locations.archive({ id: location.id });
		const input = editInput(form(posted(entry)), entry.id, entry);
		const saved = val(c.entries.update(input));
		expect(saved).toMatchObject({
			projectId: project.id,
			activityId: activity.id,
			locationId: location.id,
			description: 'Edited',
			startAt: entry.startAt
		});
	});
	it('offers the archived ones as selected options', () => {
		const { c, project, entry, val } = setup();
		c.projects.archive({ id: project.id });
		const all = val(c.projects.list({ includeArchived: true }));
		const options = withCurrent(val(c.projects.list()), all, entry.projectId);
		expect(options).toEqual([expect.objectContaining({ id: project.id, archived: true })]);
	});
	it('refuses a stale version with the conflict message for the reload link', () => {
		const { c, entry, val } = setup();
		val(c.entries.update({ id: entry.id, description: 'Elsewhere' }));
		const r = c.entries.update(editInput(form(posted(entry)), entry.id, entry));
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('conflict');
			expect(r.error.message).toBe('This was changed elsewhere; reload and try again.');
		}
	});
});

describe('postedValues', () => {
	it('echoes the posted version with the named fields, so a refused form keeps its version', () => {
		const values = postedValues(form({ ...unchanged, version: '3' }), ['start', 'description']);
		expect(values).toEqual({
			version: '3',
			start: '2026-10-18T09:00',
			description: 'Fixed the build'
		});
	});
	it('uses empty text for what was not posted', () => {
		expect(postedValues(form({}), ['end'])).toEqual({ version: '', end: '' });
	});
});
