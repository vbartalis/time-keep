import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Download, type Page } from '@playwright/test';
import {
	PASSWORD,
	QUOTED,
	noonZone,
	seedCopyOut,
	seedGateMonth,
	seedCustomer,
	seedMonth,
	seedProject,
	type CopyOutUser
} from './seed';

// Noon in the browser's zone, so This month is the month the seeded entries are in.
const zone = noonZone();
test.use({ timezoneId: zone });

/** A user of its own for each test, with the entries of `seedCopyOut`. */
const newUser = (label: string) => seedCopyOut(`${test.info().project.name}-${label}`, zone);

const rememberZone = (context: BrowserContext) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

async function signIn(page: Page, username: string) {
	await rememberZone(page.context());
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

/** Signs in and opens Copy-out at `path`, waiting for the script unless it is off. */
async function openCopyOut(page: Page, username: string, path = '/copy-out', script = true) {
	await signIn(page, username);
	await page.goto(path);
	await expect(page.getByRole('heading', { name: 'Copy-out', level: 1 })).toBeVisible();
	if (script) await page.waitForLoadState('networkidle');
}

const filterButton = (page: Page) => page.locator('summary', { hasText: 'Filter' });
const panel = (page: Page) => page.getByRole('group', { name: 'Filter' });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search entries' });
/** The toolbar's count and total. */
const tally = (page: Page, text: string) => page.getByText(text, { exact: true });
const chips = (page: Page) => page.getByRole('list', { name: 'Columns' });
const chip = (page: Page, head: string) =>
	chips(page).getByRole('button', { name: head, exact: true });
const copyButton = (page: Page) => page.getByRole('button', { name: /^Copy \d+ rows?$/ });
const csvLink = (page: Page) => page.getByRole('link', { name: 'Download CSV' });
const sheet = (page: Page) => page.getByRole('table');

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
	await expect(sheet(page).getByRole('columnheader')).toHaveText(heads);
	const body = sheet(page).locator('tbody tr');
	await expect(body).toHaveCount(rows.length);
	for (const [i, row] of rows.entries()) {
		await expect(body.nth(i).getByRole('cell')).toHaveText(row);
	}
}

/** This month's rows, all ten columns, rounded, unsplit, `h:mm`. */
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
	// The end on the next day is written with its date.
	[day(3), '22:00', `${day(4)} 02:00`, '4:00', 'Northwind', 'Support', '', '', '', 'Night deploy'],
	// The line break as a space, as the copy writes it.
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
	// The formula guard.
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
	await csvLink(page).click();
	const download = await downloading;
	return { download, bytes: await readFile(await download.path()) };
}

