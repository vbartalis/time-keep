import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Download, type Page } from '@playwright/test';
import { PASSWORD, QUOTED, noonZone, seedCopyOut, seedMonth, type CopyOutUser } from './seed';

// Noon in the browser's zone, so the default copy-out is the month the seeded entries are in.
const zone = noonZone();
test.use({ timezoneId: zone });

/** A user of its own for each test, with the entries of `seedCopyOut`. */
const newUser = (label: string) => seedCopyOut(`${test.info().project.name}-${label}`, zone);

async function signIn(page: Page, username: string) {
	await rememberZone(page.context());
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

const rememberZone = (context: BrowserContext) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

/**
 * Signs in and opens the Copy-out screen on the default month. With JavaScript it waits
 * for the script (the Copy button shows), since a box ticked before then is reset to the
 * loaded choice when the page hydrates.
 */
async function openCopyOut(page: Page, user: CopyOutUser, script = true) {
	await signIn(page, user.username);
	await page.goto('/copy-out');
	await expect(page.getByRole('heading', { name: 'Copy-out', level: 1 })).toBeVisible();
	if (script) await expect(copyButton(page)).toBeVisible();
}

const form = (page: Page) => page.getByRole('search');
const result = (page: Page) => page.getByRole('region', { name: 'Result' });
const copyButton = (page: Page) => page.getByRole('button', { name: 'Copy', exact: true });
const column = (page: Page, head: string) =>
	form(page).getByRole('checkbox', { name: head, exact: true });

async function show(page: Page) {
	await form(page).getByRole('button', { name: 'Show' }).click();
	await expect(page).toHaveURL(/\/copy-out\?/);
}

const ALL_HEADS = [
	'Date',
	'Start',
	'End',
	'Duration',
	'Customer',
	'Project',
	'Activity',
	'Location',
	'Reference',
	'Description'
];

/** The sheet's column heads and body rows are exactly these. */
async function sheetIs(page: Page, heads: string[], rows: string[][]) {
	await expect(result(page).getByRole('columnheader')).toHaveText(heads);
	const body = result(page).locator('tbody tr');
	await expect(body).toHaveCount(rows.length);
	for (const [i, row] of rows.entries()) {
		await expect(body.nth(i).getByRole('cell')).toHaveText(row);
	}
}

/** The default month's rows, all ten columns, rounded, unsplit, `h:mm`. */
const monthRows = ({ day }: CopyOutUser) => [
	[
		day(2),
		'09:00',
		'10:30',
		'1:30',
		'Acme',
		'Website',
		'Development',
		'Office',
		'T-101',
		'Fixed the login form'
	],
	[day(3), '22:00', `${day(4)} 02:00`, '4:00', 'Northwind', 'Support', '', '', '', 'Night deploy'],
	// The table shows the line break as a space, as the copy writes it.
	[
		day(5),
		'13:00',
		'14:00',
		'1:00',
		'Acme',
		'Website',
		'',
		'',
		'',
		'Met Anna, said "ship it" then left'
	],
	[day(6), '15:00', '15:45', '0:45', 'Northwind', 'Support', '', '', '', "'- fixed the export"]
];

/** A minimal RFC 4180 reader: quoted values may hold commas, doubled quotes and line breaks. */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let value = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted && c === '"' && text[i + 1] === '"') {
			value += '"';
			i++;
		} else if (c === '"') {
			quoted = !quoted;
		} else if (quoted) {
			value += c;
		} else if (c === ',') {
			row.push(value);
			value = '';
		} else if (c === '\r' && text[i + 1] === '\n') {
			rows.push([...row, value]);
			row = [];
			value = '';
			i++;
		} else {
			value += c;
		}
	}
	return rows;
}

/** Clicks Download CSV and returns the download and its bytes. */
async function downloadCsv(page: Page): Promise<{ download: Download; bytes: Buffer }> {
	const downloading = page.waitForEvent('download');
	await result(page).getByRole('link', { name: 'Download CSV' }).click();
	const download = await downloading;
	return { download, bytes: await readFile(await download.path()) };
}

