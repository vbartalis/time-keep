import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
	PASSWORD,
	noonZone,
	seedActivity,
	seedEntry,
	seedLocation,
	seedMany,
	seedUser,
	startElsewhere
} from './seed';

// Noon in the browser's zone, so the morning entries are today's whenever this runs.
const zone = noonZone();
test.use({ timezoneId: zone });

const isPc = () => test.info().project.name === 'pc';

/** A user of its own for each test (templates Standup, Review, Support call; three morning entries). */
async function newUser(label: string) {
	const user = await seedUser(`${test.info().project.name}-${label}`, zone);
	seedActivity(user.id, 'Development');
	seedLocation(user.id, 'Home office');
	return user;
}

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

/** Opens a screen and waits for its script, so a click opens the form in place. */
async function open(page: Page, path: string, title: string) {
	await page.goto(path);
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

/** The header's "+ New entry" on the PC, the fixed "+" on the phone. */
const newEntry = (page: Page) => page.getByRole('link', { name: 'New entry' });
const dialog = (page: Page, name = 'New entry') => page.getByRole('dialog', { name });
const field = (page: Page, id: string) => page.locator(`#entry-${id}`);
const saveButton = (page: Page) => page.locator('button[form="entry-form"]');
const done = (page: Page) => page.getByRole('status').filter({ hasText: 'Done:' });
const bar = (page: Page) => page.getByRole('region', { name: 'Timer', exact: true });
/** The bar's Start: the PC header's, or the phone strip's ▶. */
const startButton = (page: Page) => page.locator('[data-start-list]:visible > summary');
const startList = (page: Page) => page.locator('[data-start-list][open]:visible');
/** The timer the bar shows in full: its time and name, a link to its form. */
const shown = (page: Page) => bar(page).getByRole('link').first();
/** Entries' rows: the PC table's, or the phone list's. */
const entryRows = (page: Page) => page.locator('tbody tr:visible, [data-phone-list] li:visible');
/** Restarts the row holding `text`: its ▶ on the PC, its ⋯ sheet's Restart on the phone. */
async function restartRow(page: Page, text: string, where: string) {
	const row = entryRows(page).filter({ hasText: text }).first();
	// ▶ is named "Restart <date> <start>, <where>".
	if (isPc())
		return row.getByRole('button', { name: new RegExp(`^Restart .*, ${where}$`) }).click();
	await row.getByRole('button', { name: /^Actions for/ }).click();
	await page.getByRole('dialog', { name: where }).getByRole('button', { name: 'Restart' }).click();
}
/** The Stop of the timer the bar shows in full. */
const shownStop = (page: Page) => bar(page).locator('[data-shown-stop]');

/** Starts `template` (one without a description) from the bar's list, typing `description`. */
async function startTemplate(page: Page, template: string, description: string) {
	await startButton(page).click();
	await expect(startList(page)).toBeVisible();
	await startList(page).locator('summary', { hasText: template }).click();
	const line = startList(page).getByRole('textbox', { name: `Description for ${template}` });
	await expect(line).toBeFocused();
	await page.keyboard.type(description);
	await page.keyboard.press('Enter');
	await expect(startList(page)).toHaveCount(0);
}

/** Types `text` into a time field and leaves it, so it reads. */
async function typeTime(page: Page, id: string, text: string) {
	await field(page, id).fill(text);
	await field(page, id).blur();
}

/** Types into the combobox and picks the first match with Enter. */
async function pickProject(page: Page, typed: string, expected: string) {
	const box = page.getByRole('combobox', { name: 'Customer › project' });
	await box.fill(typed);
	await expect(page.getByRole('listbox', { name: 'Customer › project' })).toBeVisible();
	await box.press('Enter');
	await expect(box).toHaveValue(expected);
}

/** The undo strip on the screen, and its bottom edge in the viewport. */
const undoStrip = (page: Page) => page.locator('[data-undo-strip]:visible');
const stripBottom = (page: Page) =>
	undoStrip(page).evaluate((el) => el.getBoundingClientRect().bottom);

/** `HH:mm` in the browser's zone, `minutes` from now. */
const clockIn = (minutes: number) =>
	new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(new Date(Date.now() + minutes * 60_000));

test('gate 1: a past entry made over Reports without leaving it', async ({ page }) => {
	const user = await newUser('gate1');
	await signIn(page, user.username);
	await open(page, '/reports', 'Reports');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	// The screen under it stays where it was.
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(field(page, 'start')).toBeFocused();

	await dialog(page).getByRole('button', { name: 'Yesterday' }).click();
	await typeTime(page, 'start', '9:00');
	await typeTime(page, 'end', '14:30');
	await expect(field(page, 'duration')).toHaveValue('5:30');
	await pickProject(page, 'mobile', 'Northwind › Mobile app');
	await field(page, 'activity').selectOption({ label: 'Development' });
	await field(page, 'location').selectOption({ label: 'Home office' });
	await field(page, 'description').fill('Gate task 1');
	await saveButton(page).click();

	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/\/reports$/);
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(done(page)).toContainText('Create entry');
	await expect(done(page).getByRole('button', { name: 'Undo' })).toBeVisible();

	// Back does not reopen the form, nor does a reload show it.
	await page.goBack();
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(page).toHaveURL(/\/reports$/);
	await expect(dialog(page)).toBeHidden();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(dialog(page)).toBeHidden();
});

