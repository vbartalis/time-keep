/**
 * Seeds the browser tests' data straight through the core, on a second SQLite
 * connection to the database the test server created and migrated.
 */
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openCore, type Result } from '../src/lib/server/core/index';
import { openDb, type DB } from '../src/lib/server/db/index';
import { createUser } from '../src/lib/server/users';

/** The database `playwright.config.ts` hands the test server. */
const DB_PATH = fileURLToPath(new URL('../test-results/e2e/time-keep.db', import.meta.url));

export const PASSWORD = 'phone-password-1';

/**
 * A fixed-offset zone where it is about noon now, so the seeded morning entries are
 * today and in the past whenever the suite runs. `Etc/GMT-2` is UTC+2. Never the
 * zero-offset zone, which Chromium shows under another name: at 12:xx UTC it is
 * `Etc/GMT-1` (about 13:00, still after the morning entries).
 */
export function noonZone(now = new Date()): string {
	const offset = 12 - now.getUTCHours() || 1;
	return offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

/** Today's date in `zone`, as `YYYY-MM-DD`. */
export const dateIn = (zone: string, now = new Date()) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);

let db: DB | undefined;
const database = () => (db ??= openDb(DB_PATH));

const value = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(`seed refused: ${JSON.stringify(r.error)}`);
	return r.value;
};

/** A user who can sign in, with a name no earlier run of this worker took. */
async function newUser(prefix: string) {
	const username = `${prefix}-${randomBytes(4).toString('hex')}`;
	const r = await createUser(database(), { username, password: PASSWORD, isAdmin: false });
	if (!r.ok) throw new Error(`seed refused: ${r.error}`);
	return { id: r.value.id, username };
}

export type Seeded = Awaited<ReturnType<typeof seedUser>>;

/**
 * A user with two customers, four projects, templates and three finished entries this
 * morning (in `zone`): one to edit, one to delete, one for a template to overlap.
 */
export async function seedUser(prefix: string, zone: string) {
	const user = await newUser(prefix);
	const core = openCore(database(), user.id, 'system');
	const today = dateIn(zone);

	const acme = value(core.customers.create({ name: 'Acme' }));
	const north = value(core.customers.create({ name: 'Northwind' }));
	const project = (customerId: string, name: string) =>
		value(core.projects.create({ customerId, name })).id;
	const website = project(acme.id, 'Website');
	const operations = project(acme.id, 'Operations');
	const mobile = project(north.id, 'Mobile app');
	const support = project(north.id, 'Support');

	const template = (
		name: string,
		customerId: string,
		projectId: string,
		startTime: string,
		endTime: string
	) => value(core.templates.create({ name, customerId, projectId, startTime, endTime })).id;
	template('Standup', acme.id, website, '10:00', '10:15');
	template('Review', acme.id, operations, '10:30', '10:45');
	template('Support call', north.id, support, '08:30', '08:45');

	const entry = (projectId: string, start: string, end: string, description: string) =>
		value(
			core.entries.create({
				projectId,
				start: `${today}T${start}`,
				end: `${today}T${end}`,
				timeZone: zone,
				description
			})
		).id;

	return {
		...user,
		today,
		projects: { website, operations, mobile, support },
		entries: {
			toEdit: entry(website, '06:00', '06:30', 'Sorted the inbox'),
			toDelete: entry(operations, '07:00', '07:30', 'Filed the receipts'),
			morning: entry(support, '08:00', '09:00', 'Morning support')
		}
	};
}

/** A user with nothing set up. */
export const seedEmptyUser = (prefix: string) => newUser(prefix);

/** Changes an entry's description the way another device would. */
export function editElsewhere(userId: string, entryId: string, description: string) {
	value(openCore(database(), userId, 'ui').entries.update({ id: entryId, description }));
}

const asUi = (userId: string) => openCore(database(), userId, 'ui');

/** A customer, created for `userId` straight through the core. */
export const seedCustomer = (userId: string, name: string) =>
	value(asUi(userId).customers.create({ name })).id;

/** A project under `customerId`. */
export const seedProject = (userId: string, customerId: string, name: string) =>
	value(asUi(userId).projects.create({ customerId, name })).id;

