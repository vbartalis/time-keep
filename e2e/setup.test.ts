/**
 * The Setup screen (`pc-setup`, `pc-setup-menu`, `pc-setup-rename`, `pc-setup-create`,
 * `pc-setup-archived`, `ph-setup`, `ph-setup-menu`): the Active | Archived | All filter,
 * the row menus, rename in place and the create dialog; plain pages without JavaScript.
 * Both widths.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	archiveElsewhere,
	noonZone,
	renameElsewhere,
	seedCustomer,
	seedEmptyUser,
	seedGateMonth,
	seedProject
} from './seed';
import { setupRow } from './setup';
import { signIn, strip, undo } from './today';

const zone = noonZone();
test.use({ timezoneId: zone });

const isPc = () => test.info().project.name === 'pc';
/** A user of its own for each test, so no test sees another's rows. */
const prefix = (label: string) => `${test.info().project.name}-setup-${label}`;
const emptyUser = (label: string) => seedEmptyUser(prefix(label));

/** Opens Setup and waits for its script, so ⋯ and "+ New …" act in place. */
async function open(page: Page, path = '/setup') {
	await page.goto(path);
	await expect(page.getByRole('heading', { name: 'Setup', level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

const row = setupRow;
/** A row's ⋯: the PC's popover summary or the phone's row-sheet button. */
const opener = (page: Page, name: string) =>
	isPc()
		? row(page, name).locator('summary')
		: row(page, name).getByRole('button', { name: `Actions for ${name}` });
const menuItem = (menu: Locator, label: string) =>
	menu.locator('[data-menu-item]', { hasText: label });

/** Opens a row's ⋯: the PC's popover menu or the phone's row sheet, named by it. */
async function openMenu(page: Page, name: string): Promise<Locator> {
	await opener(page, name).click();
	const menu = isPc()
		? page.getByRole('menu', { name: `Actions for ${name}` })
		: page.getByRole('dialog', { name });
	await expect(menu).toBeVisible();
	return menu;
}

/** The create dialog (a sheet on the phone), by its title. */
const dialog = (page: Page, title: string) => page.getByRole('dialog', { name: title });
/** The rename field (one row at a time). */
const renameField = (page: Page) =>
	page.locator('li[data-setup-row]').getByRole('textbox', { name: 'Name' });
/** The row in rename. */
const renaming = (page: Page) =>
	page.locator('li[data-setup-row]', { has: page.getByRole('textbox', { name: 'Name' }) });

async function create(page: Page, button: string, title: string, name: string) {
	await page.getByRole('button', { name: button }).click();
	const d = dialog(page, title);
	await expect(d).toBeVisible();
	await expect(d.getByLabel('Name')).toBeFocused();
	await d.getByLabel('Name').fill(name);
	await page.keyboard.press('Enter');
	return d;
}

async function rename(page: Page, from: string, to: string) {
	await menuItem(await openMenu(page, from), 'Rename').click();
	await expect(renameField(page)).toBeFocused();
	await renameField(page).fill(to);
	await page.keyboard.press('Enter');
}

/** The filter's links. */
const filter = (page: Page, label: 'Active' | 'Archived' | 'All') =>
	page.getByRole('navigation', { name: 'Show' }).getByRole('link', { name: label });

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

test('gate 6: create, add a project, rename, archive with Undo, the filter', async ({ page }) => {
	const user = await seedGateMonth(prefix('gate6'), zone);
	await signIn(page, user.username, zone);
	await open(page);

	await test.step('Active is chosen; the lists are there', async () => {
		await expect(filter(page, 'Active')).toHaveAttribute('aria-current', 'page');
		for (const name of ['CompX', 'CompY – Support', 'Research', 'Café']) {
			await expect(row(page, name)).toBeVisible();
		}
	});

	await test.step('add customer CompZ; the focus goes to Undo', async () => {
		const d = await create(page, 'New customer', 'New customer', 'CompZ');
		await expect(d).toBeHidden();
		await expect(strip(page)).toContainText('Done: Create customer "CompZ".');
		await expect(row(page, 'CompZ')).toBeVisible();
		await expect(undo(page)).toBeFocused();
	});

	await test.step('from its ⋯ add project "CompZ – Audit"', async () => {
		await menuItem(await openMenu(page, 'CompZ'), 'Add project').click();
		const d = dialog(page, 'New project');
		await expect(d).toBeVisible();
		await expect(d.getByLabel('Customer').locator('option:checked')).toHaveText('CompZ');
		await expect(d.getByLabel('Name')).toBeFocused();
		await d.getByLabel('Name').fill('CompZ – Audit');
		await d.getByRole('button', { name: 'Create' }).click();
		await expect(d).toBeHidden();
		await expect(strip(page)).toContainText('Done: Create project "CompZ – Audit".');
		await expect(row(page, 'CompZ – Audit')).toBeVisible();
	});

	await test.step('rename activity Research to "Research and reading"', async () => {
		await rename(page, 'Research', 'Research and reading');
		await expect(strip(page)).toContainText('Done: Rename activity "Research"');
		await expect(row(page, 'Research and reading')).toBeVisible();
		await expect(row(page, 'Research')).toHaveCount(0);
		await expect(undo(page)).toBeFocused();
	});

	await test.step('archive Café and Undo it; archive it again', async () => {
		await menuItem(await openMenu(page, 'Café'), 'Archive').click();
		await expect(strip(page)).toContainText('Done: Archive location "Café".');
		await expect(row(page, 'Café')).toHaveCount(0);
		await expect(undo(page)).toBeFocused();
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(row(page, 'Café')).toBeVisible();
		await menuItem(await openMenu(page, 'Café'), 'Archive').click();
		await expect(strip(page)).toContainText('Done: Archive location "Café".');
		await expect(row(page, 'Café')).toHaveCount(0);
	});

	await test.step('in Archived Café is muted with the chip; unarchive it, the filter kept', async () => {
		await filter(page, 'Archived').click();
		await expect(page).toHaveURL(/\/setup\?show=archived$/);
		await expect(filter(page, 'Archived')).toHaveAttribute('aria-current', 'page');
		await expect(row(page, 'Café')).toContainText('Archived');
		await expect(row(page, 'Café').getByText('Café', { exact: true })).toHaveClass(
			/text-muted-foreground/
		);
		await page.waitForLoadState('networkidle');
		const menu = await openMenu(page, 'Café');
		await expect(menu.locator('[data-menu-item]')).toHaveText(['Rename', 'Unarchive']);
		await menuItem(menu, 'Unarchive').click();
		await expect(strip(page)).toContainText('Done: Unarchive location "Café".');
		await expect(page).toHaveURL(/\/setup\?show=archived$/);
		await expect(row(page, 'Café')).toHaveCount(0);
		await expect(page.getByText('No archived locations.')).toBeVisible();
	});

	await test.step('archive CompY – Support: in Archived it stands under CompX, muted', async () => {
		await filter(page, 'Active').click();
		await expect(page).toHaveURL(/\/setup$/);
		await page.waitForLoadState('networkidle');
		await menuItem(await openMenu(page, 'CompY – Support'), 'Archive').click();
		await expect(strip(page)).toContainText('Done: Archive project "CompY – Support".');
		await filter(page, 'Archived').click();
		await expect(page).toHaveURL(/\/setup\?show=archived$/);
		const names = page.locator('li[data-setup-row]:visible');
		await expect(names.first()).toContainText('CompX');
		await expect(names.nth(1)).toContainText('CompY – Support');
		await expect(row(page, 'CompX').getByText('CompX', { exact: true })).toHaveClass(
			/text-muted-foreground/
		);
		await expect(row(page, 'CompX').getByRole('button')).toHaveCount(0);
		await expect(row(page, 'CompX').locator('summary')).toHaveCount(0);
		await expect(row(page, 'CompY – Support')).toContainText('Archived');
		await expect(row(page, 'Myself')).toHaveCount(0);
	});

	await test.step('a duplicate "CompX" is refused in the dialog (Review Focus 4)', async () => {
		await page.waitForLoadState('networkidle');
		const d = await create(page, 'New customer', 'New customer', 'CompX');
		await expect(d).toBeVisible();
		const name = d.getByLabel('Name');
		await expect(name).toHaveValue('CompX');
		await expect(name).toHaveAttribute('aria-invalid', 'true');
		await expect(name).toBeFocused();
		await expect(d.getByRole('alert')).toContainText('already');
		// Closed, it starts empty again, the refusal gone.
		await page.keyboard.press('Escape');
		await expect(d).toBeHidden();
		await page.getByRole('button', { name: 'New customer' }).click();
		await expect(d.getByLabel('Name')).toHaveValue('');
		await expect(d.getByRole('alert')).toHaveCount(0);
		await d.getByRole('button', { name: 'Cancel' }).click();
		await expect(d).toBeHidden();
		await expect(page.getByRole('button', { name: 'New customer' })).toBeFocused();
	});

	await test.step('a create made in Archived lands on All, so the new row is seen', async () => {
		const d = await create(page, 'New customer', 'New customer', 'CompW');
		await expect(d).toBeHidden();
		await expect(page).toHaveURL(/\/setup\?show=all$/);
		await expect(filter(page, 'All')).toHaveAttribute('aria-current', 'page');
		await expect(strip(page)).toContainText('Done: Create customer "CompW".');
		await expect(row(page, 'CompW')).toBeVisible();
	});
});

test('gate 7: on the phone, from More, add a location from its sheet and rename it', async ({
	page
}) => {
	test.skip(isPc(), 'the phone');
	const user = await seedGateMonth(prefix('gate7'), zone);
	await signIn(page, user.username, zone);
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('navigation', { name: 'Main' })
		.locator('summary, button', { hasText: 'More' })
		.click();
	await page
		.getByRole('dialog', { name: 'More' })
		.getByRole('link', { name: 'Setup', exact: true })
		.click();
	await expect(page.getByRole('heading', { name: 'Setup', level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');

	const d = await create(page, 'New location', 'New location', 'Coworking');
	await expect(d).toBeHidden();
	await expect(strip(page)).toContainText('Done: Create location "Coworking".');
	await expect(row(page, 'Coworking')).toBeVisible();

	const sheet = await openMenu(page, 'Coworking');
	await expect(sheet).toContainText('location');
	await menuItem(sheet, 'Rename').click();
	await expect(sheet).toBeHidden();
	await expect(renameField(page)).toBeFocused();
	await expect(renameField(page)).toHaveValue('Coworking');
	expect(await underPlus(page)).toEqual([]);
	await renameField(page).fill('Coworking space');
	await renaming(page).getByRole('button', { name: 'Save' }).click();
	await expect(strip(page)).toContainText('Done: Rename location "Coworking"');
	await expect(row(page, 'Coworking space')).toBeVisible();
	expect(await underPlus(page)).toEqual([]);
});

test('a refused rename stays in rename; Escape returns to ⋯ (Review Focus 4)', async ({ page }) => {
	const user = await seedGateMonth(prefix('refused'), zone);
	await signIn(page, user.username, zone);
	await open(page);

	await test.step('a taken name: the message beside the field, the name kept, focused', async () => {
		await rename(page, 'Meeting', 'Development');
		const field = renameField(page);
		await expect(field).toBeVisible();
		await expect(field).toHaveValue('Development');
		await expect(field).toHaveAttribute('aria-invalid', 'true');
		await expect(field).toBeFocused();
		await expect(renaming(page)).toContainText('already');
		await expect(strip(page)).toHaveCount(0);
	});

	await test.step('a blank name is refused the same way', async () => {
		await renameField(page).fill('   ');
		await page.keyboard.press('Enter');
		await expect(renaming(page).getByRole('alert')).not.toContainText('already');
		await expect(renameField(page)).toHaveValue('   ');
		await expect(renameField(page)).toHaveAttribute('aria-invalid', 'true');
		await expect(renameField(page)).toBeFocused();
	});

	await test.step('Escape cancels: the name as it was, the focus on its ⋯', async () => {
		await page.keyboard.press('Escape');
		await expect(renameField(page)).toHaveCount(0);
		await expect(row(page, 'Meeting')).toBeVisible();
		await expect(opener(page, 'Meeting')).toBeFocused();
	});

	await test.step('one row at a time; a fresh rename starts from the name', async () => {
		await menuItem(await openMenu(page, 'Meeting'), 'Rename').click();
		await expect(renameField(page)).toHaveValue('Meeting');
		await expect(page.locator('li[data-setup-row]').getByRole('alert')).toHaveCount(0);
		await menuItem(await openMenu(page, 'Development'), 'Rename').click();
		await expect(renameField(page)).toHaveCount(1);
		await expect(renameField(page)).toHaveValue('Development');
		await expect(row(page, 'Meeting')).toBeVisible();
	});
});

test('the menu and rename work by keyboard', async ({ page }) => {
	const user = await seedGateMonth(prefix('keys'), zone);
	await signIn(page, user.username, zone);
	await open(page);

	if (isPc()) {
		const summary = opener(page, 'CompX');
		await summary.focus();
		await page.keyboard.press('Enter');
		const menu = page.getByRole('menu', { name: 'Actions for CompX' });
		await expect(menu).toBeVisible();
		const item = (label: string) => menu.getByRole('menuitem', { name: label });
		await expect(item('Rename')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(item('Add project')).toBeFocused();
		await page.keyboard.press('End');
		await expect(item('Archive')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(item('Rename')).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect(item('Archive')).toBeFocused();
		await page.keyboard.press('Home');
		await expect(item('Rename')).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(menu).toBeHidden();
		await expect(summary).toBeFocused();

		// Add project by keyboard: the dialog, closed by Escape, gives the focus back to ⋯.
		await page.keyboard.press('Enter');
		await expect(item('Rename')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(item('Add project')).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(dialog(page, 'New project')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog(page, 'New project')).toBeHidden();
		await expect(summary).toBeFocused();

		// Rename by keyboard: the name selected, typed over, Enter saves; Undo is focused.
		await page.keyboard.press('Enter');
		await expect(item('Rename')).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(renameField(page)).toBeFocused();
		await page.keyboard.type('CompX Ltd');
		await expect(renameField(page)).toHaveValue('CompX Ltd');
		await page.keyboard.press('Enter');
		await expect(strip(page)).toContainText('Done: Rename customer "CompX"');
		await expect(undo(page)).toBeFocused();
	} else {
		const button = opener(page, 'CompX');
		await button.click();
		const sheet = page.getByRole('dialog', { name: 'CompX' });
		await expect(sheet).toBeVisible();
		await expect(sheet).toContainText('customer');
		await expect(sheet.locator('[data-menu-item]')).toHaveText([
			'Rename',
			'Add project',
			'Archive'
		]);
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
		await expect(button).toBeFocused();

		// A project's sheet names its customer.
		await openMenu(page, 'CompY – Support');
		await expect(page.getByRole('dialog', { name: 'CompY – Support' })).toContainText(
			'CompX · project'
		);
		await page.keyboard.press('Escape');

		// Rename: the name selected, typed over, Enter saves; Undo is focused.
		await button.click();
		await menuItem(sheet, 'Rename').click();
		await expect(renameField(page)).toBeFocused();
		await page.keyboard.type('CompX Ltd');
		await expect(renameField(page)).toHaveValue('CompX Ltd');
		await page.keyboard.press('Enter');
		await expect(strip(page)).toContainText('Done: Rename customer "CompX"');
		await expect(undo(page)).toBeFocused();
	}
});

test('a project under an archived customer: archived by effect, Rename only', async ({ page }) => {
	const user = await emptyUser('under');
	const customer = seedCustomer(user.id, 'Initech');
	seedProject(user.id, customer, 'Reports');
	archiveElsewhere(user.id, 'customers', customer);
	await signIn(page, user.username, zone);

	await open(page);
	await expect(page.getByText('No customers yet.')).toBeVisible();

	await open(page, '/setup?show=all');
	await expect(filter(page, 'All')).toHaveAttribute('aria-current', 'page');
	await expect(row(page, 'Reports')).toContainText('Archived');
	const projectMenu = await openMenu(page, 'Reports');
	await expect(projectMenu.locator('[data-menu-item]')).toHaveText(['Rename']);
	await page.keyboard.press('Escape');

	const customerMenu = await openMenu(page, 'Initech');
	await expect(customerMenu.locator('[data-menu-item]')).toHaveText(['Rename', 'Unarchive']);
	await menuItem(customerMenu, 'Unarchive').click();
	await expect(strip(page)).toContainText('Done: Unarchive customer "Initech".');
	await expect(page).toHaveURL(/\/setup\?show=all$/);
	// Back as it was: live again under its live customer.
	await expect(row(page, 'Reports')).not.toContainText('Archived');
});

test('undo of a create the project outlived shows the refusal in the strip', async ({ page }) => {
	const user = await emptyUser('outlived');
	await signIn(page, user.username, zone);
	await open(page);
	await create(page, 'New customer', 'New customer', 'Hooli');
	await expect(strip(page)).toContainText('Done: Create customer "Hooli".');

	// Another device adds a project under it while this strip is still showing.
	const id = await row(page, 'Hooli').getAttribute('data-setup-row');
	seedProject(user.id, id ?? '', 'Box');

	await undo(page).click();
	await expect(page).toHaveURL(/\/setup$/);
	const refusal = page
		.locator('[data-undo-strip]')
		.filter({ has: page.getByRole('button', { name: 'Undo' }) });
	await expect(refusal).toHaveAttribute('role', 'alert');
	await expect(refusal.locator('p.text-destructive')).not.toBeEmpty();
	await expect(row(page, 'Hooli')).toBeVisible();
});

test('a rename to the same name shows no strip and nothing to undo', async ({ page }) => {
	const user = await emptyUser('same');
	seedCustomer(user.id, 'Pied Piper');
	await signIn(page, user.username, zone);
	await open(page);
	await rename(page, 'Pied Piper', 'Pied Piper');
	await expect(renameField(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/setup$/);
	await expect(row(page, 'Pied Piper')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(strip(page)).toHaveCount(0);
	await expect(opener(page, 'Pied Piper')).toBeFocused();
});

test('a stale rename shows the message and Reload', async ({ page }) => {
	const user = await emptyUser('stale');
	const customer = seedCustomer(user.id, 'Umbrella');
	await signIn(page, user.username, zone);
	await open(page);

	renameElsewhere(user.id, 'customers', customer, 'Umbrella Corp');
	await rename(page, 'Umbrella', 'Umbrella Ltd');

	const line = renaming(page);
	await expect(renameField(page)).toHaveValue('Umbrella Ltd');
	await expect(line.getByRole('alert')).toContainText('changed');
	await line.getByRole('link', { name: 'Reload' }).click();
	await expect(row(page, 'Umbrella Corp')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	/** Without the script the ⋯ is a `<details>` of links and post buttons at both widths. */
	async function menuOf(page: Page, name: string) {
		await row(page, name).locator('summary').click();
		return row(page, name).locator('details[open]');
	}

	test('?new= and ?rename= are forms in the page; the filter is kept', async ({ page }) => {
		const user = await emptyUser('nojs');
		await signIn(page, user.username, zone);
		await page.goto('/setup');

		await test.step('"+ New customer" is ?new=customer; a duplicate is refused there', async () => {
			await page.getByRole('link', { name: 'New customer' }).click();
			await expect(page).toHaveURL(/\/setup\?new=customer$/);
			await page.getByLabel('Name').fill('Wayne');
			await page.getByRole('button', { name: 'Create' }).click();
			await expect(strip(page)).toContainText('Done: Create customer "Wayne".');
			await expect(row(page, 'Wayne')).toBeVisible();

			await page.getByRole('link', { name: 'New customer' }).click();
			await page.getByLabel('Name').fill('Wayne');
			await page.getByRole('button', { name: 'Create' }).click();
			await expect(page.getByRole('heading', { name: 'New customer' })).toBeVisible();
			await expect(page.getByLabel('Name')).toHaveValue('Wayne');
			await expect(page.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');
			await expect(page.getByRole('alert')).toContainText('already');
		});

		await test.step('Add project is ?new=project&customer=', async () => {
			await page.goto('/setup');
			await menuItem(await menuOf(page, 'Wayne'), 'Add project').click();
			await expect(page).toHaveURL(/\/setup\?new=project&customer=/);
			await expect(page.getByLabel('Customer').locator('option:checked')).toHaveText('Wayne');
			await page.getByLabel('Name').fill('Cave');
			await page.getByRole('button', { name: 'Create' }).click();
			await expect(strip(page)).toContainText('Done: Create project "Cave".');
			await expect(row(page, 'Cave')).toBeVisible();
		});

		await test.step('Rename is ?rename=<id>; a refusal keeps the row in rename', async () => {
			await menuItem(await menuOf(page, 'Cave'), 'Rename').click();
			await expect(page).toHaveURL(/\/setup\?rename=/);
			await renameField(page).fill('   ');
			await page.getByRole('button', { name: 'Save' }).click();
			await expect(renameField(page)).toHaveValue('   ');
			await expect(renameField(page)).toHaveAttribute('aria-invalid', 'true');
			await renameField(page).fill('Batcave');
			await page.getByRole('button', { name: 'Save' }).click();
			await expect(strip(page)).toContainText('Done: Rename project "Cave"');
			await expect(row(page, 'Batcave')).toBeVisible();
		});

		await test.step('under All, Archive returns to All', async () => {
			await filter(page, 'All').click();
			await expect(page).toHaveURL(/\/setup\?show=all$/);
			await menuItem(await menuOf(page, 'Batcave'), 'Archive').click();
			await expect(strip(page)).toContainText('Done: Archive project "Batcave".');
			await expect(page).toHaveURL(/\/setup\?show=all$/);
			await expect(row(page, 'Batcave')).toContainText('Archived');
		});
	});
});