test('closing the form leaves the screen as it was, and Back does not reopen it', async ({
	page
}) => {
	const user = await newUser('close');
	await signIn(page, user.username);
	await open(page, '/reports', 'Reports');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await expect(page).toHaveURL(/\/entries\/new\?back=%2Freports$/);
	await dialog(page).getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/\/reports$/);

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/\/reports$/);

	await page.goBack();
	await expect(dialog(page)).toBeHidden();
});

test('a click on the dimmed screen closes the form on the PC', async ({ page }) => {
	test.skip(!isPc(), 'the phone sheet closes by Cancel only');
	const user = await newUser('backdrop');
	await signIn(page, user.username);
	await open(page, '/reports', 'Reports');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await page.mouse.click(20, 880);
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/\/reports$/);
});

test('gate 2: an entry corrected over Entries, and undone', async ({ page }) => {
	const user = await newUser('gate2');
	seedEntry(user.id, zone, {
		projectId: user.projects.mobile,
		start: '09:00',
		end: '11:30',
		description: 'Gate task 2'
	});
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	const row = entryRows(page).filter({ hasText: 'Gate task 2' });
	await row.getByRole('link').first().click();
	// The form opens over Entries: the address is the form's, the screen stays under it.
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	await expect(page).toHaveURL(/\/entries\/\w+\?back=%2Fentries/);
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await expect(field(page, 'start')).toHaveValue('09:00');

	await typeTime(page, 'start', '930');
	await expect(field(page, 'start')).toHaveValue('09:30');
	// The end holds; the stored-entry actions wait for a save or a cancel.
	await expect(field(page, 'end')).toHaveValue('11:30');
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
	await expect(page.getByText('Save or cancel your changes first')).toBeVisible();
	await saveButton(page).click();

	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await expect(page).toHaveURL(/\/entries(\?|$)/);
	const saved = entryRows(page).filter({ hasText: 'Gate task 2' });
	await expect(saved).toContainText('09:30');
	await expect(saved).toContainText('11:30');

	await done(page).getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
	await expect(entryRows(page).filter({ hasText: 'Gate task 2' })).toContainText('09:00');
});

test('a save and its Undo keep the screen where it was scrolled to', async ({ page }) => {
	const user = await newUser('keep-scroll');
	seedMany(user.id, zone, 80);
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	const row = () => entryRows(page).filter({ hasText: 'Bulk 40' });
	await row().evaluate((el) => el.scrollIntoView({ block: 'center' }));
	const scrollY = () => page.evaluate(() => window.scrollY);
	const rowTop = () => row().evaluate((el) => el.getBoundingClientRect().top);
	const before = await scrollY();
	const top = await rowTop();
	expect(before).toBeGreaterThan(500);
	/**
	 * Not reset to the top, and the row where it was on screen. The undo strip appearing
	 * above the list moves the page under it by the strip's height; the browser's scroll
	 * anchoring follows, so scrollY grows by that much while the row stays put.
	 */
	const asItWas = async () => {
		expect(await scrollY()).toBeGreaterThanOrEqual(before - 4);
		expect(Math.abs((await rowTop()) - top)).toBeLessThanOrEqual(4);
		await expect(row()).toBeInViewport({ ratio: 1 });
		// The strip is pinned in view under the bars, above the row, not over it.
		await expect(undoStrip(page)).toBeInViewport({ ratio: 1 });
		expect(await rowTop()).toBeGreaterThanOrEqual(await stripBottom(page));
	};

	// Bulk 40 runs 03:15–03:19 on the first of the month.
	await row().getByRole('link').first().click();
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	await typeTime(page, 'start', '316');
	await saveButton(page).click();

	await expect(dialog(page, 'Edit entry')).toBeHidden();
	await expect(done(page)).toBeAttached();
	await expect(row()).toContainText('03:16');
	await asItWas();

	await expect(done(page).getByRole('button', { name: 'Undo' })).toBeInViewport({ ratio: 1 });
	await done(page).getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeAttached();
	await expect(row()).toContainText('03:15');
	await asItWas();
});

