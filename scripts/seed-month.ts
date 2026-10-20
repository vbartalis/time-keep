/**
 * Fills a database with a realistic month for one user, through the core: three
 * companies deep for support work, two deep for development, start plus duration, a
 * café, at the client. Used by the usability gate and by anyone who wants a screen to
 * look at. Deterministic: the variation comes from the date, never from chance.
 *
 *   npx tsx scripts/seed-month.ts <database> <username> <password>
 */
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { openCore, type Result } from '../src/lib/server/core/index';
import { openDb, type DB } from '../src/lib/server/db/index';
import { user } from '../src/lib/server/db/schema';
import { createUser } from '../src/lib/server/users';

const DAY = 86_400_000;
const END_CLIENTS = ['Contoso', 'Fabrikam', 'Northwind Traders', 'Tailspin', 'Litware'];
const SUPPORT = [
	'Reset the shared printer queue',
	'Restored a deleted mailbox',
	'Fixed the VPN profile',
	'Replaced an expired certificate',
	'Cleared a stuck backup job'
];
const WORK = [
	'Built the invoice export',
	'Reviewed the pull request',
	'Fixed the login redirect',
	'Wrote the migration script',
	'Refactored the report query',
	'Tuned the slow search'
];

const value = <T>(r: Result<T>): T => {
	if (!r.ok) throw new Error(`seed refused: ${JSON.stringify(r.error)}`);
	return r.value;
};

const addDays = (date: string, n: number) =>
	new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

const clock = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Seeds the 30 days before `today` (`YYYY-MM-DD`, in `zone`) for `userId`; returns the
 * number of entries made. Nothing is dated today or later.
 */
export function seedMonth(
	db: DB,
	userId: string,
	opts: { today: string; zone: string }
): { entries: number } {
	const core = openCore(db, userId, 'system');
	const { today, zone } = opts;

	const compX = value(core.customers.create({ name: 'CompX' })).id;
	const myself = value(core.customers.create({ name: 'Myself' })).id;
	const projectZ = value(core.projects.create({ customerId: compX, name: 'ClientY – ProjectZ' })).id;
	const support = value(core.projects.create({ customerId: compX, name: 'CompY – Support' })).id;
	const timeKeep = value(core.projects.create({ customerId: myself, name: 'time-keep' })).id;
	const development = value(core.activities.create({ name: 'Development' })).id;
	const meeting = value(core.activities.create({ name: 'Meeting' })).id;
	const ticket = value(core.activities.create({ name: 'Support ticket' })).id;
	const research = value(core.activities.create({ name: 'Research' })).id;
	const office = value(core.locations.create({ name: 'Office' })).id;
	const home = value(core.locations.create({ name: 'Home office' })).id;
	const cafe = value(core.locations.create({ name: 'Café' })).id;
	const client = value(core.locations.create({ name: 'At the client' })).id;

	value(
		core.templates.create({
			name: 'Standup',
			customerId: compX,
			projectId: projectZ,
			activityId: meeting,
			startTime: '09:30',
			endTime: '09:45'
		})
	);
	value(
		core.templates.create({
			name: 'Ticket',
			customerId: compX,
			projectId: support,
			activityId: ticket,
			durationMinutes: 30
		})
	);

	let entries = 0;
	const add = (
		date: string,
		start: string,
		end: string,
		input: {
			projectId: string;
			activityId: string;
			locationId: string;
			reference?: string;
			description: string;
		},
		endDate = date
	) => {
		value(
			core.entries.create({
				...input,
				start: `${date}T${start}`,
				end: `${endDate}T${end}`,
				timeZone: zone
			})
		);
		entries++;
	};

	// last week's Monday: the late entry and the overlap sit in the week before today's
	const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay();
	const thisMonday = addDays(today, -((todayDow + 6) % 7));
	const lastMonday = addDays(thisMonday, -7);

	let n = 0; // index among the weekdays seeded
	for (let back = 30; back >= 1; back--) {
		const date = addDays(today, -back);
		const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
		if (dow === 0 || dow === 6) continue;
		const i = n++;
		const atClient = dow === 2 || dow === 3;

		add(date, '09:30', '09:45', {
			projectId: projectZ,
			activityId: meeting,
			locationId: atClient ? client : dow === 5 ? home : office,
			description: 'Standup'
		});
		add(date, '10:00', clock(12 * 60 + (i % 3) * 30), {
			projectId: projectZ,
			activityId: development,
			locationId: atClient ? client : home,
			description: WORK[i % WORK.length]
		});
		add(date, '13:30', clock(13 * 60 + 30 + 30 + (i % 3) * 15), {
			projectId: support,
			activityId: ticket,
			locationId: atClient ? client : home,
			reference: `T-${4000 + ((i * 37) % 900)}`,
			description: `${SUPPORT[i % SUPPORT.length]} for ${END_CLIENTS[i % END_CLIENTS.length]}`
		});
		if (dow === 2 || dow === 4 || i % 5 === 0) {
			add(date, '19:30', '21:00', {
				projectId: timeKeep,
				activityId: development,
				locationId: cafe,
				description: WORK[(i + 2) % WORK.length]
			});
		}
		if (dow === 5) {
			add(date, '15:00', '16:00', {
				projectId: timeKeep,
				activityId: research,
				locationId: home,
				description: 'Read up on calendar views'
			});
		}
		if (i === 3 || date === addDays(lastMonday, 1)) {
			// past midnight, into the next day
			add(
				date,
				'23:00',
				'01:00',
				{
					projectId: timeKeep,
					activityId: development,
					locationId: home,
					description: 'Late fix for the sync bug'
				},
				addDays(date, 1)
			);
		}
		if (i === 6 || date === addDays(lastMonday, 2)) {
			// logged twice by mistake: overlaps the morning development block
			add(date, '10:30', '11:30', {
				projectId: timeKeep,
				activityId: research,
				locationId: home,
				description: 'Looked into the overlap warning'
			});
		}
	}
	return { entries };
}

/** Today's date in `zone`, as `YYYY-MM-DD`. */
const dateIn = (zone: string, now = new Date()) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);

async function main(args: string[]) {
	const [file, username, password] = args;
	if (!file || !username || !password) {
		console.error('usage: npx tsx scripts/seed-month.ts <database> <username> <password>');
		return 2;
	}
	const db = openDb(file);
	let row = db.select().from(user).where(eq(user.username, username)).get();
	if (!row) {
		const made = await createUser(db, { username, password, isAdmin: false });
		if (!made.ok) {
			console.error(`cannot create ${username}: ${made.error}`);
			return 1;
		}
		row = db.select().from(user).where(eq(user.id, made.value.id)).get();
	}
	const zone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
	const { entries } = seedMonth(db, row!.id, { today: dateIn(zone), zone });
	console.log(`seeded ${entries} entries for ${username} (${zone})`);
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main(process.argv.slice(2)).then((code) => process.exit(code));
}
