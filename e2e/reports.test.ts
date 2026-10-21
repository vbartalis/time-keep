import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { PASSWORD, noonZone, seedCopyOut, seedDays, type CopyOutUser } from './seed';

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
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

/** Opens `path` (Reports by default) as a signed-in `user`, waiting for the script unless it is off. */
async function open(page: Page, path = '/reports', script = true) {
	await page.goto(path);
	const title = path.startsWith('/copy-out') ? 'Copy-out' : 'Reports';
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	if (script) await page.waitForLoadState('networkidle');
}

async function openReports(page: Page, user: CopyOutUser, path = '/reports', script = true) {
	await signIn(page, user.username);
	await open(page, path, script);
}

const filterButton = (page: Page) => page.locator('summary', { hasText: 'Filter' });
const panel = (page: Page) => page.getByRole('group', { name: 'Filter' });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search entries' });
/** The toolbar's count and total. */
const tally = (page: Page, text: string) => page.getByText(text, { exact: true });
const table = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const LISTS = ['Days', 'Weeks', 'Customers', 'Projects'];

/** The row of a list with this label reads this duration. */
async function rowIs(region: Locator, label: string | RegExp, duration: string) {
	const row = region.locator('tbody tr').filter({ hasText: label });
	await expect(row).toHaveCount(1);
	await expect(row.getByRole('cell').last()).toHaveText(duration);
}

const totalIs = (region: Locator, duration: string) =>
	expect(region.locator('tfoot td')).toHaveText(['Total', duration]);

const weekday = (date: string) =>
	new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/** A day's row label, as Entries' day heads: "Thu 2026-10-01". */
const dayLabel = (date: string) => `${weekday(date)} ${date}`;

async function chooseRange(page: Page, name: RegExp) {
	await filterButton(page).click();
	await panel(page).getByRole('radio', { name }).check();
	await page.keyboard.press('Escape');
}

