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
/** The shell's timer bar: the PC header's pill or the phone's strip. */
const bar = (page: Page) => section(page, 'Timer');
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

/** Starts `template` from the bar's Start list, with `description`. */
async function startTimer(page: Page, template: string, description: string) {
	const list = page.locator('[data-start-list]:visible');
	await page.locator('[data-start-list]:visible > summary').click();
	await list.locator('summary', { hasText: template }).click();
	await list.getByRole('textbox', { name: `Description for ${template}` }).fill(description);
	await list.getByRole('button', { name: 'Start', exact: true }).click();
}

/** The entry form opened over Today from a row. */
const editDialog = (page: Page) => page.getByRole('dialog', { name: 'Edit entry' });

/** Opens a row's form over Today: the address is the form's, Today stays under it. */
async function openRow(page: Page, text: string) {
	await page.waitForLoadState('networkidle');
	await entryRow(page, text).click();
	await expect(editDialog(page)).toBeVisible();
	await expect(page).toHaveURL(/\/entries\/\w+\?back=%2F$/);
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
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
	for (const name of ['Templates', 'Today’s entries'])
		await expect(section(page, name)).toBeVisible();
	// Timers start from the bar's Start list on every screen.
	await expect(section(page, 'Start a timer')).toHaveCount(0);
});

test('starts a timer, a second on the same project stops the first, stop undoes', async ({
	page
}) => {
	await signIn(page, user.username);
	const timers = bar(page);

	await test.step('start a timer and see it running', async () => {
		await startTimer(page, 'Standup', 'First timer');
		await expect(strip(page)).toContainText('Done: Start timer on "Website".');
		await expect(timers.getByRole('button', { name: /^Stop / })).toHaveCount(1);
		await expect(timers).toContainText('Website');
		await expect(entryRow(page, 'First timer')).toContainText('Running');
	});

	await test.step('a second timer on the same project stops the first', async () => {
		await startTimer(page, 'Standup', 'Second timer');
		await expect(timers.getByRole('button', { name: /^Stop / })).toHaveCount(1);
		// One timer: no "+N" list of others.
		await expect(timers.locator('summary', { hasText: '+1' })).toHaveCount(0);
		await expect(entryRow(page, 'First timer')).not.toContainText('Running');
		await expect(entryRow(page, 'Second timer')).toContainText('Running');
	});

	await test.step('stop it, and the redirected Today undoes the stop', async () => {
		await timers.getByRole('button', { name: /^Stop Website/ }).click();
		await expect(strip(page)).toContainText('Done: Stop timer on "Website".');
		await expect(timers).toContainText('No timer running');
		await expect(entryRow(page, 'Second timer')).not.toContainText('Running');

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(timers).toContainText('Website');
		await expect(entryRow(page, 'Second timer')).toContainText('Running');

		await timers.getByRole('button', { name: /^Stop Website/ }).click();
		await expect(timers).toContainText('No timer running');
	});
});

test('edits an entry’s end and description, and undoes the edit', async ({ page }) => {
	await signIn(page, user.username);
	await openRow(page, 'Sorted the inbox');
	const form = editDialog(page);
	const end = form.getByLabel('End', { exact: true });
	await expect(end).toHaveValue('06:30');

	await end.fill('645');
	await end.blur();
	await expect(end).toHaveValue('06:45');
	await form.getByLabel('Description').fill('Sorted the inbox and replied');
	await form.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(form).toBeHidden();

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

	await page.getByLabel('Description', { exact: true }).fill('Changed on the phone');
	await page.getByRole('button', { name: 'Save' }).click();
	const alert = page.getByRole('alert');
	await expect(alert).toContainText('This was changed elsewhere; reload and try again.');
	await alert.getByRole('link', { name: 'Reload' }).click();
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Changed on the PC');
});

test('deletes an entry at once, and undoes the delete', async ({ page }) => {
	await signIn(page, user.username);
	await openRow(page, 'Filed the receipts');
	await editDialog(page).getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(editDialog(page)).toBeHidden();

	await expect(page).toHaveURL(/\/$/);
	await expect(strip(page)).toContainText('Done: Delete entry on "Operations".');
	await expect(entryRow(page, 'Filed the receipts')).toHaveCount(0);

	await strip(page).getByRole('button', { name: 'Undo' }).click();
	await expect(strip(page)).toContainText('Undone.');
	await expect(entryRow(page, 'Filed the receipts')).toContainText('07:30');
});

test('a finished row restarts as a timer from Today', async ({ page }) => {
	const user = await seedUser(`${test.info().project.name}-row-restart`, zone);
	await signIn(page, user.username);
	const row = page.getByRole('listitem').filter({ hasText: 'Filed the receipts' });
	await expect(row.getByRole('button', { name: 'Restart Acme › Operations' })).toBeVisible();
	await page.waitForLoadState('networkidle');

	await row.getByRole('button', { name: 'Restart Acme › Operations' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(strip(page)).toContainText('Done: Start timer on "Operations".');
	await expect(bar(page)).toContainText('Acme › Operations');
	// The running row has no Restart.
	const running = page.getByRole('listitem').filter({ hasText: 'Running' });
	await expect(running).toContainText('Filed the receipts');
	await expect(running.getByRole('button', { name: /^Restart / })).toHaveCount(0);

	await bar(page)
		.getByRole('button', { name: /^Stop Operations/ })
		.click();
	await expect(bar(page)).toContainText('No timer running');
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
	// Back where the form was opened from: Today, since the page had no `back`.
	await expect(page).toHaveURL(/\/$/);
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

	await expect(bar(page)).toContainText('No timer running');
	await expect(section(page, 'Templates')).toContainText('Templates are set up on the PC.');
	await expect(
		section(page, 'Templates').getByRole('link', { name: 'Create a template' })
	).toHaveAttribute('href', '/templates/new');
	await expect(
		section(page, 'Templates').getByRole('link', { name: 'Edit templates' })
	).toHaveAttribute('href', '/templates');
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

		await startTimer(page, 'Review', 'Offline timer');
		const timers = bar(page);
		await expect(timers).toContainText('Operations');
		await timers.getByRole('button', { name: /^Stop Operations/ }).click();
		await expect(strip(page)).toContainText('Done: Stop timer on "Operations".');
		await expect(timers).toContainText('No timer running');

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(timers).toContainText('Operations');
		await timers.getByRole('button', { name: /^Stop Operations/ }).click();
		await expect(timers).toContainText('No timer running');

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
