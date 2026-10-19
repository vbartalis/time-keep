import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { PASSWORD, editElsewhere, noonZone, seedEmptyUser, seedUser, type Seeded } from './seed';

// Noon in the browser's zone, so the morning entries are today's whenever this runs.
const zone = noonZone();
test.use({ timezoneId: zone });

// One user per browser project (each project runs in its own worker), so the phone's
// and the PC's timers and entries never mix.
let user: Seeded;
test.beforeAll(async () => {
	user = await seedUser(test.info().project.name, zone);
});

/** Signs in; with `zoneCookie`, as a device that already gave its zone. */
async function signIn(page: Page, username: string, zoneCookie = true) {
	if (zoneCookie) await rememberZone(page.context());
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

const strip = (page: Page) => page.getByRole('status');
const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const entryRow = (page: Page, text: string) =>
	section(page, 'Today’s entries').getByRole('link').filter({ hasText: text });

/** Opens a template's sheet, types a description and logs it. */
async function logFromTemplate(page: Page, name: string, description: string) {
	const templates = section(page, 'Templates');
	await templates.locator('summary').filter({ hasText: name }).click();
	const sheet = templates.locator('details[open]');
	await sheet.getByLabel('Description').fill(description);
	await sheet.getByRole('button', { name: 'Log' }).click();
}

async function startTimer(page: Page, project: string, description: string) {
	const form = section(page, 'Start a timer');
	await form.getByLabel('Project').selectOption({ label: project });
	await form.getByLabel('Description').fill(description);
	await form.getByRole('button', { name: 'Start timer' }).click();
}

test('logs from a template with only a description, and undoes it', async ({ page }) => {
	await signIn(page, user.username);
	await logFromTemplate(page, 'Standup', 'Planned the sprint');

	await expect(strip(page)).toContainText('Done: Create entry from template "Standup".');
	const row = entryRow(page, 'Planned the sprint');
	await expect(row).toContainText('10:00');
	await expect(row).toContainText('10:15');
	await expect(row).toContainText('0:15');
	await expect(row).toContainText('Acme › Website');

	await strip(page).getByRole('button', { name: 'Undo' }).click();
	await expect(strip(page)).toContainText('Undone.');
	await expect(entryRow(page, 'Planned the sprint')).toHaveCount(0);
});

test('Today shows no placeholder panel, only its working sections', async ({ page }) => {
	await signIn(page, user.username);

	await expect(page.getByRole('heading', { name: 'At the desk' })).toHaveCount(0);
	await expect(page.getByText('Not built yet')).toHaveCount(0);
	for (const name of ['Timers', 'Templates', 'Start a timer', 'Today’s entries'])
		await expect(section(page, name)).toBeVisible();
});

test('starts a timer, a second on the same project stops the first, stop undoes', async ({
	page
}) => {
	await signIn(page, user.username);
	const timers = section(page, 'Timers');

	await test.step('start a timer and see it running', async () => {
		await startTimer(page, 'Mobile app', 'First timer');
		await expect(strip(page)).toContainText('Done: Start timer on "Mobile app".');
		await expect(timers.getByRole('listitem')).toHaveCount(1);
		await expect(timers).toContainText('Northwind › Mobile app');
		await expect(timers).toContainText('First timer');
		await expect(entryRow(page, 'First timer')).toContainText('Running');
	});

	await test.step('a second timer on the same project stops the first', async () => {
		await startTimer(page, 'Mobile app', 'Second timer');
		await expect(timers.getByRole('listitem')).toHaveCount(1);
		await expect(timers).toContainText('Second timer');
		await expect(timers).not.toContainText('First timer');
		await expect(entryRow(page, 'First timer')).not.toContainText('Running');
		await expect(entryRow(page, 'Second timer')).toContainText('Running');
	});

	await test.step('stop it, and the redirected Today undoes the stop', async () => {
		await timers.getByRole('button', { name: /^Stop Mobile app/ }).click();
		await expect(strip(page)).toContainText('Done: Stop timer on "Mobile app".');
		await expect(timers).toContainText('No timer running.');
		await expect(entryRow(page, 'Second timer')).not.toContainText('Running');

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(timers).toContainText('Second timer');
		await expect(entryRow(page, 'Second timer')).toContainText('Running');

		await timers.getByRole('button', { name: /^Stop Mobile app/ }).click();
		await expect(timers).toContainText('No timer running.');
	});
});

test('edits an entry’s end and description, and undoes the edit', async ({ page }) => {
	await signIn(page, user.username);
	await entryRow(page, 'Sorted the inbox').click();
	await expect(page.getByRole('heading', { name: 'Edit entry' })).toBeVisible();
	await expect(page.getByLabel('End', { exact: true })).toHaveValue(`${user.today}T06:30`);

	await page.getByLabel('End', { exact: true }).fill(`${user.today}T06:45`);
	await page.getByLabel('Description').fill('Sorted the inbox and replied');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect(page).toHaveURL(/\/$/);
	await expect(strip(page)).toContainText('Done: Edit entry on "Website".');
	const row = entryRow(page, 'Sorted the inbox and replied');
	await expect(row).toContainText('06:45');
	await expect(row).toContainText('0:45');

	await strip(page).getByRole('button', { name: 'Undo' }).click();
	await expect(strip(page)).toContainText('Undone.');
	await expect(entryRow(page, 'Sorted the inbox and replied')).toHaveCount(0);
	await expect(entryRow(page, 'Sorted the inbox')).toContainText('06:30');
});

test('a save over a change made elsewhere is refused with a reload', async ({ page }) => {
	await signIn(page, user.username);
	await page.goto(`/entries/${user.entries.toEdit}`);
	editElsewhere(user.id, user.entries.toEdit, 'Changed on the PC');

	await page.getByLabel('Description').fill('Changed on the phone');
	await page.getByRole('button', { name: 'Save' }).click();
	const alert = page.getByRole('alert');
	await expect(alert).toContainText('This was changed elsewhere; reload and try again.');
	await alert.getByRole('link', { name: 'Reload' }).click();
	await expect(page.getByLabel('Description')).toHaveValue('Changed on the PC');
});

test('deletes an entry after a confirm, and undoes the delete', async ({ page }) => {
	await signIn(page, user.username);
	await entryRow(page, 'Filed the receipts').click();
	await page.getByRole('button', { name: 'Delete entry' }).click();
	await expect(page.getByText('Delete this entry? You can undo it from Today.')).toBeVisible();
	await page.getByRole('button', { name: 'Yes, delete it' }).click();

	await expect(page).toHaveURL(/\/$/);
	await expect(strip(page)).toContainText('Done: Delete entry on "Operations".');
	await expect(entryRow(page, 'Filed the receipts')).toHaveCount(0);

	await strip(page).getByRole('button', { name: 'Undo' }).click();
	await expect(strip(page)).toContainText('Undone.');
	await expect(entryRow(page, 'Filed the receipts')).toContainText('07:30');
});

/** Opens the template disclosure on an entry's edit screen and posts a name. */
async function saveAsTemplate(page: Page, name: string) {
	await page.goto(`/entries/${user.entries.toEdit}`);
	await page.locator('summary', { hasText: 'Save as template' }).click();
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByRole('button', { name: 'Save template' }).click();
}

test('saves an entry as a template; a duplicate name is refused beside the field', async ({
	page
}) => {
	await signIn(page, user.username);
	await saveAsTemplate(page, 'Standup');
	const name = page.getByLabel('Name', { exact: true });
	await expect(page.getByText('Save as template')).toBeVisible();
	await expect(name).toHaveValue('Standup');
	await expect(name).toBeFocused();
	await expect(name).toHaveAttribute('aria-invalid', 'true');
	await expect(page.locator('#name-error')).toContainText('already');

	await name.fill(`Inbox ${test.info().project.name}`);
	await page.getByRole('button', { name: 'Save template' }).click();
	await expect(page).toHaveURL(/\/templates$/);
	await expect(strip(page)).toContainText(
		'Done: Save entry as template "Inbox ' + test.info().project.name + '".'
	);
});

test('an overlapping entry shows its warning', async ({ page }) => {
	await signIn(page, user.username);
	await logFromTemplate(page, 'Support call', 'Called about the outage');

	await expect(strip(page)).toContainText('Overlaps another entry');
	await expect(entryRow(page, 'Called about the outage')).toContainText('Overlaps another entry');
	await expect(entryRow(page, 'Morning support')).not.toContainText('Overlaps another entry');
});

test('a user without projects sees where to set them up', async ({ page }, testInfo) => {
	const empty = await seedEmptyUser(`${testInfo.project.name}-empty`);
	await signIn(page, empty.username);

	await expect(section(page, 'Timers')).toContainText('No timer running.');
	await expect(section(page, 'Templates')).toContainText('Templates are set up on the PC.');
	await expect(
		section(page, 'Templates').getByRole('link', { name: 'Create a template' })
	).toHaveAttribute('href', '/templates/new');
	await expect(
		section(page, 'Templates').getByRole('link', { name: 'Edit templates' })
	).toHaveAttribute('href', '/templates');
	await expect(section(page, 'Start a timer')).toContainText(
		'Customers and projects are set up on the PC.'
	);
	await expect(
		section(page, 'Start a timer').getByRole('link', { name: 'Set up customers and projects' })
	).toHaveAttribute('href', '/setup');
	await expect(section(page, 'Start a timer').getByRole('button')).toHaveCount(0);
	await expect(section(page, 'Today’s entries')).toContainText('Nothing logged today.');
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('logs from a template and starts and stops a timer as plain posts', async ({ page }) => {
		// No zone cookie either: the server falls back to the zone of the latest entry.
		await signIn(page, user.username, false);
		await expect(page.getByText(`Times in ${zone}.`)).toBeVisible();

		await logFromTemplate(page, 'Review', 'Read the pull requests');
		await expect(strip(page)).toContainText('Done: Create entry from template "Review".');
		await expect(entryRow(page, 'Read the pull requests')).toContainText('10:30');

		await startTimer(page, 'Operations', 'Offline timer');
		const timers = section(page, 'Timers');
		await expect(timers).toContainText('Offline timer');
		await timers.getByRole('button', { name: /^Stop Operations/ }).click();
		await expect(strip(page)).toContainText('Done: Stop timer on "Operations".');
		await expect(timers).toContainText('No timer running.');

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(timers).toContainText('Offline timer');
		await timers.getByRole('button', { name: /^Stop Operations/ }).click();
		await expect(timers).toContainText('No timer running.');

		// The layout's script writes the zone cookie; without JavaScript it never ran.
		const cookies = await page.context().cookies();
		expect(cookies.map((c) => c.name)).not.toContain('tz');
	});

	test('a refused template save reopens the disclosure with the name', async ({ page }) => {
		await signIn(page, user.username, false);
		await saveAsTemplate(page, 'Standup');
		const name = page.getByLabel('Name', { exact: true });
		await expect(name).toBeVisible();
		await expect(name).toHaveValue('Standup');
		await expect(page.locator('#name-error')).toContainText('already');
	});
});
