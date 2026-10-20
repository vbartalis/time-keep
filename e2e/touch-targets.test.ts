import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
	PASSWORD,
	archiveElsewhere,
	noonZone,
	seedBatches,
	seedCustomer,
	seedMonth,
	seedProject,
	seedTemplate,
	seedThreeChanges,
	type Month
} from './seed';

// The phone's 44 px rule: below `lg`, every tappable element's own box is at least
// 44 by 44. The PC keeps its density, so this runs on the phone project only.
const zone = noonZone();
test.use({ timezoneId: zone });
test.skip(({ isMobile }) => !isMobile, 'phone only');

const TAPPABLE = [
	'a[href]',
	'button',
	'summary',
	'select',
	'textarea',
	'input:not([type="hidden"])'
].join(', ');

/** 1 px of tolerance for subpixel layout. */
const MIN = 44 - 1;

let user: Month;
let templateId: string;
test.beforeAll(async () => {
	user = await seedMonth(`${test.info().project.name}-targets`, zone);
	const customer = seedCustomer(user.id, 'Retired');
	const project = seedProject(user.id, customer, 'Old work');
	templateId = seedTemplate(user.id, { name: 'Standup', customerId: customer, projectId: project });
	seedTemplate(user.id, { name: 'Ticket', customerId: customer, projectId: project });
	archiveElsewhere(user.id, 'customers', customer);
	seedThreeChanges(user.id, 'Set up the basics', {
		activity: 'Research',
		location: 'Café',
		customer: 'Spare'
	});
	// More than a page of history, so Older shows.
	seedBatches(user.id, 51);
});

const rememberZone = (context: BrowserContext) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

async function signIn(page: Page, username: string, password: string) {
	await rememberZone(page.context());
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

/** Every visible tappable element under 44x44, by tag and accessible name. */
async function offenders(page: Page) {
	await page.waitForLoadState('networkidle');
	return page.locator(TAPPABLE).evaluateAll((els, min) => {
		const nameOf = (el: Element) => {
			const label =
				el.getAttribute('aria-label') ??
				(el as HTMLInputElement).labels?.[0]?.textContent ??
				el.textContent ??
				'';
			return label.replace(/\s+/g, ' ').trim() || el.getAttribute('name') || '(unnamed)';
		};
		return els
			.filter((el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
			.map((el) => ({ el, box: el.getBoundingClientRect() }))
			.filter(({ box }) => box.width > 0 && box.height > 0)
			.filter(({ box }) => box.width < min || box.height < min)
			.map(
				({ el, box }) =>
					`${el.tagName.toLowerCase()}${el instanceof HTMLInputElement ? `[${el.type}]` : ''} "${nameOf(el)}" ${Math.round(box.width)}x${Math.round(box.height)}`
			);
	}, MIN);
}

const screens = (u: Month) => [
	'/',
	'/calendar',
	'/calendar?view=day',
	'/calendar?view=month',
	'/entries',
	`/entries/${u.entries.login}`,
	'/copy-out',
	'/reports',
	'/templates',
	'/templates/new',
	`/templates/${templateId}`,
	'/setup',
	'/setup?archived=1',
	'/history',
	'/account'
];

test('the sign-in page has 44 px targets', async ({ page }) => {
	await page.goto('/login');
	expect(await offenders(page)).toEqual([]);
});

test('every signed-in screen has 44 px targets', async ({ page }) => {
	await signIn(page, user.username, PASSWORD);
	const found: Record<string, string[]> = {};
	for (const path of screens(user)) {
		await page.goto(path);
		const list = await offenders(page);
		if (list.length) found[path] = list;
	}
	expect(found).toEqual({});
});

test('opened disclosures have 44 px targets', async ({ page }) => {
	await signIn(page, user.username, PASSWORD);
	const found: Record<string, string[]> = {};
	for (const path of ['/', '/setup', '/history']) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		// Open the first disclosure in the page (not the shell's More).
		await page.locator('main details > summary').first().click();
		const list = await offenders(page);
		if (list.length) found[path] = list;
	}
	expect(found).toEqual({});
});

test('the admin screens have 44 px targets', async ({ page }) => {
	await signIn(page, 'admin', 'admin-password-1');
	const found: Record<string, string[]> = {};
	for (const path of ['/admin/users', '/admin/backup']) {
		await page.goto(path);
		const list = await offenders(page);
		if (list.length) found[path] = list;
	}
	expect(found).toEqual({});
});
