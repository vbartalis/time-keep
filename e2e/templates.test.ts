/**
 * The Templates screen (`pc-templates`, `pc-templates-menu`, `ph-templates`) and the
 * template form: item 12's entry form in its template kind, opened in place over the
 * screen it was opened from (`pc-template-form`, `ph-template-form`), a page without
 * JavaScript. Both widths.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	archiveElsewhere,
	noonZone,
	seedCustomer,
	seedEmptyUser,
	seedGateMonth,
	seedProject,
	seedTemplate
} from './seed';
import { bar, sheet as templateSheet, signIn, strip, templates, undo } from './today';

const zone = noonZone();
test.use({ timezoneId: zone });

/** A user of its own for each test, with no rows. */
const emptyUser = (label: string) => seedEmptyUser(`${test.info().project.name}-tpl-${label}`);

/** Opens a screen and waits for its script, so a click opens the form in place. */
async function open(page: Page, path: string, title: string) {
	await page.goto(path);
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

const form = (page: Page, name: 'New template' | 'Edit template') =>
	page.getByRole('dialog', { name });
const field = (page: Page, id: string) => page.locator(`#entry-${id}`);
const saveButton = (page: Page) => page.locator('button[form="entry-form"]');
/** A template's shown row: the PC's table row or the phone's list item. */
const row = (page: Page, name: string) =>
	page.locator('[data-template]:visible').filter({ hasText: name });
const picker = (page: Page) => page.getByRole('combobox', { name: 'Customer › project' });
const startButton = (page: Page) => page.locator('[data-start-list]:visible > summary');
const startList = (page: Page) => page.locator('[data-start-list][open]:visible');
const shownStop = (page: Page) => bar(page).locator('[data-shown-stop]');

const isPc = () => test.info().project.name === 'pc';

/** Opens a template's ⋯: the PC's popover menu or the phone's row sheet, named by it. */
async function openMenu(page: Page, name: string): Promise<Locator> {
	if (isPc()) {
		await row(page, name).locator('summary').click();
		const menu = page.getByRole('menu', { name: `Actions for ${name}` });
		await expect(menu).toBeVisible();
		return menu;
	}
	await row(page, name)
		.getByRole('button', { name: `Actions for ${name}` })
		.click();
	const sheet = page.getByRole('dialog', { name });
	await expect(sheet).toBeVisible();
	return sheet;
}

const menuItem = (menu: Locator, label: string) =>
	menu.locator('[data-menu-item]', { hasText: label });

/**
 * The controls in main that reach into the phone's "+" column with less than a 44 px
 * target left beside it; checked by column, so it holds at any scroll position.
 */
const underPlus = (page: Page) =>
	page.evaluate(() => {
		const plus = document.querySelector('a[aria-label="New entry"]')?.getBoundingClientRect();
		if (!plus) return ['no +'];
		const hits: string[] = [];
		for (const el of document.querySelectorAll(
			'main :is(a, button, input, select, textarea, summary)'
		)) {
			if (!el.checkVisibility()) continue;
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) continue;
			if (r.right > plus.left && plus.left - r.left < 44) hits.push(el.outerHTML.slice(0, 120));
		}
		return hits;
	});

/** Types `text` into a time field and leaves it, so it reads. */
async function typeTime(page: Page, id: string, text: string) {
	await field(page, id).fill(text);
	await field(page, id).blur();
}

/** Types into the picker and takes the first match with Enter. */
async function pick(page: Page, typed: string, expected: string) {
	await picker(page).fill(typed);
	await expect(page.getByRole('listbox', { name: 'Customer › project' })).toBeVisible();
	await picker(page).press('Enter');
	await expect(picker(page)).toHaveValue(expected);
}

