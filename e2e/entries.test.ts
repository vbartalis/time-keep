import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
	PASSWORD,
	deleteElsewhere,
	editElsewhere,
	noonZone,
	seedActivity,
	seedEntry,
	seedCustomer,
	seedMany,
	seedMonth,
	seedGateMonth,
	seedProject,
	seedMonthEdges,
	startElsewhere,
	type Month
} from './seed';

// Noon in the browser's zone, so the kept preset's month is the month the seeded entries are in.
const zone = noonZone();
test.use({ timezoneId: zone });

/**
 * A user of its own for each test: `seedMonth`'s five entries and `seedMonthEdges`'
 * overlapping pair and midnight crossing, this month, and one entry last month.
 */
async function newMonth(label: string) {
	const user = await seedMonth(`${test.info().project.name}-${label}`, zone);
	return { ...user, edges: seedMonthEdges(user, zone) };
}
type User = Month & { edges: ReturnType<typeof seedMonthEdges> };

const rememberZone = (context: BrowserContext) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

async function signIn(page: Page, username: string) {
	await rememberZone(page.context());
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

/** Signs in and opens Entries at `path`, waiting for the script unless it is off. */
async function openEntries(page: Page, user: User, path = '/entries', script = true) {
	await signIn(page, user.username);
	await page.goto(path);
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	if (script) await page.waitForLoadState('networkidle');
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** A day head's label: "Tue 2026-10-20". */
const dayLabel = (date: string) => `${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${date}`;

/** The table's day groups, each named by its day. */
const days = (page: Page) =>
	page.getByRole('table').getByRole('rowgroup', { name: /^\w{3} \d{4}-\d{2}-\d{2}$/ });
const day = (page: Page, date: string) =>
	page.getByRole('rowgroup', { name: dayLabel(date), exact: true });

/** The day groups shown are exactly `dates`, in that order. */
async function showsDays(page: Page, dates: string[]) {
	await expect(days(page)).toHaveCount(dates.length);
	for (const [i, date] of dates.entries()) {
		await expect(days(page).nth(i)).toHaveAccessibleName(dayLabel(date));
	}
}

/** Entry rows (not day heads): each holds its row's link to the form. */
const entryRows = (page: Page) =>
	page
		.getByRole('table')
		.getByRole('row')
		.filter({ has: page.locator('a[data-entry-form]') });
const row = (page: Page, text: string) => entryRows(page).filter({ hasText: text });

const filterButton = (page: Page) => page.locator('summary', { hasText: 'Filter' });
const panel = (page: Page) => page.getByRole('group', { name: 'Filter' });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search entries' });
const strip = (page: Page) => page.getByRole('status');
const bar = (page: Page) => page.getByRole('region', { name: 'Timer', exact: true });
/** The toolbar's count and total. */
const tally = (page: Page, text: string) => page.getByText(text, { exact: true });

const ALL = (u: User) => [u.day(14), u.day(13), u.day(10), u.day(9), u.day(6), u.day(3), u.day(2)];

/** The row's ⋯ and its menu. */
const menuButton = (r: Locator) => r.locator('summary');
const menu = (page: Page) => page.getByRole('menu');

/** A row's tick box, a day head's, and the bulk bar in the toolbar's place. */
const tick = (page: Page, text: string) => row(page, text).getByRole('checkbox');
const dayTick = (page: Page, date: string) =>
	day(page, date).getByRole('checkbox', { name: `Select ${dayLabel(date)}`, exact: true });
const bulk = (page: Page) => page.getByRole('region', { name: 'Selection' });
const bulkDialog = (page: Page, n: number) =>
	page.getByRole('dialog', { name: `Edit ${n} ${n === 1 ? 'entry' : 'entries'}` });

/** A colour as the browser computes it ("rgb(r, g, b)"), from a token or any CSS colour. */
const colourOf = (page: Page, css: string) =>
	page.evaluate((value) => {
		const probe = document.createElement('i');
		probe.style.color = value;
		document.body.append(probe);
		const out = getComputedStyle(probe).color;
		probe.remove();
		return out;
	}, css);
/** The WCAG contrast of two computed `rgb(...)` colours. */
function contrast(a: string, b: string): number {
	const lum = (rgb: string) => {
		const [r, g, bl] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
			const c = Number(v) / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}
/** A long chain, as the operator's projects carry it: `CompX › ClientY – ProjectZ`. */
function seedLongProject(user: User) {
	const customer = seedCustomer(user.id, 'CompX');
	const project = seedProject(user.id, customer, 'ClientY – ProjectZ');
	seedEntry(user.id, zone, {
		projectId: project,
		start: '14:00',
		end: '15:00',
		description: 'Went through the long chain',
		date: user.day(12)
	});
}
/** The strip's Undo. */
const undo = (page: Page) => strip(page).getByRole('button', { name: 'Undo' });

/** The gate's realistic month (30 days back from today), shown over all of its days. */
async function gateMonth(label: string) {
	const user = await seedGateMonth(`${test.info().project.name}-${label}`, zone);
	return { ...user, path: `/entries?range=custom&from=${user.from}&to=${user.today}` };
}
/** The first weekday at least `n` days before `today`: the gate's month has entries on it. */
function weekdayBack(today: string, n: number) {
	for (let back = n; ; back++) {
		const date = new Date(Date.parse(`${today}T00:00:00Z`) - back * 86_400_000);
		if (date.getUTCDay() % 6 !== 0) return date.toISOString().slice(0, 10);
	}
}
/** A box's viewport rectangle, or a failure when it is not rendered. */
async function rect(l: Locator) {
	const b = await l.boundingBox();
	if (!b) throw new Error('not shown');
	return b;
}
/** The element at the centre of `l` is `l` (or inside it): nothing covers it. */
const onTop = (l: Locator) =>
	l.evaluate((el) => {
		const r = el.getBoundingClientRect();
		const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
		return at !== null && el.contains(at);
	});
const scrollTop = (page: Page) => page.evaluate(() => window.scrollY);
/** The focused element is a control in view, on top at its centre (not the page). */
const focusInView = (page: Page) =>
	page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) return false;
		const r = el.getBoundingClientRect();
		const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
		return at !== null && el.contains(at);
	});

/**
 * The bulk bar is in view between `top` (the sticky bars' foot) and `bottom` (the
 * viewport's foot or the bottom bar), and its Edit… takes a click where it is, without a
 * scroll; the dialog it opens is closed again.
 */
async function bulkInView(page: Page, top: number, bottom: number, n: number) {
	const b = await rect(bulk(page));
	expect(b.y).toBeGreaterThanOrEqual(top - 0.5);
	expect(b.y + b.height).toBeLessThanOrEqual(bottom + 0.5);
	const edit = bulk(page).getByRole('button', { name: 'Edit…' });
	expect(await onTop(edit)).toBe(true);
	const before = await scrollTop(page);
	await edit.click();
	const dialog = bulkDialog(page, n);
	await expect(dialog).toBeVisible();
	expect(await scrollTop(page)).toBe(before);
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toBeHidden();
}

/**
 * The pinned band (the bar and the chips under it) leaves most of the screen to the
 * rows, and a tick box scrolled to just under its foot takes a tick where it is.
 */
async function ticksUnderBand(page: Page, box: Locator, height: number) {
	const band = page.locator('[data-bulk-band]');
	const foot = await band.evaluate((el) => el.getBoundingClientRect().bottom);
	expect(foot).toBeLessThan(height / 2);
	await box.evaluate((el, at) => window.scrollBy(0, el.getBoundingClientRect().top - at), foot + 2);
	// Still pinned at the same place after the scroll.
	expect(await band.evaluate((el) => el.getBoundingClientRect().bottom)).toBeCloseTo(foot, 0);
	const b = await rect(box);
	expect(b.y).toBeGreaterThan(foot);
	expect(await onTop(box)).toBe(true);
	await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
	await expect(box).toBeChecked();
}