test('a row saved just under the bars is not left under the pinned undo strip', async ({
	page
}) => {
	const user = await newUser('under-strip');
	seedMany(user.id, zone, 80);
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	const row = entryRows(page).filter({ hasText: 'Bulk 40' });
	// The row's top just under the sticky bars, where the strip will pin.
	await row.evaluate((el) => {
		const bars = document.querySelector('header')?.parentElement?.getBoundingClientRect();
		window.scrollBy(0, el.getBoundingClientRect().top - (bars?.bottom ?? 0) - 8);
	});
	await row.getByRole('link').first().click();
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	await typeTime(page, 'start', '316');
	await saveButton(page).click();

	await expect(dialog(page, 'Edit entry')).toBeHidden();
	await expect(row).toContainText('03:16');
	await expect(done(page).getByRole('button', { name: 'Undo' })).toBeInViewport({ ratio: 1 });
	await expect(row).toBeInViewport({ ratio: 1 });
	const rowTop = await row.evaluate((el) => el.getBoundingClientRect().top);
	expect(rowTop).toBeGreaterThanOrEqual(await stripBottom(page));
});

test('focus moved up the rows after a save is never under the pinned undo strip', async ({
	page
}) => {
	const user = await newUser('focus-strip');
	seedMany(user.id, zone, 80);
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	const row = entryRows(page).filter({ hasText: 'Bulk 40' });
	await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await row.getByRole('link').first().click();
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	await typeTime(page, 'start', '316');
	await saveButton(page).click();
	await expect(dialog(page, 'Edit entry')).toBeHidden();
	await expect(row).toContainText('03:16');
	await expect(undoStrip(page)).toBeInViewport({ ratio: 1 });

	// Shift+Tab up through the rows above the saved one: each focused control clears the strip.
	await row.getByRole('link').first().focus();
	for (let i = 0; i < 45; i++) {
		await page.keyboard.press('Shift+Tab');
		const top = await page.evaluate(() => {
			const el = document.activeElement;
			return el?.closest('tbody tr, [data-phone-list] li') ? el.getBoundingClientRect().top : null;
		});
		if (top === null) continue;
		expect(top).toBeGreaterThanOrEqual((await stripBottom(page)) - 1);
	}
});

test('focus in the bars or the form leaves the page under a pinned strip where it is', async ({
	page
}) => {
	const user = await newUser('focus-bars');
	seedMany(user.id, zone, 80);
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	const row = entryRows(page).filter({ hasText: 'Bulk 40' });
	await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await row.getByRole('link').first().click();
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	await typeTime(page, 'start', '316');
	await saveButton(page).click();
	await expect(dialog(page, 'Edit entry')).toBeHidden();
	await expect(row).toContainText('03:16');
	await expect(undoStrip(page)).toBeInViewport({ ratio: 1 });
	const scrollY = () => page.evaluate(() => window.scrollY);
	const at = await scrollY();

	// A control in the sticky bars: the PC header's "+ New entry", the phone strip's Start.
	await page.locator('div.sticky :is(a, summary):visible').first().focus();
	expect(await scrollY()).toBe(at);

	// The form opened over the screen, its first field focused.
	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await expect(field(page, 'start')).toBeFocused();
	await field(page, 'date').focus();
	await field(page, 'start').focus();
	expect(await scrollY()).toBe(at);
});

test('an overlap warning on Today keeps the phone at its width', async ({ page }) => {
	test.skip(isPc(), 'the phone width');
	await page.setViewportSize({ width: 390, height: 844 });
	const user = await newUser('overlap-width');
	await signIn(page, user.username);

	for (const [colorScheme, start] of [
		['light', '8:10'],
		['dark', '8:30']
	] as const) {
		await page.emulateMedia({ colorScheme });
		await open(page, '/', 'Today');
		await newEntry(page).click();
		await expect(dialog(page)).toBeVisible();
		await typeTime(page, 'start', start);
		await typeTime(page, 'duration', '10');
		await pickProject(page, 'support', 'Northwind › Support');
		await field(page, 'description').fill(`Overlap ${colorScheme}`);
		await saveButton(page).click();
		await expect(dialog(page)).toBeHidden();

		const row = page.locator('[data-row]:visible').filter({ hasText: `Overlap ${colorScheme}` });
		await expect(row).toContainText('Overlaps another entry');
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390
		);
		await expect(page.getByRole('navigation', { name: 'Main' })).toBeInViewport({ ratio: 1 });
		await expect(newEntry(page)).toBeInViewport({ ratio: 1 });
	}
});

test('a new entry from an entry form opened as a page saves the new entry', async ({ page }) => {
	const user = await newUser('over-page');
	const id = seedEntry(user.id, zone, {
		projectId: user.projects.mobile,
		start: '09:00',
		end: '10:00',
		description: 'Edited on its page'
	});
	await signIn(page, user.username);
	await open(page, `/entries/${id}?back=%2Fentries`, 'Edit entry');

	await newEntry(page).click();
	await expect(page.getByRole('heading', { name: 'New entry' })).toBeVisible();
	// The form that opened is the last in the page; with one form, the only one.
	const typed = (name: string) => page.locator(`#entry-${name}`).last();
	await typed('start').fill('1100');
	await typed('start').blur();
	await typed('end').fill('1130');
	await typed('end').blur();
	await page.getByRole('combobox', { name: 'Customer › project' }).last().fill('mobile');
	await page.keyboard.press('Enter');
	await typed('description').fill('Made over the page form');
	await saveButton(page).last().click();
	await expect(done(page)).toContainText('Create entry');

	await open(page, '/entries', 'Entries');
	await expect(entryRows(page).filter({ hasText: 'Made over the page form' })).toContainText(
		'11:30'
	);
	await expect(entryRows(page).filter({ hasText: 'Edited on its page' })).toContainText('10:00');
});

