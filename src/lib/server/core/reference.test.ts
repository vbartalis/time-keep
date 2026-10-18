import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { batch, change, customer as customerTable, user } from '../db/schema';
import { newId } from '../id';
import { runBatch } from './batch';
import {
	archive,
	createActivity,
	createCustomer,
	createLocation,
	createProject,
	listActivities,
	listCustomers,
	listLocations,
	listProjects,
	rename,
	unarchive
} from './reference';
import type { Result } from './result';

function setup() {
	const db = createTestDb();
	const mkUser = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const userId = mkUser('u');
	const other = mkUser('o');
	let clock = 1000;
	const run = <T>(fn: Parameters<typeof runBatch<T>>[4], uid = userId): Result<T> =>
		runBatch(db, uid, 'ui', 'test', fn, clock++);
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(JSON.stringify(r.error));
		return r.value;
	};
	const counts = () => ({
		batches: db.select().from(batch).all().length,
		changes: db.select().from(change).all().length
	});
	const customer = (name: string, uid = userId) =>
		val(run((w) => createCustomer(w, { name }), uid)) as { id: string; version: number };
	return { db, userId, other, run, val, counts, customer };
}

const err = <T>(r: Result<T>) => (r.ok ? null : r.error);

describe('create', () => {
	it('creates customer, activity and location rows', () => {
		const { run, val } = setup();
		const c = val(run((w) => createCustomer(w, { name: '  Acme ' })));
		expect(c).toMatchObject({ name: 'Acme', nameKey: 'acme', version: 1, archivedAt: null });
		expect(val(run((w) => createActivity(w, { name: 'Dev' }))).name).toBe('Dev');
		expect(val(run((w) => createLocation(w, { name: 'Home' }))).name).toBe('Home');
	});

	it('rejects an empty or too long name as invalid', () => {
		const { run } = setup();
		expect(err(run((w) => createCustomer(w, { name: '   ' })))).toMatchObject({
			code: 'invalid',
			fields: { name: 'Name must be 1–100 characters.' }
		});
		expect(err(run((w) => createActivity(w, { name: 'x'.repeat(101) })))?.code).toBe('invalid');
		expect(err(run((w) => createLocation(w, null)))?.code).toBe('invalid');
	});

	it('rejects a case-insensitive duplicate with the kind message', () => {
		const { run, counts } = setup();
		run((w) => createCustomer(w, { name: 'Ügyfél' }));
		const before = counts();
		const e = err(run((w) => createCustomer(w, { name: 'ügyfél' })));
		expect(e).toMatchObject({
			code: 'conflict',
			fields: { name: 'A customer with this name already exists.' }
		});
		expect(err(run((w) => createCustomer(w, { name: ' Ügyfél ' })))?.code).toBe('conflict');
		expect(counts()).toEqual(before);
		run((w) => createActivity(w, { name: 'Dev' }));
		expect(err(run((w) => createActivity(w, { name: 'DEV' })))?.fields?.name).toBe(
			'An activity with this name already exists.'
		);
		run((w) => createLocation(w, { name: 'Home' }));
		expect(err(run((w) => createLocation(w, { name: 'home' })))?.fields?.name).toBe(
			'A location with this name already exists.'
		);
	});

	it('lets two users use the same name', () => {
		const { run, other } = setup();
		run((w) => createCustomer(w, { name: 'A' }));
		expect(run((w) => createCustomer(w, { name: 'A' }), other).ok).toBe(true);
	});

	it('an archived name still blocks a new one', () => {
		const { run, val, customer } = setup();
		const c = customer('A');
		val(run((w) => archive(w, 'customer', { id: c.id })));
		expect(err(run((w) => createCustomer(w, { name: 'a' })))?.code).toBe('conflict');
	});
});

