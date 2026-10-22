/** Today on the phone (`ph-today`, `ph-template-sheet`); the PC's is `today.test.ts`. */
import { expect, test, type Page } from '@playwright/test';
import {
	PASSWORD,
	editElsewhere,
	noonZone,
	seedEmptyUser,
	seedEntry,
	seedToday,
	seedUser
} from './seed';
import {
	askedFor,
	bar,
	dayLabel,
	dayTotal,
	entryRow,
	logFromTemplate,
	openSheet,
	sheet,
	signIn,
	strip,
	templateRow,
	templates,
	todaySection,
	templatePanel,
	undo
} from './today';

// Noon in the browser's zone, so the morning entries are today's whenever this runs.
const zone = noonZone();
test.use({ timezoneId: zone });
test.skip(({ isMobile }) => !isMobile, 'The phone’s Today; the PC’s is today.test.ts.');

/** The ⋯ of a phone row, opening its sheet. */
const more = (page: Page, text: string) =>
	entryRow(page, text).getByRole('button', { name: /^Actions for/ });

test('logs from templates, asking only what each leaves blank (gate 1)', async ({ page }) => {
	const user = await seedToday('phone-gate', zone);
	await signIn(page, user.username, zone);
	await expect(todaySection(page)).toContainText(`Today · ${dayLabel(user.today)}`);
	await expect(todaySection(page)).toContainText('Nothing logged today.');
	await expect(dayTotal(page)).toHaveText('0:00');

	await test.step('a template that fills everything asks only for a description', async () => {
		const daily = await openSheet(page, 'Daily');
		expect(await askedFor(daily)).toEqual(['Description']);
		await expect(daily).toContainText('CompX › ClientY – ProjectZ · Meeting · Office · DAILY');
		await expect(daily.getByLabel('Description')).toBeFocused();
		await daily.getByRole('button', { name: 'Cancel' }).click();
		await expect(daily).toBeHidden();
		await expect(templateRow(page, 'Daily')).toBeFocused();
	});

	await test.step('Standup logs with a description; the total reads 0:15', async () => {
		const standup = await openSheet(page, 'Standup');
		// The gate's Standup has no location or reference: they are asked, and optional.
		expect(await askedFor(standup)).toEqual(['Location', 'Reference', 'Description']);
		await expect(standup.getByRole('combobox', { name: 'Customer › project' })).toHaveCount(0);
		await expect(standup.getByLabel('Location')).toBeFocused();
		await standup.getByLabel('Description').fill('Planned the sprint');
		await standup.getByRole('button', { name: 'Log', exact: true }).click();
		await expect(standup).toBeHidden();

		await expect(strip(page)).toContainText('Done: Create entry from template "Standup".');
		await expect(undo(page)).toBeFocused();
		const row = entryRow(page, 'Planned the sprint');
		await expect(row).toContainText('09:30');
		await expect(row).toContainText('09:45');
		await expect(row).toContainText('CompX › ClientY – ProjectZ');
		await expect(dayTotal(page)).toHaveText('0:15');
	});

	await test.step('Ticket asks location, reference and description', async () => {
		const ticket = await openSheet(page, 'Ticket');
		expect(await askedFor(ticket)).toEqual(['Location', 'Reference', 'Description']);
		await ticket.getByLabel('Location').selectOption({ label: 'Home office' });
		await ticket.getByLabel('Reference').fill('T-1234');
		await ticket.getByLabel('Description').fill('Reset the printer queue');
		await ticket.getByRole('button', { name: 'Log', exact: true }).click();
		await expect(ticket).toBeHidden();
		const row = entryRow(page, 'Reset the printer queue');
		await expect(row).toContainText('Support ticket · Home office · T-1234');
		await expect(row).toContainText('0:30');
		await expect(dayTotal(page)).toHaveText('0:45');
	});

	await test.step('nothing sits under the "+"; the page is no wider than the phone', async () => {
		const plus = await page.getByRole('link', { name: 'New entry', exact: true }).boundingBox();
		const manage = templates(page).getByRole('link', { name: 'Manage templates' });
		await expect(manage).toHaveText('Manage', { useInnerText: true });
		const m = await manage.boundingBox();
		expect(m && plus && m.x + m.width).toBeLessThanOrEqual(plus!.x);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			412
		);
	});
});