test('gate 3: start plus duration on the phone, Save always on screen', async ({ page }) => {
	test.skip(isPc(), 'the phone sheet');
	await page.setViewportSize({ width: 390, height: 844 });
	const user = await newUser('gate3');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await expect(saveButton(page)).toBeInViewport();

	const twoDaysAgo = new Date(Date.parse(`${user.today}T00:00:00Z`) - 2 * 86_400_000)
		.toISOString()
		.slice(0, 10);
	await field(page, 'date').fill(twoDaysAgo);
	await field(page, 'date').blur();
	await typeTime(page, 'start', '13');
	await expect(field(page, 'start')).toHaveValue('13:00');
	await typeTime(page, 'duration', '5.5');
	await expect(field(page, 'duration')).toHaveValue('5:30');
	await expect(field(page, 'end')).toHaveValue('18:30');
	await pickProject(page, 'northwind support', 'Northwind › Support');
	await field(page, 'reference').fill('#4711');
	await expect(saveButton(page)).toBeInViewport();
	await saveButton(page).click();

	await expect(dialog(page)).toBeHidden();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
	await expect(done(page)).toContainText('Create entry');
	await done(page).getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
});

test('the phone keyboard never covers Save', async ({ page }) => {
	test.skip(isPc(), 'the phone sheet');
	await page.setViewportSize({ width: 390, height: 844 });
	const user = await newUser('keyboard');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');

	await newEntry(page).click();
	await field(page, 'description').focus();
	// The height a keyboard leaves.
	await page.setViewportSize({ width: 390, height: 420 });
	await expect(saveButton(page)).toBeInViewport();
	await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeInViewport();
});

test('a focused field on the phone sheet is not under Cancel and Save', async ({ page }) => {
	test.skip(isPc(), 'the phone sheet');
	await page.setViewportSize({ width: 390, height: 844 });
	const user = await newUser('focus-clear');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await field(page, 'description').focus();
	await expect
		.poll(async () => {
			const box = await field(page, 'description').boundingBox();
			const foot = await dialog(page).locator('[data-entry-footer]').boundingBox();
			return box && foot ? foot.y - (box.y + box.height) : -1;
		})
		.toBeGreaterThanOrEqual(0);
});

test('the phone "+" covers neither content nor the bottom bar', async ({ page }) => {
	test.skip(isPc(), 'the phone "+"');
	const user = await newUser('plus');
	await signIn(page, user.username);

	const plus = await newEntry(page).boundingBox();
	const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
	expect(plus && nav).toBeTruthy();
	if (!plus || !nav) return;
	expect(plus.width).toBe(56);
	expect(plus.y + plus.height).toBeLessThanOrEqual(nav.y);

	// Scrolled to the end, the last content ends above the "+".
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	const last = await page.locator('main > *').last().boundingBox();
	const after = await newEntry(page).boundingBox();
	expect(last && after).toBeTruthy();
	if (!last || !after) return;
	expect(last.y + last.height).toBeLessThanOrEqual(after.y);
});