describe('createProject', () => {
	it('creates under an active customer', () => {
		const { run, val, customer } = setup();
		const c = customer('A');
		const p = val(run((w) => createProject(w, { customerId: c.id, name: 'P' })));
		expect(p).toMatchObject({ name: 'P', customerId: c.id, version: 1 });
	});

	it('allows one project name under two customers but not twice under one', () => {
		const { run, customer } = setup();
		const a = customer('A');
		const b = customer('B');
		expect(run((w) => createProject(w, { customerId: a.id, name: 'P' })).ok).toBe(true);
		expect(run((w) => createProject(w, { customerId: b.id, name: 'P' })).ok).toBe(true);
		expect(err(run((w) => createProject(w, { customerId: a.id, name: 'p' })))).toMatchObject({
			code: 'conflict',
			fields: { name: 'A project with this name already exists.' }
		});
	});

	it('unknown or other user customer is not_found', () => {
		const { run, other, customer } = setup();
		const theirs = customer('T', other);
		expect(err(run((w) => createProject(w, { customerId: 'nope', name: 'P' })))?.code).toBe(
			'not_found'
		);
		expect(err(run((w) => createProject(w, { customerId: theirs.id, name: 'P' })))?.code).toBe(
			'not_found'
		);
	});

	it('archived customer is archived', () => {
		const { run, val, customer, counts } = setup();
		const c = customer('A');
		val(run((w) => archive(w, 'customer', { id: c.id })));
		const before = counts();
		expect(err(run((w) => createProject(w, { customerId: c.id, name: 'P' })))).toMatchObject({
			code: 'archived',
			message: 'The customer is archived.'
		});
		expect(counts()).toEqual(before);
	});

	it('rejects invalid input', () => {
		const { run } = setup();
		expect(err(run((w) => createProject(w, { name: 'P' })))?.code).toBe('invalid');
	});
});

describe('rename', () => {
	it('renames, raises the version and refreshes the key', () => {
		const { run, val, customer } = setup();
		const c = customer('A');
		const r = val(
			run((w) => rename(w, 'customer', { id: c.id, name: 'Béla', expectedVersion: 1 }))
		);
		expect(r).toMatchObject({ name: 'Béla', nameKey: 'béla', version: 2 });
	});

	it('renaming to the same name stores no batch', () => {
		const { run, val, customer, counts } = setup();
		const c = customer('A');
		const before = counts();
		const r = val(run((w) => rename(w, 'customer', { id: c.id, name: ' A ' })));
		expect(r).toMatchObject({ name: 'A', version: 1 });
		expect(counts()).toEqual(before);
	});

	it('case-only rename is allowed', () => {
		const { run, val, customer } = setup();
		const c = customer('a');
		expect(val(run((w) => rename(w, 'customer', { id: c.id, name: 'A' }))).name).toBe('A');
	});

	it('duplicate is conflict; project duplicates are per customer', () => {
		const { run, customer } = setup();
		const a = customer('A');
		const b = customer('B');
		expect(err(run((w) => rename(w, 'customer', { id: b.id, name: 'a' })))?.fields?.name).toBe(
			'A customer with this name already exists.'
		);
		const p1 = run((w) => createProject(w, { customerId: a.id, name: 'P1' }));
		const p2 = run((w) => createProject(w, { customerId: a.id, name: 'P2' }));
		const p3 = run((w) => createProject(w, { customerId: b.id, name: 'P1' }));
		if (!p1.ok || !p2.ok || !p3.ok) throw new Error('setup');
		expect(
			err(run((w) => rename(w, 'project', { id: p2.value.id as string, name: 'p1' })))?.code
		).toBe('conflict');
		expect(run((w) => rename(w, 'project', { id: p3.value.id as string, name: 'P2' })).ok).toBe(
			true
		);
	});

	it('unknown or other user id is not_found', () => {
		const { run, other, customer } = setup();
		const theirs = customer('T', other);
		for (const kind of ['customer', 'project', 'activity', 'location'] as const) {
			expect(err(run((w) => rename(w, kind, { id: 'nope', name: 'X' })))?.code).toBe('not_found');
		}
		expect(err(run((w) => rename(w, 'customer', { id: theirs.id, name: 'X' })))?.code).toBe(
			'not_found'
		);
	});

	it('stale expectedVersion is a conflict and writes nothing', () => {
		const { run, val, customer, counts } = setup();
		const c = customer('A');
		val(run((w) => rename(w, 'customer', { id: c.id, name: 'B' })));
		const before = counts();
		const e = err(run((w) => rename(w, 'customer', { id: c.id, name: 'C', expectedVersion: 1 })));
		expect(e).toMatchObject({
			code: 'conflict',
			message: 'This was changed elsewhere; reload and try again.'
		});
		expect(counts()).toEqual(before);
		expect(err(run((w) => archive(w, 'customer', { id: c.id, expectedVersion: 1 })))?.code).toBe(
			'conflict'
		);
	});

	it('invalid name is invalid', () => {
		const { run, customer } = setup();
		const c = customer('A');
		expect(err(run((w) => rename(w, 'customer', { id: c.id, name: '' })))?.code).toBe('invalid');
	});
});

