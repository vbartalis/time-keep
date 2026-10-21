import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
	PASSWORD,
	dateIn,
	noonZone,
	renameElsewhere,
	seedAgentCustomer,
	seedBatches,
	seedCustomer,
	seedEmptyUser,
	seedProject,
	seedThreeChanges
} from './seed';
import { setupRow } from './setup';

const zone = noonZone();
test.use({ timezoneId: zone });

/** A user of its own for each test, with no batch until the test seeds one. */
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

/**
 * Opens the History screen. With JavaScript it waits for the script (the selection
 * count shows), since a tick made before then is reset when the page hydrates.
 */
async function openHistory(page: Page, script = true) {
	await page.goto('/history');
	await expect(page.getByRole('heading', { name: 'History', level: 1 })).toBeVisible();
	if (script) await expect(page.getByText('0 selected')).toBeVisible();
}

const strip = (page: Page) => page.getByRole('status');

/** A batch's row, found by its label exactly (an undo's label quotes it). */
const batch = (page: Page, label: string) =>
	page
		.getByRole('listitem')
		.filter({ has: page.getByText(label, { exact: true }) })
		.filter({ has: page.locator('details') });

/** Opens a batch's changes. */
async function openChanges(row: Locator) {
	const details = row.locator('details');
	if ((await details.getAttribute('open')) === null) await row.locator('summary').click();
	await expect(details).toHaveAttribute('open', '');
}

/** A change's line inside an open batch, found by its subject. */
const change = (row: Locator, subject: string) =>
	row.locator('details li').filter({ hasText: subject });

/** The batch's own state, beside its label: "Undone", "Partly undone, k of n" or nothing. */
const state = (row: Locator) => row.locator('p').first();

/** The line of a Setup row: its name, rename and archive controls. */
const setupLine = setupRow;

const selectedBar = (page: Page) => page.getByRole('button', { name: 'Undo selected changes' });

