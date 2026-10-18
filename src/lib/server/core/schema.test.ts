import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { customer, project } from '../db/schema';
import { newId } from '../id';
import { user } from '../db/schema';

function setup() {
	const db = createTestDb();
	const mk = (username: string) => {
		const id = newId();
		db.insert(user).values({ id, username, passwordHash: 'x', createdAt: 1, updatedAt: 1 }).run();
		return id;
	};
	const row = (userId: string, name: string, nameKey = name.toLowerCase()) => ({
		id: newId(),
		userId,
		name,
		nameKey,
		version: 1,
		createdAt: 1,
		updatedAt: 1
	});
	return { db, mk, row };
}

describe('core tables', () => {
	it('creates the six tables', () => {
		const { db } = setup();
		const names = db.$client
			.prepare("select name from sqlite_master where type = 'table'")
			.all()
			.map((r) => (r as { name: string }).name);
		for (const t of ['batch', 'change', 'customer', 'project', 'activity', 'location']) {
			expect(names).toContain(t);
		}
	});

	it('rejects a duplicate customer name_key for one user', () => {
		const { db, mk, row } = setup();
		const u = mk('a');
		db.insert(customer).values(row(u, 'Acme')).run();
		expect(() =>
			db
				.insert(customer)
				.values(row(u, 'ACME', 'acme'))
				.run()
		).toThrow();
	});

	it('allows the same customer name_key for two users', () => {
		const { db, mk, row } = setup();
		db.insert(customer)
			.values(row(mk('a'), 'Acme'))
			.run();
		expect(() =>
			db
				.insert(customer)
				.values(row(mk('b'), 'Acme'))
				.run()
		).not.toThrow();
	});

	it('scopes project name_key to the customer', () => {
		const { db, mk, row } = setup();
		const u = mk('a');
		const c1 = row(u, 'C1');
		const c2 = row(u, 'C2');
		db.insert(customer).values([c1, c2]).run();
		db.insert(project)
			.values({ ...row(u, 'P'), customerId: c1.id })
			.run();
		expect(() =>
			db
				.insert(project)
				.values({ ...row(u, 'p'), customerId: c1.id })
				.run()
		).toThrow();
		expect(() =>
			db
				.insert(project)
				.values({ ...row(u, 'P'), customerId: c2.id })
				.run()
		).not.toThrow();
	});

	it('rejects a project with an unknown customer_id', () => {
		const { db, mk, row } = setup();
		expect(() =>
			db
				.insert(project)
				.values({ ...row(mk('a'), 'P'), customerId: newId() })
				.run()
		).toThrow();
	});
});