describe('archive and unarchive', () => {
	it('archives and unarchives, recording each', () => {
		const { run, val, customer, db } = setup();
		const c = customer('A');
		const a = val(run((w) => archive(w, 'customer', { id: c.id, expectedVersion: 1 })));
		expect(a.archivedAt).not.toBeNull();
		expect(a.version).toBe(2);
		const u = val(run((w) => unarchive(w, 'customer', { id: c.id })));
		expect(u.archivedAt).toBeNull();
		expect(u.version).toBe(3);
		const ops = db
			.select()
			.from(change)
			.all()
			.map((x) => x.op);
		expect(ops).toEqual(['create', 'archive', 'unarchive']);
	});

	it('archiving an archived row and unarchiving an active one is a no-op', () => {
		const { run, val, customer, counts } = setup();
		const c = customer('A');
		const un = val(run((w) => unarchive(w, 'customer', { id: c.id })));
		expect(un.version).toBe(1);
		val(run((w) => archive(w, 'customer', { id: c.id })));
		const before = counts();
		const again = val(run((w) => archive(w, 'customer', { id: c.id })));
		expect(again.version).toBe(2);
		expect(counts()).toEqual(before);
	});

	it('unknown id is not_found', () => {
		const { run } = setup();
		expect(err(run((w) => archive(w, 'activity', { id: 'x' })))?.code).toBe('not_found');
		expect(err(run((w) => unarchive(w, 'location', { id: 'x' })))?.code).toBe('not_found');
	});

	it('unarchiving a project under an archived customer is archived', () => {
		const { run, val, customer } = setup();
		const c = customer('A');
		const p = val(run((w) => createProject(w, { customerId: c.id, name: 'P' })));
		val(run((w) => archive(w, 'project', { id: p.id as string })));
		val(run((w) => archive(w, 'customer', { id: c.id })));
		expect(err(run((w) => unarchive(w, 'project', { id: p.id as string })))).toMatchObject({
			code: 'archived',
			message: 'The customer is archived.'
		});
		val(run((w) => unarchive(w, 'customer', { id: c.id })));
		expect(run((w) => unarchive(w, 'project', { id: p.id as string })).ok).toBe(true);
	});

	it('an active project under an archived customer cannot be renamed but can be archived', () => {
		const { run, val, customer, db } = setup();
		const c = customer('A');
		const p = val(run((w) => createProject(w, { customerId: c.id, name: 'P' })));
		// Archive the customer directly, leaving the project active.
		db.update(customerTable).set({ archivedAt: 5 }).where(eq(customerTable.id, c.id)).run();
		expect(err(run((w) => rename(w, 'project', { id: p.id as string, name: 'Q' })))).toMatchObject({
			code: 'archived',
			message: 'The customer is archived.'
		});
		expect(run((w) => archive(w, 'project', { id: p.id as string })).ok).toBe(true);
	});

	it('a project under an archived customer can still be archived', () => {
		const { run, val, customer } = setup();
		const c = customer('A');
		const p = val(run((w) => createProject(w, { customerId: c.id, name: 'P' })));
		val(run((w) => archive(w, 'customer', { id: c.id })));
		expect(run((w) => archive(w, 'project', { id: p.id as string })).ok).toBe(true);
	});
});

