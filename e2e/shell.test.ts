import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { barItems, moreItems, sidebarItems, type NavItem } from '../src/lib/shell';
import { PASSWORD, dateIn, noonZone, seedEmptyUser, seedUser, startElsewhere } from './seed';

const zone = noonZone();
test.use({ timezoneId: zone });

const isPc = () => test.info().project.name === 'pc';

async function signIn(page: Page, username: string, password = PASSWORD) {
	await rememberZone(page.context());
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

const rememberZone = (context: BrowserContext) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

const main = (page: Page) => page.getByRole('navigation', { name: 'Main' });
/** More's trigger: a button with the script, the <details>' summary without. */
const more = (page: Page) => main(page).locator('summary, button', { hasText: 'More' });
/** What More lists: its sheet with the script, the nav's own <details> without. */
const sheet = (page: Page) => page.getByRole('dialog', { name: 'More' });

/** Opens an item from the navigation: the sidebar on the PC, the bar or More on the phone. */
async function open(page: Page, item: NavItem) {
	const inMore = !isPc() && !barItems().some((i) => i.route === item.route);
	if (inMore) await more(page).click();
	const link = (inMore ? sheet(page) : main(page)).getByRole('link', {
		name: item.label,
		exact: true
	});
	await link.click();
	await expect(page.getByRole('heading', { name: item.label, level: 1 })).toBeVisible();
	if (!inMore) {
		await expect(link).toHaveAttribute('aria-current', 'page');
		return;
	}
	// More closes on navigation; its cell is current, and so is the item in the reopened sheet.
	await expect(sheet(page)).toBeHidden();
	await expect(more(page)).toHaveAttribute('aria-current', 'true');
	await more(page).click();
	await expect(link).toHaveAttribute('aria-current', 'page');
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
}

async function signOutIsThere(page: Page) {
	if (!isPc()) await more(page).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
	if (!isPc()) await page.keyboard.press('Escape');
}

test('every screen is reachable from the navigation', async ({ page }) => {
	const user = await seedEmptyUser(`${test.info().project.name}-shell`);
	await signIn(page, user.username);
	const items = isPc() ? sidebarItems(false) : [...barItems(), ...moreItems(false)];
	for (const item of items) await open(page, item);
	await signOutIsThere(page);
	await expect(main(page).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
});

test('an admin also reaches Users and Backup', async ({ page }) => {
	await signIn(page, 'admin', 'admin-password-1');
	const admin = sidebarItems(true).filter((i) => i.route.startsWith('/(app)/admin'));
	expect(admin.map((i) => i.label)).toEqual(['Users', 'Backup']);
	for (const item of admin) await open(page, item);
});

test("the screen's title is its one h1", async ({ page }) => {
	const user = await seedEmptyUser(`${test.info().project.name}-title`);
	await signIn(page, user.username);
	await page.goto('/reports');
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reports');
});

test('the bar has four equal cells and More lists the items in order', async ({ page }) => {
	test.skip(isPc(), 'the phone’s bar');
	await page.setViewportSize({ width: 390, height: 844 });
	const user = await seedEmptyUser('phone-more-list');
	await signIn(page, user.username);
	const cells = main(page).locator('li');
	await expect(cells).toHaveCount(4);
	const widths = await cells.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
	for (const w of widths) expect(Math.abs(w - widths[0])).toBeLessThan(1);
	await expect(main(page).locator('li > a, li > button')).toHaveText([
		/Today/,
		/Calendar/,
		/Entries/,
		/More/
	]);
	await more(page).click();
	await expect(sheet(page)).toBeVisible();
	await expect(sheet(page).getByRole('heading', { name: 'More' })).toBeAttached();
	await expect(sheet(page).getByRole('link')).toHaveText(
		moreItems(false).map((i) => new RegExp(`^\\s*${i.label}\\s*$`))
	);
	// Each row is 48 px; the sheet sits above the bar.
	const row = (await sheet(page).getByRole('link').first().boundingBox())!;
	expect(row.height).toBeGreaterThanOrEqual(48);
	const box = (await sheet(page).boundingBox())!;
	const nav = (await main(page).boundingBox())!;
	expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
});

test('Templates is two taps away and More is current there', async ({ page }) => {
	test.skip(isPc(), 'the phone’s More');
	const user = await seedEmptyUser('phone-more-templates');
	await signIn(page, user.username);
	await more(page).click();
	await sheet(page).getByRole('link', { name: 'Templates', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Templates', level: 1 })).toBeVisible();
	await expect(sheet(page)).toBeHidden();
	await expect(more(page)).toHaveAttribute('aria-current', 'true');
	// A sub-screen of Templates keeps More current.
	await page.goto('/templates/new');
	await expect(more(page)).toHaveAttribute('aria-current', 'true');
});

test('More closes when an item is chosen', async ({ page }) => {
	test.skip(isPc(), 'the phone’s More');
	const user = await seedEmptyUser('phone-more');
	await signIn(page, user.username);
	await more(page).click();
	await sheet(page).getByRole('link', { name: 'Reports', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeHidden();
});

test('Escape closes More and returns focus to it', async ({ page }) => {
	test.skip(isPc(), 'the phone’s More');
	const user = await seedEmptyUser('phone-more-escape');
	await signIn(page, user.username);
	await more(page).click();
	await sheet(page).getByRole('link', { name: 'Reports', exact: true }).focus();
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
	await expect(more(page)).toBeFocused();
});

test('a tap on the scrim closes More and returns focus to it', async ({ page }) => {
	test.skip(isPc(), 'the phone’s More');
	const user = await seedEmptyUser('phone-more-scrim');
	await signIn(page, user.username);
	await more(page).click();
	await expect(sheet(page)).toBeVisible();
	await page.mouse.click(195, 40);
	await expect(sheet(page)).toBeHidden();
	await expect(more(page)).toBeFocused();
});

test("the browser's Back closes More and leaves the screen as it was", async ({ page }) => {
	test.skip(isPc(), 'the phone’s More');
	const user = await seedEmptyUser('phone-more-back');
	await signIn(page, user.username);
	// In-app navigation, so Back is a popstate within the page, not a reload.
	await main(page).getByRole('link', { name: 'Entries', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
	await more(page).click();
	await expect(sheet(page)).toBeVisible();
	await page.goBack();
	await expect(sheet(page)).toBeHidden();
	await expect(page).toHaveURL(/\/entries$/);
	await expect(page.getByRole('heading', { name: 'Entries', level: 1 })).toBeVisible();
});

const bar = (page: Page) => page.getByRole('region', { name: 'Timer', exact: true });
const flash = (page: Page) => page.getByRole('status');

test('the bar says when nothing runs', async ({ page }) => {
	const user = await seedEmptyUser(`${test.info().project.name}-bar-none`);
	await signIn(page, user.username);
	for (const path of ['/', '/entries', '/reports']) {
		await page.goto(path);
		await expect(bar(page)).toHaveCount(1);
		await expect(bar(page)).toContainText('No timer running');
	}
});

test('a timer is stopped from the bar and undone where it was stopped', async ({ page }) => {
	const user = await seedUser(`${test.info().project.name}-bar-stop`, zone);
	await signIn(page, user.username);
	// Started from the bar's Start list, with the Standup template (Acme › Website).
	const list = page.locator('[data-start-list]:visible');
	await page.locator('[data-start-list]:visible > summary').click();
	await list.locator('summary', { hasText: 'Standup' }).click();
	await list.getByRole('textbox', { name: 'Description for Standup' }).fill('Bar timer');
	await list.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(bar(page)).toContainText('Website');

	await page.goto('/reports');
	await expect(bar(page)).toContainText('Website');
	await expect(bar(page)).toContainText(/\d+:\d\d:\d\d/);
	await bar(page)
		.getByRole('button', { name: /^Stop Website started/ })
		.click();
	await expect(page).toHaveURL(/\/reports$/);
	await expect(flash(page)).toContainText('Done: Stop timer');
	await expect(bar(page)).toContainText('No timer running');

	await flash(page).getByRole('button', { name: 'Undo' }).click();
	await expect(page).toHaveURL(/\/reports$/);
	await expect(flash(page)).toContainText('Undone.');
	await expect(bar(page)).toContainText('Website');
	await expect(bar(page).getByRole('button', { name: /^Stop Website/ })).toBeVisible();
});

test('several timers show as the newest plus a count', async ({ page }) => {
	const user = await seedUser(`${test.info().project.name}-bar-many`, zone);
	startElsewhere(user.id, user.projects.website, zone, '09:00', 'Older');
	startElsewhere(user.id, user.projects.mobile, zone, '10:00', 'Newer');
	await signIn(page, user.username);
	const url = `/entries?from=${dateIn(zone)}`;
	await page.goto(url);
	await expect(bar(page)).toContainText('Mobile app');
	const more = bar(page).locator('summary', { hasText: '+1' });
	await expect(more).toBeVisible();
	await more.click();
	await bar(page).getByRole('button', { name: 'Stop Website started 09:00' }).click();
	await expect(bar(page).locator('summary', { hasText: '+1' })).toHaveCount(0);
	expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(url);
	await expect(bar(page)).toContainText('Mobile app');
	// What shows, not the closed start list's template labels.
	await expect(bar(page)).not.toContainText('Website', { useInnerText: true });
});

test('a refused stop is shown', async ({ context }) => {
	const user = await seedUser(`${test.info().project.name}-bar-refused`, zone);
	startElsewhere(user.id, user.projects.mobile, zone, '09:00', 'Twice');
	const first = await context.newPage();
	await signIn(first, user.username);
	const second = await context.newPage();
	await first.goto('/reports');
	await second.goto('/reports');
	const stop = (page: Page) => bar(page).getByRole('button', { name: /^Stop Mobile app started/ });
	await stop(first).click();
	await expect(flash(first)).toContainText('Done: Stop timer');
	await stop(second).click();
	await expect(second.getByRole('alert')).toContainText('That timer is already stopped.');
	await expect(second).toHaveURL(/\/reports$/);
});

test('the bar never hides Stop or Save', async ({ page }) => {
	const user = await seedUser(`${test.info().project.name}-bar-room`, zone);
	startElsewhere(user.id, user.projects.mobile, zone, '09:00', 'x'.repeat(120));
	await page.setViewportSize({ width: 390, height: 844 });
	await signIn(page, user.username);
	const stop = bar(page).getByRole('button', { name: /^Stop Mobile app/ });
	await expect(stop).toBeInViewport({ ratio: 1 });
	const box = await stop.boundingBox();
	expect(box!.x + box!.width).toBeLessThanOrEqual(390);

	await page.goto(`/entries/${user.entries.toEdit}`);
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	const save = (await page.getByRole('button', { name: 'Save', exact: true }).boundingBox())!;
	const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
	expect(save.y + save.height).toBeLessThanOrEqual(nav.y);
});

test("the bar uses the project's colour", async ({ page }) => {
	const user = await seedUser(`${test.info().project.name}-bar-colour`, zone);
	startElsewhere(user.id, user.projects.website, zone, '09:00', 'One');
	startElsewhere(user.id, user.projects.mobile, zone, '10:00', 'Two');
	await signIn(page, user.username);
	await bar(page).locator('summary', { hasText: '+1' }).click();
	const dots = bar(page).locator('[data-project-dot]');
	await expect(dots).toHaveCount(2);
	const colours = await dots.evaluateAll((els) =>
		els.map((el) => getComputedStyle(el).backgroundColor)
	);
	expect(colours[0]).not.toBe(colours[1]);
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the bar stops and undoes as plain posts', async ({ page }) => {
		const user = await seedUser(`${test.info().project.name}-bar-nojs`, zone);
		startElsewhere(user.id, user.projects.website, zone, '09:00', 'Older');
		startElsewhere(user.id, user.projects.mobile, zone, '10:00', 'Newer');
		await signIn(page, user.username);
		await page.goto('/reports');
		await bar(page).locator('summary', { hasText: '+1' }).click();
		await bar(page).getByRole('button', { name: 'Stop Website started 09:00' }).click();
		await expect(page).toHaveURL(/\/reports$/);
		await expect(flash(page)).toContainText('Done: Stop timer');
		await expect(bar(page).locator('summary', { hasText: '+1' })).toHaveCount(0);
		await flash(page).getByRole('button', { name: 'Undo' }).click();
		await expect(flash(page)).toContainText('Undone.');
		await expect(bar(page).locator('summary', { hasText: '+1' })).toBeVisible();
	});

	test('More opens and its items work', async ({ page }) => {
		test.skip(isPc(), 'the phone’s More');
		const user = await seedEmptyUser('phone-more-nojs');
		await signIn(page, user.username);
		await more(page).click();
		const names = await main(page).locator('details').getByRole('link').allInnerTexts();
		expect(names.map((n) => n.trim())).toEqual(moreItems(false).map((i) => i.label));
		await main(page).getByRole('link', { name: 'History', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'History', level: 1 })).toBeVisible();
		await more(page).click();
		await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
	});
});

/** The control's box lies below the phone's top band and above its bottom bar. */
async function expectClear(page: Page, control: Locator) {
	const box = await control.boundingBox();
	// The sticky top bar with the timer strip, and the visible Main nav (the bottom bar).
	const band = await page.locator('div.sticky').first().boundingBox();
	const bar = await page.locator('nav[aria-label="Main"]:visible').boundingBox();
	// A pixel of slack: the browser rounds the scroll position.
	expect(box!.y).toBeGreaterThanOrEqual(band!.y + band!.height - 1);
	expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y);
}

test('focus lands clear of the sticky bars', async ({ page }) => {
	test.skip(isPc(), 'the phone has the top band and the bottom bar');
	const user = await seedUser(`${test.info().project.name}-focus`, zone);
	await signIn(page, user.username);
	await page.goto(`/entries/${user.entries.toEdit}`);
	await page.getByLabel('End', { exact: true }).fill(`${user.today}T05:00`);
	// Left first, so its message is shown before the click (else the form grows between the
	// press and the release, and the release can land beside Save).
	await page.getByLabel('End', { exact: true }).blur();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	// A refused save focuses the field the core refused.
	const invalid = page.locator('main form [aria-invalid="true"]').first();
	await expect(invalid).toBeFocused();
	await expectClear(page, invalid);

	// Scrolled to the bottom, bringing it back the nearest way (as Tab does) stops short of
	// the top band.
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await invalid.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
	await expectClear(page, invalid);
});

test.describe('the sign-in page', () => {
	test('is a card on the ground, with no dark bar', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
		const rail = await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.background = 'var(--sidebar)';
			document.body.append(probe);
			const colour = getComputedStyle(probe).backgroundColor;
			probe.remove();
			return colour;
		});
		const colours = await page
			.locator('body, body *')
			.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
		expect(colours).not.toContain(rail);
	});

	test('a refused sign-in keeps the username and focuses the password', async ({ page }) => {
		const user = await seedEmptyUser(`${test.info().project.name}-refused`);
		await page.goto('/login');
		await page.getByLabel('Username').fill(user.username);
		await page.getByLabel('Password', { exact: true }).fill('not-the-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByText('Wrong username or password.')).toBeVisible();
		await expect(page.getByLabel('Username')).toHaveValue(user.username);
		await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
	});

	test('the eye shows and hides the password and keeps the focus', async ({ page }) => {
		await page.goto('/login');
		const field = page.getByLabel('Password', { exact: true });
		await field.focus();
		await page.getByRole('button', { name: 'Show password' }).click();
		await expect(field).toBeFocused();
		await expect(field).toHaveAttribute('type', 'text');
		await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await page.getByRole('button', { name: 'Hide password' }).click();
		await expect(field).toHaveAttribute('type', 'password');
	});
});

test.describe('the error pages', () => {
	test('a refused page shows in the shell and leads back to Today', async ({ page }) => {
		const user = await seedEmptyUser(`${test.info().project.name}-denied`);
		await signIn(page, user.username);
		const response = await page.goto('/admin/users');
		expect(response?.status()).toBe(403);
		await expect(page.getByRole('heading', { name: 'Admins only', level: 1 })).toBeVisible();
		await expect(main(page)).toBeVisible();
		await page.getByRole('link', { name: 'Back to Today' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
	});

	test('an unknown address is a card with a way back', async ({ page }) => {
		const response = await page.goto('/no-such-page');
		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { name: 'Not found', level: 1 })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
	});
});