test.describe('the PC table', () => {
	test.skip(({ isMobile }) => isMobile, 'the PC at 1440 px; the phone is its own');

	test('opens on this month, newest day first, with day totals, overlaps and the count', async ({
		page
	}) => {
		const user = await newMonth('read');
		await openEntries(page, user);

		await expect(filterButton(page)).toContainText('This month');
		await showsDays(page, ALL(user));
		const totals = ['2:00', '2:00', '2:00', '1:00', '2:00', '2:00', '1:30'];
		for (const [i, total] of totals.entries()) {
			await expect(days(page).nth(i).getByRole('row').first()).toContainText(total);
		}
		await expect(tally(page, '8 entries · 12:30')).toBeVisible();
		await expect(page.getByText('Fixed the login form last month')).toHaveCount(0);

		// Within a day, the newest start first.
		await expect(day(page, user.day(10)).getByRole('row').nth(1)).toContainText('14:00');
		await expect(day(page, user.day(10)).getByRole('row').nth(2)).toContainText('13:30');

		// The overlapping pair: a red top edge and the mark in the row's name.
		const overlapping = entryRows(page).filter({
			has: page.getByRole('link', { name: /Overlaps another entry/ })
		});
		await expect(overlapping).toHaveCount(2);
		await expect(overlapping.nth(0)).toContainText('Looked into the overlap warning');
		await expect(overlapping.nth(1)).toContainText('Reset the shared printer queue');
		const edge = (r: Locator) =>
			r
				.locator('td')
				.first()
				.evaluate((el) => getComputedStyle(el).boxShadow);
		expect(await edge(overlapping.nth(0))).toMatch(/inset/);
		expect(await edge(row(page, 'Planned the release'))).toBe('none');

		// The entry past midnight ends "+1" and counts in its start day.
		await expect(row(page, 'Late fix for the sync bug')).toContainText('01:00+1');
		await expect(
			row(page, 'Late fix for the sync bug').getByRole('link', { name: /Late fix/ })
		).toHaveAccessibleName(/^23:00–01:00 \+1 day, Acme › Website, Late fix for the sync bug$/);
	});

	test('a preset applies at once and is kept for the next visit', async ({ page }) => {
		const user = await newMonth('preset');
		await openEntries(page, user);

		await filterButton(page).click();
		await expect(panel(page)).toBeVisible();
		await expect(panel(page).getByRole('radio', { name: /^This month/ })).toBeChecked();
		await panel(page)
			.getByRole('radio', { name: /^Last month/ })
			.check();
		await expect(page).toHaveURL(/\/entries\?range=last-month$/);
		await expect(filterButton(page)).toContainText('Last month');
		await expect(page.getByText('Fixed the login form last month')).toBeVisible();
		await expect(entryRows(page)).toHaveCount(1);

		const nav = page.getByRole('navigation', { name: 'Main' });
		await nav.getByRole('link', { name: 'Today' }).click();
		await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
		await nav.getByRole('link', { name: 'Entries' }).click();
		await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
		await expect(filterButton(page)).toContainText('Last month');
		await expect(page.getByText('Fixed the login form last month')).toBeVisible();
	});

	test('the search finds as you type, by any field, and clears', async ({ page }) => {
		const user = await newMonth('search');
		await openEntries(page, user);

		await search(page).click();
		await search(page).pressSequentially('printer');
		await expect(page).toHaveURL(/q=printer$/);
		await expect(entryRows(page)).toHaveCount(1);
		await expect(row(page, 'Reset the shared printer queue')).toBeVisible();
		await expect(search(page)).toBeFocused();
		await expect(search(page)).toHaveValue('printer');

		await search(page).fill('T-101');
		await expect(entryRows(page)).toHaveCount(1);
		await expect(row(page, 'Fixed the login form')).toBeVisible();

		// A location's name.
		await search(page).fill('café');
		await expect(entryRows(page)).toHaveCount(1);
		await expect(row(page, 'Looked into the overlap warning')).toBeVisible();
		await expect(tally(page, '1 entry · 0:30')).toBeVisible();

		await page.getByRole('button', { name: 'Clear search' }).click();
		await expect(search(page)).toHaveValue('');
		await expect(search(page)).toBeFocused();
		await expect(page).not.toHaveURL(/q=/);
		await showsDays(page, ALL(user));
	});

	test('Review Focus 4: a search typed then Back returns to the table before it', async ({
		page
	}) => {
		const user = await newMonth('back');
		await openEntries(page, user);
		const before = page.url();

		await search(page).click();
		// Slow enough that each letter is applied on its own.
		await search(page).pressSequentially('vpn', { delay: 400 });
		await expect(page).toHaveURL(/q=vpn$/);
		await expect(search(page)).toBeFocused();
		await expect(search(page)).toHaveValue('vpn');
		await expect(page.getByText('No entries match “vpn”.')).toBeVisible();

		await page.goBack();
		expect(page.url()).toBe(before);
		await expect(search(page)).toHaveValue('');
		await showsDays(page, ALL(user));
	});

	test('filters show as chips, are removed one by one and cleared', async ({ page }) => {
		const user = await newMonth('chips');
		await openEntries(page, user);

		await filterButton(page).click();
		const scope = panel(page).getByRole('combobox', { name: 'Customer › project' });
		await scope.fill('website');
		await expect(page.getByRole('listbox', { name: 'Customer › project' })).toBeVisible();
		await scope.press('Enter');
		await expect(page).toHaveURL(new RegExp(`project=${user.projects.website}`));
		await expect(scope).toHaveValue('Acme › Website');
		await panel(page).getByLabel('Activity').selectOption({ label: 'Development' });
		await expect(page).toHaveURL(new RegExp(`activity=${user.activities.development}`));
		await page.keyboard.press('Escape');
		await expect(panel(page)).toBeHidden();
		await expect(filterButton(page)).toBeFocused();

		await expect(filterButton(page)).toContainText('+2');
		await expect(entryRows(page)).toHaveCount(1);
		await expect(row(page, 'Fixed the login form')).toBeVisible();
		const chips = page.getByRole('list', { name: 'Filters' });
		await expect(chips.getByRole('listitem')).toHaveText([
			'Acme › Website',
			'Activity: Development'
		]);

		await chips.getByRole('link', { name: 'Remove Activity: Development' }).click();
		await expect(filterButton(page)).toContainText('+1');
		await expect(entryRows(page)).toHaveCount(4);

		await page.getByRole('link', { name: 'Clear filters' }).click();
		await expect(filterButton(page)).not.toContainText('+');
		await expect(chips).toHaveCount(0);
		await showsDays(page, ALL(user));
	});

	test('a customer heading filters by the customer, activity None too', async ({ page }) => {
		const user = await newMonth('customer');
		await openEntries(page, user);

		await filterButton(page).click();
		const scope = panel(page).getByRole('combobox', { name: 'Customer › project' });
		await scope.fill('northwind');
		await page.getByRole('option', { name: 'Northwind, all projects' }).click();
		await expect(page).toHaveURL(/customer=/);
		await showsDays(page, [user.day(13), user.day(9)]);

		await panel(page).getByLabel('Activity').selectOption({ label: 'None' });
		await showsDays(page, [user.day(13)]);
		await expect(page.getByRole('list', { name: 'Filters' })).toContainText('Activity: None');
	});

	test('a row click opens its form in place; Save returns to the same table', async ({ page }) => {
		const user = await newMonth('open');
		await openEntries(page, user);
		await search(page).fill('release');
		await expect(page).toHaveURL(/q=release$/);
		const address = page.url();

		await row(page, 'Planned the release').getByRole('cell', { name: 'Meeting' }).click();
		const form = page.getByRole('dialog', { name: 'Edit entry' });
		await expect(form).toBeVisible();
		await expect(page).toHaveURL(/\/entries\/\w+\?back=%2Fentries%3Frange%3Dthis-month/);
		await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();

		await form.getByLabel('Description').fill('Planned the release twice');
		await form.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(form).toBeHidden();
		expect(page.url()).toBe(address);
		await expect(strip(page)).toContainText('Done: Edit entry');
		await expect(row(page, 'Planned the release twice')).toBeVisible();
	});

	test('the row menu copies, deletes with undo, and works by keyboard', async ({ page }) => {
		const user = await newMonth('menu');
		await openEntries(page, user);

		await test.step('Copy opens a new entry from the row', async () => {
			await menuButton(row(page, 'Planned the release')).click();
			await menu(page).getByRole('menuitem', { name: 'Copy' }).click();
			const form = page.getByRole('dialog', { name: 'New entry' });
			await expect(form).toBeVisible();
			await expect(form.getByLabel('Description')).toHaveValue('Planned the release');
			await form.getByRole('button', { name: 'Cancel' }).click();
			await expect(form).toBeHidden();
		});

		await test.step('Delete removes it at once; Undo brings it back', async () => {
			await menuButton(row(page, 'Filed the receipts')).click();
			await menu(page).getByRole('menuitem', { name: 'Delete' }).click();
			await expect(strip(page)).toContainText('Done: Delete entry');
			await expect(row(page, 'Filed the receipts')).toHaveCount(0);
			await expect(tally(page, '7 entries · 10:30')).toBeVisible();
			await strip(page).getByRole('button', { name: 'Undo' }).click();
			await expect(strip(page)).toContainText('Undone.');
			await expect(row(page, 'Filed the receipts')).toHaveCount(1);
		});

		await test.step('the menu by keyboard', async () => {
			const button = menuButton(row(page, 'Built the login screen'));
			await button.focus();
			await page.keyboard.press('Enter');
			const items = menu(page).getByRole('menuitem');
			await expect(items).toHaveText(['Restart', 'Copy', 'Edit', 'Delete']);
			await expect(items.nth(0)).toBeFocused();
			await page.keyboard.press('ArrowDown');
			await expect(items.nth(1)).toBeFocused();
			await page.keyboard.press('End');
			await expect(items.nth(3)).toBeFocused();
			await page.keyboard.press('ArrowDown');
			await expect(items.nth(0)).toBeFocused();
			await page.keyboard.press('ArrowUp');
			await expect(items.nth(3)).toBeFocused();
			await page.keyboard.press('Home');
			await expect(items.nth(0)).toBeFocused();
			await page.keyboard.press('Escape');
			await expect(menu(page)).toHaveCount(0);
			await expect(button).toBeFocused();
		});
	});

	test('a row Delete refused because the entry changed or went elsewhere says so', async ({
		page
	}) => {
		const user = await newMonth('refused-delete');
		await openEntries(page, user);

		editElsewhere(user.id, user.entries.receipts, 'Filed the receipts again');
		await menuButton(row(page, 'Filed the receipts')).click();
		await menu(page).getByRole('menuitem', { name: 'Delete' }).click();
		const alert = page.getByRole('alert');
		await expect(alert).toContainText('This was changed elsewhere; reload and try again.');
		await expect(menu(page)).toHaveCount(0);
		await alert.getByRole('link', { name: 'Reload' }).click();
		await expect(row(page, 'Filed the receipts again')).toHaveCount(1);
		await expect(page.getByRole('alert')).toHaveCount(0);

		deleteElsewhere(user.id, user.entries.release);
		await menuButton(row(page, 'Planned the release')).click();
		await menu(page).getByRole('menuitem', { name: 'Delete' }).click();
		await expect(page.getByRole('alert')).toContainText('This entry was deleted elsewhere.');
	});

	test('▶ restarts a row in the timer bar; a running row cannot restart', async ({ page }) => {
		const user = await newMonth('restart');
		await openEntries(page, user);

		// Each ▶ is named by its date and start as well, so rows of one project differ.
		const built = row(page, 'Built the login screen');
		await expect(built.getByRole('button', { name: /^Restart / })).toHaveAccessibleName(
			`Restart ${user.day(9)} 08:00, Northwind › Mobile app`
		);
		await built.getByRole('button', { name: /^Restart / }).click();
		await expect(bar(page)).toContainText('Northwind › Mobile app');
		await expect(strip(page)).toContainText('Start timer on');
		await expect(page).toHaveURL(/\/entries\?range=this-month$/);

		// The running copy heads the table, today, and its menu's Restart says why it is off.
		const running = entryRows(page).filter({ hasText: 'Running' });
		await expect(running).toHaveCount(1);
		await expect(running.getByRole('button', { name: /^Restart/ })).toHaveCount(0);
		await menuButton(running).click();
		const restart = menu(page).getByRole('menuitem', { name: /Restart/ });
		await expect(restart).toBeDisabled();
		await expect(restart).toContainText('Already running');

		// By keyboard it is still met (the APG menu): focusable in the arrow order, inert.
		await expect(restart).toHaveAttribute('aria-disabled', 'true');
		await expect(restart).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(menu(page).getByRole('menuitem', { name: 'Copy' })).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect(restart).toBeFocused();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Space');
		await expect(menu(page)).toBeVisible();
		await expect(restart).toBeFocused();
		await expect(entryRows(page).filter({ hasText: 'Running' })).toHaveCount(1);
		await expect(strip(page)).toContainText('Start timer on');
	});

	test('a search the core refuses says why, and the field stops at 200 characters', async ({
		page
	}) => {
		const user = await newMonth('long-search');
		await openEntries(page, user, `/entries?q=${'x'.repeat(201)}`);
		await expect(page.getByRole('alert')).toHaveText('Use 1–200 characters.');
		await expect(page.getByText(/No entries match/)).toHaveCount(0);
		await expect(search(page)).toHaveAttribute('maxlength', '200');
	});

	test('/ focuses the search from anywhere on the screen', async ({ page }) => {
		const user = await newMonth('slash');
		await openEntries(page, user);
		await page.getByRole('heading', { name: 'Entries', level: 1 }).click();
		await page.keyboard.press('/');
		await expect(search(page)).toBeFocused();
		await expect(search(page)).toHaveValue('');
	});

	test('at 1180 px Location and Reference go and nothing scrolls sideways', async ({ page }) => {
		const user = await newMonth('narrow');
		await page.setViewportSize({ width: 1180, height: 900 });
		await openEntries(page, user);
		await expect(page.getByRole('columnheader', { name: 'Activity' })).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Location' })).toBeHidden();
		await expect(page.getByRole('columnheader', { name: 'Reference' })).toBeHidden();
		const wide = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(wide).toBe(false);
	});

	test('the empty, unmatched and refused states', async ({ page }) => {
		const user = await newMonth('states');
		await openEntries(page, user, '/entries?range=custom&from=2001-01-01&to=2001-01-31');
		await expect(page.getByText('No entries in this range.')).toBeVisible();
		await expect(page.getByRole('table')).toHaveCount(0);

		await page.goto('/entries?range=this-month&q=nowhere');
		await expect(page.getByText('No entries match “nowhere”.')).toBeVisible();
		await page.getByRole('link', { name: 'Clear the search' }).click();
		await showsDays(page, ALL(user));

		await filterButton(page).click();
		await panel(page).getByRole('radio', { name: 'Custom range' }).check();
		await expect(page).toHaveURL(/range=custom/);
		await panel(page).getByLabel('From', { exact: true }).fill(user.day(20));
		await panel(page).getByLabel('To', { exact: true }).fill(user.day(1));
		await expect(panel(page).getByText('From must not be after To.')).toBeVisible();
		await expect(panel(page).getByLabel('To', { exact: true })).toHaveAttribute(
			'aria-invalid',
			'true'
		);
		await expect(page.getByRole('table')).toHaveCount(0);
	});

	test('500 rows at most, the newest, with a message', async ({ page }) => {
		const user = await newMonth('many');
		const project = seedMany(user.id, zone, 501);
		await openEntries(page, user, `/entries?range=this-month&project=${project}`);
		await expect(
			page.getByText('Showing the newest 500 entries; narrow the filters.')
		).toBeVisible();
		await expect(entryRows(page)).toHaveCount(500);
		await expect(tally(page, '500 entries · 33:20')).toBeVisible();
		await expect(page.getByText('Bulk 501', { exact: true })).toHaveCount(1);
		await expect(page.getByText('Bulk 1', { exact: true })).toHaveCount(0);
	});

	test('a day head ticks its rows, shift ticks a run, and the bulk bar names its set', async ({
		page
	}) => {
		const user = await newMonth('select');
		await openEntries(page, user);

		await test.step("a day head's box ticks the day; one row off makes it mixed", async () => {
			await dayTick(page, user.day(10)).check();
			await expect(tick(page, 'Reset the shared printer queue')).toBeChecked();
			await expect(tick(page, 'Looked into the overlap warning')).toBeChecked();
			await expect(bulk(page)).toContainText('2 selected · 2:00');
			await expect(bulk(page)).toContainText('This month');
			await expect(search(page)).toHaveCount(0);
			await expect(filterButton(page)).toHaveCount(0);

			await tick(page, 'Looked into the overlap warning').uncheck();
			await expect(bulk(page)).toContainText('1 selected · 1:30');
			await expect(dayTick(page, user.day(10))).toHaveJSProperty('indeterminate', true);
			await expect(dayTick(page, user.day(10))).not.toBeChecked();

			await bulk(page).getByRole('button', { name: 'Clear selection' }).click();
			await expect(bulk(page)).toHaveCount(0);
			await expect(search(page)).toBeVisible();
			await expect(tick(page, 'Reset the shared printer queue')).not.toBeChecked();
			await expect(dayTick(page, user.day(10))).toHaveJSProperty('indeterminate', false);
		});

		await test.step('shift-click ticks the run between the last tick and this one', async () => {
			await tick(page, 'Planned the release').click();
			await tick(page, 'Built the login screen').click({ modifiers: ['Shift'] });
			await expect(tick(page, 'Filed the receipts')).toBeChecked();
			await expect(tick(page, 'Built the login screen')).toBeChecked();
			await expect(tick(page, 'Fixed the login form')).not.toBeChecked();
			await expect(tick(page, 'Reset the shared printer queue')).not.toBeChecked();
			await expect(bulk(page)).toContainText('3 selected · 5:00');
		});

		await test.step('with a filter and a search, the bar names them and the chips stay', async () => {
			await page.goto(`/entries?range=this-month&project=${user.projects.operations}&q=printer`);
			await page.waitForLoadState('networkidle');
			await tick(page, 'Reset the shared printer queue').check();
			await expect(bulk(page)).toContainText('1 selected · 1:30');
			await expect(bulk(page)).toContainText('This month · “printer”');
			await expect(page.getByRole('list', { name: 'Filters' })).toContainText('Acme › Operations');
		});
	});

	test('Edit… changes the ticked entries in one batch; Undo puts them all back', async ({
		page
	}) => {
		const user = await newMonth('bulk-edit');
		for (const n of [7, 8]) {
			seedEntry(user.id, zone, {
				projectId: user.projects.website,
				start: '09:30',
				end: '09:45',
				description: 'Standup',
				date: user.day(n)
			});
		}
		await openEntries(page, user);

		await tick(page, 'Standup').nth(0).check();
		await tick(page, 'Standup').nth(1).check();
		await expect(bulk(page)).toContainText('2 selected · 0:30');
		await bulk(page).getByRole('button', { name: 'Edit…' }).click();
		const dialog = bulkDialog(page, 2);
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel('Activity')).toHaveValue('keep');
		await expect(dialog).toContainText('Only what you set changes. One undo puts all 2 back.');
		await dialog.getByLabel('Location').selectOption({ label: 'Home' });
		await dialog.getByLabel('Find').fill('Standup');
		await dialog.getByLabel('Replace with').fill('Daily standup');
		await dialog.getByRole('button', { name: 'Apply to 2 entries' }).click();

		await expect(dialog).toBeHidden();
		await expect(strip(page)).toContainText('Done: Edit 2 entries.');
		await expect(row(page, 'Daily standup')).toHaveCount(2);
		await expect(row(page, 'Daily standup').nth(0)).toContainText('Home');
		await expect(row(page, 'Daily standup').nth(1)).toContainText('Home');
		// A done change clears the ticks.
		await expect(bulk(page)).toHaveCount(0);
		await expect(search(page)).toBeVisible();

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(row(page, 'Daily standup')).toHaveCount(0);
		await expect(row(page, 'Standup')).toHaveCount(2);
		await expect(row(page, 'Standup').nth(0)).not.toContainText('Home');
	});

	test('Delete removes the ticked entries at once; Undo brings them back', async ({ page }) => {
		const user = await newMonth('bulk-delete');
		await openEntries(page, user);

		await tick(page, 'Filed the receipts').check();
		await tick(page, 'Planned the release').check();
		await bulk(page).getByRole('button', { name: 'Delete' }).click();
		await expect(strip(page)).toContainText('Done: Delete 2 entries.');
		await expect(row(page, 'Filed the receipts')).toHaveCount(0);
		await expect(row(page, 'Planned the release')).toHaveCount(0);
		await expect(tally(page, '6 entries · 8:30')).toBeVisible();
		await expect(bulk(page)).toHaveCount(0);

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(row(page, 'Filed the receipts')).toHaveCount(1);
		await expect(row(page, 'Planned the release')).toHaveCount(1);
		await expect(tick(page, 'Filed the receipts')).not.toBeChecked();
	});

	test('Review Focus 1: a change of range or filter clears the ticks', async ({ page }) => {
		const user = await newMonth('clear-ticks');
		await openEntries(page, user, '/entries?range=last-month');
		await filterButton(page).click();
		await panel(page)
			.getByRole('radio', { name: /^This month/ })
			.check();
		await expect(page).toHaveURL(/range=this-month/);
		await page.keyboard.press('Escape');

		await tick(page, 'Filed the receipts').check();
		await tick(page, 'Planned the release').check();
		await expect(bulk(page)).toContainText('2 selected');

		await page.goBack();
		await expect(page).toHaveURL(/range=last-month/);
		await expect(bulk(page)).toHaveCount(0);
		await expect(filterButton(page)).toContainText('Last month');
		await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);

		await page.goForward();
		await expect(filterButton(page)).toContainText('This month');
		await expect(bulk(page)).toHaveCount(0);
		await expect(tick(page, 'Filed the receipts')).not.toBeChecked();

		// A chip removed is a filter change too.
		await page.goto(`/entries?range=this-month&project=${user.projects.website}`);
		await page.waitForLoadState('networkidle');
		await tick(page, 'Planned the release').check();
		await expect(bulk(page)).toBeVisible();
		await page
			.getByRole('list', { name: 'Filters' })
			.getByRole('link', { name: 'Remove Acme › Website' })
			.click();
		await expect(page).not.toHaveURL(/project=/);
		await expect(bulk(page)).toHaveCount(0);
		await expect(tick(page, 'Planned the release')).not.toBeChecked();
	});

	test('Review Focus 3: a ticked entry changed elsewhere is refused in the dialog by name', async ({
		page
	}) => {
		const user = await newMonth('stale');
		await openEntries(page, user);

		await tick(page, 'Filed the receipts').check();
		await tick(page, 'Planned the release').check();
		editElsewhere(user.id, user.entries.receipts, 'Filed the receipts again');
		await bulk(page).getByRole('button', { name: 'Edit…' }).click();
		const dialog = bulkDialog(page, 2);
		await dialog.getByLabel('Activity').selectOption({ label: 'Development' });
		await dialog.getByRole('button', { name: 'Apply to 2 entries' }).click();

		const alert = dialog.getByRole('alert');
		await expect(alert).toContainText(
			`${user.day(6)} 13:00, Acme › Operations: This was changed elsewhere; reload and try again.`
		);
		await expect(alert.getByRole('link', { name: 'Reload' })).toBeVisible();
		await expect(dialog.getByLabel('Activity')).toHaveValue(user.activities.development);

		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog).toBeHidden();
		await expect(row(page, 'Planned the release')).toContainText('Meeting');
		await expect(bulk(page)).toContainText('2 selected');
	});

	test('a long Customer › project reads in full at 1440 px', async ({ page }) => {
		const user = await newMonth('long-project');
		seedLongProject(user);
		await openEntries(page, user);
		const name = row(page, 'Went through the long chain')
			.locator('a[data-entry-form]')
			.first()
			.locator(':scope > span')
			.last();
		await expect(name).toHaveText('CompX › ClientY – ProjectZ');
		const cut = await name.evaluate((el) => el.scrollWidth > el.clientWidth);
		expect(cut).toBe(false);
	});

	test('ticked rows take the accent fill', async ({ page }) => {
		const user = await newMonth('shade');
		await openEntries(page, user);
		const accent = await colourOf(page, 'var(--accent)');
		const background = (text: string) =>
			row(page, text).evaluate((el) => getComputedStyle(el).backgroundColor);
		await tick(page, 'Filed the receipts').check();
		await page.mouse.move(0, 0);
		await expect.poll(() => background('Filed the receipts')).toBe(accent);
		expect(await background('Planned the release')).not.toBe(accent);
	});

	test('an unticked box has a stroke of 3:1 in both themes', async ({ page }) => {
		const user = await newMonth('stroke');
		await openEntries(page, user);
		for (const colorScheme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme });
			const box = tick(page, 'Filed the receipts');
			const stroke = await box.evaluate((el) => getComputedStyle(el).borderTopColor);
			const fill = await box.evaluate((el) => getComputedStyle(el).backgroundColor);
			const ground = await colourOf(page, 'var(--card)');
			const accent = await colourOf(page, 'var(--accent)');
			for (const against of [fill, ground, accent]) {
				expect(
					contrast(stroke, against),
					`${colorScheme} ${stroke} on ${against}`
				).toBeGreaterThanOrEqual(3);
			}
			// The fields' stroke stays as it was.
			expect(await colourOf(page, 'var(--input)')).toBe(
				colorScheme === 'light' ? 'rgb(200, 203, 208)' : 'rgb(67, 70, 75)'
			);
		}
	});

	test('Delete in the row menu is red', async ({ page }) => {
		const user = await newMonth('red-delete');
		await openEntries(page, user);
		await menuButton(row(page, 'Filed the receipts')).click();
		const del = menu(page).getByRole('menuitem', { name: 'Delete' });
		const red = await colourOf(page, 'var(--destructive)');
		expect(await del.evaluate((el) => getComputedStyle(el).color)).toBe(red);
		const copy = menu(page).getByRole('menuitem', { name: 'Copy' });
		expect(await copy.evaluate((el) => getComputedStyle(el).color)).toBe(
			await colourOf(page, 'var(--foreground)')
		);
	});

	test('the chips are 36 px controls', async ({ page }) => {
		const user = await newMonth('chip-size');
		await openEntries(
			page,
			user,
			`/entries?range=this-month&activity=${user.activities.development}`
		);
		const chips = page.getByRole('list', { name: 'Filters' });
		const chip = (await chips.getByRole('listitem').first().boundingBox())!;
		const remove = (await chips.getByRole('link', { name: /^Remove/ }).boundingBox())!;
		const clear = (await page.getByRole('link', { name: 'Clear filters' }).boundingBox())!;
		expect(chip.height).toBeGreaterThanOrEqual(36);
		expect(remove.height).toBeGreaterThanOrEqual(36);
		expect(remove.width).toBeGreaterThanOrEqual(36);
		expect(clear.height).toBeGreaterThanOrEqual(36);
	});

	test('focus: Clear selection to the head box; a done action to Undo', async ({ page }) => {
		const user = await newMonth('focus');
		await openEntries(page, user);

		await test.step('Clear selection', async () => {
			await tick(page, 'Filed the receipts').check();
			await bulk(page).getByRole('button', { name: 'Clear selection' }).click();
			await expect(page.getByRole('checkbox', { name: 'Select all shown' })).toBeFocused();
		});

		await test.step('a done bulk Delete', async () => {
			await tick(page, 'Filed the receipts').check();
			await bulk(page).getByRole('button', { name: 'Delete' }).click();
			await expect(strip(page)).toContainText('Done: Delete 1 entry.');
			await expect(undo(page)).toBeFocused();
		});

		await test.step('a done bulk Apply', async () => {
			await tick(page, 'Planned the release').check();
			await bulk(page).getByRole('button', { name: 'Edit…' }).click();
			const dialog = bulkDialog(page, 1);
			await dialog.getByLabel('Activity').selectOption({ label: 'Development' });
			await dialog.getByRole('button', { name: 'Apply to 1 entry' }).click();
			await expect(strip(page)).toContainText('Done: Edit 1 entry.');
			await expect(undo(page)).toBeFocused();
		});

		await test.step('⋯ Delete', async () => {
			await menuButton(row(page, 'Built the login screen')).click();
			await menu(page).getByRole('menuitem', { name: 'Delete' }).click();
			await expect(strip(page)).toContainText('Done: Delete entry');
			await expect(undo(page)).toBeFocused();
		});
	});

	test('a row ticked far down the month keeps the bulk bar in view, rows still tickable', async ({
		page
	}) => {
		const user = await gateMonth('bulk-view');
		await openEntries(page, user, user.path);
		const rowsOf = (date: string) =>
			day(page, date)
				.getByRole('row')
				.filter({ has: page.locator('a[data-entry-form]') });

		const far = rowsOf(weekdayBack(user.today, 14)).first().getByRole('checkbox');
		await far.scrollIntoViewIfNeeded();
		await far.check();
		expect(await scrollTop(page)).toBeGreaterThan(1000);
		await expect(bulk(page)).toContainText('1 selected');

		const header = await rect(
			page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })
		);
		await bulkInView(page, header.y + header.height, 900, 1);

		await ticksUnderBand(
			page,
			rowsOf(weekdayBack(user.today, 9)).first().getByRole('checkbox'),
			900
		);
		await expect(bulk(page)).toContainText('2 selected');
		await bulkInView(page, header.y + header.height, 900, 2);

		await test.step('Clear selection leaves the page where it is, the focus in view', async () => {
			const before = await scrollTop(page);
			const lastRow = rowsOf(weekdayBack(user.today, 9)).first();
			const rowAt = (await rect(lastRow)).y;
			await bulk(page).getByRole('button', { name: 'Clear selection' }).click();
			await expect(bulk(page)).toHaveCount(0);
			await expect(rowsOf(weekdayBack(user.today, 9)).first().getByRole('checkbox')).toBeFocused();
			// The rows stay still: the scroll moves only by scroll anchoring's correction for
			// the toolbar taking the bar's place at the top, never back up the month.
			expect(Math.abs((await rect(lastRow)).y - rowAt)).toBeLessThan(1);
			expect(Math.abs((await scrollTop(page)) - before)).toBeLessThan(20);
			expect(await focusInView(page)).toBe(true);
		});
	});

	test('Review I2: a row deleted while rows are ticked far down shows Undo in view, focused', async ({
		page
	}) => {
		const user = await gateMonth('bulk-undo');
		await openEntries(page, user, user.path);
		const rowsOf = (date: string) =>
			day(page, date)
				.getByRole('row')
				.filter({ has: page.locator('a[data-entry-form]') });
		const far = rowsOf(weekdayBack(user.today, 14));
		await far.first().getByRole('checkbox').scrollIntoViewIfNeeded();
		await far.first().getByRole('checkbox').check();
		await expect(bulk(page)).toContainText('1 selected');

		const gone = far.nth(1);
		// The ticked row above the deleted one: it stays where it is when the page does not move.
		// (Not a row below: the day may have no more than three rows, and those move up.)
		const keptAt = (await rect(far.first())).y;
		await menuButton(gone).click();
		await menu(page).getByRole('menuitem', { name: 'Delete' }).click();
		await expect(strip(page)).toContainText('Done: Delete entry');
		await expect(undo(page)).toBeFocused();
		await expect(bulk(page)).toContainText('1 selected');
		// Undo is in view and on top; the page did not move: the row above still sits where it was.
		expect(await onTop(undo(page))).toBe(true);
		const band = await rect(page.locator('[data-bulk-band]'));
		expect(band.y + band.height).toBeLessThan(450);
		expect(await onTop(bulk(page).getByRole('button', { name: 'Edit…' }))).toBe(true);
		expect(Math.abs((await rect(far.first())).y - keptAt)).toBeLessThan(1);
		await undo(page).click();
		await expect(strip(page)).toContainText('Undone.');
		expect(await onTop(strip(page))).toBe(true);
	});

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		test('tick boxes post to Edit, the bulk form applies, and Select all ticks every row', async ({
			page
		}) => {
			const user = await newMonth('nojs-bulk');
			await openEntries(page, user, '/entries', false);

			// Without the script the day heads have no box; Edit and Delete are always there.
			await expect(dayTick(page, user.day(10))).toHaveCount(0);
			await page.getByRole('button', { name: 'Edit…' }).click();
			await expect(page.getByRole('alert')).toContainText('Select at least one entry.');

			await tick(page, 'Filed the receipts').check();
			await tick(page, 'Planned the release').check();
			await page.getByRole('button', { name: 'Edit…' }).click();
			await expect(page.getByRole('heading', { name: 'Edit 2 entries' })).toBeVisible();
			const form = page.getByRole('region', { name: 'Edit 2 entries' });
			await form.getByLabel('Activity').selectOption({ label: 'Development' });
			await form.getByRole('button', { name: 'Apply to 2 entries' }).click();
			await expect(strip(page)).toContainText('Done: Edit 2 entries.');
			await expect(row(page, 'Filed the receipts')).toContainText('Development');
			await expect(row(page, 'Planned the release')).toContainText('Development');

			await page.getByRole('link', { name: 'Select all' }).click();
			await expect(page).toHaveURL(/all=1/);
			await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(8);
			await page.getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(strip(page)).toContainText('Done: Delete 8 entries.');
			await expect(page.getByText('No entries in this range.')).toBeVisible();
		});

		test('a refused custom range opens the filter with the message and no list', async ({
			page
		}) => {
			const user = await newMonth('nojs-dates');
			await openEntries(
				page,
				user,
				`/entries?range=custom&from=${user.day(20)}&to=${user.day(1)}`,
				false
			);
			await expect(panel(page)).toBeVisible();
			await expect(panel(page).getByText('From must not be after To.')).toBeVisible();
			await expect(panel(page).getByLabel('From', { exact: true })).toHaveValue(user.day(20));
			await expect(panel(page).getByLabel('To', { exact: true })).toHaveAttribute(
				'aria-invalid',
				'true'
			);
			await expect(page.getByRole('table')).toHaveCount(0);
		});

		test('the filter shows on Show, the search on Enter, and the menu deletes', async ({
			page
		}) => {
			const user = await newMonth('nojs');
			await openEntries(page, user, '/entries', false);

			await filterButton(page).click();
			await panel(page)
				.getByRole('radio', { name: /^Last month/ })
				.check();
			await panel(page).getByRole('button', { name: 'Show' }).click();
			await expect(page).toHaveURL(/range=last-month/);
			await expect(filterButton(page)).toContainText('Last month');
			await expect(entryRows(page)).toHaveCount(1);

			await page.goto('/entries?range=this-month');
			await search(page).fill('printer');
			await search(page).press('Enter');
			await expect(page).toHaveURL(/q=printer/);
			await expect(entryRows(page)).toHaveCount(1);

			await menuButton(row(page, 'Reset the shared printer queue')).click();
			await row(page, 'Reset the shared printer queue')
				.getByRole('button', { name: 'Delete' })
				.click();
			await expect(strip(page)).toContainText('Done: Delete entry');
			await expect(page).toHaveURL(/q=printer/);
			await expect(page.getByText('No entries match “printer”.')).toBeVisible();
		});
	});
});

