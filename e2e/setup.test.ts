import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
	PASSWORD,
	archiveElsewhere,
	noonZone,
	renameElsewhere,
	seedCustomer,
	seedEmptyUser,
	seedProject,
	seedTemplate
} from './seed';

// "Save as template" from an entry is covered in phone.test.ts (listed on /templates,
// a duplicate name refused beside the field, and without JavaScript).

const zone = noonZone();
test.use({ timezoneId: zone });

/** A user of its own for each test, so no test sees another's rows. */
const newUser = (label: string) => seedEmptyUser(`${test.info().project.name}-${label}`);

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

/** The strip: a status, or an alert when it shows a refusal. */
const strip = (page: Page) => page.locator('[role="status"], [role="alert"]').first();
const alert = (page: Page) => page.getByRole('alert');

/** The line of a row: its name, rename and archive controls. */
const line = (page: Page, name: string) =>
	page.locator('details', { has: page.locator('summary', { hasText: name }) }).locator('..');

/** The add form of a field, found by its accessible name. */
const addForm = (page: Page, label: string) =>
	page.locator('form', { has: page.locator(`[aria-label="${label}"]`) });

async function add(page: Page, label: string, name: string) {
	const form = addForm(page, label);
	await form.getByLabel(label).fill(name);
	await form.getByRole('button', { name: 'Add', exact: true }).click();
}

async function addProject(page: Page, customer: string, name: string) {
	await line(page, customer).getByText('Add project').click();
	await add(page, `New project in ${customer}`, name);
}

async function rename(page: Page, from: string, to: string) {
	await line(page, from).locator('summary').first().click();
	await line(page, from).getByLabel('Name', { exact: true }).fill(to);
	await line(page, from).getByRole('button', { name: 'Save' }).click();
}

const pick = (page: Page, label: string, option: string) =>
	page.getByLabel(label, { exact: true }).selectOption({ label: option });

