import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { PASSWORD, noonZone, seedCopyOut, seedDays, type CopyOutUser } from './seed';

// Noon in the browser's zone, so the default report is the month the seeded entries are in.
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
 * Signs in and opens the Reports screen on the default month. With JavaScript it waits
 * a moment for hydration, since a box ticked before then is reset to the loaded choice.
 */
async function openReports(page: Page, user: CopyOutUser, script = true) {
	await signIn(page, user.username);
	await page.goto('/reports');
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	if (script) await page.waitForLoadState('networkidle');
}

const form = (page: Page) => page.getByRole('search');
const result = (page: Page) => page.getByRole('region', { name: 'Result' });
const table = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

async function show(page: Page) {
	await form(page).getByRole('button', { name: 'Show' }).click();
	await expect(page).toHaveURL(/\/reports\?/);
}

const weekday = (date: string) =>
	new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/** The row of a table with this label reads this duration. */
async function rowIs(region: Locator, label: string | RegExp, duration: string) {
	const row = region.getByRole('row').filter({ hasText: label });
	await expect(row).toHaveCount(1);
	await expect(row.getByRole('cell').last()).toHaveText(duration);
}

const totalIs = (region: Locator, duration: string) =>
	expect(region.getByRole('row').filter({ hasText: 'Total' }).getByRole('cell').last()).toHaveText(
		duration
	);

/** A day's row label: the date, then its weekday. */
const dayLabel = (date: string) => new RegExp(`^${date}\\s*${weekday(date)}`);

test('the month shows the four tables and the totals match the entries', async ({ page }) => {
	const user = await newUser('month');
	const { day } = user;
	await openReports(page, user);

	await expect(form(page).getByLabel('From', { exact: true })).toHaveValue(day(1));
	await expect(result(page)).toContainText('4 entries, 7:15');
	await expect(result(page)).toContainText('1 running entry left out.');
	await expect(result(page)).not.toContainText('Deploying');
	await expect(result(page)).not.toContainText('Reviewed last month');

	const days = table(page, 'Days');
	await expect(days).toBeVisible();
	await rowIs(days, dayLabel(day(2)), '1:30');
	await rowIs(days, dayLabel(day(3)), '4:00');
	await rowIs(days, dayLabel(day(5)), '1:00');
	await rowIs(days, dayLabel(day(6)), '0:45');
	await expect(days.locator('tbody tr')).toHaveCount(4);

	const customers = table(page, 'Customers');
	await rowIs(customers, 'Acme', '2:30');
	await rowIs(customers, 'Northwind', '4:45');
	const projects = table(page, 'Projects');
	await rowIs(projects, 'Acme › Website', '2:30');
	await rowIs(projects, 'Northwind › Support', '4:45');
	const weeks = table(page, 'Weeks');
	await expect(weeks).toBeVisible();
	expect(await weeks.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);

	for (const name of ['Days', 'Weeks', 'Customers', 'Projects']) {
		await totalIs(table(page, name), '7:15');
	}
});

test('on the PC the right column stacks Weeks, Customers and Projects close', async ({ page }) => {
	test.skip(test.info().project.name !== 'pc', 'the two columns are from 1024 px');
	const user = await newUser('stack');
	seedDays(user.id, zone, 24);
	await openReports(page, user);

	const days = await table(page, 'Days').boundingBox();
	const boxes = [];
	for (const name of ['Weeks', 'Customers', 'Projects']) {
		boxes.push(await table(page, name).boundingBox());
	}
	// Days is the taller one, the case that used to spread the right column apart.
	expect(days!.height).toBeGreaterThan(boxes[2]!.y + boxes[2]!.height - boxes[0]!.y);
	for (let i = 1; i < boxes.length; i++) {
		const gap = boxes[i]!.y - (boxes[i - 1]!.y + boxes[i - 1]!.height);
		expect(gap).toBeGreaterThanOrEqual(0);
		expect(gap).toBeLessThan(40);
	}
});