/** The controls in main the phone's "+" lies over; none, if it covers no control. */
/**
 * The controls in main the phone's "+" would hide: one that reaches into the "+"'s column
 * with less than a 44 px target left beside it. Checked by column, not by where the page
 * is scrolled, so it holds at any scroll position; a wide field that runs under the "+"
 * keeps most of its width and is not hidden.
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

test('the phone "+" covers no control at the top or the end of Today and Entries', async ({
	page
}) => {
	test.skip(isPc(), 'the phone "+"');
	await page.setViewportSize({ width: 390, height: 844 });
	const user = await newUser('plus-controls');
	seedEntry(user.id, zone, {
		projectId: user.projects.mobile,
		start: '09:00',
		end: '10:00',
		description: 'Under the plus'
	});
	await signIn(page, user.username);
	const check = async () => {
		await page.evaluate(() => window.scrollTo(0, 0));
		expect(await underPlus(page)).toEqual([]);
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		expect(await underPlus(page)).toEqual([]);
	};
	for (const [path, title] of [
		['/', 'Today'],
		['/entries', 'Entries']
	] as const) {
		await open(page, path, title);
		await check();
	}

	// With the undo strip showing (Restart and Undo) and a running row.
	await restartRow(page, 'Under the plus', 'Northwind › Mobile app');
	await expect(done(page).getByRole('button', { name: 'Undo' })).toBeVisible();
	await check();
	await done(page).getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
});

test('an existing entry opens on the phone without the keyboard, on the PC in its project', async ({
	page
}) => {
	const user = await newUser('edit-focus');
	seedEntry(user.id, zone, {
		projectId: user.projects.mobile,
		start: '09:00',
		end: '10:00',
		description: 'Focus task'
	});
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');
	await entryRows(page).filter({ hasText: 'Focus task' }).getByRole('link').first().click();
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	const project = page.getByRole('combobox', { name: 'Customer › project' });
	if (isPc()) {
		await expect(project).toBeFocused();
	} else {
		await expect(page.getByRole('heading', { name: 'Edit entry' })).toBeFocused();
		await expect(project).not.toBeFocused();
	}
	await dialog(page, 'Edit entry').getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog(page, 'Edit entry')).toBeHidden();

	// A new entry still starts in its first empty field.
	await newEntry(page).click();
	await expect(field(page, 'start')).toBeFocused();
});

test('the phone start sheet holds the focus while it is open', async ({ page }) => {
	test.skip(isPc(), 'the phone sheet');
	const user = await newUser('sheet-focus');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');
	const behind = [page.locator('main'), page.getByRole('link', { name: 'New entry' })];

	await startButton(page).click();
	await expect(startList(page)).toBeVisible();
	for (const node of behind) await expect(node).toHaveAttribute('inert', '');
	// The bottom bar (the visible "Main" navigation) is inside an inert wrapper.
	const barInert = () =>
		page.evaluate(() =>
			[...document.querySelectorAll('nav[aria-label="Main"]')]
				.filter((n) => n.checkVisibility())
				.every((n) => n.closest('[inert]') !== null)
		);
	expect(await barInert()).toBe(true);
	for (let i = 0; i < 12; i++) {
		await page.keyboard.press('Tab');
		const outside = await page.evaluate(
			() =>
				document.activeElement?.closest(
					'main, nav[aria-label="Main"], a[aria-label="New entry"]'
				) !== null && document.activeElement !== null
		);
		expect(outside).toBe(false);
	}

	await page.keyboard.press('Escape');
	await expect(startList(page)).toHaveCount(0);
	for (const node of behind) await expect(node).not.toHaveAttribute('inert', '');
	expect(await barInert()).toBe(false);
});

test('gate 4: forgiving input reads times and durations, linked', async ({ page }) => {
	const user = await newUser('gate4');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await typeTime(page, 'start', '900');
	await typeTime(page, 'end', '1330');
	await expect(field(page, 'start')).toHaveValue('09:00');
	await expect(field(page, 'end')).toHaveValue('13:30');
	await expect(field(page, 'duration')).toHaveValue('4:30');

	await typeTime(page, 'duration', '90');
	await expect(field(page, 'duration')).toHaveValue('1:30');
	await expect(field(page, 'end')).toHaveValue('10:30');

	await typeTime(page, 'end', '17.5');
	await expect(field(page, 'end')).toHaveValue('17.5');
	await expect(field(page, 'end')).toHaveAttribute('aria-invalid', 'true');
	await expect(dialog(page).getByText('Type 17:30 or 17:05')).toBeVisible();
});

test('gate 5: a template fills the form and leaves the description', async ({ page }) => {
	const user = await newUser('gate5');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await dialog(page).getByRole('link', { name: 'Support call' }).click();
	// Filled in place: still the dialog, nothing navigated.
	await expect(dialog(page)).toBeVisible();
	await expect(field(page, 'start')).toHaveValue('08:30');
	await expect(field(page, 'end')).toHaveValue('08:45');
	await expect(page.getByRole('combobox', { name: 'Customer › project' })).toHaveValue(
		'Northwind › Support'
	);
	await expect(field(page, 'description')).toBeFocused();

	await page.keyboard.type('Called about the invoice');
	await saveButton(page).click();
	await expect(dialog(page)).toBeHidden();
	await expect(done(page)).toContainText('Create entry');
});

test('gate 6: start at the previous end of the day', async ({ page }) => {
	const user = await newUser('gate6');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await dialog(page).getByRole('button', { name: 'Start at previous end 09:00' }).click();
	await expect(field(page, 'start')).toHaveValue('09:00');
});

test('gate 10: delete, copy and save as template', async ({ page }) => {
	const user = await newUser('gate10');
	seedEntry(user.id, zone, {
		projectId: user.projects.mobile,
		start: '09:00',
		end: '10:00',
		description: 'Gate task 10'
	});
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');
	const row = () => entryRows(page).filter({ hasText: 'Gate task 10' });

	await row().getByRole('link').first().click();
	// The form opens over Entries: the address is the form's, the screen stays under it.
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	await expect(page).toHaveURL(/\/entries\/\w+\?back=%2Fentries/);
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await expect(row()).toHaveCount(0);
	await done(page).getByRole('button', { name: 'Undo' }).click();
	await expect(row()).toHaveCount(1);

	await row().getByRole('link').first().click();
	await page.getByRole('link', { name: 'Copy', exact: true }).click();
	await expect(field(page, 'start')).toHaveValue('09:00');
	await expect(field(page, 'end')).toHaveValue('10:00');
	await expect(field(page, 'description')).toHaveValue('Gate task 10');
	await expect(page.getByRole('combobox', { name: 'Customer › project' })).toHaveValue(
		'Northwind › Mobile app'
	);
	await page.getByRole('button', { name: 'Yesterday' }).click();
	await saveButton(page).click();
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await expect(done(page)).toContainText('Create entry');

	await row().first().getByRole('link').first().click();
	await page.getByText('Save as template', { exact: true }).click();
	await page.getByLabel('Name').fill('Gate template');
	await page.getByRole('button', { name: 'Save template' }).click();
	await expect(done(page)).toContainText('Gate template');
	// It appears in the bar's start list.
	await startButton(page).click();
	await expect(startList(page).getByText('Gate template', { exact: true })).toBeVisible();
});

test('gate 7: a timer from any screen, stopped and restarted from the bar', async ({ page }) => {
	const user = await newUser('gate7');
	const [first, firstTitle, second, secondTitle] = isPc()
		? ['/setup', 'Setup', '/account', 'Account']
		: ['/templates', 'Templates', '/copy-out', 'Copy-out'];
	await signIn(page, user.username);
	await open(page, first, firstTitle);

	await startTemplate(page, 'Standup', 'Gate task 7');
	await expect(shown(page)).toContainText('Acme › Website');
	if (isPc()) await expect(shown(page)).toContainText('Gate task 7');
	await expect(page.getByRole('heading', { name: firstTitle, level: 1 })).toBeVisible();
	// The start is one batch: its Undo stops and removes the new timer.
	await expect(done(page)).toContainText('Start timer on');
	await done(page).getByRole('button', { name: 'Undo' }).click();
	await expect(bar(page)).toContainText('No timer running');

	await startTemplate(page, 'Standup', 'Gate task 7');
	await expect(shown(page)).toContainText('Acme › Website');

	await open(page, second, secondTitle);
	await shownStop(page).click();
	await expect(bar(page)).toContainText('No timer running');
	await expect(done(page)).toContainText('Stop timer');
	await expect(done(page).getByRole('button', { name: 'Undo' })).toBeVisible();
	await done(page).getByRole('button', { name: 'Restart' }).click();

	await expect(shown(page)).toContainText('Acme › Website');
	if (isPc()) await expect(shown(page)).toContainText('Gate task 7');
	await expect(page.getByRole('heading', { name: secondTitle, level: 1 })).toBeVisible();
	await expect(done(page)).toContainText('Start timer on');
	// The restart's Undo removes the restarted timer too.
	await done(page).getByRole('button', { name: 'Undo' }).click();
	await expect(bar(page)).toContainText('No timer running');
	await expect(page.getByRole('heading', { name: secondTitle, level: 1 })).toBeVisible();
});

test('the start list closes with Escape and an outside click', async ({ page }) => {
	const user = await newUser('startlist');
	await signIn(page, user.username);
	await page.waitForLoadState('networkidle');

	await startButton(page).click();
	await expect(startList(page)).toBeVisible();
	await expect(startList(page)).toContainText('Start a timer');
	await expect(startList(page)).toContainText('Start on a project…');
	await page.keyboard.press('Escape');
	await expect(startList(page)).toHaveCount(0);
	await expect(startButton(page)).toBeFocused();

	await startButton(page).click();
	await expect(startList(page)).toBeVisible();
	// Off the list: the PC's empty ground, the phone's scrim above the sheet.
	await page.mouse.click(isPc() ? 700 : 200, isPc() ? 600 : 260);
	await expect(startList(page)).toHaveCount(0);
});

test('gate 8: a timer on a project started earlier, opened from the bar', async ({ page }) => {
	const user = await newUser('gate8');
	await signIn(page, user.username);
	await open(page, '/reports', 'Reports');

	await startButton(page).click();
	await startList(page)
		.getByRole('link', { name: /Start on a project…/ })
		.click();
	await expect(dialog(page)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(dialog(page).getByText('No end: this starts a timer.')).toBeVisible();
	await pickProject(page, 'operations', 'Acme › Operations');
	await typeTime(page, 'start', clockIn(-10));
	await saveButton(page).click();

	await expect(dialog(page)).toBeHidden();
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(shown(page)).toContainText('Acme › Operations');
	await expect(shown(page)).toContainText(/0:1[01]:\d\d/);

	// The running time opens its form over the screen.
	await shown(page).click();
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Customer › project' })).toHaveValue(
		'Acme › Operations'
	);
	await dialog(page, 'Edit entry').getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog(page, 'Edit entry')).toBeHidden();

	await shownStop(page).click();
	await expect(bar(page)).toContainText('No timer running');
	await expect(done(page)).toContainText('Stop timer');
});

/** Opens "Start on a project…" from the bar and starts a timer on `expected`, Start untouched. */
async function startOnProject(page: Page, typed: string, expected: string, description: string) {
	await startButton(page).click();
	await startList(page)
		.getByRole('link', { name: /Start on a project…/ })
		.click();
	await expect(dialog(page)).toBeVisible();
	await pickProject(page, typed, expected);
	await field(page, 'description').fill(description);
	await saveButton(page).click();
}