test.describe('setup', () => {
	test('creates, renames, archives and undoes, and refuses a duplicate', async ({ page }) => {
		const user = await newUser('setup');
		await signIn(page, user.username);
		await page.goto('/setup');

		await test.step('create a customer, a project, an activity and a location', async () => {
			await expect(page.getByText('No customers yet.')).toBeVisible();
			await add(page, 'New customer', 'Globex');
			await expect(strip(page)).toContainText('Done: Create customer "Globex".');
			await expect(line(page, 'Globex')).toBeVisible();

			await addProject(page, 'Globex', 'Portal');
			await expect(strip(page)).toContainText('Done: Create project "Portal".');
			await expect(line(page, 'Portal')).toBeVisible();

			await add(page, 'New activity', 'Review work');
			await expect(strip(page)).toContainText('Done: Create activity "Review work".');
			await add(page, 'New location', 'Annex');
			await expect(strip(page)).toContainText('Done: Create location "Annex".');
			await expect(line(page, 'Review work')).toBeVisible();
			await expect(line(page, 'Annex')).toBeVisible();
		});

		await test.step('a duplicate name is refused beside the field', async () => {
			await add(page, 'New customer', 'Globex');
			const field = page.getByLabel('New customer');
			await expect(field).toHaveValue('Globex');
			await expect(field).toHaveAttribute('aria-invalid', 'true');
			await expect(field).toBeFocused();
			await expect(addForm(page, 'New customer')).toContainText('already');
			await field.fill('');
		});

		await test.step('rename one in place', async () => {
			await rename(page, 'Review work', 'Code review');
			await expect(strip(page)).toContainText('Done: Rename activity "Review work"');
			await expect(line(page, 'Code review')).toBeVisible();
		});

		await test.step('a rename to a taken name is refused on its line', async () => {
			await add(page, 'New activity', 'Planning');
			await rename(page, 'Planning', 'Code review');
			const field = line(page, 'Planning').getByLabel('Name', { exact: true });
			await expect(field).toHaveValue('Code review');
			await expect(field).toHaveAttribute('aria-invalid', 'true');
			await expect(line(page, 'Planning')).toContainText('already');
		});

		await test.step('archive the customer: gone, then struck through under Show archived', async () => {
			await page.goto('/setup');
			await line(page, 'Globex').getByRole('button', { name: 'Archive' }).click();
			await expect(strip(page)).toContainText('Done: Archive customer "Globex".');
			await expect(page.locator('summary', { hasText: 'Globex' })).toHaveCount(0);

			await page.getByRole('link', { name: 'Show archived' }).click();
			await expect(page).toHaveURL(/\/setup\?archived=1$/);
			const globex = line(page, 'Globex');
			await expect(globex.locator('span.line-through').first()).toContainText('Globex');
			await expect(globex).toContainText('Archived');
			await expect(line(page, 'Portal').locator('span.line-through').first()).toContainText(
				'Portal'
			);
		});

		await test.step('unarchive it, then undo that from the strip', async () => {
			await line(page, 'Globex').getByRole('button', { name: 'Unarchive' }).click();
			await expect(strip(page)).toContainText('Done: Unarchive customer "Globex".');
			await expect(line(page, 'Globex').getByRole('button', { name: 'Archive' })).toBeVisible();
			await expect(line(page, 'Portal').locator('span.line-through').first()).toHaveCount(0);

			await strip(page).getByRole('button', { name: 'Undo' }).click();
			await expect(strip(page)).toContainText('Undone.');
			await expect(page).toHaveURL(/\/setup\?archived=1$/);
			await expect(line(page, 'Globex').getByRole('button', { name: 'Unarchive' })).toBeVisible();
		});
	});

	test('a project under an archived customer is refused on its line', async ({ page }) => {
		const user = await newUser('under');
		const customer = seedCustomer(user.id, 'Initech');
		const project = seedProject(user.id, customer, 'Reports');
		archiveElsewhere(user.id, 'projects', project);
		archiveElsewhere(user.id, 'customers', customer);

		await signIn(page, user.username);
		await page.goto('/setup?archived=1');
		await line(page, 'Reports').getByRole('button', { name: 'Unarchive' }).click();

		await expect(line(page, 'Reports').getByRole('alert')).toBeVisible();
		await expect(line(page, 'Reports').getByRole('button', { name: 'Unarchive' })).toBeVisible();
		await expect(line(page, 'Reports').locator('span.line-through').first()).toContainText(
			'Reports'
		);
	});

	test('undo of a create the project outlived shows the refusal in the strip', async ({ page }) => {
		const user = await newUser('refused');
		await signIn(page, user.username);
		await page.goto('/setup');
		await add(page, 'New customer', 'Hooli');
		await expect(strip(page)).toContainText('Done: Create customer "Hooli".');

		// Another device adds a project under it while this strip is still showing.
		const id = await line(page, 'Hooli').locator('input[name="id"]').first().inputValue();
		seedProject(user.id, id, 'Box');

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(page).toHaveURL(/\/setup$/);
		const refusal = alert(page).filter({ has: page.getByRole('button', { name: 'Undo' }) });
		await expect(refusal).toBeVisible();
		await expect(refusal.locator('p.text-destructive')).not.toBeEmpty();
		await expect(refusal.getByRole('button', { name: 'Undo' })).toBeVisible();
		await expect(line(page, 'Hooli')).toBeVisible();
	});

	test('a rename to the same name shows no strip and nothing to undo', async ({ page }) => {
		const user = await newUser('same');
		seedCustomer(user.id, 'Pied Piper');
		archiveElsewhere(user.id, 'customers', seedCustomer(user.id, 'Other'));
		await signIn(page, user.username);
		await page.goto('/setup');
		await rename(page, 'Pied Piper', 'Pied Piper');
		await expect(page).toHaveURL(/\/setup$/);
		await expect(line(page, 'Pied Piper')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
		await expect(strip(page)).toHaveCount(0);
	});

	test('a stale rename shows the message and Reload', async ({ page }) => {
		const user = await newUser('stale');
		const customer = seedCustomer(user.id, 'Umbrella');
		await signIn(page, user.username);
		await page.goto('/setup');

		renameElsewhere(user.id, 'customers', customer, 'Umbrella Corp');
		await rename(page, 'Umbrella', 'Umbrella Ltd');

		const row = line(page, 'Umbrella');
		const stale = row.getByRole('alert');
		await expect(stale).toContainText('changed');
		await expect(stale.getByRole('link', { name: 'Reload' })).toBeVisible();

		await stale.getByRole('link', { name: 'Reload' }).click();
		await expect(line(page, 'Umbrella Corp')).toBeVisible();
		await expect(page.getByRole('alert')).toHaveCount(0);
	});
});

test.describe('templates', () => {
	test('creates one with a project and a duration, edits it clearing the description, deletes and undoes', async ({
		page
	}) => {
		const user = await newUser('templates');
		const customer = seedCustomer(user.id, 'Hooli');
		seedProject(user.id, customer, 'Box');
		await signIn(page, user.username);

		await test.step('create it; it is listed and on Today', async () => {
			await page.goto('/templates');
			await expect(page.getByText('No templates yet.')).toBeVisible();
			await page.getByRole('link', { name: 'New template' }).first().click();
			await page.getByLabel('Name', { exact: true }).fill('Weekly sync');
			await pick(page, 'Project', 'Box');
			await page.getByLabel('Duration in minutes').fill('45');
			await page.getByLabel('Description').fill('Weekly sync with the team');
			await page.getByRole('button', { name: 'Save' }).click();

			await expect(page).toHaveURL(/\/templates$/);
			await expect(strip(page)).toContainText('Done: Create template "Weekly sync".');
			const row = page.getByRole('row').filter({ hasText: 'Weekly sync' });
			await expect(row).toContainText('Hooli › Box');

			await page.goto('/');
			await expect(
				page.getByRole('region', { name: 'Templates', exact: true }).locator('summary', {
					hasText: 'Weekly sync'
				})
			).toBeVisible();
		});

		await test.step('edit it, clearing the description', async () => {
			await page.goto('/templates');
			await page.getByRole('link', { name: 'Weekly sync' }).click();
			await expect(page.getByLabel('Description')).toHaveValue('Weekly sync with the team');
			await page.getByLabel('Name', { exact: true }).fill('Weekly sync-up');
			await page.getByLabel('Description').fill('');
			await page.getByRole('button', { name: 'Save' }).click();
			await expect(strip(page)).toContainText('Done: Edit template');

			await page.getByRole('link', { name: 'Weekly sync-up' }).click();
			await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Weekly sync-up');
			await expect(page.getByLabel('Description')).toHaveValue('');
			await expect(page.getByLabel('Duration in minutes')).toHaveValue('45');
		});

		await test.step('delete it after a confirm, and undo the delete', async () => {
			await page.getByRole('button', { name: 'Delete template' }).click();
			await expect(page.getByText('Delete this template?')).toBeVisible();
			await page.getByRole('button', { name: 'Yes, delete it' }).click();
			await expect(page).toHaveURL(/\/templates$/);
			await expect(strip(page)).toContainText('Done: Delete template');
			await expect(page.getByText('No templates yet.')).toBeVisible();

			await strip(page).getByRole('button', { name: 'Undo' }).click();
			await expect(strip(page)).toContainText('Undone.');
			await expect(page.getByRole('link', { name: 'Weekly sync-up' })).toBeVisible();
		});
	});

	test('a template on a project archived afterwards opens with it selected and archived', async ({
		page
	}) => {
		const user = await newUser('archived');
		const customer = seedCustomer(user.id, 'Soylent');
		const project = seedProject(user.id, customer, 'Green');
		seedTemplate(user.id, { name: 'Green hour', customerId: customer, projectId: project });
		archiveElsewhere(user.id, 'projects', project);

		await signIn(page, user.username);
		await page.goto('/templates');
		await page.getByRole('link', { name: 'Green hour' }).click();

		await expect(page.locator('#tpl-project')).toHaveValue(project);
		await expect(page.locator('#tpl-project option:checked')).toHaveText('Green (archived)');

		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page).toHaveURL(/\/templates$/);
		await page.getByRole('link', { name: 'Green hour' }).click();
		await expect(page.locator('#tpl-project')).toHaveValue(project);
	});

	test('an unchanged template save shows no strip and nothing to undo', async ({ page }) => {
		const user = await newUser('tplsame');
		const customer = seedCustomer(user.id, 'Dunder');
		const project = seedProject(user.id, customer, 'Paper');
		const id = seedTemplate(user.id, { name: 'Sell', customerId: customer, projectId: project });
		archiveElsewhere(user.id, 'projects', seedProject(user.id, customer, 'Old'));
		await signIn(page, user.username);
		await page.goto(`/templates/${id}`);
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(page.getByRole('link', { name: 'Sell' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
		await expect(strip(page)).toHaveCount(0);
	});

	test('a stale template save shows the message and Reload', async ({ page }) => {
		const user = await newUser('tplstale');
		const customer = seedCustomer(user.id, 'Vandelay');
		const project = seedProject(user.id, customer, 'Latex');
		const id = seedTemplate(user.id, { name: 'Import', customerId: customer, projectId: project });
		await signIn(page, user.username);
		await page.goto(`/templates/${id}`);

		// Another device saves the template while this form is open.
		const other = await page.context().newPage();
		await other.goto(`/templates/${id}`);
		await other.getByLabel('Name', { exact: true }).fill('Export');
		await other.getByRole('button', { name: 'Save' }).click();
		await expect(other).toHaveURL(/\/templates$/);

		await page.getByLabel('Name', { exact: true }).fill('Import goods');
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('alert')).toContainText('changed');
		await expect(page.getByRole('link', { name: 'Reload' })).toBeVisible();
		await page.getByRole('link', { name: 'Reload' }).click();
		await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Export');
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('creates a customer, a project and a template as plain posts', async ({ page }) => {
		const user = await newUser('nojs');
		await signIn(page, user.username);
		await page.goto('/setup');

		await add(page, 'New customer', 'Wayne');
		await expect(strip(page)).toContainText('Done: Create customer "Wayne".');
		await addProject(page, 'Wayne', 'Cave');
		await expect(strip(page)).toContainText('Done: Create project "Cave".');
		await expect(line(page, 'Cave')).toBeVisible();

		await add(page, 'New customer', 'Wayne');
		await expect(addForm(page, 'New customer')).toContainText('already');

		await page.goto('/templates/new');
		await page.getByLabel('Name', { exact: true }).fill('Patrol');
		await pick(page, 'Project', 'Cave');
		await page.getByLabel('Duration in minutes').fill('60');
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page).toHaveURL(/\/templates$/);
		await expect(strip(page)).toContainText('Done: Create template "Patrol".');
		await expect(page.getByRole('row').filter({ hasText: 'Patrol' })).toContainText('Wayne › Cave');
	});
});