test('makes, uses, edits and deletes templates over Templates (gate 3)', async ({ page }) => {
	const user = await seedGateMonth(`${test.info().project.name}-tpl-gate3`, zone);
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');

	await test.step('New template: Café evening, no times; listed with TIMER', async () => {
		await page.getByRole('link', { name: 'New template' }).first().click();
		const dialog = form(page, 'New template');
		await expect(dialog).toBeVisible();
		await expect(page).toHaveURL(/\/templates\/new\?back=%2Ftemplates$/);
		await expect(field(page, 'name')).toBeFocused();
		await expect(dialog).toContainText(
			'Any field may stay blank; only the blanks are asked when it is used.'
		);
		await expect(dialog).toContainText("Blank uses the device's zone");
		await expect(field(page, 'date')).toHaveCount(0);
		for (const name of ['Copy', 'Restart', 'Save as template', 'Delete']) {
			await expect(dialog.getByRole('button', { name, exact: true })).toHaveCount(0);
		}

		await field(page, 'name').fill('Café evening');
		await pick(page, 'time-keep', 'Myself › time-keep');
		await field(page, 'activity').selectOption({ label: 'Development' });
		await field(page, 'location').selectOption({ label: 'Café' });
		await saveButton(page).click();

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(strip(page)).toContainText('Done: Create template "Café evening".');
		await expect(row(page, 'Café evening')).toContainText('Myself › time-keep');
		await expect(row(page, 'Café evening')).toContainText(/timer/i);
	});

	await test.step("start it from the bar's Start list, then stop it", async () => {
		await startButton(page).click();
		await expect(startList(page)).toBeVisible();
		await startList(page).locator('summary', { hasText: 'Café evening' }).click();
		const line = startList(page).getByRole('textbox', { name: 'Description for Café evening' });
		await expect(line).toBeFocused();
		await page.keyboard.type('Evening work');
		await page.keyboard.press('Enter');
		await expect(startList(page)).toHaveCount(0);
		await expect(bar(page)).toContainText('time-keep');
		await shownStop(page).click();
		await expect(bar(page)).toContainText('No timer running');
	});

	await test.step("Standup's end to 09:50: its duration reads 0:20", async () => {
		await row(page, 'Standup').getByRole('link', { name: 'Standup' }).click();
		const dialog = form(page, 'Edit template');
		await expect(dialog).toBeVisible();
		await expect(field(page, 'name')).toHaveValue('Standup');
		await expect(field(page, 'end')).toHaveValue('09:45');
		await typeTime(page, 'end', '0950');
		await expect(field(page, 'end')).toHaveValue('09:50');
		await expect(field(page, 'duration')).toHaveValue('0:20');
		await saveButton(page).click();
		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(strip(page)).toContainText('Done: Edit template "Standup".');
		await expect(row(page, 'Standup')).toContainText('09:30–09:50');
	});

	await test.step('delete Ticket from its ⋯ at once; Undo brings it back', async () => {
		await menuItem(await openMenu(page, 'Ticket'), 'Delete').click();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(strip(page)).toContainText('Done: Delete template');
		await expect(row(page, 'Ticket')).toHaveCount(0);
		await expect(undo(page)).toBeFocused();
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(row(page, 'Ticket')).toBeVisible();
	});

	await test.step('the form deletes at once too', async () => {
		await row(page, 'Café evening').getByRole('link', { name: 'Café evening' }).click();
		const dialog = form(page, 'Edit template');
		await expect(field(page, 'name')).toHaveValue('Café evening');
		await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(strip(page)).toContainText('Done: Delete template "Café evening".');
		await expect(row(page, 'Café evening')).toHaveCount(0);
	});
});

test('lists the templates by name: dot, fields and mark; nothing under the "+"', async ({
	page
}) => {
	const user = await seedGateMonth(`${test.info().project.name}-tpl-list`, zone);
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');

	await expect(page.locator('main [data-count]')).toHaveText(/^\s*2\s+templates\s*$/);
	await expect(page.locator('[data-template]:visible')).toHaveCount(2);
	const names = page.locator('[data-template]:visible');
	await expect(names.nth(0)).toContainText('Standup');
	await expect(names.nth(1)).toContainText('Ticket');

	const standup = row(page, 'Standup');
	await expect(standup).toContainText('CompX › ClientY – ProjectZ');
	await expect(standup).toContainText('Meeting');
	await expect(standup).toContainText('09:30–09:45');
	await expect(standup).toContainText(/log/i);
	await expect(row(page, 'Ticket')).toContainText('Support ticket');
	await expect(row(page, 'Ticket')).toContainText('0:30');
	// The project's dot.
	await expect(standup.locator('.rounded-full[class*="bg-project-"]')).toHaveCount(1);

	if (isPc()) {
		const heads = page.locator('main thead th');
		await expect(heads).toHaveText([
			'Name',
			'Customer › project',
			'Activity',
			'Location',
			'Times',
			'Mark',
			'Actions'
		]);
		// Under 1280 px Activity and Location drop.
		await page.setViewportSize({ width: 1100, height: 900 });
		await expect(page.locator('main thead th:visible')).toHaveCount(5);
	} else {
		expect(await underPlus(page)).toEqual([]);
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		expect(await underPlus(page)).toEqual([]);
		const wide = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(wide).toBe(false);
	}
});