test('item 18: a second timer on the same project at once stops the first', async ({ page }) => {
	const user = await newUser('item18-stop');
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	await startOnProject(page, 'operations', 'Acme › Operations', 'First run');
	await expect(dialog(page)).toBeHidden();
	await startOnProject(page, 'mobile', 'Northwind › Mobile app', 'Other project');
	await expect(dialog(page)).toBeHidden();
	await startOnProject(page, 'operations', 'Acme › Operations', 'Second run');
	await expect(dialog(page)).toBeHidden();
	await expect(dialog(page).getByText(/timer has been running since/)).toHaveCount(0);

	// Two timers run: the second Operations one and the Mobile app one.
	await expect(bar(page)).toContainText('Acme › Operations');
	await expect(bar(page)).toContainText(/\+1\s*more running/);
	await open(page, '/entries', 'Entries');
	const first = entryRows(page).filter({ hasText: 'First run' });
	await expect(first).toHaveCount(1);
	await expect(first).toContainText(/\d\d:\d\d\s+\d\d:\d\d/);
});

test('item 18: one Undo takes back the start and the stop', async ({ page }) => {
	const user = await newUser('item18-undo');
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	await startOnProject(page, 'operations', 'Acme › Operations', 'First run');
	await expect(dialog(page)).toBeHidden();
	await startOnProject(page, 'operations', 'Acme › Operations', 'Second run');
	await expect(dialog(page)).toBeHidden();
	await expect(undoStrip(page)).toBeVisible();

	await undoStrip(page).getByRole('button', { name: 'Undo' }).click();
	await expect(undoStrip(page)).toContainText('Undone.');
	await open(page, '/entries', 'Entries');
	await expect(entryRows(page).filter({ hasText: 'Second run' })).toHaveCount(0);
	// The first timer runs again: no end on its row.
	const first = entryRows(page).filter({ hasText: 'First run' });
	await expect(first).toHaveCount(1);
	await expect(first).not.toContainText(/\d\d:\d\d\s+\d\d:\d\d/);
});