test.describe('the PC', () => {
	test.skip(({ isMobile }) => isMobile, 'the PC at 1440 px; the phone is its own');

	test('the month as written, the Total, the running line, and the sidebar', async ({ page }) => {
		const user = await newUser('month');
		await openCopyOut(page, user.username);

		await expect(filterButton(page)).toContainText('This month');
		await expect(tally(page, '4 rows · 7:15')).toBeVisible();
		await sheetIs(page, ALL_HEADS, monthRows(user));
		await expect(sheet(page).locator('tfoot td')).toHaveText([
			'Total',
			'',
			'',
			'7:15',
			'',
			'',
			'',
			'',
			'',
			''
		]);
		await expect(page.getByText('1 running entry left out.')).toBeVisible();
		await expect(sheet(page)).not.toContainText('Deploying');
		await expect(copyButton(page)).toHaveText('Copy 4 rows');
		await expect(page.getByRole('button', { name: 'Show' })).toHaveCount(0);

		const main = page.getByRole('navigation', { name: 'Main' });
		await expect(main.getByRole('link', { name: 'Copy-out' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(main.getByRole('link', { name: 'Entries' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	test('Last month, chips, Copy, and kept between visits', async ({ page }) => {
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const user = await newUser('copy');
		await openCopyOut(page, user.username);

		await test.step('Last month applies at once', async () => {
			await filterButton(page).click();
			await panel(page)
				.getByRole('radio', { name: /^Last month/ })
				.check();
			await expect(filterButton(page)).toContainText('Last month');
			await expect(tally(page, '1 row · 1:00')).toBeVisible();
			await expect(copyButton(page)).toHaveText('Copy 1 row');
			await expect(page.getByText('running entry left out')).toHaveCount(0);
			await page.keyboard.press('Escape');
			await filterButton(page).click();
			await panel(page)
				.getByRole('radio', { name: /^This month/ })
				.check();
			await expect(tally(page, '4 rows · 7:15')).toBeVisible();
			await page.keyboard.press('Escape');
		});

		await test.step('chips off remove their columns at once, the focus kept', async () => {
			await expect(chip(page, 'Activity')).toHaveAttribute('aria-pressed', 'true');
			await chip(page, 'Activity').click();
			await expect(chip(page, 'Activity')).toHaveAttribute('aria-pressed', 'false');
			await expect(page).toHaveURL(/cols=date%2Cstart|cols=date,start/);
			await chip(page, 'Location').click();
			await expect(sheet(page).getByRole('columnheader')).toHaveText(
				ALL_HEADS.filter((h) => h !== 'Activity' && h !== 'Location')
			);
			await expect(chip(page, 'Location')).toBeFocused();
		});

		await test.step('Copy puts the rows shown on the clipboard, tab-separated', async () => {
			await copyButton(page).click();
			await expect(page.getByText('Copied 4 rows.')).toBeVisible();
			await expect(copyButton(page)).toBeFocused();
			const copied = await page.evaluate(() => navigator.clipboard.readText());
			expect(copied).toBe(
				monthRows(user)
					.map((row) => [...row.slice(0, 6), ...row.slice(8)].join('\t'))
					.join('\r\n')
			);
		});

		await test.step('Last month, then Entries and back: all kept', async () => {
			await filterButton(page).click();
			await panel(page)
				.getByRole('radio', { name: /^Last month/ })
				.check();
			await expect(tally(page, '1 row · 1:00')).toBeVisible();
			await page.keyboard.press('Escape');
			const nav = page.getByRole('navigation', { name: 'Main' });
			await nav.getByRole('link', { name: 'Entries' }).click();
			await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
			await expect(filterButton(page)).toContainText('This month');
			await nav.getByRole('link', { name: 'Copy-out' }).click();
			await expect(page.getByRole('heading', { name: 'Copy-out', level: 1 })).toBeVisible();
			await expect(filterButton(page)).toContainText('Last month');
			await expect(chip(page, 'Activity')).toHaveAttribute('aria-pressed', 'false');
			await expect(chip(page, 'Location')).toHaveAttribute('aria-pressed', 'false');
			await sheetIs(
				page,
				ALL_HEADS.filter((h) => h !== 'Activity' && h !== 'Location'),
				[
					[
						user.lastMonth.from,
						'09:00',
						'10:00',
						'1:00',
						'Acme',
						'Website',
						'',
						'Reviewed last month'
					]
				]
			);
		});
	});

	test('a project filter as a chip, and the CSV of the columns on', async ({ page }) => {
		const user = await newUser('csv');
		const { day } = user;
		await openCopyOut(page, user.username);

		await chip(page, 'Reference').click();
		await expect(sheet(page).getByRole('columnheader', { name: 'Reference' })).toHaveCount(0);

		await page.goto(`/copy-out?project=${user.projects.support}`);
		const filters = page.getByRole('list', { name: 'Filters' });
		await expect(filters.getByRole('listitem')).toHaveText(['Northwind › Support']);
		await expect(tally(page, '2 rows · 4:45')).toBeVisible();
		await expect(sheet(page).locator('tbody tr')).toHaveCount(2);
		for (const project of await sheet(page).locator('tbody tr td:nth-child(6)').allTextContents())
			expect(project).toBe('Support');

		const { download, bytes } = await downloadCsv(page);
		expect(download.suggestedFilename()).toBe(`time-keep-${day(1)}-${user.lastDay}.csv`);
		expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
		const [heads, ...rows] = parseCsv(bytes.subarray(3).toString('utf8'));
		expect(heads).toEqual(ALL_HEADS.filter((h) => h !== 'Reference'));
		expect(rows.map((r) => r[5])).toEqual(['Support', 'Support']);

		await filters.getByRole('link', { name: 'Remove Northwind › Support' }).click();
		await expect(filters).toHaveCount(0);
		await expect(tally(page, '4 rows · 7:15')).toBeVisible();

		// All ten columns: the file keeps the line break, quoted.
		await page.goto(`/copy-out?cols=${ALL_HEADS.map((h) => h.toLowerCase()).join(',')}`);
		const all = await downloadCsv(page);
		const [allHeads, ...allRows] = parseCsv(all.bytes.subarray(3).toString('utf8'));
		expect(allHeads).toEqual(ALL_HEADS);
		const expected = monthRows(user);
		expected[2][9] = QUOTED;
		expect(allRows).toEqual(expected);
	});

	test('options: exact minutes, decimal hours, and split at midnight', async ({ page }) => {
		const user = await newUser('options');
		const { day } = user;
		await openCopyOut(page, user.username);

		await page.getByRole('checkbox', { name: 'Round to 5 minutes' }).uncheck();
		await expect(sheet(page).locator('tbody tr').first().getByRole('cell').nth(3)).toHaveText(
			'1:29'
		);
		await expect(tally(page, '4 rows · 7:14')).toBeVisible();
		await page.getByRole('radio', { name: 'Decimal' }).check();
		await expect(sheet(page).locator('tbody tr').first().getByRole('cell')).toHaveText([
			day(2),
			'09:02',
			'10:31',
			'1.48',
			'Acme',
			'Website',
			'Development',
			'Office',
			'T-101',
			'Fixed the login form'
		]);
		await expect(page.getByRole('radio', { name: 'Decimal' })).toBeFocused();

		await page.getByRole('checkbox', { name: 'Round to 5 minutes' }).check();
		await page.getByRole('radio', { name: 'h:mm' }).check();
		await page.getByRole('checkbox', { name: 'Split at midnight' }).check();
		await expect(tally(page, '5 rows · 7:15')).toBeVisible();
		const [login, , ...rest] = monthRows(user);
		const support = ['Northwind', 'Support', '', '', '', 'Night deploy'];
		await sheetIs(page, ALL_HEADS, [
			login,
			[day(3), '22:00', '24:00', '2:00', ...support],
			[day(4), '00:00', '02:00', '2:00', ...support],
			...rest
		]);
	});

	test('the search narrows as you type; no match says so, both actions off', async ({ page }) => {
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const user = await newUser('search');
		await openCopyOut(page, user.username);

		await search(page).click();
		await search(page).pressSequentially('T-10');
		await expect(tally(page, '1 row · 1:30')).toBeVisible();
		await expect(sheet(page).locator('tbody tr')).toHaveCount(1);
		await expect(search(page)).toBeFocused();

		await search(page).fill('zzzz');
		await expect(page.getByText('No entries match.')).toBeVisible();
		await expect(sheet(page)).toHaveCount(0);

		// Nothing to copy: both off, still reachable, saying why; the clipboard untouched.
		await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
		await expect(csvLink(page)).toHaveAttribute('aria-disabled', 'true');
		await expect(csvLink(page)).not.toHaveAttribute('href');
		await expect(copyButton(page)).toHaveAccessibleDescription('No entries match.');
		await expect(csvLink(page)).toHaveAccessibleDescription('No entries match.');
		await page.evaluate(() => navigator.clipboard.writeText('untouched'));
		// Playwright waits on an `aria-disabled` control's click; a key press reaches it.
		await copyButton(page).focus();
		await page.keyboard.press('Enter');
		await expect(copyButton(page)).toBeFocused();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('untouched');
		await expect(page.getByText(/^Copied/)).toHaveCount(0);
	});

	test('no column on: the message, both actions off, and the kept columns unchanged', async ({
		page
	}) => {
		const user = await newUser('none');
		await openCopyOut(page, user.username, '/copy-out?cols=date,duration');
		await chip(page, 'Date').click();
		await expect(sheet(page).getByRole('columnheader')).toHaveText(['Duration']);
		await chip(page, 'Duration').click();
		await expect(page.getByRole('alert')).toHaveText('Choose at least one column.');
		await expect(sheet(page)).toHaveCount(0);
		// The range's rows are still counted and totalled.
		await expect(tally(page, '4 rows · 7:15')).toBeVisible();
		await expect(copyButton(page)).toHaveText('Copy 4 rows');
		await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
		await expect(csvLink(page)).toHaveAttribute('aria-disabled', 'true');
		await expect(csvLink(page)).not.toHaveAttribute('href');
		await expect(chip(page, 'Duration')).toBeFocused();
		// Still reachable, saying why.
		await copyButton(page).focus();
		await expect(copyButton(page)).toBeFocused();
		await expect(copyButton(page)).toHaveAccessibleDescription('Choose at least one column.');

		await page.reload();
		await expect(page.getByRole('alert')).toHaveText('Choose at least one column.');
		// The last choice with a column (Duration alone) is still the kept one.
		await page.goto('/copy-out');
		await expect(sheet(page).getByRole('columnheader')).toHaveText(['Duration']);
	});

	test('the month of the gate: nothing cut, the panel inside the column', async ({ page }) => {
		const user = await seedGateMonth(`${test.info().project.name}-wide`, zone);
		await openCopyOut(page, user.username, `/copy-out?range=custom&from=${user.from}&to=`);
		await expect(sheet(page).getByRole('columnheader')).toHaveText(ALL_HEADS);
		const fits = await page.evaluate(() => {
			const panel = document.querySelector<HTMLElement>('[data-sheet]')!;
			const main = document.querySelector('main')!;
			const cells = [...document.querySelectorAll<HTMLElement>('tbody td:last-child')];
			return {
				scroll: panel.scrollWidth <= panel.clientWidth,
				inside: panel.getBoundingClientRect().right <= main.getBoundingClientRect().right,
				cut: cells.filter((c) => c.scrollWidth > c.clientWidth).length,
				cells: cells.length
			};
		});
		expect(fits).toEqual({ scroll: true, inside: true, cut: 0, cells: fits.cells });
		expect(fits.cells).toBeGreaterThan(50);

		// The short columns are never broken inside a name: each value is one line.
		const broken = await page.evaluate(() => {
			const heads = [...document.querySelectorAll('[data-sheet] thead th')].map((th) =>
				th.textContent!.trim()
			);
			const short = ['Date', 'Start', 'Duration', 'Customer', 'Project', 'Activity'];
			short.push('Location', 'Reference');
			const out: string[] = [];
			for (const tr of document.querySelectorAll<HTMLTableRowElement>('[data-sheet] tbody tr'))
				for (const [i, td] of [...tr.cells].entries()) {
					if (!short.includes(heads[i]) || td.textContent!.trim() === '') continue;
					const range = document.createRange();
					range.selectNodeContents(td);
					const line = parseFloat(getComputedStyle(td).lineHeight);
					if (range.getBoundingClientRect().height > line * 1.5)
						out.push(`${heads[i]}: ${td.textContent}`);
				}
			return out;
		});
		expect(broken).toEqual([]);
	});

	test('at 1024 px the band holds its controls; the option labels stay on one line', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		const user = await seedGateMonth(`${test.info().project.name}-narrow`, zone);
		await openCopyOut(page, user.username);
		const layout = await page.evaluate(() => {
			const band = document.querySelector<HTMLElement>('form#output')!;
			const edge =
				band.getBoundingClientRect().right - parseFloat(getComputedStyle(band).paddingRight);
			const controls = [
				...band.querySelectorAll<HTMLElement>('button, a, label, [role="radiogroup"]')
			].filter((el) => el.checkVisibility() && el.getBoundingClientRect().width > 0);
			/** The band's column (its child) that holds `el`. */
			const column = (el: HTMLElement) => {
				let at = el;
				while (at.parentElement !== band) at = at.parentElement!;
				return at.getBoundingClientRect();
			};
			/** The lines its text sets on: the distinct tops of its text's boxes. */
			const lines = (el: HTMLElement) => {
				const tops = new Set<number>();
				const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
				for (let node = walk.nextNode(); node; node = walk.nextNode()) {
					if (node.textContent!.trim() === '') continue;
					const range = document.createRange();
					range.selectNodeContents(node);
					for (const box of range.getClientRects()) tops.add(Math.round(box.top));
				}
				return tops.size;
			};
			return {
				count: controls.length,
				past: controls
					.filter((el) => {
						const right = el.getBoundingClientRect().right;
						return right > edge + 0.5 || right > column(el).right + 0.5;
					})
					.map((el) => el.textContent?.trim()),
				wrapped: controls.filter((el) => lines(el) > 1).map((el) => el.textContent?.trim()),
				width: document.documentElement.scrollWidth
			};
		});
		expect(layout).toEqual({ count: layout.count, past: [], wrapped: [], width: 1024 });
		expect(layout.count).toBeGreaterThan(12);
		await expect(page.getByRole('checkbox', { name: 'Round to 5 minutes' })).toBeVisible();
	});
});

test.describe('the phone at 390 px', () => {
	test.skip(({ isMobile }) => !isMobile, 'the phone; the PC is its own');
	test.use({ viewport: { width: 390, height: 844 } });

	test('from More: no sheet, nothing under the "+", no sideways scroll; Reference off and Copy', async ({
		page
	}) => {
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const user = await newUser('phone');
		await signIn(page, user.username);
		const main = page.getByRole('navigation', { name: 'Main' });
		await expect(main.getByRole('link', { name: 'Copy-out' })).toHaveCount(0);
		await main.getByRole('button', { name: 'More' }).click();
		await page.getByRole('dialog').getByRole('link', { name: 'Copy-out' }).click();
		await expect(page.getByRole('heading', { name: 'Copy-out', level: 1 })).toBeVisible();
		await page.waitForLoadState('networkidle');

		await expect(tally(page, '4 rows · 7:15')).toBeVisible();
		await expect(sheet(page)).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Columns' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
		await expect(copyButton(page)).toBeVisible();
		await expect(csvLink(page)).toBeVisible();

		const layout = await page.evaluate(() => {
			const controls = [
				...document.querySelectorAll<HTMLElement>(
					'main a[href], main button, main input, main label'
				)
			].filter((el) => el.checkVisibility() && el.getBoundingClientRect().width > 0);
			return {
				width: document.documentElement.scrollWidth,
				past: controls
					.filter((el) => el.getBoundingClientRect().right > 390 - 56)
					.map((el) => el.textContent?.trim() || el.getAttribute('aria-label'))
			};
		});
		expect(layout).toEqual({ width: 390, past: [] });

		await chip(page, 'Reference').click();
		await expect(chip(page, 'Reference')).toHaveAttribute('aria-pressed', 'false');
		await expect(page).toHaveURL(
			/cols=date%2Cstart%2Cend%2Cduration%2Ccustomer%2Cproject%2Cactivity%2Clocation%2Cdescription|cols=date,start,end,duration,customer,project,activity,location,description/
		);
		await copyButton(page).click();
		await expect(page.getByText('Copied 4 rows.')).toBeVisible();
		const copied = await page.evaluate(() => navigator.clipboard.readText());
		expect(copied.split('\r\n')[0]).toBe(
			[
				user.day(2),
				'09:00',
				'10:30',
				'1:30',
				'Acme',
				'Website',
				'Development',
				'Office',
				'Fixed the login form'
			].join('\t')
		);
	});
});

test.describe('the phone at 390 px, a filter on', () => {
	test.skip(({ isMobile }) => !isMobile, 'the phone; the PC is its own');
	test.use({ viewport: { width: 390, height: 844 } });

	test('the chip and Clear filters stay out of the "+"\'s column', async ({ page }) => {
		const user = await newUser('phone-chip');
		// The gate's chip, whose Clear filters once ended in the "+"'s column.
		const project = seedProject(user.id, seedCustomer(user.id, 'CompX'), 'CompY – Support');
		await openCopyOut(page, user.username, `/copy-out?project=${project}`);
		await expect(page.getByRole('list', { name: 'Filters' }).getByRole('listitem')).toHaveText([
			'CompX › CompY – Support'
		]);
		for (const control of await page
			.getByRole('main')
			.getByRole('link', { name: /^(Remove .*|Clear filters)$/ })
			.all()) {
			const b = (await control.boundingBox())!;
			expect(b.x + b.width).toBeLessThanOrEqual(390 - 56);
		}
	});
});

test.describe('the CSV route', () => {
	test.skip(({ isMobile }) => isMobile, 'once is enough');

	test('signed out, it redirects to sign-in', async ({ request }) => {
		const res = await request.get('/copy-out/csv?cols=date', { maxRedirects: 0 });
		expect(res.status()).toBe(303);
		expect(res.headers()['location']).toBe('/login');
	});

	test("another user's session gets only its own rows", async ({ page }) => {
		const owner = await newUser('owner');
		const other = await seedMonth(`${test.info().project.name}-other`, zone);
		await signIn(page, other.username);

		const own = await page.request.get('/copy-out/csv?range=this-month');
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
			`/copy-out/csv?range=custom&from=&to=&project=${owner.projects.support}`
		);
		expect(theirs.status()).toBe(200);
		expect(parseCsv((await theirs.text()).replace(/^\uFEFF/, ''))).toEqual([ALL_HEADS]);
	});

	test('a hand-made bad query is a 400 with the screen’s message', async ({ page }) => {
		const user = await newUser('bad');
		await signIn(page, user.username);
		const cases: [string, string][] = [
			['?range=custom&from=2026-13-01', 'Use dates like 2026-10-01.'],
			['?range=custom&from=2026-10-31&to=2026-10-01', 'From must not be after To.'],
			['?cols=&round=1', 'Choose at least one column.']
		];
		for (const [query, message] of cases) {
			const res = await page.request.get(`/copy-out/csv${query}`);
			expect(res.status(), query).toBe(400);
			expect(await res.text(), query).toBe(message);
		}
	});
});

test.describe('without JavaScript', () => {
	test.skip(({ isMobile }) => isMobile, 'the PC page; the phone shares its form');
	test.use({ javaScriptEnabled: false });

	test('a chip unticked and Apply change the sheet; the CSV works; there is no Copy', async ({
		page
	}) => {
		const user = await newUser('nojs');
		const { day } = user;
		await openCopyOut(page, user.username, '/copy-out', false);

		await sheetIs(page, ALL_HEADS, monthRows(user));
		await expect(copyButton(page)).toHaveCount(0);

		await page.getByRole('checkbox', { name: 'Customer', exact: true }).uncheck();
		await page.getByRole('checkbox', { name: 'Split at midnight' }).check();
		await page.getByRole('checkbox', { name: 'Round to 5 minutes' }).uncheck();
		await page.getByRole('radio', { name: 'Decimal' }).check();
		await page.getByRole('button', { name: 'Apply' }).click();
		await expect(page).toHaveURL(/\/copy-out\?/);
		await expect(sheet(page).getByRole('columnheader')).toHaveText(
			ALL_HEADS.filter((h) => h !== 'Customer')
		);
		await expect(tally(page, '5 rows · 7.23')).toBeVisible();
		await expect(sheet(page).locator('tbody tr').nth(2).getByRole('cell').nth(0)).toHaveText(
			day(4)
		);
		await expect(page.getByRole('checkbox', { name: 'Round to 5 minutes' })).not.toBeChecked();
		await expect(copyButton(page)).toHaveCount(0);

		// The filter's form keeps the choice.
		await filterButton(page).click();
		await panel(page)
			.getByRole('radio', { name: /^Last month/ })
			.check();
		await panel(page).getByRole('button', { name: 'Show' }).click();
		await expect(tally(page, '1 row · 1.00')).toBeVisible();
		await expect(sheet(page).getByRole('columnheader')).toHaveText(
			ALL_HEADS.filter((h) => h !== 'Customer')
		);

		await page.goto('/copy-out?range=this-month');
		const { download, bytes } = await downloadCsv(page);
		expect(download.suggestedFilename()).toBe(`time-keep-${day(1)}-${user.lastDay}.csv`);
		const [heads, ...rows] = parseCsv(bytes.subarray(3).toString('utf8'));
		expect(heads).toEqual(ALL_HEADS.filter((h) => h !== 'Customer'));
		expect(rows).toHaveLength(5);
	});
});