/** A template on a customer and project, with a start and an end. */
export const seedTemplate = (
	userId: string,
	input: { name: string; customerId: string; projectId: string; description?: string }
) => value(asUi(userId).templates.create({ ...input, startTime: '09:00', endTime: '09:30' })).id;

export type Kind = 'customers' | 'projects' | 'activities' | 'locations';

/** Renames a row the way another device would, which bumps its version. */
export function renameElsewhere(userId: string, kind: Kind, id: string, name: string) {
	value(asUi(userId)[kind].rename({ id, name }));
}

/** Archives a row the way another device would. */
export function archiveElsewhere(userId: string, kind: Kind, id: string) {
	value(asUi(userId)[kind].archive({ id }));
}

/** Day `day` of `today`'s month, as `YYYY-MM-DD`. */
const dayOf = (today: string, day: number) => `${today.slice(0, 8)}${String(day).padStart(2, '0')}`;

/**
 * A user with five finished entries across this month (in `zone`) and one last month,
 * with activities, locations, references and descriptions to find them by:
 *
 * | day | in–out      | project                | activity    | location | ref   | description                |
 * | 02  | 09:00–10:30 | Acme › Website         | Development | Office   | T-101 | Fixed the login form       |
 * | 03  | 09:00–11:00 | Acme › Website         | Meeting     | Home     |       | Planned the release        |
 * | 06  | 13:00–15:00 | Acme › Operations      |             | Office   |       | Filed the receipts         |
 * | 09  | 08:00–09:00 | Northwind › Mobile app | Development |          | M-7   | Built the login screen     |
 * | 13  | 10:00–12:00 | Northwind › Mobile app |             | Home     |       | Reviewed the crash reports |
 */
export async function seedMonth(prefix: string, zone: string) {
	const user = await newUser(prefix);
	const core = asUi(user.id);
	const today = dateIn(zone);
	const month = today.slice(0, 7);

	const acme = value(core.customers.create({ name: 'Acme' })).id;
	const north = value(core.customers.create({ name: 'Northwind' })).id;
	const website = value(core.projects.create({ customerId: acme, name: 'Website' })).id;
	const operations = value(core.projects.create({ customerId: acme, name: 'Operations' })).id;
	const mobile = value(core.projects.create({ customerId: north, name: 'Mobile app' })).id;
	const development = value(core.activities.create({ name: 'Development' })).id;
	const meeting = value(core.activities.create({ name: 'Meeting' })).id;
	const office = value(core.locations.create({ name: 'Office' })).id;
	const home = value(core.locations.create({ name: 'Home' })).id;

	const entry = (
		date: string,
		start: string,
		end: string,
		input: {
			projectId: string;
			activityId?: string;
			locationId?: string;
			reference?: string;
			description: string;
		}
	) =>
		value(
			core.entries.create({
				...input,
				start: `${date}T${start}`,
				end: `${date}T${end}`,
				timeZone: zone
			})
		).id;

	const firstOfLast = new Date(
		Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1)
	);
	entry(firstOfLast.toISOString().slice(0, 10), '09:00', '10:00', {
		projectId: website,
		description: 'Fixed the login form last month'
	});

	return {
		...user,
		today,
		month,
		/** A day of this month, `YYYY-MM-DD`. */
		day: (n: number) => dayOf(today, n),
		projects: { website, operations, mobile },
		activities: { development, meeting },
		locations: { office, home },
		entries: {
			login: entry(dayOf(today, 2), '09:00', '10:30', {
				projectId: website,
				activityId: development,
				locationId: office,
				reference: 'T-101',
				description: 'Fixed the login form'
			}),
			release: entry(dayOf(today, 3), '09:00', '11:00', {
				projectId: website,
				activityId: meeting,
				locationId: home,
				description: 'Planned the release'
			}),
			receipts: entry(dayOf(today, 6), '13:00', '15:00', {
				projectId: operations,
				locationId: office,
				description: 'Filed the receipts'
			}),
			screen: entry(dayOf(today, 9), '08:00', '09:00', {
				projectId: mobile,
				activityId: development,
				reference: 'M-7',
				description: 'Built the login screen'
			}),
			crashes: entry(dayOf(today, 13), '10:00', '12:00', {
				projectId: mobile,
				locationId: home,
				description: 'Reviewed the crash reports'
			})
		}
	};
}