test('item 18: the form opened again in the next minute shows that minute', async ({ page }) => {
	test.setTimeout(120_000);
	const user = await newUser('item18-minute');
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	const openStart = async () => {
		await startButton(page).click();
		const link = startList(page).getByRole('link', { name: /Start on a project…/ });
		if (isPc()) await link.hover();
		await link.click();
		await expect(dialog(page)).toBeVisible();
		const value = await field(page, 'start').inputValue();
		await dialog(page).getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog(page)).toBeHidden();
		return value;
	};
	const before = await openStart();
	await expect.poll(() => clockIn(0), { timeout: 65_000, intervals: [1000] }).not.toBe(before);
	expect(await openStart()).toBe(clockIn(0));
});

test('item 18: a start typed ten minutes before the running one is refused with its start', async ({
	page
}) => {
	const user = await newUser('item18-refused');
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	await startButton(page).click();
	await startList(page)
		.getByRole('link', { name: /Start on a project…/ })
		.click();
	await pickProject(page, 'operations', 'Acme › Operations');
	const running = clockIn(-5);
	await typeTime(page, 'start', running);
	await saveButton(page).click();
	await expect(dialog(page)).toBeHidden();

	await startButton(page).click();
	await startList(page)
		.getByRole('link', { name: /Start on a project…/ })
		.click();
	await expect(dialog(page)).toBeVisible();
	await pickProject(page, 'operations', 'Acme › Operations');
	const earlier = clockIn(-10);
	await typeTime(page, 'start', earlier);
	await saveButton(page).click();

	await expect(dialog(page)).toBeVisible();
	await expect(
		dialog(page)
			.locator('#start-error')
			.filter({
				hasText: `This project's timer has been running since ${running}. Start at ${running} or later, or stop that timer first.`
			})
	).toBeVisible();
	await expect(field(page, 'start')).toHaveValue(earlier);
});

test('gate 9: a past entry restarted, and a running one that cannot be', async ({ page }) => {
	const user = await newUser('gate9');
	const research = seedActivity(user.id, 'Research');
	seedEntry(user.id, zone, {
		projectId: user.projects.mobile,
		start: '09:00',
		end: '10:00',
		description: 'Gate task 9',
		activityId: research
	});
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	// Restarted from its row: ▶ on the PC, the ⋯ sheet on the phone (item 14's call 17).
	await restartRow(page, 'Gate task 9', 'Northwind › Mobile app');
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await expect(page).toHaveURL(/\/entries(\?|$)/);
	await expect(shown(page)).toContainText('Northwind › Mobile app');
	await expect(shown(page)).toContainText('Research');
	if (isPc()) await expect(shown(page)).toContainText('Gate task 9');
	await expect(done(page)).toContainText('Start timer on');

	// The running entry's form: Restart is disabled and says why.
	await shown(page).click();
	await expect(dialog(page, 'Edit entry')).toBeVisible();
	const restart = dialog(page, 'Edit entry').getByRole('button', { name: /Restart/ });
	await expect(restart).toBeDisabled();
	await expect(restart).toContainText('Already running');
	await dialog(page, 'Edit entry').getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog(page, 'Edit entry')).toBeHidden();

	await shownStop(page).click();
	await expect(bar(page)).toContainText('No timer running');
});