test('the month shows every column; columns and decimal hours change the sheet', async ({
	page
}) => {
	const user = await newUser('month');
	const { day } = user;
	await openCopyOut(page, user);

	await test.step('the month by default, all ten columns, the running entry left out', async () => {
		await expect(form(page).getByLabel('From', { exact: true })).toHaveValue(day(1));
		await sheetIs(page, ALL_HEADS, monthRows(user));
		await expect(result(page)).toContainText('4 rows, 7:15');
		await expect(result(page)).toContainText('1 running entry left out.');
		await expect(result(page)).not.toContainText('Deploying');
		await expect(result(page)).not.toContainText('Reviewed last month');
	});

	await test.step('fewer columns and decimal hours', async () => {
		for (const head of ['Customer', 'Activity', 'Location', 'Reference']) {
			await column(page, head).uncheck();
		}
		await form(page).getByRole('radio', { name: 'Decimal hours' }).check();
		await show(page);
		await sheetIs(
			page,
			['Date', 'Start', 'End', 'Duration', 'Project', 'Description'],
			[
				[day(2), '09:00', '10:30', '1.50', 'Website', 'Fixed the login form'],
				[day(3), '22:00', `${day(4)} 02:00`, '4.00', 'Support', 'Night deploy'],
				[day(5), '13:00', '14:00', '1.00', 'Website', 'Met Anna, said "ship it" then left'],
				[day(6), '15:00', '15:45', '0.75', 'Support', "'- fixed the export"]
			]
		);
		await expect(result(page)).toContainText('4 rows, 7.25');
	});

	await test.step('Last month keeps the chosen columns', async () => {
		await form(page).getByRole('link', { name: 'Last month' }).click();
		await expect(form(page).getByLabel('From', { exact: true })).toHaveValue(user.lastMonth.from);
		await expect(form(page).getByLabel('To', { exact: true })).toHaveValue(user.lastMonth.to);
		await sheetIs(
			page,
			['Date', 'Start', 'End', 'Duration', 'Project', 'Description'],
			[[user.lastMonth.from, '09:00', '10:00', '1.00', 'Website', 'Reviewed last month']]
		);
		await expect(result(page)).toContainText('1 row, 1.00');
		await expect(result(page)).not.toContainText('running');
	});

	await test.step('This month comes back', async () => {
		await form(page).getByRole('link', { name: 'This month' }).click();
		await expect(form(page).getByLabel('From', { exact: true })).toHaveValue(day(1));
		await expect(result(page)).toContainText('4 rows, 7.25');
	});

	await test.step('no column ticked says so, with no rows', async () => {
		for (const head of ['Date', 'Start', 'End', 'Duration', 'Project', 'Description']) {
			await column(page, head).uncheck();
		}
		await show(page);
		await expect(form(page).getByRole('alert')).toHaveText('Choose at least one column.');
		await expect(result(page)).toHaveCount(0);
	});
});

test('split at midnight makes two rows of the overnight entry; rounding off shows exact minutes', async ({
	page
}) => {
	const user = await newUser('split');
	const { day } = user;
	await openCopyOut(page, user);

	await form(page).getByRole('checkbox', { name: 'Split at midnight' }).check();
	await show(page);
	const [login, , ...rest] = monthRows(user);
	const support = ['Northwind', 'Support', '', '', '', 'Night deploy'];
	await sheetIs(page, ALL_HEADS, [
		login,
		[day(3), '22:00', '24:00', '2:00', ...support],
		[day(4), '00:00', '02:00', '2:00', ...support],
		...rest
	]);
	await expect(result(page)).toContainText('5 rows, 7:15');

	await form(page).getByRole('checkbox', { name: 'Round to 5 minutes' }).uncheck();
	await show(page);
	await expect(result(page).locator('tbody tr').first().getByRole('cell')).toHaveText([
		day(2),
		'09:02',
		'10:31',
		'1:29',
		'Acme',
		'Website',
		'Development',
		'Office',
		'T-101',
		'Fixed the login form'
	]);
	await expect(result(page)).toContainText('5 rows, 7:14');
});

test('Copy puts the rows on the clipboard, tab-separated, without a header', async ({ page }) => {
	test.skip(test.info().project.name !== 'pc', 'copying is for the PC');
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	const user = await newUser('copy');
	await openCopyOut(page, user);

	await copyButton(page).click();
	await expect(page.getByText('Copied 4 rows.')).toBeVisible();
	const copied = await page.evaluate(() => navigator.clipboard.readText());
	// One line per row: the line break inside a description is a space.
	expect(copied).toBe(
		monthRows(user)
			.map((row) => row.join('\t'))
			.join('\r\n')
	);
	expect(copied.split('\r\n')).toHaveLength(4);
});

