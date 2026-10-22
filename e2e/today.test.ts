/** Today on the PC (`pc-today`, `pc-template-sheet`); the phone's is `phone.test.ts`. */
import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, dateIn, noonZone, seedEmptyUser, seedSpan, seedToday } from './seed';
import {
	askedFor,
	bar,
	dayLabel,
	dayTotal,
	entryRow,
	logFromTemplate,
	openSheet,
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
test.skip(({ isMobile }) => isMobile, 'The PC’s Today; the phone’s is phone.test.ts.');

/** A row's ⋯ menu button. */
const menuButton = (page: Page, text: string) => entryRow(page, text).locator('summary');
const menu = (page: Page) => page.getByRole('menu');

test('fixes today: opens, copies, deletes with Undo and restarts a row (gate 2)', async ({
	page
}) => {
	const user = await seedToday('pc-gate', zone);
	await signIn(page, user.username, zone);
	await expect(todaySection(page)).toContainText(`Today · ${dayLabel(user.today)}`);
	await logFromTemplate(page, 'Standup', 'Standup');
	await expect(dayTotal(page)).toHaveText('0:15');
	// The table without tick boxes or a day head row.
	await expect(todaySection(page).getByRole('checkbox')).toHaveCount(0);
	await expect(todaySection(page).getByRole('columnheader')).toHaveText([
		'Start',
		'End',
		'Hours',
		'Customer › project',
		'Activity',
		'Location',
		'Reference',
		'Description',
		'Restart',
		'Actions'
	]);

	await test.step('a row click opens its form over Today; Save returns to Today', async () => {
		await entryRow(page, 'Standup').getByRole('cell', { name: 'Meeting' }).click();
		const form = page.getByRole('dialog', { name: 'Edit entry' });
		await expect(form).toBeVisible();
		await expect(page).toHaveURL(/\/entries\/\w+\?back=%2F$/);
		await form.getByLabel('Description').fill('Standup with the client');
		await form.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(form).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
		await expect(strip(page)).toContainText('Done: Edit entry');
		await expect(entryRow(page, 'Standup with the client')).toBeVisible();
	});

	await test.step('Copy from ⋯ opens a new entry; save it', async () => {
		await menuButton(page, 'Standup with the client').click();
		await menu(page).getByRole('menuitem', { name: 'Copy' }).click();
		const copy = page.getByRole('dialog', { name: 'New entry' });
		await expect(copy.getByLabel('Description')).toHaveValue('Standup with the client');
		await copy.getByLabel('Description').fill('The copy');
		await copy.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(copy).toBeHidden();
		await expect(entryRow(page, 'The copy')).toBeVisible();
		await expect(dayTotal(page)).toHaveText('0:30');
	});

	await test.step('Delete the copy from ⋯ at once; Undo brings it back', async () => {
		await menuButton(page, 'The copy').click();
		await menu(page).getByRole('menuitem', { name: 'Delete' }).click();
		await expect(strip(page)).toContainText('Done: Delete entry');
		await expect(entryRow(page, 'The copy')).toHaveCount(0);
		await expect(undo(page)).toBeFocused();
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(entryRow(page, 'The copy')).toBeVisible();
	});

	await test.step('▶ restarts a finished row; the bar runs it; stop it', async () => {
		await entryRow(page, 'Standup with the client')
			.getByRole('button', { name: /^Restart / })
			.click();
		await expect(strip(page)).toContainText('Start timer on');
		await expect(bar(page)).toContainText('CompX › ClientY – ProjectZ');
		const running = entryRow(page, 'Running');
		await expect(running).toContainText('Standup with the client');
		await expect(running.getByRole('button', { name: /^Restart / })).toHaveCount(0);
		await bar(page)
			.getByRole('button', { name: /^Stop / })
			.click();
		await expect(bar(page)).toContainText('No timer running');
	});
});

test('a template’s sheet is a centred dialog asking only its blanks', async ({ page }) => {
	const user = await seedToday('pc-sheet', zone);
	await signIn(page, user.username, zone);

	await expect(templateRow(page, 'Standup')).toContainText('LOG', { ignoreCase: true });
	await expect(templates(page).getByRole('link', { name: 'Manage templates' })).toHaveText(
		'Manage templates',
		{ useInnerText: true }
	);

	const ticket = await openSheet(page, 'Ticket');
	expect(await askedFor(ticket)).toEqual(['Location', 'Reference', 'Description']);
	await expect(ticket).toContainText('CompX › CompY – Support · Support ticket · 0:30');
	const box = await ticket.boundingBox();
	const size = page.viewportSize();
	expect(box && size && Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThan(2);
	await expect(ticket.getByLabel('Location')).toBeFocused();
	await expect(ticket.getByRole('button', { name: 'Log', exact: true })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(ticket).toBeHidden();
	await expect(templateRow(page, 'Ticket')).toBeFocused();

	const onCompX = await openSheet(page, 'On CompX');
	await onCompX.getByRole('combobox', { name: 'Customer › project' }).click();
	await expect(
		page.getByRole('listbox', { name: 'Customer › project' }).getByRole('option')
	).toHaveText(['ClientY – ProjectZ', 'CompY – Support']);
	await onCompX.getByRole('button', { name: 'Cancel' }).click();
	await expect(onCompX).toBeHidden();

	const empty = await openSheet(page, 'On Empty Co');
	await expect(empty).toContainText('No active projects for Empty Co.');
	await expect(empty.getByRole('button', { name: 'Log', exact: true })).toBeDisabled();
});

test('an entry from yesterday is listed "Since" it, not counted in today', async ({ page }) => {
	const user = await seedToday('pc-since', zone);
	const today = dateIn(zone);
	const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
		.toISOString()
		.slice(0, 10);
	seedSpan(
		user.id,
		zone,
		user.projects.timeKeep,
		`${yesterday}T22:00`,
		`${today}T01:00`,
		'Night deploy'
	);
	await signIn(page, user.username, zone);
	await expect(entryRow(page, 'Night deploy')).toContainText(`Since ${yesterday}`);
	await expect(dayTotal(page)).toHaveText('0:00');
});

test('no templates says so and offers to create one', async ({ page }) => {
	const empty = await seedEmptyUser('pc-empty');
	await signIn(page, empty.username, zone);
	await expect(templates(page)).toContainText('No templates yet.');
	await expect(templates(page).getByRole('link', { name: 'Create a template' })).toBeVisible();
	await expect(todaySection(page)).toContainText('Nothing logged today.');
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('a template’s <details> sheet logs', async ({ page }) => {
		const user = await seedToday('pc-nojs', zone);
		await page.goto('/login');
		await page.getByLabel('Username').fill(user.username);
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
		await page.getByRole('button', { name: 'Sign in' }).click();

		const panel = templatePanel(page, 'Ticket');
		await panel.locator(':scope > summary').click();
		expect(await askedFor(panel)).toEqual(['Location', 'Reference', 'Description']);
		await panel.getByLabel('Reference').fill('T-1234');
		await panel.getByLabel('Description').fill('Offline ticket');
		await panel.getByRole('button', { name: 'Log', exact: true }).click();
		await expect(strip(page)).toContainText('Done: Create entry from template "Ticket".');
		await expect(entryRow(page, 'Offline ticket')).toContainText('T-1234');
	});
});