export type Month = Awaited<ReturnType<typeof seedMonth>>;

/** A description with a comma, a quote and a line break, which must stay one value. */
export const QUOTED = 'Met Anna, said "ship it"\nthen left';

/**
 * A user for the copy-out (in `zone`): four finished entries this month, one last
 * month and a timer running today.
 *
 * | when                 | in–out      | project              | activity / location / ref  | description                 |
 * | day 02               | 09:02–10:31 | Acme › Website       | Development / Office / T-101 | Fixed the login form      |
 * | day 03 to day 04     | 22:00–02:00 | Northwind › Support  |                            | Night deploy                |
 * | day 05               | 13:00–14:00 | Acme › Website       |                            | `QUOTED`                    |
 * | day 06               | 15:00–15:45 | Northwind › Support  |                            | - fixed the export          |
 * | last month's 1st     | 09:00–10:00 | Acme › Website       |                            | Reviewed last month         |
 * | today, running       | from 07:15  | Northwind › Support  |                            | Deploying                   |
 */
export async function seedCopyOut(prefix: string, zone: string) {
	const user = await newUser(prefix);
	const core = asUi(user.id);
	const today = dateIn(zone);
	const [year, month] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
	const iso = (d: Date) => d.toISOString().slice(0, 10);

	const acme = value(core.customers.create({ name: 'Acme' })).id;
	const north = value(core.customers.create({ name: 'Northwind' })).id;
	const website = value(core.projects.create({ customerId: acme, name: 'Website' })).id;
	const support = value(core.projects.create({ customerId: north, name: 'Support' })).id;
	const development = value(core.activities.create({ name: 'Development' })).id;
	const office = value(core.locations.create({ name: 'Office' })).id;

	const entry = (
		start: string,
		end: string,
		input: {
			projectId: string;
			activityId?: string;
			locationId?: string;
			reference?: string;
			description: string;
		}
	) => value(core.entries.create({ ...input, start, end, timeZone: zone })).id;

	const day = (n: number) => dayOf(today, n);
	const lastMonth = iso(new Date(Date.UTC(year, month - 2, 1)));
	entry(`${day(2)}T09:02`, `${day(2)}T10:31`, {
		projectId: website,
		activityId: development,
		locationId: office,
		reference: 'T-101',
		description: 'Fixed the login form'
	});
	entry(`${day(3)}T22:00`, `${day(4)}T02:00`, { projectId: support, description: 'Night deploy' });
	entry(`${day(5)}T13:00`, `${day(5)}T14:00`, { projectId: website, description: QUOTED });
	entry(`${day(6)}T15:00`, `${day(6)}T15:45`, {
		projectId: support,
		description: '- fixed the export'
	});
	entry(`${lastMonth}T09:00`, `${lastMonth}T10:00`, {
		projectId: website,
		description: 'Reviewed last month'
	});
	startElsewhere(user.id, support, zone, '07:15', 'Deploying');

	return {
		...user,
		/** A day of this month, `YYYY-MM-DD`. */
		day,
		/** This month's last day. */
		lastDay: iso(new Date(Date.UTC(year, month, 0))),
		/** Last month's first and last day. */
		lastMonth: { from: lastMonth, to: iso(new Date(Date.UTC(year, month - 1, 0))) },
		projects: { website, support }
	};
}

/** One half-hour entry on each of this month's first `days` days, for a long Days table. */
export function seedDays(userId: string, zone: string, days: number) {
	const core = asUi(userId);
	const first = dayOf(dateIn(zone), 1);
	const customer = value(core.customers.create({ name: 'Daily' })).id;
	const project = value(core.projects.create({ customerId: customer, name: 'Every day' })).id;
	for (let i = 0; i < days; i++) {
		value(
			core.entries.create({
				projectId: project,
				start: `${nextDays(first, i)}T09:00`,
				end: `${nextDays(first, i)}T09:30`,
				timeZone: zone,
				description: `Day ${i + 1}`
			})
		);
	}
}

