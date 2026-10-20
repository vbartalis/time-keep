import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { localParts } from '../src/lib/server/core/time';
import { activity, customer, entry, location, project, template } from '../src/lib/server/db/schema';
import { createTestDb } from '../src/lib/server/testing/db';
import { createUser } from '../src/lib/server/users';
import { seedMonth } from './seed-month';

const ZONE = 'Europe/Budapest';
const TODAY = '2026-10-19';

async function setup() {
	const db = createTestDb();
	const make = async (username: string) => {
		const r = await createUser(db, { username, password: 'seed-password-1', isAdmin: false });
		if (!r.ok) throw new Error(r.error);
		return r.value.id;
	};
	return { db, make };
}

const rowsOf = (db: ReturnType<typeof createTestDb>, userId: string) => ({
	customers: db.select().from(customer).where(eq(customer.userId, userId)).all(),
	projects: db.select().from(project).where(eq(project.userId, userId)).all(),
	activities: db.select().from(activity).where(eq(activity.userId, userId)).all(),
	locations: db.select().from(location).where(eq(location.userId, userId)).all(),
	templates: db.select().from(template).where(eq(template.userId, userId)).all(),
	entries: db.select().from(entry).where(eq(entry.userId, userId)).all()
});

describe('seedMonth', () => {
	it('fills a realistic month with no entry on or after today', async () => {
		const { db, make } = await setup();
		const id = await make('user-a');
		const { entries } = seedMonth(db, id, { today: TODAY, zone: ZONE });
		const rows = rowsOf(db, id).entries;
		expect(entries).toBeGreaterThanOrEqual(60);
		expect(rows).toHaveLength(entries);
		for (const r of rows) expect(localParts(r.startAt, ZONE).date < TODAY).toBe(true);
	});

	it('includes an overnight entry, an overlapping pair and ticket references', async () => {
		const { db, make } = await setup();
		const id = await make('user-a');
		seedMonth(db, id, { today: TODAY, zone: ZONE });
		const rows = rowsOf(db, id).entries;
		expect(
			rows.some(
				(r) =>
					r.endAt !== null && localParts(r.startAt, ZONE).date !== localParts(r.endAt, ZONE).date
			)
		).toBe(true);
		const overlaps = rows.some((a) =>
			rows.some(
				(b) =>
					a.id !== b.id &&
					a.endAt !== null &&
					b.endAt !== null &&
					a.startAt < b.endAt &&
					b.startAt < a.endAt
			)
		);
		expect(overlaps).toBe(true);
		expect(rows.some((r) => /^T-\d+$/.test(r.reference ?? ''))).toBe(true);
	});

	it.each(['2026-10-20', '2026-10-19'])(
		'puts last week\'s late entry and overlap in place when today is %s',
		async (today) => {
			const { db, make } = await setup();
			const id = await make('user-a');
			seedMonth(db, id, { today, zone: ZONE });
			const rows = rowsOf(db, id).entries;
			const local = (at: number) => localParts(at, ZONE);
			const tuesday = '2026-10-13';
			const wednesday = '2026-10-14';
			const thursday = '2026-10-15';

			const crossing = rows.find(
				(r) =>
					r.endAt !== null &&
					local(r.startAt).date === tuesday &&
					local(r.startAt).time === '23:00' &&
					local(r.endAt).date === wednesday &&
					local(r.endAt).time === '01:00'
			);
			expect(crossing).toBeDefined();

			const late = rows.find(
				(r) =>
					r.endAt !== null &&
					local(r.startAt).date === wednesday &&
					local(r.startAt).time === '10:30' &&
					local(r.endAt).time === '11:30'
			);
			expect(late).toBeDefined();
			const dev = rows.find(
				(r) =>
					r.id !== late!.id &&
					r.endAt !== null &&
					local(r.startAt).date === wednesday &&
					local(r.startAt).time === '10:00'
			);
			expect(dev).toBeDefined();
			expect(dev!.startAt < late!.endAt! && late!.startAt < dev!.endAt!).toBe(true);

			const afternoon = rows.filter((r) => {
				if (local(r.startAt).date !== thursday) return false;
				const s = local(r.startAt).time;
				const e = r.endAt === null ? s : local(r.endAt).time;
				return s < '19:30' && e > '16:00';
			});
			expect(afternoon).toEqual([]);
		}
	);

	it('creates exactly the listed customers, projects, activities, locations and templates', async () => {
		const { db, make } = await setup();
		const id = await make('user-a');
		seedMonth(db, id, { today: TODAY, zone: ZONE });
		const r = rowsOf(db, id);
		const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort();
		expect(names(r.customers)).toEqual(['CompX', 'Myself']);
		expect(names(r.projects)).toEqual(['ClientY – ProjectZ', 'CompY – Support', 'time-keep']);
		expect(names(r.activities)).toEqual(['Development', 'Meeting', 'Research', 'Support ticket']);
		expect(names(r.locations)).toEqual(['At the client', 'Café', 'Home office', 'Office']);
		expect(names(r.templates)).toEqual(['Standup', 'Ticket']);
		const standup = r.templates.find((t) => t.name === 'Standup');
		const ticket = r.templates.find((t) => t.name === 'Ticket');
		expect(standup).toMatchObject({ startTime: '09:30', endTime: '09:45' });
		expect(ticket).toMatchObject({ durationMinutes: 30, endTime: null });
	});

	it('is deterministic', async () => {
		const { db, make } = await setup();
		const a = await make('user-a');
		const b = await make('user-b');
		seedMonth(db, a, { today: TODAY, zone: ZONE });
		seedMonth(db, b, { today: TODAY, zone: ZONE });
		const key = (id: string) =>
			rowsOf(db, id).entries.map((e) => [e.startAt, e.endAt, e.reference, e.description]);
		expect(key(b)).toEqual(key(a));
	});

	it('leaves another user untouched when a second is seeded', async () => {
		const { db, make } = await setup();
		const a = await make('user-a');
		const b = await make('user-b');
		seedMonth(db, a, { today: TODAY, zone: ZONE });
		const before = rowsOf(db, a);
		seedMonth(db, b, { today: TODAY, zone: ZONE });
		expect(rowsOf(db, a)).toEqual(before);
		expect(rowsOf(db, b).entries.length).toBe(before.entries.length);
	});
});