test('Download CSV gives the file with its header, and the quoted description round-trips', async ({
	page
}) => {
	const user = await newUser('csv');
	const { day } = user;
	await openCopyOut(page, user);

	const { download, bytes } = await downloadCsv(page);
	expect(download.suggestedFilename()).toBe(`time-keep-${day(1)}-${user.lastDay}.csv`);
	expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
	const text = bytes.subarray(3).toString('utf8');
	expect(text.startsWith(`${ALL_HEADS.join(',')}\r\n`)).toBe(true);

	const [heads, ...rows] = parseCsv(text);
	expect(heads).toEqual(ALL_HEADS);
	// The file keeps the line break, quoted; every other value is as the table shows it.
	const expected = monthRows(user);
	expected[2][9] = QUOTED;
	expect(rows).toEqual(expected);
});

test('the rail shows Copy-out current; the phone bar has none', async ({ page }) => {
	const user = await newUser('rail');
	await openCopyOut(page, user);
	const main = page.getByRole('navigation', { name: 'Main' });
	if (test.info().project.name === 'pc') {
		await expect(main.getByRole('link', { name: 'Copy-out' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(main.getByRole('link', { name: 'Entries' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
	} else {
		await expect(main.getByRole('link', { name: 'Copy-out' })).toHaveCount(0);
	}
});

test.describe('the CSV route', () => {
	test('signed out, it redirects to sign-in', async ({ request }) => {
		const res = await request.get('/copy-out/csv?show=1&col=date', { maxRedirects: 0 });
		expect(res.status()).toBe(303);
		expect(res.headers()['location']).toBe('/login');
	});

	test("another user's session gets only its own rows", async ({ page }) => {
		const owner = await newUser('owner');
		const other = await seedMonth(`${test.info().project.name}-other`, zone);
		await signIn(page, other.username);

		const own = await page.request.get('/copy-out/csv');
		expect(own.status()).toBe(200);
		const [, ...rows] = parseCsv((await own.text()).replace(/^\uFEFF/, ''));
		expect(rows.map((row) => row[9])).toEqual([
			'Fixed the login form',
			'Planned the release',
			'Filed the receipts',
			'Built the login screen',
			'Reviewed the crash reports'
		]);

		// Asking by the owner's project finds nothing of the owner's.
		const theirs = await page.request.get(
			`/copy-out/csv?projectId=${owner.projects.support}&from=&to=`
		);
		expect(theirs.status()).toBe(200);
		expect(parseCsv((await theirs.text()).replace(/^\uFEFF/, ''))).toEqual([ALL_HEADS]);
	});

	test('a hand-made bad query is a 400 with the screen’s message', async ({ page }) => {
		const user = await newUser('bad');
		await signIn(page, user.username);
		const cases: [string, string][] = [
			['?show=1&from=2026-13-01', 'Use dates like 2026-10-01.'],
			['?from=2026-10-31&to=2026-10-01', 'From must not be after To.'],
			['?show=1&round=1', 'Choose at least one column.']
		];
		for (const [query, message] of cases) {
			const res = await page.request.get(`/copy-out/csv${query}`);
			expect(res.status(), query).toBe(400);
			expect(await res.text(), query).toBe(message);
		}
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('Show, the table and the CSV link work, and there is no Copy button', async ({ page }) => {
		const user = await newUser('nojs');
		const { day } = user;
		await openCopyOut(page, user, false);

		await sheetIs(page, ALL_HEADS, monthRows(user));
		await expect(copyButton(page)).toHaveCount(0);

		await form(page).getByRole('checkbox', { name: 'Split at midnight' }).check();
		await form(page).getByRole('radio', { name: 'Decimal hours' }).check();
		await show(page);
		await expect(result(page)).toContainText('5 rows, 7.25');
		await expect(result(page).locator('tbody tr').nth(2).getByRole('cell').nth(0)).toHaveText(
			day(4)
		);
		await expect(copyButton(page)).toHaveCount(0);

		const { download, bytes } = await downloadCsv(page);
		expect(download.suggestedFilename()).toBe(`time-keep-${day(1)}-${user.lastDay}.csv`);
		const [heads, ...rows] = parseCsv(bytes.subarray(3).toString('utf8'));
		expect(heads).toEqual(ALL_HEADS);
		expect(rows).toHaveLength(5);
		expect(rows[2].slice(0, 4)).toEqual([day(4), '00:00', '02:00', '2.00']);
	});
});