test.describe('the phone list', () => {
	test.skip(({ isMobile }) => !isMobile, 'the phone at 390 px; the PC is its own');
	test.use({ viewport: { width: 390, height: 844 } });

	const addDays = (date: string, n: number) =>
		new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
	/** Last week, Monday to Sunday, from `today`. */
	function lastWeekOf(today: string) {
		const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
		const from = addDays(today, -((dow + 6) % 7) - 7);
		return { from, to: addDays(from, 6) };
	}

	/** `newMonth`'s entries, a VPN entry on last week's Wednesday, and a Research activity. */
	async function phoneMonth(label: string) {
		const user = await newMonth(label);
		const week = lastWeekOf(user.today);
		const vpnDate = addDays(week.from, 2);
		seedEntry(user.id, zone, {
			projectId: user.projects.mobile,
			start: '16:00',
			end: '17:15',
			description: 'Set up the VPN',
			date: vpnDate
		});
		seedActivity(user.id, 'Research');
		const [y, m] = user.month.split('-').map(Number);
		const lastMonthFirst = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
		const dates = [
			lastMonthFirst,
			...[2, 3, 6, 9, 10, 10, 13, 14].map((n) => user.day(n)),
			vpnDate
		];
		const within = (from: string, to: string) => dates.filter((d) => d >= from && d <= to).length;
		return {
			...user,
			lastWeek: within(week.from, week.to),
			thisMonth: within(`${user.month}-01`, `${user.month}-31`)
		};
	}

	const list = (page: Page) => page.locator('[data-phone-list]');
	const pDay = (page: Page, date: string) =>
		list(page).getByRole('region', { name: dayLabel(date), exact: true });
	const pRows = (page: Page) => list(page).getByRole('listitem');
	const pRow = (page: Page, text: string) => pRows(page).filter({ hasText: text });
	const more = (r: Locator) => r.getByRole('button', { name: /^Actions for/ });
	const trigger = (page: Page) => page.getByRole('button', { name: /^Filter/ });
	const sheet = (page: Page) => page.getByRole('dialog', { name: 'Filter' });
	const selectButton = (page: Page) => page.getByRole('button', { name: 'Select', exact: true });
	const plus = (page: Page) => page.getByRole('link', { name: 'New entry', exact: true });
	const entries = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

	async function box(l: Locator) {
		const b = await l.boundingBox();
		if (!b) throw new Error('not shown');
		return b;
	}
	type Box = { x: number; width: number };
	/** Two boxes share a column: their spans across the screen overlap. */
	const sameColumn = (a: Box, b: Box) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5;
	const style = (l: Locator, prop: string) =>
		l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

	test('a filter chip and Clear filters stay out of the "+"\'s column', async ({ page }) => {
		const user = await newMonth('phone-chip');
		await openEntries(page, user, `/entries?range=this-month&project=${user.projects.mobile}`);
		await expect(page.getByRole('list', { name: 'Filters' }).getByRole('listitem')).toHaveCount(1);
		const plusBox = await box(plus(page));
		for (const control of [
			page.getByRole('link', { name: 'Clear filters' }),
			page.getByRole('list', { name: 'Filters' }).getByRole('link', { name: /^Remove/ })
		]) {
			const b = await box(control);
			expect(b.x + b.width).toBeLessThanOrEqual(390 - 56);
			expect(sameColumn(b, plusBox)).toBe(false);
		}
	});

	test('Entries from the bottom bar: the toolbar, the day heads and rows that say what each entry was', async ({
		page
	}) => {
		const user = await phoneMonth('phone-read');
		startElsewhere(user.id, user.projects.website, zone, '11:00', 'Watching the deploy');
		await signIn(page, user.username);
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('link', { name: 'Entries' })
			.click();
		await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('table')).toHaveCount(0);

		await test.step('Filter and Select, the search under them, the count and total under that', async () => {
			const f = await box(trigger(page));
			const s = await box(selectButton(page));
			const q = await box(search(page));
			const t = await box(page.getByText(/^\d+ entries · \d+:\d{2}$/));
			expect(Math.abs(f.y - s.y)).toBeLessThan(1);
			expect(f.x).toBeLessThan(s.x);
			expect(f.width).toBeGreaterThan(s.width * 2);
			expect(q.y).toBeGreaterThanOrEqual(f.y + f.height);
			expect(t.y).toBeGreaterThanOrEqual(q.y + q.height);
		});

		await test.step('days as caps heads with their totals', async () => {
			const head = pDay(page, user.day(10)).getByRole('heading');
			await expect(head).toHaveText(dayLabel(user.day(10)));
			expect(await style(head, 'text-transform')).toBe('uppercase');
			await expect(pDay(page, user.day(10)).locator('[data-day-total]')).toHaveText('2:00');
		});

		await test.step('rows of 64 px with the bar, a leading ⋯, the times, the lines and the duration', async () => {
			const heights = await pRows(page).evaluateAll((els) =>
				els.map((el) => el.getBoundingClientRect().height)
			);
			expect(heights.length).toBe(user.thisMonth + 1);
			for (const h of heights) expect(h).toBeGreaterThanOrEqual(64);

			const r = pRow(page, 'Fixed the login form');
			expect(await style(r, 'border-left-width')).toBe('4px');
			const dots = await box(more(r));
			const start = await box(r.locator('[data-start]'));
			const end = await box(r.locator('[data-end]'));
			const what = await box(r.locator('[data-what]'));
			const span = await box(r.locator('[data-duration]'));
			expect(dots.x).toBeLessThan(start.x);
			expect(dots.width).toBeGreaterThanOrEqual(44);
			await expect(r.locator('[data-start]')).toHaveText('09:00');
			await expect(r.locator('[data-end]')).toHaveText('10:30');
			expect(end.y).toBeGreaterThan(start.y);
			expect(start.x).toBeLessThan(what.x);
			expect(span.x).toBeGreaterThan(what.x);
			await expect(r.locator('[data-duration]')).toHaveText('1:30');
			await expect(r).toContainText('Acme › Website');
			await expect(r).toContainText('Development · Office · T-101');

			const running = pRow(page, 'Watching the deploy');
			const runningMark = running.getByText('Running', { exact: true });
			await expect(runningMark).toBeVisible();
			expect(await style(runningMark, 'text-transform')).toBe('uppercase');
			expect((await box(runningMark)).y).toBeGreaterThan(
				(await box(running.locator('[data-start]'))).y
			);

			const overlap = pRow(page, 'Looked into the overlap warning');
			await expect(overlap).toContainText('Overlaps another entry');
			expect(await style(overlap, 'border-top-width')).toBe('2px');
		});

		await test.step('nothing sits in the column of the "+"', async () => {
			const p = await box(plus(page));
			for (const control of [trigger(page), selectButton(page), search(page)]) {
				expect(sameColumn(await box(control), p)).toBe(false);
			}
			const spans = await list(page)
				.locator('[data-duration]')
				.evaluateAll((els) =>
					els.map((el) => {
						const b = el.getBoundingClientRect();
						return { x: b.x, width: b.width };
					})
				);
			expect(spans.length).toBe(user.thisMonth + 1);
			for (const s of spans) expect(sameColumn(s, p)).toBe(false);
			const wide = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);
			expect(wide).toBe(false);
		});
	});

	test('the filter sheet applies at once; Show, the scrim, Escape and Back close it; search VPN', async ({
		page
	}) => {
		const user = await phoneMonth('phone-filter');
		await openEntries(page, user);

		await trigger(page).click();
		await expect(sheet(page)).toBeVisible();
		const s = await box(sheet(page));
		expect(Math.round(s.y + s.height)).toBe(844);
		await expect(
			sheet(page).getByRole('button', { name: `Show ${entries(user.thisMonth)}` })
		).toBeVisible();

		await sheet(page).getByText('Last week', { exact: true }).click();
		await expect(page).toHaveURL(/range=last-week/);
		await expect(sheet(page)).toBeVisible();
		await expect(
			sheet(page).getByRole('button', { name: `Show ${entries(user.lastWeek)}` })
		).toBeVisible();
		await sheet(page).getByRole('button', { name: /^Show/ }).click();
		await expect(sheet(page)).toBeHidden();
		await expect(trigger(page)).toContainText('Last week');
		await expect(pRows(page)).toHaveCount(user.lastWeek);

		await test.step('a tap on the scrim keeps the choice', async () => {
			await trigger(page).click();
			await sheet(page).getByText('Last month', { exact: true }).click();
			await expect(page).toHaveURL(/range=last-month/);
			await page.mouse.click(195, 40);
			await expect(sheet(page)).toBeHidden();
			await expect(trigger(page)).toContainText('Last month');
		});

		await test.step('Escape and Back close it too, the table kept', async () => {
			await trigger(page).click();
			await expect(sheet(page)).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(sheet(page)).toBeHidden();
			await expect(trigger(page)).toBeFocused();

			await trigger(page).click();
			await expect(sheet(page)).toBeVisible();
			await page.goBack({ waitUntil: 'commit' });
			await expect(sheet(page)).toBeHidden();
			await expect(page).toHaveURL(/range=last-month/);
			await expect(trigger(page)).toContainText('Last month');
		});

		await test.step('search VPN in last week', async () => {
			await trigger(page).click();
			await sheet(page).getByText('Last week', { exact: true }).click();
			await expect(page).toHaveURL(/range=last-week/);
			await sheet(page).getByRole('button', { name: /^Show/ }).click();
			await search(page).fill('VPN');
			await expect(page).toHaveURL(/q=VPN/);
			await expect(pRows(page)).toHaveCount(1);
			await expect(pRow(page, 'Set up the VPN')).toContainText('Northwind › Mobile app');
		});
	});

	test('a row opens its form as a sheet; ⋯ opens a sheet naming the row; Copy and Restart', async ({
		page
	}) => {
		const user = await phoneMonth('phone-menu');
		await openEntries(page, user);

		await pRow(page, 'Planned the release')
			.getByRole('link', { name: /Planned the release/ })
			.click();
		const form = page.getByRole('dialog', { name: 'Edit entry' });
		await expect(form).toBeVisible();
		await expect(form.getByLabel('Description')).toHaveValue('Planned the release');
		await form.getByRole('button', { name: 'Cancel' }).click();
		await expect(form).toBeHidden();

		await test.step('⋯ opens the sheet headed by its row; Copy opens the form', async () => {
			await more(pRow(page, 'Filed the receipts')).click();
			const menu = page.getByRole('dialog', { name: 'Acme › Operations' });
			await expect(menu).toBeVisible();
			await expect(menu).toContainText(`${dayLabel(user.day(6))} · 13:00–15:00`);
			const s = await box(menu);
			expect(Math.round(s.y + s.height)).toBe(844);
			const items = menu.locator('[data-menu-item]');
			await expect(items).toHaveText(['Restart', 'Copy', 'Edit', 'Delete']);
			for (const h of await items.evaluateAll((els) =>
				els.map((el) => el.getBoundingClientRect().height)
			))
				expect(h).toBeGreaterThanOrEqual(48);

			await menu.getByRole('link', { name: 'Copy' }).click();
			const copy = page.getByRole('dialog', { name: 'New entry' });
			await expect(copy).toBeVisible();
			await expect(menu).toBeHidden();
			await expect(copy.getByLabel('Description')).toHaveValue('Filed the receipts');
			await copy.getByRole('button', { name: 'Cancel' }).click();
			await expect(copy).toBeHidden();
		});

		await test.step('Restart from the ⋯ sheet runs it in the timer bar (call 17)', async () => {
			await more(pRow(page, 'Built the login screen')).click();
			const menu = page.getByRole('dialog', { name: 'Northwind › Mobile app' });
			await menu.getByRole('button', { name: 'Restart' }).click();
			await expect(menu).toBeHidden();
			await expect(bar(page)).toContainText('Northwind › Mobile app');
			await expect(strip(page)).toContainText('Start timer on');

			const running = pRows(page).filter({ hasText: 'Running' });
			await expect(running).toHaveCount(1);
			await more(running).click();
			const restart = page
				.getByRole('dialog', { name: 'Northwind › Mobile app' })
				.getByRole('button', { name: /Restart/ });
			await expect(restart).toBeDisabled();
			await expect(restart).toContainText('Already running');
		});
	});

	test('Select ticks rows; the bulk bar edits them in a sheet; Undo; Done clears the ticks', async ({
		page
	}) => {
		const user = await phoneMonth('phone-select');
		await openEntries(page, user);
		await expect(plus(page)).toBeVisible();

		await selectButton(page).click();
		await expect(bulk(page)).toBeVisible();
		// Nothing ticked yet: the actions are off, so no "Edit 0 entries".
		await expect(bulk(page).getByRole('button', { name: 'Edit…' })).toBeDisabled();
		await expect(bulk(page).getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
		await bulk(page).getByRole('button', { name: 'Edit…' }).click({ force: true });
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(trigger(page)).toBeHidden();
		await expect(plus(page)).toBeHidden();
		await expect(list(page).getByRole('button', { name: /^Actions for/ })).toHaveCount(0);
		await expect(
			pDay(page, user.day(10)).getByRole('checkbox', {
				name: `Select ${dayLabel(user.day(10))}`,
				exact: true
			})
		).toBeVisible();

		await pRow(page, 'Filed the receipts').getByRole('checkbox').check();
		await pRow(page, 'Planned the release').getByRole('checkbox').check();
		// "2 selected" over the total and the set it acts on.
		const lines = bulk(page).locator('p').first().locator(':scope > span');
		await expect(lines.nth(0)).toHaveText('2 selected', { useInnerText: true });
		await expect(lines.nth(1)).toHaveText('4:00 · This month', { useInnerText: true });
		expect((await box(lines.nth(1))).y).toBeGreaterThan((await box(lines.nth(0))).y);
		for (const name of ['Edit…', 'Delete', 'Done']) {
			await expect(bulk(page).getByRole('button', { name, exact: true })).toBeVisible();
		}

		await bulk(page).getByRole('button', { name: 'Edit…' }).click();
		const dialog = bulkDialog(page, 2);
		await expect(dialog).toBeVisible();
		const s = await box(dialog);
		expect(Math.round(s.y + s.height)).toBe(844);
		await dialog.getByLabel('Activity').selectOption({ label: 'Research' });
		await dialog.getByRole('button', { name: 'Apply to 2 entries' }).click();
		await expect(dialog).toBeHidden();
		await expect(strip(page)).toContainText('Done: Edit 2 entries.');
		await expect(pRow(page, 'Filed the receipts')).toContainText('Research');
		await expect(pRow(page, 'Planned the release')).toContainText('Research');
		await expect(pRow(page, 'Filed the receipts').getByRole('checkbox')).not.toBeChecked();

		await strip(page).getByRole('button', { name: 'Undo' }).click();
		await expect(strip(page)).toContainText('Undone.');
		await expect(pRow(page, 'Filed the receipts')).not.toContainText('Research');
		await expect(pRow(page, 'Planned the release')).toContainText('Meeting');

		await pRow(page, 'Filed the receipts').getByRole('checkbox').check();
		await expect(lines.nth(0)).toHaveText('1 selected', { useInnerText: true });
		await bulk(page).getByRole('button', { name: 'Done' }).click();
		await expect(bulk(page)).toBeHidden();
		await expect(trigger(page)).toBeVisible();
		await expect(plus(page)).toBeVisible();
		await expect(list(page).getByRole('checkbox')).toHaveCount(0);
		await selectButton(page).click();
		await expect(pRow(page, 'Filed the receipts').getByRole('checkbox')).not.toBeChecked();
	});

	test('a long Customer › project wraps to a second line, not cut', async ({ page }) => {
		const user = await phoneMonth('phone-long');
		seedLongProject(user);
		await openEntries(page, user);
		const name = pRow(page, 'Went through the long chain').locator('[data-what] > span').first();
		await expect(name).toHaveText('CompX › ClientY – ProjectZ');
		const fit = await name.evaluate((el) => ({
			cut: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
			lines: Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight))
		}));
		expect(fit).toEqual({ cut: false, lines: 2 });
	});

	test('in Select, a row ticked far down the month keeps the bulk bar in view, rows still tickable', async ({
		page
	}) => {
		const user = await gateMonth('ph-bulk-view');
		await openEntries(page, user, user.path);
		await selectButton(page).click();
		await expect(bulk(page)).toBeVisible();
		const boxOf = (date: string) =>
			pDay(page, date).getByRole('listitem').first().getByRole('checkbox');

		const far = boxOf(weekdayBack(user.today, 14));
		await far.scrollIntoViewIfNeeded();
		await far.check();
		expect(await scrollTop(page)).toBeGreaterThan(1500);
		await expect(bulk(page)).toContainText('1 selected');

		const strip = await rect(bar(page));
		const foot = await rect(page.getByRole('navigation', { name: 'Main' }));
		await bulkInView(page, strip.y + strip.height, foot.y, 1);
		// Done stays in reach too.
		expect(await onTop(bulk(page).getByRole('button', { name: 'Done' }))).toBe(true);

		await ticksUnderBand(page, boxOf(weekdayBack(user.today, 9)), 844);
		await expect(bulk(page)).toContainText('2 selected');
		await bulkInView(page, strip.y + strip.height, foot.y, 2);

		await test.step('Done leaves the page where it is, the focus in view', async () => {
			const before = await scrollTop(page);
			const lastRow = pDay(page, weekdayBack(user.today, 9)).getByRole('listitem').first();
			const rowAt = (await rect(lastRow)).y;
			await bulk(page).getByRole('button', { name: 'Done' }).click();
			await expect(bulk(page)).toBeHidden();
			await expect(
				pDay(page, weekdayBack(user.today, 9))
					.getByRole('listitem')
					.first()
					.getByRole('button', {
						name: /^Actions for/
					})
			).toBeFocused();
			// The rows stay still: the scroll moves only by scroll anchoring's correction for
			// the toolbar taking the bar's place at the top, never back up the month.
			// Within the day heads' own change: a head's tick box goes with Select (13 px).
			expect(Math.abs((await rect(lastRow)).y - rowAt)).toBeLessThan(20);
			expect(Math.abs((await scrollTop(page)) - before)).toBeLessThan(20);
			expect(await focusInView(page)).toBe(true);
		});
	});

	test('a meta part wider than the column breaks inside the row, no sideways scroll', async ({
		page
	}) => {
		const user = await gateMonth('phone-long-part');
		await openEntries(page, user, user.path);
		const lines = list(page).locator('[data-what] > span').filter({ hasText: /T-\d+/ });
		expect(await lines.count()).toBeGreaterThan(0);
		// A reference like a URL: one unbroken part far wider than the 390 px column.
		const long = 'https://example.test/tickets/' + 'x'.repeat(120);
		const report = await lines.first().evaluate((el, text) => {
			const parts = el.querySelectorAll(':scope > span');
			parts[parts.length - 1]!.textContent = text;
			const row = el.closest('li')!.getBoundingClientRect();
			const own = el.getBoundingClientRect();
			return {
				rowInside: row.right <= window.innerWidth + 0.5,
				lineInside: own.right <= row.right + 0.5,
				noSideways: document.documentElement.scrollWidth <= window.innerWidth
			};
		}, long);
		expect(report).toEqual({ rowInside: true, lineInside: true, noSideways: true });
	});

	test('every row shows its activity, location and reference in full, wrapping', async ({
		page
	}) => {
		const user = await gateMonth('phone-refs');
		await openEntries(page, user, user.path);
		const lines = list(page).locator('[data-what] > span').filter({ hasText: /T-\d+/ });
		expect(await lines.count()).toBeGreaterThan(3);
		const report = await lines.evaluateAll((els) =>
			els.map((el) => {
				const row = el.closest('li')!.getBoundingClientRect();
				const own = el.getBoundingClientRect();
				const text = [...el.childNodes].flatMap((n) =>
					n.nodeType === Node.TEXT_NODE ? [n] : [...n.childNodes]
				);
				const node = text.find((n) => /T-\d+/.test(n.textContent ?? ''))!;
				const at = node.textContent!.search(/T-\d+/);
				const range = document.createRange();
				range.setStart(node, at);
				range.setEnd(node, at + node.textContent!.match(/T-\d+/)![0].length);
				const ref = range.getBoundingClientRect();
				const right = Math.min(own.right, row.right) + 0.5;
				return {
					line: el.textContent,
					cut: el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 0.5,
					ellipsis: getComputedStyle(el).textOverflow === 'ellipsis',
					shown:
						ref.width > 0 &&
						ref.left >= own.left - 0.5 &&
						ref.right <= right &&
						ref.bottom <= row.bottom + 0.5
				};
			})
		);
		for (const r of report)
			expect(r).toEqual({ line: r.line, cut: false, ellipsis: false, shown: true });

		/** Each element's text is whole: not clipped, not ellipsised, inside its row or bar. */
		const whole = (l: Locator) =>
			l.evaluateAll((els) =>
				els.map((el) => {
					const own = el.getBoundingClientRect();
					const box = (el.closest('li') ?? el.closest('section'))!.getBoundingClientRect();
					return {
						line: el.textContent,
						cut: el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 0.5,
						ellipsis: getComputedStyle(el).textOverflow === 'ellipsis',
						inside: own.right <= box.right + 0.5 && own.bottom <= box.bottom + 0.5
					};
				})
			);
		const ok = (r: { line: string | null }) => ({
			line: r.line,
			cut: false,
			ellipsis: false,
			inside: true
		});

		await test.step('no muted line and no description is cut, however long', async () => {
			const muted = list(page).locator('[data-what] > span.text-muted-foreground');
			// Every row has a description, and most an activity · location line too.
			expect(await muted.count()).toBeGreaterThan(await pRows(page).count());
			for (const r of await whole(muted)) expect(r).toEqual(ok(r));
		});

		await test.step("in Select, the bar's set line (the custom range) is not cut", async () => {
			await selectButton(page).click();
			await pRows(page).first().getByRole('checkbox').check();
			const set = bulk(page).locator('p > span').nth(1);
			await expect(set).toContainText(`${user.from} – ${user.today}`);
			for (const r of await whole(set)) expect(r).toEqual(ok(r));
			await bulk(page).getByRole('button', { name: 'Done' }).click();
		});

		await test.step('rows stay 64 px and durations keep out of the "+"\'s column', async () => {
			const heights = await pRows(page).evaluateAll((els) =>
				els.map((el) => el.getBoundingClientRect().height)
			);
			for (const h of heights) expect(h).toBeGreaterThanOrEqual(64);
			const p = await box(plus(page));
			const spans = await list(page)
				.locator('[data-duration]')
				.evaluateAll((els) =>
					els.map((el) => {
						const b = el.getBoundingClientRect();
						return { x: b.x, width: b.width };
					})
				);
			for (const s of spans) expect(sameColumn(s, p)).toBe(false);
		});
	});

	test('ticked rows take the accent fill; an unticked box has a 3:1 stroke in both themes', async ({
		page
	}) => {
		const user = await phoneMonth('phone-shade');
		await openEntries(page, user);
		await selectButton(page).click();
		await pRow(page, 'Filed the receipts').getByRole('checkbox').check();
		const accent = await colourOf(page, 'var(--accent)');
		const background = (text: string) =>
			pRow(page, text).evaluate((el) => getComputedStyle(el).backgroundColor);
		await expect.poll(() => background('Filed the receipts')).toBe(accent);
		expect(await background('Planned the release')).not.toBe(accent);

		for (const colorScheme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme });
			const box = pRow(page, 'Planned the release').getByRole('checkbox');
			const stroke = await box.evaluate((el) => getComputedStyle(el, '::before').borderTopColor);
			const fill = await box.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
			const ground = await colourOf(page, 'var(--background)');
			const shaded = await colourOf(page, 'var(--accent)');
			for (const against of [fill, ground, shaded]) {
				expect(
					contrast(stroke, against),
					`${colorScheme} ${stroke} on ${against}`
				).toBeGreaterThanOrEqual(3);
			}
		}
	});

	test('Delete in the row sheet is red', async ({ page }) => {
		const user = await phoneMonth('phone-red');
		await openEntries(page, user);
		await more(pRow(page, 'Filed the receipts')).click();
		const sheetMenu = page.getByRole('dialog', { name: 'Acme › Operations' });
		const red = await colourOf(page, 'var(--destructive)');
		const del = sheetMenu.getByRole('button', { name: 'Delete' });
		expect(await del.evaluate((el) => getComputedStyle(el).color)).toBe(red);
	});

	test('the Edit sheet shows Cancel and Apply as it opens', async ({ page }) => {
		const user = await phoneMonth('phone-foot');
		await openEntries(page, user);
		await selectButton(page).click();
		await pRow(page, 'Filed the receipts').getByRole('checkbox').check();
		await pRow(page, 'Planned the release').getByRole('checkbox').check();
		await bulk(page).getByRole('button', { name: 'Edit…' }).click();
		const dialog = bulkDialog(page, 2);
		await expect(dialog).toBeVisible();
		for (const name of ['Cancel', 'Apply to 2 entries']) {
			const b = await box(dialog.getByRole('button', { name, exact: true }));
			expect(b.y + b.height, name).toBeLessThanOrEqual(844);
			expect(b.height).toBeGreaterThanOrEqual(44);
		}
		// The fields scroll above the foot; the foot stays put.
		const apply = dialog.getByRole('button', { name: 'Apply to 2 entries' });
		const before = await box(apply);
		await dialog.getByLabel('Replace with').scrollIntoViewIfNeeded();
		expect((await box(apply)).y).toBe(before.y);
	});

	test('focus: Done to Select; a done action to Undo', async ({ page }) => {
		const user = await phoneMonth('phone-focus');
		await openEntries(page, user);

		await test.step('Done', async () => {
			await selectButton(page).click();
			await pRow(page, 'Filed the receipts').getByRole('checkbox').check();
			// From the top, where Select comes back in view (a month down, see the far-down test).
			await page.evaluate(() => window.scrollTo(0, 0));
			await bulk(page).getByRole('button', { name: 'Done' }).click();
			await expect(selectButton(page)).toBeFocused();
		});

		await test.step('a done bulk Delete', async () => {
			await selectButton(page).click();
			await pRow(page, 'Filed the receipts').getByRole('checkbox').check();
			await bulk(page).getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(strip(page)).toContainText('Done: Delete 1 entry.');
			await expect(undo(page)).toBeFocused();
		});

		await test.step('a done bulk Apply', async () => {
			await pRow(page, 'Planned the release').getByRole('checkbox').check();
			await bulk(page).getByRole('button', { name: 'Edit…' }).click();
			const dialog = bulkDialog(page, 1);
			await dialog.getByLabel('Activity').selectOption({ label: 'Research' });
			await dialog.getByRole('button', { name: 'Apply to 1 entry' }).click();
			await expect(strip(page)).toContainText('Done: Edit 1 entry.');
			await expect(undo(page)).toBeFocused();
			await bulk(page).getByRole('button', { name: 'Done' }).click();
		});

		await test.step('⋯ Delete', async () => {
			await more(pRow(page, 'Built the login screen')).click();
			await page
				.getByRole('dialog', { name: 'Northwind › Mobile app' })
				.getByRole('button', { name: 'Delete' })
				.click();
			await expect(strip(page)).toContainText('Done: Delete entry');
			await expect(undo(page)).toBeFocused();
		});
	});

	test('the filter sheet lays its presets out two to a row, Custom range across', async ({
		page
	}) => {
		const user = await phoneMonth('phone-presets');
		await openEntries(page, user);
		await trigger(page).click();
		const choices = await sheet(page)
			.getByRole('group', { name: 'Time range' })
			.locator('label')
			.evaluateAll((els) =>
				els.map((el) => {
					const r = el.getBoundingClientRect();
					return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: r.height };
				})
			);
		expect(choices).toHaveLength(7);
		const [a, b] = choices;
		for (let i = 0; i < 6; i += 2) {
			expect(choices[i].y).toBe(choices[i + 1].y);
			expect(choices[i].x).toBe(a.x);
			expect(choices[i + 1].x).toBe(b.x);
			expect(choices[i].w).toBe(a.w);
			expect(choices[i + 1].w).toBe(a.w);
		}
		expect(b.x).toBeGreaterThan(a.x + a.w - 1);
		const custom = choices[6];
		expect(custom.x).toBe(a.x);
		expect(custom.w).toBe(b.x + b.w - a.x);
		for (const c of choices) expect(c.h).toBeGreaterThanOrEqual(44);
		// Each name on one line ("This week" never broken over two).
		const names = await sheet(page)
			.getByRole('group', { name: 'Time range' })
			.locator('label > span:first-of-type')
			.evaluateAll((els) =>
				els.map((el) => el.getClientRects().length === 1 && el.getBoundingClientRect().height < 30)
			);
		expect(names).toEqual(Array(7).fill(true));
	});

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		test('Select is a link that reloads with tick boxes; Delete posts them', async ({ page }) => {
			const user = await phoneMonth('phone-nojs');
			await openEntries(page, user, '/entries', false);

			await expect(list(page).getByRole('checkbox')).toHaveCount(0);
			const select = page.getByRole('link', { name: 'Select', exact: true });
			await expect(select).toHaveAttribute('href', /[?&]select=1/);
			await select.click();
			await expect(page).toHaveURL(/select=1/);
			await expect(page.getByRole('link', { name: 'Done', exact: true })).toBeVisible();

			await pRow(page, 'Filed the receipts').getByRole('checkbox').check();
			await pRow(page, 'Planned the release').getByRole('checkbox').check();
			await bulk(page).getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(strip(page)).toContainText('Done: Delete 2 entries.');
			await expect(pRow(page, 'Filed the receipts')).toHaveCount(0);

			// The filter is a disclosure with Show.
			await page.locator('summary', { hasText: 'Filter' }).click();
			await expect(panel(page).getByRole('button', { name: 'Show' })).toBeVisible();
		});
	});
});