test('a refused save keeps the form open with the message and what was typed', async ({ page }) => {
	const user = await newUser('refused');
	await signIn(page, user.username);
	await open(page, '/reports', 'Reports');

	await newEntry(page).click();
	await expect(dialog(page)).toBeVisible();
	await typeTime(page, 'start', clockIn(10));
	await pickProject(page, 'website', 'Acme › Website');
	await field(page, 'description').fill('Not yet begun');
	await expect(dialog(page).getByText('No end: this starts a timer.')).toBeVisible();
	await saveButton(page).click();

	await expect(dialog(page).getByText('A timer cannot start in the future.').first()).toBeVisible();
	await expect(dialog(page)).toBeVisible();
	await expect(field(page, 'start')).toHaveAttribute('aria-invalid', 'true');
	await expect(field(page, 'description')).toHaveValue('Not yet begun');
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
});

test('gate 11: the keyboard on the PC', async ({ page }) => {
	test.skip(!isPc(), 'keys are the PC’s');
	const user = await newUser('gate11');
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	await page.keyboard.press('n');
	await expect(dialog(page)).toBeVisible();
	await expect(field(page, 'start')).toBeFocused();
	await page.keyboard.type('1000');
	await page.keyboard.press('Tab');
	await page.keyboard.type('1030');
	await page.keyboard.press('Tab');
	await expect(field(page, 'duration')).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('combobox', { name: 'Customer › project' })).toBeFocused();
	await page.keyboard.type('mobile');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('combobox', { name: 'Customer › project' })).toHaveValue(
		'Northwind › Mobile app'
	);
	await page.keyboard.press('Control+Enter');
	await expect(dialog(page)).toBeHidden();
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await expect(done(page)).toContainText('Create entry');
	await expect(entryRows(page).filter({ hasText: 'Northwind › Mobile app' })).toContainText(
		'10:30'
	);

	await page.keyboard.press('n');
	await expect(dialog(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog(page)).toBeHidden();

	startElsewhere(user.id, user.projects.support, zone, '11:00', 'On call');
	await open(page, '/entries', 'Entries');
	await expect(bar(page)).toContainText('Support');
	await page.keyboard.press('s');
	await expect(bar(page)).toContainText('No timer running');
	await expect(done(page)).toContainText('Stop timer');
});

test('n and s typed into a field change nothing else', async ({ page }) => {
	test.skip(!isPc(), 'keys are the PC’s');
	const user = await newUser('keys');
	startElsewhere(user.id, user.projects.support, zone, '11:00', 'On call');
	await signIn(page, user.username);
	await open(page, '/entries', 'Entries');

	// A screen's own field.
	const search = page.getByRole('searchbox', { name: 'Search entries' });
	await search.focus();
	await page.keyboard.type('ns');
	await expect(search).toHaveValue('ns');
	await expect(dialog(page)).toBeHidden();
	await expect(bar(page)).toContainText('Support');

	// The form's description and its combobox.
	await search.fill('');
	await search.blur();
	await page.keyboard.press('n');
	await expect(dialog(page)).toBeVisible();
	await field(page, 'description').focus();
	await page.keyboard.type('ns');
	await expect(field(page, 'description')).toHaveValue('ns');
	const box = page.getByRole('combobox', { name: 'Customer › project' });
	await box.focus();
	await page.keyboard.type('ns');
	await expect(box).toHaveValue('ns');
	await expect(dialog(page)).toHaveCount(1);
	await expect(dialog(page)).toBeVisible();
	await expect(bar(page)).toContainText('Support');
	await expect(bar(page)).not.toContainText('No timer running');
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the start list starts a template and Restart restarts it, as plain posts', async ({
		page
	}) => {
		const user = await newUser('start-nojs');
		await signIn(page, user.username);
		await page.goto('/reports');

		await startButton(page).click();
		await startList(page).locator('summary', { hasText: 'Standup' }).click();
		await startList(page)
			.getByRole('textbox', { name: 'Description for Standup' })
			.fill('Without a script');
		await startList(page).getByRole('button', { name: 'Start', exact: true }).click();
		await expect(page).toHaveURL(/\/reports$/);
		await expect(shown(page)).toContainText('Acme › Website');
		await expect(done(page)).toContainText('Start timer on');

		await shownStop(page).click();
		await expect(bar(page)).toContainText('No timer running');
		await done(page).getByRole('button', { name: 'Restart' }).click();
		await expect(page).toHaveURL(/\/reports$/);
		await expect(shown(page)).toContainText('Acme › Website');
	});
});
