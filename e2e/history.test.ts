import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
	PASSWORD,
	dateIn,
	editElsewhere,
	noonZone,
	renameElsewhere,
	seedAgentCustomer,
	seedBatches,
	seedCustomer,
	seedEmptyUser,
	seedEntry,
	seedLocation,
	seedMany,
	seedMoveBatch,
	seedProject,
	seedSystemCustomer,
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
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

const rememberZone = (context: BrowserContext) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

/**
 * Opens the History screen. With JavaScript it waits for the script (the form says so),
 * since a tick made before then is reset when the page hydrates.
 */
async function openHistory(page: Page, script = true, path = '/history') {
	await page.goto(path);
	await expect(page.getByRole('heading', { name: 'History', level: 1 })).toBeVisible();
	if (script) await expect(page.locator('form#history[data-enhanced]')).toHaveCount(1);
}

const strip = (page: Page) => page.getByRole('status');
const stripUndo = (page: Page) => page.locator('[data-undo-strip] [data-undo]');

/**
 * A batch's row, found by its label exactly (an undo's label quotes it). Without the
 * script both the PC's table and the phone's list render, CSS showing one: the shown one.
 */
const batch = (page: Page, label: string) =>
	page.locator('[data-batch]:visible').filter({ has: page.getByText(label, { exact: true }) });

/** Opens a batch's changes: its disclosure with the script, its `<details>` without. */
async function openChanges(row: Locator) {
	const disclosure = row.locator('[data-disclosure]');
	if ((await disclosure.count()) > 0) {
		if ((await disclosure.getAttribute('aria-expanded')) !== 'true') await disclosure.click();
		await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
		return;
	}
	const details = row.locator('details');
	if ((await details.getAttribute('open')) === null) await row.locator('summary').click();
	await expect(details).toHaveAttribute('open', '');
}

/** A change's line inside an open batch, found by its subject. */
const change = (row: Locator, subject: string) => row.locator('ul li').filter({ hasText: subject });
const stateOf = (row: Locator) => row.locator('[data-state]');
const undoOf = (row: Locator, label: string) =>
	row.getByRole('button', { name: `Undo ${label}`, exact: true });
const redoOf = (row: Locator, label: string) =>
	row.getByRole('button', { name: `Redo ${label}`, exact: true });

const range = (page: Page) => page.locator('main p').filter({ hasText: /^\d+–\d+ of \d+ batch/ });
const pager = (page: Page) => page.getByRole('navigation', { name: 'Pages', exact: true });
const foot = (page: Page) => page.getByRole('navigation', { name: 'More pages', exact: true });
const bar = (page: Page) => page.getByRole('region', { name: 'Selection' });
const undoSelected = (page: Page) => page.getByRole('button', { name: 'Undo selected' });
const redoSelected = (page: Page) => page.getByRole('button', { name: 'Redo selected' });

const setupLine = setupRow;

/**
 * Without the script: undoes one change of a three-change batch, then ticks it again
 * with a standing one, which the core refuses; unticks the undone one and retries,
 * which undoes the standing one. Only the shown tick boxes may post.
 */
async function refuseThenRetry(page: Page, label: string, undo: () => Locator) {
	await openChanges(batch(page, label));
	await change(batch(page, label), 'activity Travel').getByRole('checkbox').check();
	await undo().click();
	await expect(strip(page)).toContainText('Done: Undo 1 change.');
	await expect(stateOf(batch(page, label))).toHaveText('Partly undone, 1 of 3');

	const row = batch(page, label);
	await openChanges(row);
	await change(row, 'activity Travel').getByRole('checkbox').check();
	await change(row, 'location Office').getByRole('checkbox').check();
	await undo().click();
	await expect(page.getByRole('alert')).toHaveText('That change is already undone.');

	await change(row, 'activity Travel').getByRole('checkbox').uncheck();
	await expect(change(row, 'location Office').getByRole('checkbox')).toBeChecked();
	await undo().click();
	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect(strip(page)).toContainText('Done: Undo 1 change.');
	await expect(stateOf(batch(page, label))).toHaveText('Partly undone, 2 of 3');
}
const weekday = (date: string) =>
	new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(
		new Date(`${date}T12:00:00Z`)
	);