test.describe('the PC', () => {
	test.skip(({ isMobile }) => isMobile, 'the PC at 1440 px; the phone is its own');

	test('the month: four lists, each Total the toolbar’s, the running line, the sidebar', async ({
		page
	}) => {
		const user = await newUser('month');
		const { day } = user;
		await openReports(page, user);

		await expect(filterButton(page)).toContainText('This month');
		await expect(tally(page, '4 entries · 7:15')).toBeVisible();
		await expect(page.getByText('1 running entry left out.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Show' })).toHaveCount(0);
		await expect(page.getByRole('checkbox', { name: 'Round to 5 minutes' })).toBeChecked();

		const days = table(page, 'Days');
		await rowIs(days, dayLabel(day(2)), '1:30');
		await rowIs(days, dayLabel(day(3)), '4:00');
		await rowIs(days, dayLabel(day(5)), '1:00');
		await rowIs(days, dayLabel(day(6)), '0:45');
		await expect(days.locator('tbody tr')).toHaveCount(4);
		await expect(days.locator('tbody td').first()).toHaveText(dayLabel(day(2)));

		await rowIs(table(page, 'Customers'), 'Acme', '2:30');
		await rowIs(table(page, 'Customers'), 'Northwind', '4:45');
		const projects = table(page, 'Projects');
		await rowIs(projects, 'Acme › Website', '2:30');
		await rowIs(projects, 'Northwind › Support', '4:45');
		// Each project row leads with its dot.
		await expect(projects.locator('tbody tr [class*="bg-project-"]')).toHaveCount(2);
		const weeks = table(page, 'Weeks');
		await expect(weeks.locator('tbody td').first()).toHaveText(
			/^W\d{2} · \d{4}-\d{2}-\d{2} – (\d{4}-)?\d{2}-\d{2}$/
		);
		for (const name of LISTS) await totalIs(table(page, name), '7:15');
		await expect(page.locator('main').getByText('Deploying')).toHaveCount(0);

		const main = page.getByRole('navigation', { name: 'Main' });
		await expect(main.getByRole('link', { name: 'Reports' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(main.getByRole('link', { name: 'Copy-out' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
		const names = (await main.getByRole('link').allInnerTexts()).map((n) => n.trim());
		expect(names.indexOf('Reports')).toBe(names.indexOf('Copy-out') + 1);
	});

	test('Days at the left; Weeks, Customers and Projects stacked close at the right', async ({
		page
	}) => {
		const user = await newUser('stack');
		seedDays(user.id, zone, 24);
		await openReports(page, user);

		const days = (await table(page, 'Days').boundingBox())!;
		const boxes = [];
		for (const name of ['Weeks', 'Customers', 'Projects'])
			boxes.push((await table(page, name).boundingBox())!);
		for (const box of boxes) expect(box.x).toBeGreaterThan(days.x + days.width);
		expect(days.height).toBeGreaterThan(boxes[2].y + boxes[2].height - boxes[0].y);
		for (let i = 1; i < boxes.length; i++) {
			const gap = boxes[i].y - (boxes[i - 1].y + boxes[i - 1].height);
			expect(gap).toBeGreaterThanOrEqual(0);
			expect(gap).toBeLessThan(40);
		}
	});

	test('the options apply at once: split, decimal, then Last month keeps them', async ({
		page
	}) => {
		const user = await newUser('options');
		const { day } = user;
		await openReports(page, user);

		await page.getByRole('checkbox', { name: 'Split at midnight' }).check();
		const days = table(page, 'Days');
		await rowIs(days, dayLabel(day(3)), '2:00');
		await rowIs(days, dayLabel(day(4)), '2:00');
		await rowIs(table(page, 'Customers'), 'Northwind', '4:45');
		// Split makes more rows, never more entries.
		await expect(tally(page, '4 entries · 7:15')).toBeVisible();
		await expect(page.getByRole('checkbox', { name: 'Split at midnight' })).toBeFocused();

		await page.getByRole('radio', { name: 'Decimal' }).check();
		await rowIs(table(page, 'Customers'), 'Acme', '2.50');
		await expect(tally(page, '4 entries · 7.25')).toBeVisible();
		for (const name of LISTS) await totalIs(table(page, name), '7.25');

		await chooseRange(page, /^Last month/);
		await expect(filterButton(page)).toContainText('Last month');
		await expect(tally(page, '1 entry · 1.00')).toBeVisible();
		await rowIs(table(page, 'Projects'), 'Acme › Website', '1.00');
		await expect(page.getByText('running entry left out')).toHaveCount(0);
		await expect(page.getByRole('radio', { name: 'Decimal' })).toBeChecked();
	});

	test('Gate 4: Reports opens on Copy-out’s kept range and options', async ({ page }) => {
		const user = await newUser('kept');
		await signIn(page, user.username);
		await open(page, '/copy-out');
		await chooseRange(page, /^Last month/);
		await expect(tally(page, '1 row · 1:00')).toBeVisible();
		await page.getByRole('radio', { name: 'Decimal' }).check();
		await expect(tally(page, '1 row · 1.00')).toBeVisible();

		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('link', { name: 'Reports' })
			.click();
		await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
		await expect(filterButton(page)).toContainText('Last month');
		await expect(tally(page, '1 entry · 1.00')).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Decimal' })).toBeChecked();
	});

	test('a filter or option change on Reports leaves Copy-out’s kept columns as they were', async ({
		page
	}) => {
		const user = await newUser('columns');
		await signIn(page, user.username);
		await open(page, '/copy-out?cols=date,duration');
		await expect(page.getByRole('table').getByRole('columnheader')).toHaveText([
			'Date',
			'Duration'
		]);

		await open(page, '/reports');
		await chooseRange(page, /^Last month/);
		await expect(tally(page, '1 entry · 1:00')).toBeVisible();
		await expect(page).toHaveURL(/cols=date%2Cduration|cols=date,duration/);
		await page.getByRole('checkbox', { name: 'Round to 5 minutes' }).uncheck();
		await expect(page).toHaveURL(/round=0/);
		await expect(page).toHaveURL(/cols=date%2Cduration|cols=date,duration/);

		await open(page, '/copy-out');
		await expect(page.getByRole('table').getByRole('columnheader')).toHaveText([
			'Date',
			'Duration'
		]);
	});

	test('Gate 5: the totals equal Copy-out’s for the same address, rounded and not', async ({
		page
	}) => {
		const user = await newUser('equal');
		await signIn(page, user.username);
		for (const [round, total] of [
			['1', '7:15'],
			['0', '7:14']
		]) {
			const query = `range=this-month&round=${round}&split=0&duration=hm`;
			await open(page, `/reports?${query}`);
			await expect(tally(page, `4 entries · ${total}`)).toBeVisible();
			for (const name of LISTS) await totalIs(table(page, name), total);
			await open(page, `/copy-out?${query}`);
			await expect(tally(page, `4 rows · ${total}`)).toBeVisible();
			await expect(page.getByRole('table').locator('tfoot td').nth(3)).toHaveText(total);
		}
	});

	test('Gate 6: the search narrows the totals as you type; no match says so', async ({ page }) => {
		const user = await newUser('search');
		await openReports(page, user);

		await search(page).click();
		await search(page).pressSequentially('T-10');
		await expect(tally(page, '1 entry · 1:30')).toBeVisible();
		for (const name of LISTS) await totalIs(table(page, name), '1:30');
		await expect(table(page, 'Customers').locator('tbody tr')).toHaveCount(1);
		await expect(search(page)).toBeFocused();

		await search(page).fill('zzzz');
		await expect(page.getByText('No entries match.')).toBeVisible();
		for (const name of LISTS) await expect(table(page, name)).toHaveCount(0);
	});

	test('only a running entry matching says so, with no lists', async ({ page }) => {
		const user = await newUser('running');
		await openReports(page, user);
		await search(page).fill('Deploying');
		await expect(page.getByText('No entries match.')).toBeVisible();
		await expect(page.getByText('1 running entry left out.')).toBeVisible();
		for (const name of LISTS) await expect(table(page, name)).toHaveCount(0);
	});

	test('a project filter is a chip with Clear filters', async ({ page }) => {
		const user = await newUser('chip');
		await openReports(page, user, `/reports?project=${user.projects.support}`);
		const filters = page.getByRole('list', { name: 'Filters' });
		await expect(filters.getByRole('listitem')).toHaveText(['Northwind › Support']);
		await expect(tally(page, '2 entries · 4:45')).toBeVisible();
		await expect(table(page, 'Projects').locator('tbody tr')).toHaveCount(1);
		await filters.getByRole('link', { name: 'Remove Northwind › Support' }).click();
		await expect(tally(page, '4 entries · 7:15')).toBeVisible();
	});
});

test.describe('the phone at 390 px', () => {
	test.skip(({ isMobile }) => !isMobile, 'the phone; the PC is its own');
	test.use({ viewport: { width: 390, height: 844 } });

	test('Gate 7: from More; the Options sheet to Decimal; Customers first; nothing under the "+"', async ({
		page
	}) => {
		const user = await newUser('phone');
		await signIn(page, user.username);
		const main = page.getByRole('navigation', { name: 'Main' });
		await expect(main.getByRole('link', { name: 'Reports' })).toHaveCount(0);
		await main.getByRole('button', { name: 'More' }).click();
		await page.getByRole('dialog').getByRole('link', { name: 'Reports' }).click();
		await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
		await page.waitForLoadState('networkidle');
		await expect(tally(page, '4 entries · 7:15')).toBeVisible();

		const tops = [];
		for (const name of ['Customers', 'Projects', 'Weeks', 'Days'])
			tops.push((await table(page, name).boundingBox())!.y);
		expect([...tops].sort((a, b) => a - b)).toEqual(tops);

		const layout = await page.evaluate(() => {
			const controls = [
				...document.querySelectorAll<HTMLElement>(
					'main a[href], main button, main input, main label, main summary'
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

		// At the foot of the page the last list's Total clears the "+".
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		const lastTotal = (await table(page, 'Days').locator('tfoot tr').boundingBox())!;
		const plus = (await page.getByRole('link', { name: 'New entry', exact: true }).boundingBox())!;
		expect(lastTotal.y + lastTotal.height).toBeLessThanOrEqual(plus.y);
		await page.evaluate(() => window.scrollTo(0, 0));

		const options = page.getByRole('button', { name: 'Options · h:mm, rounded' });
		await options.click();
		const sheet = page.getByRole('dialog', { name: 'Options' });
		await expect(sheet).toBeVisible();
		await sheet.getByRole('radio', { name: 'Decimal' }).check();
		await expect(tally(page, '4 entries · 7.25')).toBeVisible();
		await sheet.getByRole('button', { name: 'Done' }).click();
		await expect(sheet).toBeHidden();
		const decimal = page.getByRole('button', { name: 'Options · decimal, rounded' });
		await expect(decimal).toBeFocused();
		for (const name of LISTS) {
			for (const cell of await table(page, name).locator('td:last-child').allTextContents())
				expect(cell.trim()).toMatch(/^\d+\.\d{2}$/);
			await totalIs(table(page, name), '7.25');
		}

		// The phone's More holds Reports as the current screen.
		await main.getByRole('button', { name: 'More' }).click();
		await expect(page.getByRole('dialog').getByRole('link', { name: 'Reports' })).toHaveAttribute(
			'aria-current',
			'page'
		);
	});
});

test.describe('the phone without JavaScript', () => {
	test.skip(({ isMobile }) => !isMobile, 'the phone');
	test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

	test('Options is a <details> whose Apply reloads with decimal totals', async ({ page }) => {
		const user = await newUser('phone-nojs');
		await openReports(page, user, '/reports', false);
		const options = page.locator('summary', { hasText: 'Options · h:mm, rounded' });
		await options.click();
		const group = page.getByRole('group', { name: 'Options' });
		await group.getByRole('radio', { name: 'Decimal' }).check();
		await group.getByRole('button', { name: 'Apply' }).click();
		await expect(page.locator('summary', { hasText: 'Options · decimal, rounded' })).toBeVisible();
		await totalIs(table(page, 'Customers'), '7.25');
	});
});

test.describe('without JavaScript', () => {
	test.skip(({ isMobile }) => isMobile, 'the PC page; the phone shares its form');
	test.use({ javaScriptEnabled: false });

	test('the options’ Apply reloads with the split, decimal totals; the filter keeps them', async ({
		page
	}) => {
		const user = await newUser('nojs');
		const { day } = user;
		await openReports(page, user, '/reports', false);
		await rowIs(table(page, 'Days'), dayLabel(day(3)), '4:00');

		await page.getByRole('checkbox', { name: 'Split at midnight' }).check();
		await page.getByRole('radio', { name: 'Decimal' }).check();
		await page.getByRole('button', { name: 'Apply' }).click();
		await expect(page).toHaveURL(/\/reports\?/);
		await rowIs(table(page, 'Days'), dayLabel(day(3)), '2.00');
		await rowIs(table(page, 'Days'), dayLabel(day(4)), '2.00');
		await totalIs(table(page, 'Projects'), '7.25');

		await filterButton(page).click();
		await panel(page)
			.getByRole('radio', { name: /^Last month/ })
			.check();
		await panel(page).getByRole('button', { name: 'Show' }).click();
		await expect(tally(page, '1 entry · 1.00')).toBeVisible();
		await expect(page.getByRole('checkbox', { name: 'Split at midnight' })).toBeChecked();
	});
});