test('split at midnight divides the overnight entry; decimal hours; Last month', async ({
	page
}) => {
	const user = await newUser('options');
	const { day } = user;
	await openReports(page, user);

	await test.step('split at midnight', async () => {
		await form(page).getByRole('checkbox', { name: 'Split at midnight' }).check();
		await show(page);
		const days = table(page, 'Days');
		await rowIs(days, dayLabel(day(2)), '1:30');
		await rowIs(days, dayLabel(day(3)), '2:00');
		await rowIs(days, dayLabel(day(4)), '2:00');
		await rowIs(days, dayLabel(day(5)), '1:00');
		await rowIs(days, dayLabel(day(6)), '0:45');
		await rowIs(table(page, 'Customers'), 'Northwind', '4:45');
		await rowIs(table(page, 'Customers'), 'Acme', '2:30');
		await expect(result(page)).toContainText('4 entries, 7:15');
	});

	await test.step('decimal hours', async () => {
		await form(page).getByRole('radio', { name: 'Decimal hours' }).check();
		await show(page);
		await totalIs(table(page, 'Customers'), '7.25');
		await rowIs(table(page, 'Customers'), 'Acme', '2.50');
		await expect(result(page)).toContainText('4 entries, 7.25');
	});

	await test.step('Last month keeps the options', async () => {
		await form(page).getByRole('link', { name: 'Last month' }).click();
		await expect(form(page).getByLabel('From', { exact: true })).toHaveValue(user.lastMonth.from);
		await expect(result(page)).toContainText('1 entry, 1.00');
		await rowIs(table(page, 'Projects'), 'Acme › Website', '1.00');
		await expect(result(page)).not.toContainText('running');
	});

	await test.step('This month comes back', async () => {
		await form(page).getByRole('link', { name: 'This month' }).click();
		await expect(result(page)).toContainText('4 entries, 7.25');
	});
});

test('only a running entry matching says so, with no tables', async ({ page }) => {
	const user = await newUser('running');
	await openReports(page, user);

	await form(page).getByLabel('Text', { exact: true }).fill('Deploying');
	await show(page);
	await expect(page.getByText('No entries match.')).toBeVisible();
	await expect(page.getByText('1 running entry left out.')).toBeVisible();
	await expect(result(page)).toHaveCount(0);
	for (const name of ['Days', 'Weeks', 'Customers', 'Projects']) {
		await expect(table(page, name)).toHaveCount(0);
	}
});

test('the sidebar shows Reports after Copy-out and current; the phone has it in More', async ({
	page
}) => {
	const user = await newUser('rail');
	await openReports(page, user);
	const main = page.getByRole('navigation', { name: 'Main' });
	if (test.info().project.name === 'pc') {
		await expect(main.getByRole('link', { name: 'Reports' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(main.getByRole('link', { name: 'Copy-out' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
		const names = await main.getByRole('link').allInnerTexts();
		expect(names.map((n) => n.trim()).indexOf('Reports')).toBe(
			names.map((n) => n.trim()).indexOf('Copy-out') + 1
		);
	} else {
		await expect(main.getByRole('link', { name: 'Reports' })).toHaveCount(0);
		await main.getByRole('button', { name: 'More' }).click();
		await expect(page.getByRole('dialog').getByRole('link', { name: 'Reports' })).toHaveAttribute(
			'aria-current',
			'page'
		);
	}
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('Show with Split ticked reloads with the split totals', async ({ page }) => {
		const user = await newUser('nojs');
		const { day } = user;
		await openReports(page, user, false);
		await rowIs(table(page, 'Days'), dayLabel(day(3)), '4:00');

		await form(page).getByRole('checkbox', { name: 'Split at midnight' }).check();
		await show(page);
		await rowIs(table(page, 'Days'), dayLabel(day(3)), '2:00');
		await rowIs(table(page, 'Days'), dayLabel(day(4)), '2:00');
		await totalIs(table(page, 'Projects'), '7:15');
	});
});