test('shows a batch with its label, time and changes', async ({ page }) => {
	const user = await newUser('shows');
	seedCustomer(user.id, 'Acme');
	await signIn(page, user.username);
	await openHistory(page);

	const today = dateIn(zone);
	const weekday = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long' }).format(
		new Date()
	);
	await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${today} ${weekday}`);

	const row = batch(page, 'Create customer "Acme"');
	await expect(row).toHaveCount(1);
	await expect(row.locator('.figures').first()).toHaveText(/^\d{2}:\d{2}$/);
	await expect(state(row)).toHaveText('Create customer "Acme"');
	await expect(row.locator('summary')).toHaveText('1 change');
	await expect(row.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
	await expect(row.getByRole('button', { name: 'Redo', exact: true })).toHaveCount(0);

	await openChanges(row);
	await expect(row.locator('details li')).toHaveCount(1);
	await expect(change(row, 'Customer Acme')).toHaveText('Created Customer Acme');
	await expect(page.getByRole('link', { name: 'Older' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Newest' })).toHaveCount(0);
});

test('undoes a batch from the list, then redoes it', async ({ page }) => {
	const user = await newUser('undo');
	const acme = seedCustomer(user.id, 'Acme');
	renameElsewhere(user.id, 'customers', acme, 'Acme Ltd');
	const label = 'Rename customer "Acme" to "Acme Ltd"';
	await signIn(page, user.username);
	await openHistory(page);

	await openChanges(batch(page, label));
	await expect(change(batch(page, label), 'Customer Acme Ltd')).toHaveText(
		'Changed Customer Acme Ltd Name: Acme → Acme Ltd'
	);

	await batch(page, label).getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(strip(page)).toContainText(`Done: Undo "${label}".`);
	await expect(page).toHaveURL(/\/history$/);
	const row = batch(page, label);
	await expect(state(row)).toHaveText(`${label} Undone`);
	await expect(row.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
	await expect(row.getByRole('button', { name: 'Redo', exact: true })).toBeVisible();
	await expect(batch(page, `Undo "${label}"`)).toHaveCount(1);

	await page.goto('/setup');
	await expect(setupLine(page, 'Acme')).toBeVisible();
	await expect(setupLine(page, 'Acme Ltd')).toHaveCount(0);

	await openHistory(page);
	await batch(page, label).getByRole('button', { name: 'Redo', exact: true }).click();
	await expect(strip(page)).toContainText(`Done: Redo "${label}".`);
	await expect(state(batch(page, label))).toHaveText(label);
	await expect(batch(page, label).getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
	await expect(batch(page, `Redo "${label}"`)).toHaveCount(1);

	await page.goto('/setup');
	await expect(setupLine(page, 'Acme Ltd')).toBeVisible();
});

test('undoes two of a batch’s three changes: partly undone, the third stands', async ({ page }) => {
	const user = await newUser('partly');
	const label = 'Set up Globex';
	seedThreeChanges(user.id, label, { activity: 'Travel', location: 'Office', customer: 'Globex' });
	await signIn(page, user.username);
	await openHistory(page);

	const row = batch(page, label);
	await expect(row.locator('summary')).toHaveText('3 changes');
	await openChanges(row);
	await expect(row.locator('details li')).toHaveText([
		'Created Activity Travel',
		'Created Location Office',
		'Created Customer Globex'
	]);
	await change(row, 'Activity Travel').getByRole('checkbox').check();
	await change(row, 'Location Office').getByRole('checkbox').check();
	await expect(page.getByText('2 selected')).toBeVisible();
	await selectedBar(page).click();

	await expect(strip(page)).toContainText('Done: Undo 2 changes.');
	const after = batch(page, label);
	await expect(state(after)).toHaveText(`${label} Partly undone, 2 of 3`);
	await expect(after.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
	await expect(after.getByRole('button', { name: 'Redo', exact: true })).toBeVisible();
	await openChanges(after);
	await expect(change(after, 'Activity Travel')).toHaveText('Created Activity Travel Undone');
	await expect(change(after, 'Location Office')).toHaveText('Created Location Office Undone');
	await expect(change(after, 'Customer Globex')).toHaveText('Created Customer Globex');

	await page.goto('/setup');
	await expect(setupLine(page, 'Globex')).toBeVisible();
	await expect(setupLine(page, 'Travel')).toHaveCount(0);
	await expect(setupLine(page, 'Office')).toHaveCount(0);
});

test('undoes changes from two batches in one step', async ({ page }) => {
	const user = await newUser('two');
	seedCustomer(user.id, 'Acme');
	seedCustomer(user.id, 'Initech');
	await signIn(page, user.username);
	await openHistory(page);

	for (const name of ['Acme', 'Initech']) {
		const row = batch(page, `Create customer "${name}"`);
		await openChanges(row);
		await change(row, `Customer ${name}`).getByRole('checkbox').check();
	}
	await expect(page.getByText('2 selected')).toBeVisible();
	await selectedBar(page).click();

	await expect(strip(page)).toContainText('Done: Undo 2 changes.');
	await expect(batch(page, 'Undo 2 changes')).toHaveCount(1);
	await expect(page.getByRole('main').locator('summary')).toHaveText([
		'2 changes',
		'1 change',
		'1 change'
	]);
	for (const name of ['Acme', 'Initech']) {
		const label = `Create customer "${name}"`;
		await expect(state(batch(page, label))).toHaveText(`${label} Undone`);
	}

	await page.goto('/setup');
	await expect(page.getByText('No customers yet.')).toBeVisible();
});

test('a refused undo shows the core’s message, keeps the ticks and changes nothing', async ({
	page
}) => {
	const user = await newUser('refused');
	const hooli = seedCustomer(user.id, 'Hooli');
	seedProject(user.id, hooli, 'Box');
	const label = 'Create customer "Hooli"';
	await signIn(page, user.username);
	await openHistory(page);

	await openChanges(batch(page, label));
	await change(batch(page, label), 'Customer Hooli').getByRole('checkbox').check();
	await selectedBar(page).click();

	const alert = page.getByRole('alert');
	await expect(alert).toHaveText('Other records depend on this.');
	const row = batch(page, label);
	await expect(row.locator('details')).toHaveAttribute('open', '');
	await expect(change(row, 'Customer Hooli').getByRole('checkbox')).toBeChecked();
	await expect(page.getByText('1 selected')).toBeVisible();
	await expect(state(row)).toHaveText(label);
	await expect(page.getByRole('main').locator('summary')).toHaveCount(2);
	await expect(strip(page)).toHaveCount(0);

	await page.goto('/setup');
	await expect(setupLine(page, 'Hooli')).toBeVisible();
	await expect(setupLine(page, 'Box')).toBeVisible();
});

test('51 batches page by Older and Newest', async ({ page }) => {
	const user = await newUser('older');
	seedBatches(user.id, 51);
	await signIn(page, user.username);
	await openHistory(page);

	await expect(page.getByRole('main').locator('summary')).toHaveCount(50);
	await expect(batch(page, 'Create customer "Customer 51"')).toHaveCount(1);
	await expect(batch(page, 'Create customer "Customer 2"')).toHaveCount(1);
	await expect(batch(page, 'Create customer "Customer 1"')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Newest' })).toHaveCount(0);

	await page.getByRole('link', { name: 'Older' }).click();
	await expect(page).toHaveURL(/\/history\?before=/);
	await expect(page.getByRole('main').locator('summary')).toHaveCount(1);
	await expect(batch(page, 'Create customer "Customer 1"')).toHaveCount(1);
	await expect(page.getByRole('link', { name: 'Older' })).toHaveCount(0);

	await page.getByRole('link', { name: 'Newest' }).click();
	await expect(page).toHaveURL(/\/history$/);
	await expect(page.getByRole('main').locator('summary')).toHaveCount(50);
	await expect(batch(page, 'Create customer "Customer 51"')).toHaveCount(1);
});

test('a batch’s own Undo beats a tick on another batch', async ({ page }) => {
	const user = await newUser('beats');
	seedCustomer(user.id, 'Acme');
	seedCustomer(user.id, 'Initech');
	const a = 'Create customer "Acme"';
	const b = 'Create customer "Initech"';
	await signIn(page, user.username);
	await openHistory(page);

	await openChanges(batch(page, a));
	await change(batch(page, a), 'Customer Acme').getByRole('checkbox').check();
	await expect(page.getByText('1 selected')).toBeVisible();
	await batch(page, b).getByRole('button', { name: 'Undo', exact: true }).click();

	await expect(strip(page)).toContainText(`Done: Undo "${b}".`);
	await expect(state(batch(page, b))).toHaveText(`${b} Undone`);
	await expect(state(batch(page, a))).toHaveText(a);
	await expect(batch(page, a).getByText('Partly undone')).toHaveCount(0);
	await expect(batch(page, a).getByRole('button', { name: 'Redo', exact: true })).toHaveCount(0);

	await page.goto('/setup');
	await expect(setupLine(page, 'Acme')).toBeVisible();
	await expect(setupLine(page, 'Initech')).toHaveCount(0);
});

test('an unknown before goes back to the newest page', async ({ page }) => {
	const user = await newUser('nope');
	seedCustomer(user.id, 'Acme');
	await signIn(page, user.username);
	await page.goto('/history?before=nope');
	await expect(page).toHaveURL(/\/history$/);
	await expect(batch(page, 'Create customer "Acme"')).toHaveCount(1);
});

test('a forged batch id shows the core’s message and changes nothing', async ({ page }) => {
	const user = await newUser('forged');
	seedCustomer(user.id, 'Acme');
	const label = 'Create customer "Acme"';
	await signIn(page, user.username);
	await openHistory(page);

	const undo = batch(page, label).getByRole('button', { name: 'Undo', exact: true });
	await undo.evaluate((el) => ((el as HTMLButtonElement).value = 'forged-batch-id'));
	await undo.click();

	await expect(page.getByRole('alert')).toHaveText('Not found.');
	await expect(strip(page)).toHaveCount(0);
	await expect(state(batch(page, label))).toHaveText(label);
	await page.goto('/setup');
	await expect(setupLine(page, 'Acme')).toBeVisible();
});

test('an undo on an older page lands back on that page', async ({ page }) => {
	const user = await newUser('olderundo');
	seedBatches(user.id, 51);
	const label = 'Create customer "Customer 1"';
	await signIn(page, user.username);
	await openHistory(page);

	await page.getByRole('link', { name: 'Older' }).click();
	await expect(page).toHaveURL(/\/history\?before=/);
	const url = page.url();
	await batch(page, label).getByRole('button', { name: 'Undo', exact: true }).click();

	await expect(strip(page)).toContainText(`Done: Undo "${label}".`);
	await expect(page).toHaveURL(/\/history\?before=/);
	expect(page.url()).toBe(url);
	await expect(state(batch(page, label))).toHaveText(`${label} Undone`);
});

test('exactly 50 batches show no Older', async ({ page }) => {
	const user = await newUser('fifty');
	seedBatches(user.id, 50);
	await signIn(page, user.username);
	await openHistory(page);

	await expect(page.getByRole('main').locator('summary')).toHaveCount(50);
	await expect(batch(page, 'Create customer "Customer 1"')).toHaveCount(1);
	await expect(page.getByRole('link', { name: 'Older' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Newest' })).toHaveCount(0);
});

test('an agent batch shows the Agent chip', async ({ page }) => {
	const user = await newUser('agent');
	seedAgentCustomer(user.id, 'Umbrella');
	seedCustomer(user.id, 'Acme');
	await signIn(page, user.username);
	await openHistory(page);

	const agent = batch(page, 'Create customer "Umbrella"');
	await expect(state(agent)).toHaveText('Create customer "Umbrella" Agent');
	await expect(agent.getByText('Agent', { exact: true })).toBeVisible();
	await expect(state(batch(page, 'Create customer "Acme"'))).toHaveText('Create customer "Acme"');
});

test('the sidebar shows History current on /history', async ({ page }) => {
	const user = await newUser('rail');
	await signIn(page, user.username);
	await openHistory(page, false);
	await expect(page.getByText('Nothing recorded yet.')).toBeVisible();

	const main = page.getByRole('navigation', { name: 'Main' });
	if (test.info().project.name === 'pc') {
		await expect(main.getByRole('link', { name: 'History' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(main.getByRole('link', { name: 'Setup' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
	} else {
		// The phone's bar has no History, More has it; Today is not current either.
		await expect(main.getByRole('link', { name: 'History' })).toHaveCount(0);
		await expect(main.getByRole('link', { name: 'Today' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
		await main.getByRole('button', { name: 'More' }).click();
		await expect(page.getByRole('dialog').getByRole('link', { name: 'History' })).toHaveAttribute(
			'aria-current',
			'page'
		);
	}
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('ticks a change and undoes the selected changes', async ({ page }) => {
		const user = await newUser('nojs');
		seedCustomer(user.id, 'Wayne');
		const label = 'Create customer "Wayne"';
		await signIn(page, user.username);
		await openHistory(page, false);

		await selectedBar(page).click();
		await expect(page.getByRole('alert')).toHaveText('Select at least one change.');

		await openChanges(batch(page, label));
		await change(batch(page, label), 'Customer Wayne').getByRole('checkbox').check();
		await selectedBar(page).click();

		await expect(strip(page)).toContainText('Done: Undo 1 change.');
		await expect(state(batch(page, label))).toHaveText(`${label} Undone`);
		await expect(batch(page, 'Undo 1 change')).toHaveCount(1);
	});
});