export type CopyOutUser = Awaited<ReturnType<typeof seedCopyOut>>;

/** Starts a timer for `userId` at `start` (`HH:mm` today in `zone`), the way another device would. */
export function startElsewhere(
	userId: string,
	projectId: string,
	zone: string,
	start: string,
	description: string
) {
	return value(
		asUi(userId).timers.start({
			projectId,
			start: `${dateIn(zone)}T${start}`,
			timeZone: zone,
			description
		})
	).id;
}

/** Deletes an entry the way another device would. */
export function deleteElsewhere(userId: string, entryId: string) {
	value(asUi(userId).entries.delete({ id: entryId }));
}

/**
 * `count` five-minute entries from the first of this month, on a customer and project
 * of their own, written as one batch.
 */
export function seedMany(userId: string, zone: string, count: number) {
	const core = asUi(userId);
	const first = dayOf(dateIn(zone), 1);
	return value(
		core.batch(`Seed ${count} entries`, (c) => {
			const customer = c.customers.create({ name: 'Bulk' });
			if (!customer.ok) return customer;
			const project = c.projects.create({ customerId: customer.value.id, name: 'Bulk load' });
			if (!project.ok) return project;
			for (let i = 0; i < count; i++) {
				const minutes = i * 5;
				const day = Math.floor(minutes / 1440);
				const hh = String(Math.floor((minutes % 1440) / 60)).padStart(2, '0');
				const mm = String(minutes % 60).padStart(2, '0');
				const r = c.entries.create({
					projectId: project.value.id,
					start: `${nextDays(first, day)}T${hh}:${mm}`,
					durationMinutes: 4,
					timeZone: zone,
					description: `Bulk ${i + 1}`
				});
				if (!r.ok) return r;
			}
			return project;
		})
	).id;
}

const nextDays = (date: string, n: number) =>
	new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** A customer created by an agent: one batch, `Create customer "<name>"`, made by `agent`. */
export const seedAgentCustomer = (userId: string, name: string) =>
	value(openCore(database(), userId, 'agent').customers.create({ name })).id;

/**
 * `n` cheap batches, oldest first: customers "Customer 1" … "Customer <n>", each its own
 * batch `Create customer "Customer <i>"`. A user made by `seedEmptyUser` has no batch of
 * its own, so the history then holds exactly `n`.
 */
export function seedBatches(userId: string, n: number) {
	const core = asUi(userId);
	for (let i = 1; i <= n; i++) value(core.customers.create({ name: `Customer ${i}` }));
}

/** One batch of three changes, labelled `label`: an activity, a location and a customer. */
export function seedThreeChanges(
	userId: string,
	label: string,
	names: { activity: string; location: string; customer: string }
) {
	value(
		asUi(userId).batch(label, (c) => {
			const a = c.activities.create({ name: names.activity });
			if (!a.ok) return a;
			const l = c.locations.create({ name: names.location });
			if (!l.ok) return l;
			return c.customers.create({ name: names.customer });
		})
	);
}

/** An activity, created for `userId` straight through the core. */
export const seedActivity = (userId: string, name: string) =>
	value(asUi(userId).activities.create({ name })).id;

/** A location, created for `userId` straight through the core. */
export const seedLocation = (userId: string, name: string) =>
	value(asUi(userId).locations.create({ name })).id;

/** A finished entry today in `zone`, from `start` to `end` (`HH:mm`). */
export const seedEntry = (
	userId: string,
	zone: string,
	input: {
		projectId: string;
		start: string;
		end: string;
		description: string;
		activityId?: string;
	}
) =>
	value(
		asUi(userId).entries.create({
			projectId: input.projectId,
			...(input.activityId === undefined ? {} : { activityId: input.activityId }),
			start: `${dateIn(zone)}T${input.start}`,
			end: `${dateIn(zone)}T${input.end}`,
			timeZone: zone,
			description: input.description
		})
	).id;