test('a refused sheet stays open with the message beside the field', async ({ page }) => {
	const user = await seedToday('phone-refused', zone);
	await signIn(page, user.username, zone);
	const standup = await openSheet(page, 'Standup');
	await standup.getByText('Change times').click();
	await standup.getByLabel('Start').fill('25');
	await standup.getByLabel('Description').fill('Too late');
	await expect(standup.getByText('Not a time of day.')).toBeVisible();
	await standup.getByRole('button', { name: 'Log', exact: true }).click();
	await expect(standup).toBeVisible();
	await expect(standup.getByLabel('Start')).toBeFocused();
	await expect(standup.getByLabel('Description')).toHaveValue('Too late');
	await expect(entryRow(page, 'Too late')).toHaveCount(0);

	await page.keyboard.press('Escape');
	await expect(standup).toBeHidden();
	// Each opening starts afresh.
	await openSheet(page, 'Standup');
	await expect(standup.getByLabel('Description')).toHaveValue('');
});

test('a template with a customer and no project offers only that customer’s projects', async ({
	page
}) => {
	const user = await seedToday('phone-customer', zone);
	await signIn(page, user.username, zone);

	const onCompX = await openSheet(page, 'On CompX');
	expect(await askedFor(onCompX)).toEqual([
		'Customer › project',
		'Activity',
		'Location',
		'Reference',
		'Description'
	]);
	const picker = onCompX.getByRole('combobox', { name: 'Customer › project' });
	await expect(picker).toBeFocused();
	await picker.click();
	const options = page.getByRole('listbox', { name: 'Customer › project' }).getByRole('option');
	await expect(options).toHaveText(['ClientY – ProjectZ', 'CompY – Support']);
	await options.filter({ hasText: 'CompY – Support' }).click();
	await onCompX.getByLabel('Description').fill('Answered the client');
	await onCompX.getByRole('button', { name: 'Log', exact: true }).click();
	await expect(onCompX).toBeHidden();
	await expect(entryRow(page, 'Answered the client')).toContainText('CompX › CompY – Support');

	const empty = await openSheet(page, 'On Empty Co');
	await expect(empty).toContainText('No active projects for Empty Co.');
	await expect(empty.getByRole('button', { name: 'Log', exact: true })).toBeDisabled();
});

test('the row sheet copies, deletes with Undo and restarts; a row opens its form', async ({
	page
}) => {
	const user = await seedToday('phone-rows', zone);
	seedEntry(user.id, zone, {
		projectId: user.projects.timeKeep,
		start: '08:00',
		end: '09:00',
		description: 'Wrote the tests'
	});
	await signIn(page, user.username, zone);
	await page.waitForLoadState('networkidle');

	await test.step('a row opens its form over Today', async () => {
		await entryRow(page, 'Wrote the tests').getByRole('link').click();
		const form = page.getByRole('dialog', { name: 'Edit entry' });
		await expect(form).toBeVisible();
		await expect(page).toHaveURL(/\/entries\/\w+\?back=%2F$/);
		await form.getByRole('button', { name: 'Cancel' }).click();
		await expect(form).toBeHidden();
	});

	await test.step('Copy opens a new entry from the row', async () => {
		await more(page, 'Wrote the tests').click();
		const menu = page.getByRole('dialog', { name: 'Myself › time-keep' });
		await menu.getByRole('link', { name: 'Copy' }).click();
		const copy = page.getByRole('dialog', { name: 'New entry' });
		await expect(copy.getByLabel('Description')).toHaveValue('Wrote the tests');
		await copy.getByRole('button', { name: 'Cancel' }).click();
		await expect(copy).toBeHidden();
	});

	await test.step('Delete at once, Undo brings it back', async () => {
		await more(page, 'Wrote the tests').click();
		await page
			.getByRole('dialog', { name: 'Myself › time-keep' })
			.getByRole('button', { name: 'Delete' })
			.click();
		await expect(strip(page)).toContainText('Done: Delete entry');
		await expect(entryRow(page, 'Wrote the tests')).toHaveCount(0);
		await expect(dayTotal(page)).toHaveText('0:00');
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(dayTotal(page)).toHaveText('1:00');
	});

	await test.step('Restart runs it in the bar; Stop', async () => {
		await more(page, 'Wrote the tests').click();
		await page
			.getByRole('dialog', { name: 'Myself › time-keep' })
			.getByRole('button', { name: 'Restart' })
			.click();
		await expect(bar(page)).toContainText('Myself › time-keep');
		await expect(entryRow(page, 'Running')).toContainText('Wrote the tests');
		await bar(page)
			.getByRole('button', { name: /^Stop / })
			.click();
		await expect(bar(page)).toContainText('No timer running');
	});
});