describe('lists', () => {
	it('sorts by name and hides archived rows by default', () => {
		const { db, userId, run, val } = setup();
		const names = ['banán', 'Ábel', 'alma', 'Cseresznye'];
		for (const n of names) val(run((w) => createActivity(w, { name: n })));
		const all = val(listActivities(db, userId));
		expect(all.map((a) => a.name)).toEqual(['Ábel', 'alma', 'banán', 'Cseresznye']);
		val(run((w) => archive(w, 'activity', { id: all[0].id })));
		expect(val(listActivities(db, userId)).length).toBe(3);
		expect(val(listActivities(db, userId, { includeArchived: true })).length).toBe(4);
	});

	it('lists customers and locations for the user only', () => {
		const { db, userId, other, run, val } = setup();
		run((w) => createCustomer(w, { name: 'B' }));
		run((w) => createCustomer(w, { name: 'A' }));
		run((w) => createLocation(w, { name: 'L' }));
		run((w) => createCustomer(w, { name: 'Z' }), other);
		expect(val(listCustomers(db, userId)).map((c) => c.name)).toEqual(['A', 'B']);
		expect(val(listLocations(db, userId)).map((c) => c.name)).toEqual(['L']);
		expect(val(listCustomers(db, other)).map((c) => c.name)).toEqual(['Z']);
	});

	it('lists projects with customer names, filtered and hiding archived customers', () => {
		const { db, userId, run, val, customer } = setup();
		const a = customer('Acme');
		const b = customer('Beta');
		const pa = val(run((w) => createProject(w, { customerId: a.id, name: 'Web' })));
		val(run((w) => createProject(w, { customerId: a.id, name: 'App' })));
		val(run((w) => createProject(w, { customerId: b.id, name: 'Web' })));
		let rows = val(listProjects(db, userId));
		expect(rows.map((r) => [r.customerName, r.name])).toEqual([
			['Acme', 'App'],
			['Acme', 'Web'],
			['Beta', 'Web']
		]);
		expect(val(listProjects(db, userId, { customerId: b.id })).length).toBe(1);
		val(run((w) => archive(w, 'project', { id: pa.id as string })));
		expect(val(listProjects(db, userId)).length).toBe(2);
		val(run((w) => archive(w, 'customer', { id: b.id })));
		rows = val(listProjects(db, userId));
		expect(rows.map((r) => r.name)).toEqual(['App']);
		rows = val(listProjects(db, userId, { includeArchived: true }));
		expect(rows.length).toBe(3);
	});

	it('sorts by name, ignoring case and accents, with numbers in order', () => {
		const { db, userId, run, val, customer } = setup();
		for (const n of ['Zsolt', 'Ádám', 'Béla', 'x10', 'x2'])
			val(run((w) => createActivity(w, { name: n })));
		expect(val(listActivities(db, userId)).map((a) => a.name)).toEqual([
			'Ádám',
			'Béla',
			'x2',
			'x10',
			'Zsolt'
		]);
		const z = customer('Zsolt');
		const a = customer('Ádám');
		val(run((w) => createProject(w, { customerId: z.id, name: 'A' })));
		val(run((w) => createProject(w, { customerId: a.id, name: 'Ö' })));
		val(run((w) => createProject(w, { customerId: a.id, name: 'Z' })));
		expect(val(listProjects(db, userId)).map((r) => [r.customerName, r.name])).toEqual([
			['Ádám', 'Ö'],
			['Ádám', 'Z'],
			['Zsolt', 'A']
		]);
	});

	it('rejects invalid list input', () => {
		const { db, userId } = setup();
		expect(err(listProjects(db, userId, { customerId: 5 }))?.code).toBe('invalid');
	});
});
