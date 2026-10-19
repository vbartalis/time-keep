import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
	PASSWORD,
	deleteElsewhere,
	editElsewhere,
	noonZone,
	seedMany,
	seedMonth,
	startElsewhere,
	type Month
} from './seed';

// Noon in the browser's zone, so the default search is the month the seeded entries are in.
const zone = noonZone();
test.use({ timezoneId: zone });

/** A user of its own for each test, with the month of `seedMonth`, so no test sees another's changes. */
const newMonth = (label: string) => seedMonth(`${test.info().project.name}-${label}`, zone);

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
 * Signs in and opens the Entries screen on the default month. With JavaScript it waits
 * for the script (the change form's count shows), since a picker chosen before then is
 * reset to the loaded search when the page hydrates.
 */
async function openEntries(page: Page, user: Month, script = true) {
	await signIn(page, user.username);
	await page.goto('/entries');
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	if (script) await expect(changeForm(page)).toContainText('0 selected');
}

const strip = (page: Page) => page.getByRole('status');
const filters = (page: Page) => page.getByRole('search');
const changeForm = (page: Page) => page.getByRole('region', { name: 'Change selected' });
const found = (page: Page) => page.getByRole('region', { name: 'Found' });

/** Every row's checkbox, named "Select <date> <in>, <customer › project>". */
const boxes = (page: Page) => page.getByRole('checkbox', { name: /^Select \d{4}-\d{2}-\d{2} / });
const box = (page: Page, date: string, time: string) =>
	page.getByRole('checkbox', { name: new RegExp(`^Select ${date} ${time},`) });

/** The listed rows are exactly those starting on `dates`. */
async function listsDays(page: Page, dates: string[]) {
	await expect(boxes(page)).toHaveCount(dates.length);
	for (const date of dates) {
		await expect(page.getByRole('checkbox', { name: new RegExp(`^Select ${date} `) })).toHaveCount(
			1
		);
	}
}

/** Picks an option in one of the filter form's pickers, by its label. */
const filterBy = (page: Page, label: string, option: string) =>
	filters(page).getByLabel(label, { exact: true }).selectOption({ label: option });

async function search(page: Page) {
	await filters(page).getByRole('button', { name: 'Search' }).click();
	await expect(page).toHaveURL(/\/entries\?/);
}

async function clear(page: Page) {
	await filters(page).getByRole('link', { name: 'Clear' }).click();
	await expect(page).toHaveURL(/\/entries$/);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('finds entries by range, customer, project, activity none and text; Clear returns to the month', async ({
	page
}) => {
	const user = await newMonth('find');
	const { day } = user;
	await openEntries(page, user);

	await test.step('the month by default, last month left out', async () => {
		await expect(filters(page).getByLabel('From', { exact: true })).toHaveValue(day(1));
		await listsDays(page, [day(2), day(3), day(6), day(9), day(13)]);
		await expect(found(page)).toContainText('5 entries, 8:30');
		await expect(page.getByText('Fixed the login form last month')).toHaveCount(0);
	});

	await test.step('a range', async () => {
		await filters(page).getByLabel('From', { exact: true }).fill(day(2));
		await filters(page).getByLabel('To', { exact: true }).fill(day(3));
		await search(page);
		await listsDays(page, [day(2), day(3)]);
		await expect(found(page)).toContainText('2 entries, 3:30');
	});

	await test.step('Clear returns to the month', async () => {
		await clear(page);
		await listsDays(page, [day(2), day(3), day(6), day(9), day(13)]);
	});

	await test.step('a customer', async () => {
		await filterBy(page, 'Customer', 'Northwind');
		await search(page);
		await listsDays(page, [day(9), day(13)]);
		await clear(page);
	});

	await test.step('a project', async () => {
		await filterBy(page, 'Project', 'Operations');
		await search(page);
		await listsDays(page, [day(6)]);
		await expect(found(page)).toContainText('1 entry, 2:00');
		await clear(page);
	});

	await test.step('activity None', async () => {
		await filterBy(page, 'Activity', 'None');
		await search(page);
		await listsDays(page, [day(6), day(13)]);
		await clear(page);
	});

	await test.step('text matching a project name, case-insensitively', async () => {
		await filters(page).getByLabel('Text').fill('MOBILE');
		await search(page);
		await listsDays(page, [day(9), day(13)]);
		await clear(page);
	});

	await test.step('text matching a description', async () => {
		await filters(page).getByLabel('Text').fill('login');
		await search(page);
		await listsDays(page, [day(2), day(9)]);
		await expect(found(page)).toContainText('Fixed the login form');
		await expect(found(page)).toContainText('Built the login screen');
	});

	await test.step('nothing matching says so, with Clear', async () => {
		await filters(page).getByLabel('Text').fill('nowhere to be found');
		await search(page);
		await expect(page.getByText('No entries match.')).toBeVisible();
		await page.getByRole('link', { name: 'Clear' }).last().click();
		await listsDays(page, [day(2), day(3), day(6), day(9), day(13)]);
	});
});

test('selects and clears every shown row with JavaScript', async ({ page }) => {
	const user = await newMonth('selectall');
	await openEntries(page, user);

	// The head checkbox shows from the PC's width, the one above the table below it.
	const all = page.getByRole('checkbox', { name: 'Select all shown' });
	await all.check();
	await expect(changeForm(page)).toContainText('5 selected');
	await expect(boxes(page).first()).toBeChecked();
	await all.uncheck();
	await expect(changeForm(page)).toContainText('0 selected');
	await expect(boxes(page).first()).not.toBeChecked();
});

test('changes three entries in one batch, and undoes all three', async ({ page }) => {
	const user = await newMonth('change');
	const { day } = user;
	await openEntries(page, user);

	await box(page, day(2), '09:00').check();
	await box(page, day(9), '08:00').check();
	await box(page, day(13), '10:00').check();
	await expect(changeForm(page)).toContainText('3 selected');

	await changeForm(page).getByLabel('Activity').selectOption({ label: 'Meeting' });
	await changeForm(page).getByLabel('Find').fill('login');
	await changeForm(page).getByLabel('Replace with').fill('sign-in');
	await changeForm(page).getByRole('button', { name: 'Apply to selected' }).click();

	// Day 13's entry has no "login": only its activity changes, and it still counts.
	await expect(strip(page)).toContainText('Done: Edit 3 entries.');
	await expect(page).toHaveURL(new RegExp(`/entries\\?from=${day(1)}&to=`));
	await expect(found(page)).toContainText('Fixed the sign-in form');
	await expect(found(page)).toContainText('Built the sign-in screen');
	await expect(found(page)).toContainText('Reviewed the crash reports');
	if (test.info().project.name === 'pc') {
		// The activity column shows at the PC's width.
		const crashes = page.getByRole('row').filter({ hasText: 'Reviewed the crash reports' });
		await expect(crashes).toContainText('Meeting');
	}
	// The form starts again: nothing selected, the fields cleared.
	await expect(changeForm(page)).toContainText('0 selected');
	await expect(changeForm(page).getByLabel('Find')).toHaveValue('');

	await strip(page).getByRole('button', { name: 'Undo' }).click();
	await expect(strip(page)).toContainText('Undone.');
	await expect(found(page)).toContainText('Fixed the login form');
	await expect(found(page)).toContainText('Built the login screen');
	await expect(found(page)).not.toContainText('sign-in');

	// Undo put the activities back too: only the seeded meeting has Meeting.
	await filterBy(page, 'Activity', 'Meeting');
	await search(page);
	await listsDays(page, [day(3)]);
});

test('deletes two entries after confirming on the page, and undoes the delete', async ({
	page
}) => {
	const user = await newMonth('delete');
	const { day } = user;
	await openEntries(page, user);

	await box(page, day(6), '13:00').check();
	await box(page, day(13), '10:00').check();
	await changeForm(page).getByRole('button', { name: 'Delete selected' }).click();

	await expect(page.getByText('Delete 2 entries?')).toBeVisible();
	const yes = page.getByRole('button', { name: 'Yes, delete them' });
	await expect(yes).toBeFocused();
	await expect(page.getByRole('link', { name: 'Keep them' })).toBeVisible();
	await yes.click();

	await expect(strip(page)).toContainText('Done: Delete 2 entries.');
	await listsDays(page, [day(2), day(3), day(9)]);
	await expect(found(page)).toContainText('3 entries, 4:30');

	await strip(page).getByRole('button', { name: 'Undo' }).click();
	await expect(strip(page)).toContainText('Undone.');
	await listsDays(page, [day(2), day(3), day(6), day(9), day(13)]);
});

test('a selected entry changed elsewhere refuses the whole change, with a reload', async ({
	page
}) => {
	const user = await newMonth('stale');
	const { day } = user;
	await openEntries(page, user);

	await box(page, day(2), '09:00').check();
	await box(page, day(9), '08:00').check();
	editElsewhere(user.id, user.entries.screen, 'Built the login screen again');

	await changeForm(page).getByLabel('Find').fill('login');
	await changeForm(page).getByLabel('Replace with').fill('sign-in');
	await changeForm(page).getByRole('button', { name: 'Apply to selected' }).click();

	const alert = page.getByRole('alert');
	await expect(alert).toHaveText(
		`${day(9)} 08:00, Northwind › Mobile app: This was changed elsewhere; reload and try again. Reload`
	);
	// The form and the selection are kept as posted.
	await expect(changeForm(page).getByLabel('Find')).toHaveValue('login');
	await expect(box(page, day(2), '09:00')).toBeChecked();
	await expect(box(page, day(9), '08:00')).toBeChecked();

	await alert.getByRole('link', { name: 'Reload' }).click();
	await expect(page.getByRole('alert')).toHaveCount(0);
	// Nothing was written: the first entry, which the core took before the refusal, is as it was.
	await expect(found(page)).toContainText('Fixed the login form');
	await expect(found(page)).toContainText('Built the login screen again');
	await expect(found(page)).not.toContainText('sign-in');
});

test('an entry deleted elsewhere refuses the change without naming it', async ({ page }) => {
	const user = await newMonth('gone');
	const { day } = user;
	await openEntries(page, user);

	await box(page, day(2), '09:00').check();
	await box(page, day(9), '08:00').check();
	deleteElsewhere(user.id, user.entries.screen);

	await changeForm(page).getByLabel('Activity').selectOption({ label: 'Meeting' });
	await changeForm(page).getByRole('button', { name: 'Apply to selected' }).click();

	// The screen cannot name an entry it can no longer read, and a reload would not help:
	// the core's message alone, no Reload.
	const alert = page.getByRole('alert');
	await expect(alert).toHaveText('Not found.');
	await expect(alert.getByRole('link', { name: 'Reload' })).toHaveCount(0);

	await page.goto('/entries');
	await expect(changeForm(page)).toContainText('0 selected');
	await listsDays(page, [day(2), day(3), day(6), day(13)]);
	await filterBy(page, 'Activity', 'Meeting');
	await search(page);
	await listsDays(page, [day(3)]);
});

test('a refusal names the entry it came from', async ({ page }) => {
	const user = await newMonth('refused');
	// A running entry on Website, and a timer on Operations that started after it, at
	// times no seeded entry has, so today's boxes stay unique whatever day it is.
	startElsewhere(user.id, user.projects.website, zone, '07:15', 'Deploying');
	startElsewhere(user.id, user.projects.operations, zone, '07:45', 'On call');
	await openEntries(page, user);

	await box(page, user.today, '07:15').check();
	await changeForm(page).getByLabel('Project').selectOption({ label: 'Operations' });
	await changeForm(page).getByRole('button', { name: 'Apply to selected' }).click();

	const alert = page.getByRole('alert');
	await expect(alert).toHaveText(new RegExp(`^${escape(`${user.today} 07:15, Acme › Website: `)}`));
	await expect(alert).toHaveText(
		`${user.today} 07:15, Acme › Website: The running timer on this project started later; stop it first.`
	);
	// Not a stale row: a reload would not help.
	await expect(alert.getByRole('link', { name: 'Reload' })).toHaveCount(0);
});

test('opens an entry from a search, saves, and lands back on the search', async ({ page }) => {
	const user = await newMonth('open');
	const { day } = user;
	await openEntries(page, user);
	await filterBy(page, 'Customer', 'Acme');
	await search(page);

	await found(page)
		.getByRole('link', { name: day(6) })
		.click();
	await expect(page.getByRole('heading', { name: 'Edit entry' })).toBeVisible();
	if (test.info().project.name === 'pc') {
		await expect(
			page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Entries' })
		).toHaveAttribute('aria-current', 'page');
	} else {
		// The phone's bar has no Entries; Today is not current either.
		await expect(
			page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' })
		).not.toHaveAttribute('aria-current', 'page');
	}

	await page.getByLabel('Description').fill('Filed the receipts twice');
	await page.getByRole('button', { name: 'Save' }).click();

	// The search as the screen writes it: the blank filters left out.
	await expect(page).toHaveURL(
		new RegExp(`/entries\\?from=${day(1)}&to=\\d{4}-\\d{2}-\\d{2}&customerId=\\w+$`)
	);
	await expect(strip(page)).toContainText('Done: Edit entry on "Operations".');
	await expect(found(page)).toContainText('Filed the receipts twice');
	await listsDays(page, [day(2), day(3), day(6)]);
});

test('500 rows at most, with a message to narrow the filters', async ({ page }) => {
	const user = await newMonth('many');
	seedMany(user.id, zone, 501);
	await openEntries(page, user);

	await filterBy(page, 'Project', 'Bulk load');
	await search(page);
	await expect(page.getByText('Showing the first 500 entries; narrow the filters.')).toBeVisible();
	await expect(boxes(page)).toHaveCount(500);
	await expect(found(page)).toContainText('500 entries, 33:20');
	await expect(found(page).getByText('Bulk 500', { exact: true })).toHaveCount(1);
	await expect(found(page).getByText('Bulk 501', { exact: true })).toHaveCount(0);
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('searches, selects all and applies as plain requests', async ({ page }) => {
		const user = await newMonth('nojs');
		const { day } = user;
		await openEntries(page, user, false);

		await filters(page).getByLabel('Text').fill('login');
		await search(page);
		await listsDays(page, [day(2), day(9)]);

		await changeForm(page).getByRole('button', { name: 'Apply to selected' }).click();
		await expect(page.getByRole('alert')).toHaveText('Select at least one entry.');

		await found(page).getByRole('link', { name: 'Select all' }).click();
		await expect(page).toHaveURL(/&all=1$/);
		await expect(box(page, day(2), '09:00')).toBeChecked();
		await expect(box(page, day(9), '08:00')).toBeChecked();

		await changeForm(page).getByLabel('Activity').selectOption({ label: 'Meeting' });
		await changeForm(page).getByRole('button', { name: 'Apply to selected' }).click();
		await expect(strip(page)).toContainText('Done: Edit 2 entries.');
		// Back on the search, without `all`: nothing is checked any more.
		await expect(page).toHaveURL(/text=login$/);
		await expect(box(page, day(2), '09:00')).not.toBeChecked();

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(page).toHaveURL(/text=login$/);
	});
});