test('⋯ → Edit opens the form; ⋯ → Log… logs and returns with the strip', async ({ page }) => {
	const user = await seedGateMonth(`${test.info().project.name}-tpl-menu`, zone);
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');

	await test.step('Edit opens the form in place; Cancel leaves Templates as it was', async () => {
		await menuItem(await openMenu(page, 'Ticket'), 'Edit').click();
		const dialog = form(page, 'Edit template');
		await expect(dialog).toBeVisible();
		await expect(page).toHaveURL(/\/templates\/[^/?]+\?back=%2Ftemplates$/);
		await expect(field(page, 'name')).toHaveValue('Ticket');
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/templates$/);
	});

	await test.step('a row click opens the form too', async () => {
		if (isPc()) await row(page, 'Standup').locator('td').nth(1).click();
		else await row(page, 'Standup').getByRole('link').click();
		await expect(form(page, 'Edit template')).toBeVisible();
		await expect(field(page, 'name')).toHaveValue('Standup');
		await page.keyboard.press('Escape');
		await expect(form(page, 'Edit template')).toBeHidden();
	});

	await test.step('Log… opens its sheet over Templates; it logs and returns', async () => {
		await menuItem(await openMenu(page, 'Standup'), 'Log…').click();
		const dialog = templateSheet(page, 'Standup');
		await expect(dialog).toBeVisible();
		await dialog.getByLabel('Description').fill('Logged from Templates');
		await dialog.getByRole('button', { name: 'Log', exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(page.getByRole('heading', { name: 'Templates', level: 1 })).toBeVisible();
		await expect(strip(page)).toContainText('Done:');
		await expect(undo(page)).toBeFocused();
	});

	await test.step('it is on Today', async () => {
		await page.goto('/');
		await expect(page.locator('[data-row]:visible')).toContainText(['Logged from Templates']);
	});
});

test('the menu works by keyboard and gives the focus back to ⋯', async ({ page }) => {
	const user = await seedGateMonth(`${test.info().project.name}-tpl-keys`, zone);
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');

	if (isPc()) {
		const opener = row(page, 'Standup').locator('summary');
		await opener.focus();
		await page.keyboard.press('Enter');
		const menu = page.getByRole('menu', { name: 'Actions for Standup' });
		await expect(menu).toBeVisible();
		const item = (label: string) => menu.getByRole('menuitem', { name: label });
		await expect(item('Edit')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(item('Log…')).toBeFocused();
		await page.keyboard.press('End');
		await expect(item('Delete')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(item('Edit')).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect(item('Delete')).toBeFocused();
		await page.keyboard.press('Home');
		await expect(item('Edit')).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(menu).toBeHidden();
		await expect(opener).toBeFocused();

		// Log… by keyboard: its sheet, closed by Escape, gives the focus back to ⋯.
		await page.keyboard.press('Enter');
		await expect(item('Edit')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(item('Log…')).toBeFocused();
		await page.keyboard.press('Enter');
		const dialog = templateSheet(page, 'Standup');
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
	} else {
		const opener = row(page, 'Standup').getByRole('button', { name: 'Actions for Standup' });
		await opener.click();
		const sheet = page.getByRole('dialog', { name: 'Standup' });
		await expect(sheet).toBeVisible();
		await expect(sheet).toContainText('CompX › ClientY – ProjectZ');
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
		await expect(opener).toBeFocused();

		// Log… from the row sheet: the template's sheet takes its place, then back to ⋯.
		await opener.click();
		await menuItem(sheet, 'Log…').click();
		const dialog = templateSheet(page, 'Standup');
		await expect(dialog.getByLabel('Description')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
	}
});

test('an entry saved as a template is on Templates and on Today (gate 4)', async ({ page }) => {
	const user = await seedGateMonth(`${test.info().project.name}-tpl-gate4`, zone);
	await signIn(page, user.username, zone);
	await open(page, `/entries?range=custom&from=${user.from}&to=${user.today}`, 'Entries');
	await page.locator('[data-row]:visible').first().getByRole('link').first().click();
	await page.getByText('Save as template', { exact: true }).click();
	await page.locator('#entry-template-name').fill('Printer');
	await page.getByRole('button', { name: 'Save template' }).click();
	await expect(strip(page)).toContainText('Printer');

	await open(page, '/templates', 'Templates');
	await expect(row(page, 'Printer')).toBeVisible();
	await page.goto('/');
	await expect(templates(page)).toContainText('Printer');
});

test('Templates on the phone: from More, ⋯ → Edit, Location to Home office (gate 5)', async ({
	page
}) => {
	test.skip(isPc(), 'the phone');
	const user = await seedGateMonth('phone-tpl-gate5', zone);
	await signIn(page, user.username, zone);
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('navigation', { name: 'Main' })
		.locator('summary, button', { hasText: 'More' })
		.click();
	await page
		.getByRole('dialog', { name: 'More' })
		.getByRole('link', { name: 'Templates', exact: true })
		.click();
	await expect(page.getByRole('heading', { name: 'Templates', level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');

	await menuItem(await openMenu(page, 'Standup'), 'Edit').click();
	const dialog = form(page, 'Edit template');
	await expect(dialog).toBeVisible();
	await field(page, 'location').selectOption({ label: 'Home office' });
	await saveButton(page).click();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/templates$/);
	await expect(strip(page)).toContainText('Done: Edit template "Standup".');
	await expect(row(page, 'Standup')).toContainText('Home office');
	expect(await underPlus(page)).toEqual([]);
});

test('opened over Today, Back closes it with Today unchanged; Save returns to Today', async ({
	page
}) => {
	const user = await emptyUser('today');
	await signIn(page, user.username, zone);
	await page.waitForLoadState('networkidle');
	const create = templates(page).getByRole('link', { name: 'Create a template' });

	await test.step('Back closes it, Today as it was', async () => {
		await create.click();
		await expect(form(page, 'New template')).toBeVisible();
		await expect(page).toHaveURL(/\/templates\/new\?back=%2F$/);
		await field(page, 'name').fill('Never saved');
		await page.goBack();
		await expect(form(page, 'New template')).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
		await expect(templates(page)).toContainText('No templates yet.');
		await expect(strip(page)).toHaveCount(0);
	});

	await test.step('a save returns to Today with the strip', async () => {
		await create.click();
		await expect(form(page, 'New template')).toBeVisible();
		// Each opening starts afresh.
		await expect(field(page, 'name')).toHaveValue('');
		await field(page, 'name').fill('Printer');
		await typeTime(page, 'duration', '45');
		await saveButton(page).click();
		await expect(form(page, 'New template')).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
		await expect(strip(page)).toContainText('Done: Create template "Printer".');
		await expect(templates(page).getByRole('button', { name: /^Printer\b/ })).toBeVisible();
	});
});

test("the Start list's Create a template opens the form over the screen", async ({ page }) => {
	const user = await emptyUser('startlist');
	await signIn(page, user.username, zone);
	await open(page, '/entries', 'Entries');
	await startButton(page).click();
	await startList(page).getByRole('link', { name: 'Create a template' }).click();
	const dialog = form(page, 'New template');
	await expect(dialog).toBeVisible();
	await expect(page).toHaveURL(/\/templates\/new\?back=%2Fentries/);
	await field(page, 'name').fill('From the bar');
	await saveButton(page).click();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/entries/);
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await expect(strip(page)).toContainText('Done: Create template "From the bar".');
});

test('a customer alone may be chosen; the project is left to be asked', async ({ page }) => {
	const user = await emptyUser('customer');
	const customer = seedCustomer(user.id, 'Initech');
	seedProject(user.id, customer, 'TPS');
	// A customer with no project at all is a choice too.
	seedCustomer(user.id, 'Hooli');
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');

	await page.getByRole('link', { name: 'New template' }).first().click();
	await field(page, 'name').fill('Hooli call');
	await pick(page, 'hooli', 'Hooli');
	await saveButton(page).click();
	await expect(form(page, 'New template')).toBeHidden();
	await expect(row(page, 'Hooli call')).toContainText('Hooli');

	await row(page, 'Hooli call').getByRole('link', { name: 'Hooli call' }).click();
	await expect(picker(page)).toHaveValue('Hooli');
	// The heading is a choice under its own name; its projects stay choices beneath it.
	await picker(page).fill('initech');
	const list = page.getByRole('listbox', { name: 'Customer › project' });
	await expect(list.getByRole('option')).toHaveText(['Initech', 'TPS']);
	await picker(page).press('Escape');
});

test('an untouched save keeps an end or a duration and shows no strip', async ({ page }) => {
	const user = await seedGateMonth(`${test.info().project.name}-tpl-same`, zone);
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');

	for (const name of ['Standup', 'Ticket']) {
		await row(page, name).getByRole('link', { name }).click();
		await expect(field(page, 'name')).toHaveValue(name);
		await saveButton(page).click();
		await expect(form(page, 'Edit template')).toBeHidden();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(strip(page)).toHaveCount(0);
	}
	await expect(row(page, 'Standup')).toContainText('09:30–09:45');

	// A duration template given a start keeps its duration: the end shown is only linked.
	await row(page, 'Ticket').getByRole('link', { name: 'Ticket' }).click();
	await typeTime(page, 'start', '10');
	await expect(field(page, 'end')).toHaveValue('10:30');
	await saveButton(page).click();
	await expect(strip(page)).toContainText('Done: Edit template "Ticket".');
	await expect(row(page, 'Ticket')).toContainText('10:00 + 0:30');
});

test('a template on a project archived since shows it marked, and a save keeps it', async ({
	page
}) => {
	const user = await emptyUser('archived');
	const customer = seedCustomer(user.id, 'Soylent');
	const project = seedProject(user.id, customer, 'Green');
	seedTemplate(user.id, { name: 'Green hour', customerId: customer, projectId: project });
	archiveElsewhere(user.id, 'projects', project);
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');

	await row(page, 'Green hour').getByRole('link', { name: 'Green hour' }).click();
	await expect(picker(page)).toHaveValue('Soylent › Green (archived)');
	await field(page, 'name').fill('Green hours');
	await saveButton(page).click();
	await expect(strip(page)).toContainText('Done: Edit template');
	await row(page, 'Green hours').getByRole('link', { name: 'Green hours' }).click();
	await expect(picker(page)).toHaveValue('Soylent › Green (archived)');
});

test('a stale save shows the message and Reload', async ({ page }) => {
	const user = await emptyUser('stale');
	const customer = seedCustomer(user.id, 'Vandelay');
	const project = seedProject(user.id, customer, 'Latex');
	const id = seedTemplate(user.id, { name: 'Import', customerId: customer, projectId: project });
	await signIn(page, user.username, zone);
	await open(page, '/templates', 'Templates');
	await row(page, 'Import').getByRole('link', { name: 'Import' }).click();
	await expect(form(page, 'Edit template')).toBeVisible();

	// Another device saves the template while this form is open.
	const other = await page.context().newPage();
	await other.goto(`/templates/${id}`);
	await other.locator('#entry-name').fill('Export');
	await other.locator('button[form="entry-form"]').click();
	await expect(other).toHaveURL(/\/$/);
	await other.close();

	await field(page, 'name').fill('Import goods');
	await saveButton(page).click();
	const dialog = form(page, 'Edit template');
	await expect(dialog.getByRole('alert')).toContainText('changed');
	await expect(field(page, 'name')).toHaveValue('Import goods');
	await dialog.getByRole('link', { name: 'Reload' }).click();
	await expect(field(page, 'name')).toHaveValue('Export');
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('/templates/new saves as a page, a customer alone too', async ({ page }) => {
		const user = await emptyUser('nojs');
		const customer = seedCustomer(user.id, 'Wayne');
		seedProject(user.id, customer, 'Cave');
		seedCustomer(user.id, 'Gotham');
		await signIn(page, user.username, zone);

		await page.goto('/templates/new?back=%2Ftemplates');
		await expect(page.getByRole('heading', { name: 'New template', level: 1 })).toBeVisible();
		await page.getByLabel('Name', { exact: true }).fill('Patrol');
		await page.getByLabel('Customer › project').selectOption({ label: 'Cave' });
		await page.getByLabel('Duration').fill('1:00');
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(strip(page)).toContainText('Done: Create template "Patrol".');
		await expect(row(page, 'Patrol')).toContainText('Wayne › Cave');

		await page.goto('/templates/new?back=%2Ftemplates');
		await page.getByLabel('Name', { exact: true }).fill('City watch');
		await page.getByLabel('Customer', { exact: true }).selectOption({ label: 'Gotham' });
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(row(page, 'City watch')).toContainText('Gotham');

		// A refusal comes back as the page, what was typed kept.
		await page.goto('/templates/new?back=%2Ftemplates');
		await page.getByLabel('Name', { exact: true }).fill('Patrol');
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page.locator('#entry-name')).toHaveAttribute('aria-invalid', 'true');
		await expect(page.locator('#entry-name')).toHaveValue('Patrol');
	});
});
