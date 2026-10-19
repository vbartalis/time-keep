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