test('no templates says so and offers to create one', async ({ page }) => {
	const empty = await seedEmptyUser('phone-empty');
	await signIn(page, empty.username, zone);
	await expect(templates(page)).toContainText('No templates yet.');
	// The template form, opened over Today (returning there).
	await expect(templates(page).getByRole('link', { name: 'Create a template' })).toHaveAttribute(
		'href',
		'/templates/new?back=%2F'
	);
	await expect(templates(page).getByRole('link', { name: 'Manage templates' })).toHaveAttribute(
		'href',
		'/templates'
	);
	await expect(todaySection(page)).toContainText('Nothing logged today.');
	// Round 1's lines are gone: the date is in the entries' head, the zone the device's.
	await expect(page.getByText('Signed in as')).toHaveCount(0);
	await expect(page.getByText(/^Times in /)).toHaveCount(0);
});

test.describe('round 1’s Today flows', () => {
	let user: Awaited<ReturnType<typeof seedUser>>;
	test.beforeAll(async () => {
		user = await seedUser('phone', zone);
	});

	/** Opens a row's form over Today: the address is the form's, Today stays under it. */
	async function openRow(page: Page, text: string) {
		await page.waitForLoadState('networkidle');
		await entryRow(page, text).getByRole('link').click();
		await expect(page.getByRole('dialog', { name: 'Edit entry' })).toBeVisible();
		await expect(page).toHaveURL(/\/entries\/\w+\?back=%2F$/);
		await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
	}

	/** Starts `template` from the bar's Start list, with `description`. */
	async function startTimer(page: Page, template: string, description: string) {
		const list = page.locator('[data-start-list]:visible');
		await page.locator('[data-start-list]:visible > summary').click();
		await list.locator('summary', { hasText: template }).click();
		await list.getByRole('textbox', { name: `Description for ${template}` }).fill(description);
		await list.getByRole('button', { name: 'Start', exact: true }).click();
	}

	test('starts a timer, a second on the same project stops the first, stop undoes', async ({
		page
	}) => {
		await signIn(page, user.username, zone);
		const timers = bar(page);

		await startTimer(page, 'Standup', 'First timer');
		await expect(strip(page)).toContainText('Done: Start timer on "Website".');
		await expect(timers.getByRole('button', { name: /^Stop / })).toHaveCount(1);
		await expect(entryRow(page, 'First timer')).toContainText('Running');

		await startTimer(page, 'Standup', 'Second timer');
		await expect(timers.getByRole('button', { name: /^Stop / })).toHaveCount(1);
		await expect(entryRow(page, 'First timer')).not.toContainText('Running');
		await expect(entryRow(page, 'Second timer')).toContainText('Running');

		await timers.getByRole('button', { name: /^Stop Website/ }).click();
		await expect(strip(page)).toContainText('Done: Stop timer on "Website".');
		await expect(timers).toContainText('No timer running');
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(entryRow(page, 'Second timer')).toContainText('Running');
		await timers.getByRole('button', { name: /^Stop Website/ }).click();
		await expect(timers).toContainText('No timer running');
	});

	test('edits an entry’s end and description, and undoes the edit', async ({ page }) => {
		await signIn(page, user.username, zone);
		await openRow(page, 'Sorted the inbox');
		const form = page.getByRole('dialog', { name: 'Edit entry' });
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
		await expect(entryRow(page, 'Sorted the inbox and replied')).toContainText('06:45');
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(entryRow(page, 'Sorted the inbox and replied')).toHaveCount(0);
		await expect(entryRow(page, 'Sorted the inbox')).toContainText('06:30');
	});

	test('a save over a change made elsewhere is refused with a reload', async ({ page }) => {
		await signIn(page, user.username, zone);
		await page.goto(`/entries/${user.entries.toEdit}`);
		editElsewhere(user.id, user.entries.toEdit, 'Changed on the PC');

		await page.getByLabel('Description', { exact: true }).fill('Changed on the phone');
		await page.getByRole('button', { name: 'Save' }).click();
		const alert = page.getByRole('alert');
		await expect(alert).toContainText('This was changed elsewhere; reload and try again.');
		await alert.getByRole('link', { name: 'Reload' }).click();
		await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Changed on the PC');
	});

	test('deletes an entry from its form at once, and undoes the delete', async ({ page }) => {
		await signIn(page, user.username, zone);
		await openRow(page, 'Filed the receipts');
		const form = page.getByRole('dialog', { name: 'Edit entry' });
		await form.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(form).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
		await expect(strip(page)).toContainText('Done: Delete entry on "Operations".');
		await expect(entryRow(page, 'Filed the receipts')).toHaveCount(0);
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(entryRow(page, 'Filed the receipts')).toContainText('07:30');
	});

	test('saves an entry as a template; a duplicate name is refused beside the field', async ({
		page
	}) => {
		await signIn(page, user.username, zone);
		await page.goto(`/entries/${user.entries.toEdit}`);
		await page.locator('summary', { hasText: 'Save as template' }).click();
		const name = page.getByLabel('Name', { exact: true });
		await name.fill('Standup');
		await page.getByRole('button', { name: 'Save template' }).click();
		await expect(name).toHaveValue('Standup');
		await expect(name).toBeFocused();
		await expect(page.locator('#name-error')).toContainText('already');

		await name.fill('Inbox phone');
		await page.getByRole('button', { name: 'Save template' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(strip(page)).toContainText('Done: Save entry as template "Inbox phone".');
		await expect(templateRow(page, 'Inbox phone')).toBeVisible();
	});

	test('an overlapping entry shows its warning', async ({ page }) => {
		await signIn(page, user.username, zone);
		await logFromTemplate(page, 'Support call', 'Called about the outage');
		await expect(strip(page)).toContainText('Overlaps another entry');
		await expect(entryRow(page, 'Called about the outage')).toContainText('Overlaps another entry');
		// Both carry it, as on Entries: overlaps are judged against all the user's entries.
		await expect(entryRow(page, 'Morning support')).toContainText('Overlaps another entry');
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('a template’s <details> sheet logs, and a refusal reopens it', async ({ page }) => {
		const user = await seedToday('phone-nojs', zone);
		// No zone cookie either: the server falls back to the zone of the latest entry.
		await page.goto('/login');
		await page.getByLabel('Username').fill(user.username);
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
		await page.getByRole('button', { name: 'Sign in' }).click();

		const panel = templatePanel(page, 'Standup');
		await panel.locator(':scope > summary').click();
		await panel.getByLabel('Description').fill('Offline standup');
		await panel.getByRole('button', { name: 'Log', exact: true }).click();
		await expect(strip(page)).toContainText('Done: Create entry from template "Standup".');
		await expect(entryRow(page, 'Offline standup')).toContainText('09:30');

		await panel.locator(':scope > summary').click();
		await panel.getByText('Change times').click();
		await panel.getByLabel('End').fill('9:5');
		await panel.getByRole('button', { name: 'Log', exact: true }).click();
		await expect(panel).toHaveAttribute('open', '');
		await expect(panel).toContainText('Minutes take two digits, as in 9:05.');
		await expect(panel.getByLabel('End')).toHaveValue('9:5');
		await expect(sheet(page, 'Standup')).toHaveCount(0);
	});
});