test.describe('the first load', () => {
	/**
	 * Nothing changes size when the script arrives: the no-JS parts (the bulk bar, the
	 * head's Select all) are hidden from the first paint, so a row under the pointer stays
	 * put. The script is held back until the server's page has been measured.
	 */
	test('the rows stay put while the page hydrates, and no bulk bar shows', async ({ page }) => {
		const user = await newMonth('no-shift');
		await signIn(page, user.username);
		await page.waitForLoadState('networkidle');

		let release = () => {};
		const held = new Promise<void>((r) => (release = r));
		await page.route('**/_app/immutable/**/*.js', async (route) => {
			await held;
			await route.continue();
		});
		await page.goto('/entries', { waitUntil: 'domcontentloaded' });
		const first = page.locator('tbody tr:visible, [data-phone-list] li:visible').nth(1);
		await expect(first).toBeVisible();
		const before = await first.boundingBox();
		await expect(bulk(page)).toBeHidden();
		await expect(page.getByRole('link', { name: 'Select all' })).toBeHidden();

		release();
		// Hydrated: Select is the script's button (it carries `data-select`).
		await expect(page.locator('[data-select]')).toHaveCount(1);
		await page.waitForLoadState('networkidle');
		const after = await first.boundingBox();
		expect(after?.y).toBe(before?.y);
		expect(after?.height).toBe(before?.height);
		await expect(bulk(page)).toBeHidden();
	});
});