test.describe('on the PC', () => {
	test.skip(() => test.info().project.name !== 'pc', 'the PC table; the phone has its own');

	test('finds an edit by what it touched, undoes it from the row and redoes it', async ({
		page
	}) => {
		const user = await newUser('edit');
		const compx = seedCustomer(user.id, 'CompX');
		const project = seedProject(user.id, compx, 'ClientY – ProjectZ');
		const yesterday = dateIn(zone, new Date(Date.now() - 86_400_000));
		const entry = seedEntry(user.id, zone, {
			projectId: project,
			date: yesterday,
			start: '09:30',
			end: '09:45',
			description: 'Standup'
		});
		editElsewhere(user.id, entry, 'Standup and planning');
		await signIn(page, user.username);
		await openHistory(page);

		const label = 'Edit entry on "ClientY – ProjectZ"';
		const first = page.locator('[data-batch]').first();
		await expect(first.locator('[data-label]')).toHaveText(label);
		const row = batch(page, label);
		await expect(row).toContainText(
			`${weekday(yesterday)} ${yesterday} 09:30–09:45 · CompX › ClientY – ProjectZ`
		);
		await expect(row.locator('.figures').first()).toHaveText(/^\d{2}:\d{2}$/);
		await expect(row.getByText('Agent', { exact: true })).toHaveCount(0);
		await expect(row.getByText('System', { exact: true })).toHaveCount(0);
		await expect(row.locator('[data-count]')).toHaveText('1 change');
		await expect(stateOf(row)).toHaveText('');
		await expect(redoOf(row, label)).toHaveCount(0);

		await openChanges(row);
		await expect(change(row, 'Changed entry')).toContainText(
			'Description: Standup → Standup and planning'
		);

		await undoOf(row, label).click();
		await expect(strip(page)).toContainText(`Done: Undo "${label}".`);
		await expect(stripUndo(page)).toBeFocused();
		await expect(page).toHaveURL(/\/history$/);
		await expect(stateOf(row)).toHaveText('Undone');
		await expect(undoOf(row, label)).toHaveCount(0);
		await expect(redoOf(row, label)).toBeVisible();
		// The new batch heads the page; the opened batch stays open.
		await expect(first.locator('[data-label]')).toHaveText(`Undo "${label}"`);
		await expect(row.locator('[data-disclosure]')).toHaveAttribute('aria-expanded', 'true');

		await page.goto(`/entries/${entry}`);
		await expect(page.getByLabel('Description')).toHaveValue('Standup');

		await openHistory(page);
		await redoOf(batch(page, label), label).click();
		await expect(strip(page)).toContainText(`Done: Redo "${label}".`);
		await expect(stateOf(batch(page, label))).toHaveText('');
		await expect(undoOf(batch(page, label), label)).toBeVisible();
		await page.goto(`/entries/${entry}`);
		await expect(page.getByLabel('Description')).toHaveValue('Standup and planning');
	});

	test('undoes chosen changes of a batch: partly undone, and a mixed tick says why', async ({
		page
	}) => {
		const user = await newUser('chosen');
		const compx = seedCustomer(user.id, 'CompX');
		const project = seedProject(user.id, compx, 'Support');
		const home = seedLocation(user.id, 'Home office');
		const entries = ['09:00', '10:00', '11:00'].map((start, i) =>
			seedEntry(user.id, zone, {
				projectId: project,
				start,
				end: `${String(9 + i).padStart(2, '0')}:30`,
				description: `Ticket ${i + 1}`
			})
		);
		const label = 'Edit 3 entries';
		seedMoveBatch(user.id, label, entries, home);
		await signIn(page, user.username);
		await openHistory(page);

		const row = batch(page, label);
		await expect(row.locator('[data-count]')).toHaveText('3 changes');
		await openChanges(row);
		await expect(row.locator('ul li')).toHaveCount(3);
		await expect(row.locator('ul li').first()).toContainText('Location: none → Home office');
		await expect(row.locator('ul li').first().locator('i')).toHaveText('none');

		const boxes = row.getByRole('checkbox');
		const top = async () => (await page.locator('[data-batch]').first().boundingBox())!.y;
		const before = await top();
		await boxes.nth(0).check();
		await expect(bar(page)).toBeVisible();
		expect(await top()).toBe(before);
		await boxes.nth(1).check();
		await expect(bar(page)).toContainText('2 selected');
		await expect(bar(page)).toContainText(`of “${label}”`);
		// A ticked line fills with accent, as Entries' ticked rows; an unticked one does not.
		const fill = (line: Locator) => line.evaluate((li) => getComputedStyle(li).backgroundColor);
		const lines = row.locator('ul li');
		await expect(lines.nth(0)).toHaveAttribute('data-ticked', '');
		await expect(lines.nth(2)).not.toHaveAttribute('data-ticked');
		await expect.poll(() => fill(lines.nth(0))).not.toBe('rgba(0, 0, 0, 0)');
		expect(await fill(lines.nth(2))).toBe('rgba(0, 0, 0, 0)');
		await expect(undoSelected(page)).toBeEnabled();
		await expect(redoSelected(page)).toBeDisabled();
		await expect(range(page)).toHaveCount(0);

		await undoSelected(page).click();
		await expect(strip(page)).toContainText('Done: Undo 2 changes.');
		await expect(stripUndo(page)).toBeFocused();
		await expect(bar(page)).toHaveCount(0);
		await expect(stateOf(row)).toHaveText('Partly undone, 2 of 3');
		await expect(undoOf(row, label)).toBeVisible();
		await expect(redoOf(row, label)).toBeVisible();
		await openChanges(row);
		await expect(row.locator('ul li').nth(0)).toContainText('Undone');
		await expect(row.locator('ul li').nth(2)).not.toContainText('Undone');

		// One undone and one standing: neither action applies, and the bar says why.
		await boxes.nth(1).check();
		await boxes.nth(2).check();
		await expect(bar(page)).toContainText('2 selected');
		await expect(bar(page)).toContainText('Tick only standing or only undone changes.');
		await expect(undoSelected(page)).toBeDisabled();
		await expect(redoSelected(page)).toBeDisabled();
		await undoSelected(page).click({ force: true });
		await expect(page.getByRole('alert')).toHaveCount(0);
		await expect(stateOf(row)).toHaveText('Partly undone, 2 of 3');

		await bar(page).getByRole('button', { name: 'Clear' }).click();
		await expect(bar(page)).toHaveCount(0);
		await expect(range(page)).toHaveText('1–8 of 8 batches');
		await expect(boxes.nth(2)).toBeFocused();
		await expect(boxes.nth(2)).not.toBeChecked();
	});

	test('at 1024 px what a batch touched keeps its customer › project', async ({ page }) => {
		const user = await newUser('narrow');
		const compx = seedCustomer(user.id, 'CompX');
		const project = seedProject(user.id, compx, 'ClientY – ProjectZ');
		const yesterday = dateIn(zone, new Date(Date.now() - 86_400_000));
		const entry = seedEntry(user.id, zone, {
			projectId: project,
			date: yesterday,
			start: '09:30',
			end: '09:45',
			description: 'Standup'
		});
		editElsewhere(user.id, entry, 'Standup and planning');
		await page.setViewportSize({ width: 1024, height: 900 });
		await signIn(page, user.username);
		await openHistory(page);

		const touched = batch(page, 'Edit entry on "ClientY – ProjectZ"').locator(
			'[data-label] + span'
		);
		await expect(touched).toContainText('CompX › ClientY – ProjectZ');
		// Nothing of it is cut: it takes a second line before an ellipsis.
		expect(
			await touched.evaluate(
				(el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1
			)
		).toBe(true);
	});

	test('the last untick brings the toolbar back, the focus kept on the box', async ({ page }) => {
		const user = await newUser('untick');
		seedCustomer(user.id, 'Acme');
		await signIn(page, user.username);
		await openHistory(page);

		const row = batch(page, 'Create customer "Acme"');
		await openChanges(row);
		const box = row.getByRole('checkbox');
		await box.check();
		await expect(bar(page)).toContainText('1 selected');
		await box.uncheck();
		await expect(bar(page)).toHaveCount(0);
		await expect(range(page)).toHaveText('1–1 of 1 batch');
		await expect(box).toBeFocused();
	});

	test('chooses changes across two batches and undoes them in one step', async ({ page }) => {
		const user = await newUser('across');
		seedCustomer(user.id, 'Acme');
		seedCustomer(user.id, 'Initech');
		await signIn(page, user.username);
		await openHistory(page);

		for (const name of ['Acme', 'Initech']) {
			const row = batch(page, `Create customer "${name}"`);
			await openChanges(row);
			await change(row, `customer ${name}`).getByRole('checkbox').check();
		}
		await expect(bar(page)).toContainText('2 selected');
		await expect(bar(page)).toContainText('across 2 batches');
		// The ticks are kept while a batch closes and opens again.
		await batch(page, 'Create customer "Acme"').locator('[data-disclosure]').click();
		await expect(bar(page)).toContainText('2 selected');
		await undoSelected(page).click();

		await expect(strip(page)).toHaveCount(1);
		await expect(strip(page)).toContainText('Done: Undo 2 changes.');
		await expect(batch(page, 'Undo 2 changes')).toHaveCount(1);
		await expect(page.locator('[data-batch] [data-count]')).toHaveText([
			'2 changes',
			'1 change',
			'1 change'
		]);
		for (const name of ['Acme', 'Initech']) {
			await expect(stateOf(batch(page, `Create customer "${name}"`))).toHaveText('Undone');
		}

		await page.goto('/setup');
		await expect(page.getByText('No customers yet.')).toBeVisible();
	});

	test('a refused undo shows the core’s message in view, focused, and changes nothing', async ({
		page
	}) => {
		const user = await newUser('refused');
		seedBatches(user.id, 30);
		const compz = seedCustomer(user.id, 'CompZ');
		seedProject(user.id, compz, 'CompZ – Audit');
		const label = 'Create customer "CompZ"';
		await signIn(page, user.username);
		await openHistory(page);

		const row = batch(page, label);
		await undoOf(row, label).click();
		const alert = page.getByRole('alert');
		await expect(alert).toHaveText('Other records depend on this.');
		await expect(alert).toBeInViewport();
		await expect(alert).toBeFocused();
		// Posted from the top, the page stays there: the toolbar is not slid under the header.
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
		await expect(pager(page)).toBeInViewport({ ratio: 1 });
		await expect(strip(page)).toHaveCount(0);
		await expect(stateOf(row)).toHaveText('');

		// The same with a tick: the tick kept, its batch open, the bar still up.
		await openChanges(row);
		await change(row, 'customer CompZ').getByRole('checkbox').check();
		await undoSelected(page).click();
		await expect(alert).toHaveText('Other records depend on this.');
		await expect(alert).toBeInViewport();
		await expect(alert).toBeFocused();
		await expect(change(row, 'customer CompZ').getByRole('checkbox')).toBeChecked();
		await expect(row.locator('[data-disclosure]')).toHaveAttribute('aria-expanded', 'true');
		await expect(bar(page)).toContainText('1 selected');
		await expect(stateOf(row)).toHaveText('');

		await page.goto('/setup');
		await expect(setupLine(page, 'CompZ')).toBeVisible();
		await expect(setupLine(page, 'CompZ – Audit')).toBeVisible();
	});

	test('51 batches page by the toolbar and the foot links; System chips on seeded ones', async ({
		page
	}) => {
		const user = await newUser('pages');
		seedSystemCustomer(user.id, 'Seeded');
		seedBatches(user.id, 50);
		await signIn(page, user.username);
		await openHistory(page);

		await expect(range(page)).toHaveText('1–50 of 51 batches');
		await expect(page.locator('[data-batch]')).toHaveCount(50);
		await expect(pager(page).getByRole('button', { name: 'Newer' })).toBeDisabled();
		await expect(foot(page).getByRole('link')).toHaveText(['Older']);
		await expect(
			batch(page, 'Create customer "Customer 50"').getByText('System', { exact: true })
		).toHaveCount(0);

		await pager(page).getByRole('link', { name: 'Older' }).click();
		await expect(page).toHaveURL(/\/history\?before=/);
		await expect(range(page)).toHaveText('51–51 of 51 batches');
		await expect(page.locator('[data-batch]')).toHaveCount(1);
		const seeded = batch(page, 'Create customer "Seeded"');
		await expect(seeded.getByText('System', { exact: true })).toBeVisible();
		await expect(pager(page).getByRole('button', { name: 'Older' })).toBeDisabled();
		await expect(pager(page).getByRole('link', { name: 'Newer' })).toBeVisible();
		await expect(foot(page).getByRole('link')).toHaveText(['Newer']);

		await foot(page).getByRole('link', { name: 'Newer' }).click();
		await expect(page).toHaveURL(/\/history$/);
		await expect(range(page)).toHaveText('1–50 of 51 batches');

		await pager(page).getByRole('link', { name: 'Older' }).click();
		await expect(range(page)).toHaveText('51–51 of 51 batches');
		await pager(page).getByRole('link', { name: 'Newer' }).click();
		await expect(page).toHaveURL(/\/history$/);
		await expect(range(page)).toHaveText('1–50 of 51 batches');
	});

	test('exactly 50 batches: one page, Newer and Older both disabled', async ({ page }) => {
		const user = await newUser('fifty');
		seedBatches(user.id, 50);
		await signIn(page, user.username);
		await openHistory(page);

		await expect(range(page)).toHaveText('1–50 of 50 batches');
		await expect(page.locator('[data-batch]')).toHaveCount(50);
		await expect(batch(page, 'Create customer "Customer 1"')).toHaveCount(1);
		await expect(pager(page).getByRole('button', { name: 'Newer' })).toBeDisabled();
		await expect(pager(page).getByRole('button', { name: 'Older' })).toBeDisabled();
		await expect(foot(page)).toHaveCount(0);
	});

	test('an undo on an older page lands back on that page, its range right', async ({ page }) => {
		const user = await newUser('olderundo');
		seedBatches(user.id, 141);
		const label = 'Create customer "Customer 60"';
		await signIn(page, user.username);
		await openHistory(page);

		await pager(page).getByRole('link', { name: 'Older' }).click();
		await expect(page).toHaveURL(/\/history\?before=/);
		await expect(range(page)).toHaveText('51–100 of 141 batches');
		const url = page.url();
		await undoOf(batch(page, label), label).click();

		await expect(strip(page)).toContainText(`Done: Undo "${label}".`);
		expect(page.url()).toBe(url);
		await expect(stateOf(batch(page, label))).toHaveText('Undone');
		// The undo is the newest batch, so this page now starts one further down.
		await expect(range(page)).toHaveText('52–101 of 142 batches');
	});

	test('a batch of more than 100 changes lists 100 without tick boxes', async ({ page }) => {
		const user = await newUser('big');
		seedMany(user.id, zone, 101);
		const label = 'Seed 101 entries';
		await signIn(page, user.username);
		await openHistory(page);

		const row = batch(page, label);
		await expect(row.locator('[data-count]')).toHaveText('103 changes');
		await openChanges(row);
		await expect(row.getByRole('checkbox')).toHaveCount(0);
		await expect(row.locator('ul li').last()).toHaveText(
			'The first 100 of 103 are listed. Too many to choose one by one: undo or redo the whole batch.'
		);
		await expect(undoOf(row, label)).toBeVisible();
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
		await change(batch(page, a), 'customer Acme').getByRole('checkbox').check();
		await expect(bar(page)).toContainText('1 selected');
		await undoOf(batch(page, b), b).click();

		await expect(strip(page)).toContainText(`Done: Undo "${b}".`);
		await expect(stateOf(batch(page, b))).toHaveText('Undone');
		await expect(stateOf(batch(page, a))).toHaveText('');
		await expect(redoOf(batch(page, a), a)).toHaveCount(0);
		// An action clears the ticks.
		await expect(bar(page)).toHaveCount(0);

		await page.goto('/setup');
		await expect(setupLine(page, 'Acme')).toBeVisible();
		await expect(setupLine(page, 'Initech')).toHaveCount(0);
	});

	test('undoes a rename and shows its field line', async ({ page }) => {
		const user = await newUser('rename');
		const acme = seedCustomer(user.id, 'Acme');
		renameElsewhere(user.id, 'customers', acme, 'Acme Ltd');
		const label = 'Rename customer "Acme" to "Acme Ltd"';
		await signIn(page, user.username);
		await openHistory(page);

		const row = batch(page, label);
		await expect(row).toContainText('Customer Acme Ltd');
		await openChanges(row);
		await expect(change(row, 'customer Acme Ltd')).toHaveText(
			'Changed customer Acme Ltd Name: Acme → Acme Ltd'
		);
		await row.locator('[data-disclosure]').focus();
		await page.keyboard.press('Enter');
		await expect(row.locator('[data-disclosure]')).toHaveAttribute('aria-expanded', 'false');
		await page.keyboard.press('Space');
		await expect(row.locator('[data-disclosure]')).toHaveAttribute('aria-expanded', 'true');
		// A click on the row's text closes it as well.
		await row.locator('[data-count]').click();
		await expect(row.locator('[data-disclosure]')).toHaveAttribute('aria-expanded', 'false');
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

		const undo = undoOf(batch(page, label), label);
		await undo.evaluate((el) => ((el as HTMLButtonElement).value = 'forged-batch-id'));
		await undo.click();

		await expect(page.getByRole('alert')).toHaveText('Not found.');
		await expect(page.getByRole('alert')).toBeFocused();
		await expect(strip(page)).toHaveCount(0);
		await expect(stateOf(batch(page, label))).toHaveText('');
		await page.goto('/setup');
		await expect(setupLine(page, 'Acme')).toBeVisible();
	});

	test('an agent batch shows the Agent chip, a UI batch none', async ({ page }) => {
		const user = await newUser('agent');
		seedAgentCustomer(user.id, 'Umbrella');
		seedCustomer(user.id, 'Acme');
		await signIn(page, user.username);
		await openHistory(page);

		await expect(
			batch(page, 'Create customer "Umbrella"').getByText('Agent', { exact: true })
		).toBeVisible();
		const ui = batch(page, 'Create customer "Acme"');
		await expect(ui.getByText('Agent', { exact: true })).toHaveCount(0);
		await expect(ui.getByText('System', { exact: true })).toHaveCount(0);
	});
});

test.describe('on the phone', () => {
	test.skip(() => test.info().project.name !== 'phone', 'the phone list; the PC has its own');
	test.use({ viewport: { width: 390, height: 844 } });

	/** The phone's "+" keeps the right 72 px; no row control may sit in that column. */
	const GUTTER = 390 - 72;
	const plus = (page: Page) => page.getByRole('link', { name: 'New entry', exact: true });
	const select = (page: Page) => page.getByRole('button', { name: 'Select', exact: true });
	const barButton = (page: Page, name: string) =>
		bar(page).getByRole('button', { name, exact: true });

	/** Today → More → History: two taps. */
	async function fromMore(page: Page) {
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('button', { name: 'More' })
			.click();
		await page.getByRole('dialog').getByRole('link', { name: 'History' }).click();
		await expect(page.getByRole('heading', { name: 'History', level: 1 })).toBeVisible();
		await expect(page.locator('form#history[data-enhanced]')).toHaveCount(1);
	}

	/** The page is no wider than the phone, and no row control reaches the "+"'s column. */
	async function expectFits(page: Page) {
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390
		);
		const ends = await page
			.locator('[data-phone-history] :is(a, button, input, summary), [data-select]')
			.evaluateAll((els) =>
				els
					.filter((el) => el.checkVisibility())
					.map((el) => ({
						name: el.getAttribute('aria-label') ?? el.textContent?.trim(),
						right: el.getBoundingClientRect().right
					}))
			);
		expect(ends.length).toBeGreaterThan(0);
		expect(ends.filter((e) => e.right > GUTTER + 0.5)).toEqual([]);
	}

	test('gate task 6: undo and redo from the leading button, open, select, tick, undo, done', async ({
		page
	}) => {
		const user = await newUser('phone-gate');
		const label = 'Set up Globex';
		seedThreeChanges(user.id, label, {
			activity: 'Travel',
			location: 'Office',
			customer: 'Globex'
		});
		seedAgentCustomer(user.id, 'Agent Co');
		await signIn(page, user.username);
		await fromMore(page);

		await expect(range(page)).toHaveCount(0);
		await expect(page.locator('main p').filter({ hasText: /^1–2 of 2$/ })).toBeVisible();
		await expectFits(page);

		// The newest batch, undone and redone from its leading button.
		const newest = 'Create customer "Agent Co"';
		const top = batch(page, newest);
		await expect(top.getByText('Agent', { exact: true })).toBeVisible();
		await expect(top.locator('[data-count]')).toHaveText('1 change');
		await undoOf(top, newest).click();
		await expect(strip(page)).toContainText(`Done: Undo "${newest}".`);
		await expect(stripUndo(page)).toBeFocused();
		await expect(stateOf(top)).toHaveText('Undone');
		await expect(undoOf(top, newest)).toHaveCount(0);
		await redoOf(top, newest).click();
		await expect(strip(page)).toContainText(`Done: Redo "${newest}".`);
		await expect(stripUndo(page)).toBeFocused();
		await expect(stateOf(top)).toHaveText('');
		await expect(undoOf(top, newest)).toBeVisible();

		// A batch's changes open under it, without tick boxes until Select.
		const row = batch(page, label);
		await expect(row.locator('[data-count]')).toHaveText('3 changes');
		await openChanges(row);
		await expect(change(row, 'activity Travel')).toBeVisible();
		await expect(row.getByRole('checkbox')).toHaveCount(0);

		// Select: tick boxes, the bar pinned in the strip's place, no leading buttons, no "+";
		// the list does not move.
		const before = (await row.boundingBox())!.y;
		await expect(plus(page)).toBeVisible();
		await select(page).click();
		await expect(bar(page)).toContainText('0 selected');
		expect((await row.boundingBox())!.y).toBe(before);
		await expect(plus(page)).toBeHidden();
		await expect(undoOf(row, label)).toHaveCount(0);
		await expect(row.getByRole('checkbox')).toHaveCount(3);
		await expectFits(page);
		await change(row, 'activity Travel').getByRole('checkbox').check();
		await expect(bar(page)).toContainText('1 selected');
		await expect(bar(page)).toContainText(`of “${label}”`);
		await expect(barButton(page, 'Undo')).toBeEnabled();
		await expect(barButton(page, 'Redo')).toBeDisabled();
		await barButton(page, 'Undo').click();
		await expect(strip(page)).toContainText('Done: Undo 1 change.');
		await expect(stripUndo(page)).toBeFocused();
		await expect(bar(page)).toContainText('0 selected');
		await expect(stateOf(row)).toHaveText('Partly undone, 1 of 3');
		// The "·" ends the disclosure's part, so a wrapped state never starts with it.
		await expect(row.locator('[data-disclosure] + [aria-hidden]')).toHaveText('·');

		// A mixed tick says why, both actions off.
		await change(row, 'activity Travel').getByRole('checkbox').check();
		await change(row, 'location Office').getByRole('checkbox').check();
		await expect(bar(page)).toContainText('Tick only standing or only undone changes.');
		await expect(barButton(page, 'Undo')).toBeDisabled();
		await expect(barButton(page, 'Redo')).toBeDisabled();

		// Done: the ticks clear, the focus back on Select, the leading buttons and the "+" back.
		await barButton(page, 'Done').click();
		await expect(bar(page)).toHaveCount(0);
		await expect(select(page)).toBeFocused();
		await expect(plus(page)).toBeVisible();
		await expect(row.getByRole('checkbox')).toHaveCount(0);

		// A partly undone batch leads with both, Undo over Redo.
		const undo = (await undoOf(row, label).boundingBox())!;
		const redo = (await redoOf(row, label).boundingBox())!;
		expect(redo.y).toBeGreaterThanOrEqual(undo.y + undo.height);
		expect(redo.x).toBe(undo.x);
		await expectFits(page);
	});

	test("rows stay short: the meta line's 44 px target does not add a line of its own", async ({
		page
	}) => {
		const user = await newUser('phone-short');
		seedCustomer(user.id, 'Acme');
		const compx = seedCustomer(user.id, 'CompX');
		const project = seedProject(user.id, compx, 'ClientY – ProjectZ');
		const yesterday = dateIn(zone, new Date(Date.now() - 86_400_000));
		const entry = seedEntry(user.id, zone, {
			projectId: project,
			date: yesterday,
			start: '09:30',
			end: '09:45',
			description: 'Standup'
		});
		editElsewhere(user.id, entry, 'Standup and planning');
		await signIn(page, user.username);
		await openHistory(page);

		const height = async (label: string) => (await batch(page, label).boundingBox())!.height;
		// A one-line label and touched line: under 80 px; two lines each: under 116 px.
		expect(await height('Create customer "Acme"')).toBeLessThanOrEqual(80);
		expect(await height('Edit entry on "ClientY – ProjectZ"')).toBeLessThanOrEqual(116);
		const disclosure = batch(page, 'Create customer "Acme"').locator('[data-disclosure]');
		expect((await disclosure.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	});

	test('long labels and what they touched wrap, never wider than the phone', async ({ page }) => {
		const user = await newUser('phone-wide');
		seedBatches(user.id, 51);
		const compx = seedCustomer(user.id, 'CompX Holdings International');
		const project = seedProject(user.id, compx, 'ClientY – A very long project name indeed');
		const entry = seedEntry(user.id, zone, {
			projectId: project,
			start: '09:30',
			end: '09:45',
			description: 'Standup'
		});
		editElsewhere(user.id, entry, 'Standup and planning with a long description that wraps');
		await signIn(page, user.username);
		await openHistory(page);
		await expectFits(page);
		const row = batch(page, 'Edit entry on "ClientY – A very long project name indeed"');
		await openChanges(row);
		await expectFits(page);
		await select(page).click();
		await expectFits(page);
		// Newer and Older are the links under the list.
		await expect(pager(page)).toHaveCount(0);
		await expect(foot(page).getByRole('link', { name: 'Older' })).toBeVisible();
	});

	test('a refusal shows in view and takes the focus', async ({ page }) => {
		const user = await newUser('phone-refused');
		seedBatches(user.id, 12);
		const compz = seedCustomer(user.id, 'CompZ');
		seedProject(user.id, compz, 'CompZ – Audit');
		await signIn(page, user.username);
		await openHistory(page);
		const label = 'Create customer "CompZ"';
		await undoOf(batch(page, label), label).click();
		const alert = page.getByRole('alert');
		await expect(alert).toHaveText('Other records depend on this.');
		await expect(alert).toBeInViewport();
		await expect(alert).toBeFocused();
		await expect(stateOf(batch(page, label))).toHaveText('');
	});

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		test('Select is a link to the page with tick boxes; Undo posts them; Done leaves', async ({
			page
		}) => {
			const user = await newUser('phone-nojs');
			const label = 'Set up Globex';
			seedThreeChanges(user.id, label, {
				activity: 'Travel',
				location: 'Office',
				customer: 'Globex'
			});
			await signIn(page, user.username);
			await openHistory(page, false);

			await openChanges(batch(page, label));
			await expect(batch(page, label).getByRole('checkbox')).toHaveCount(0);
			await page.getByRole('link', { name: 'Select', exact: true }).click();
			await expect(page).toHaveURL(/\/history\?select=1$/);
			const row = batch(page, label);
			await expect(undoOf(row, label)).toHaveCount(0);
			await openChanges(row);
			await change(row, 'activity Travel').getByRole('checkbox').check();
			await barButton(page, 'Undo').click();

			await expect(strip(page)).toContainText('Done: Undo 1 change.');
			await expect(page).toHaveURL(/\/history\?select=1$/);
			await expect(stateOf(batch(page, label))).toHaveText('Partly undone, 1 of 3');

			await bar(page).getByRole('link', { name: 'Done' }).click();
			await expect(page).toHaveURL(/\/history$/);
			await expect(bar(page)).toHaveCount(0);
			await expect(undoOf(batch(page, label), label)).toBeVisible();
			await expect(redoOf(batch(page, label), label)).toBeVisible();
		});

		test('after a refusal, an untick and a retry undo the rest', async ({ page }) => {
			const user = await newUser('phone-nojs-retry');
			const label = 'Set up Globex';
			seedThreeChanges(user.id, label, {
				activity: 'Travel',
				location: 'Office',
				customer: 'Globex'
			});
			await signIn(page, user.username);
			await openHistory(page, false, '/history?select=1');
			await refuseThenRetry(page, label, () => barButton(page, 'Undo'));
		});
	});
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
	test.skip(() => test.info().project.name !== 'pc', 'the PC table; the phone has its own');

	test('ticks a change and undoes the selected changes', async ({ page }) => {
		const user = await newUser('nojs');
		seedCustomer(user.id, 'Wayne');
		const label = 'Create customer "Wayne"';
		await signIn(page, user.username);
		await openHistory(page, false);

		await undoSelected(page).click();
		await expect(page.getByRole('alert')).toHaveText('Select at least one change.');

		await openChanges(batch(page, label));
		await change(batch(page, label), 'customer Wayne').getByRole('checkbox').check();
		await undoSelected(page).click();

		await expect(strip(page)).toContainText('Done: Undo 1 change.');
		await expect(stateOf(batch(page, label))).toHaveText('Undone');
		await expect(batch(page, 'Undo 1 change')).toHaveCount(1);

		await undoOf(batch(page, 'Undo 1 change'), 'Undo 1 change').click();
		await expect(strip(page)).toContainText('Done: Undo "Undo 1 change".');
		await expect(stateOf(batch(page, label))).toHaveText('');
	});

	test('a mixed selection reaches the core, which refuses it', async ({ page }) => {
		const user = await newUser('nojsmixed');
		const label = 'Set up Globex';
		seedThreeChanges(user.id, label, {
			activity: 'Travel',
			location: 'Office',
			customer: 'Globex'
		});
		await signIn(page, user.username);
		await openHistory(page, false);

		await openChanges(batch(page, label));
		await change(batch(page, label), 'activity Travel').getByRole('checkbox').check();
		await undoSelected(page).click();
		await expect(strip(page)).toContainText('Done: Undo 1 change.');
		await expect(stateOf(batch(page, label))).toHaveText('Partly undone, 1 of 3');

		const row = batch(page, label);
		await openChanges(row);
		await change(row, 'activity Travel').getByRole('checkbox').check();
		await change(row, 'location Office').getByRole('checkbox').check();
		await undoSelected(page).click();
		await expect(page.getByRole('alert')).toHaveText('That change is already undone.');
		await expect(strip(page)).toHaveCount(0);
		await expect(row.locator('details')).toHaveAttribute('open', '');
		await expect(change(row, 'activity Travel').getByRole('checkbox')).toBeChecked();
		await expect(change(row, 'location Office').getByRole('checkbox')).toBeChecked();
		await expect(stateOf(row)).toHaveText('Partly undone, 1 of 3');

		await page.goto('/setup');
		await expect(setupLine(page, 'Office')).toBeVisible();
	});

	for (const path of ['/history', '/history?select=1'])
		test(`after a refusal, an untick and a retry undo the rest (${path})`, async ({ page }) => {
			const user = await newUser(`nojsretry${path.length}`);
			const label = 'Set up Globex';
			seedThreeChanges(user.id, label, {
				activity: 'Travel',
				location: 'Office',
				customer: 'Globex'
			});
			await signIn(page, user.username);
			await openHistory(page, false, path);
			await refuseThenRetry(page, label, () => undoSelected(page));
		});

	test('pages by links', async ({ page }) => {
		const user = await newUser('nojspages');
		seedBatches(user.id, 51);
		await signIn(page, user.username);
		await openHistory(page, false);

		await expect(range(page)).toHaveText('1–50 of 51 batches');
		await pager(page).getByRole('link', { name: 'Older' }).click();
		await expect(range(page)).toHaveText('51–51 of 51 batches');
		await foot(page).getByRole('link', { name: 'Newer' }).click();
		await expect(page).toHaveURL(/\/history$/);
	});
});
