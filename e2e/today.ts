/** Today's screen as the browser tests reach it, at either width. */
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { PASSWORD } from './seed';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** `Tue 2026-10-20` */
export const dayLabel = (date: string) =>
	`${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${date}`;

export const rememberZone = (context: BrowserContext, zone: string) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

/** Signs in and lands on Today; with `zone`, as a device that already gave its zone. */
export async function signIn(page: Page, username: string, zone?: string) {
	if (zone) await rememberZone(page.context(), zone);
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

export const strip = (page: Page) => page.getByRole('status');
export const undo = (page: Page) => strip(page).getByRole('button', { name: 'Undo' });
/** The shell's timer bar: the PC header's pill or the phone's strip. */
export const bar = (page: Page) => page.getByRole('region', { name: 'Timer', exact: true });
export const templates = (page: Page) =>
	page.getByRole('region', { name: 'Templates', exact: true });
/** Today's entries: the section headed "Today · <day>". */
export const todaySection = (page: Page) => page.getByRole('region', { name: /^Today · / });
/** The day's total, at the right of its head. */
export const dayTotal = (page: Page) => todaySection(page).locator('[data-day-total]');
/** A shown entry row (the PC's table row or the phone's list item). */
export const entryRow = (page: Page, text: string) =>
	page.locator('[data-row]:visible').filter({ hasText: text });
/** A template's row: the button that opens its sheet. */
export const templateRow = (page: Page, name: string) =>
	templates(page).getByRole('button', { name: new RegExp(`^${name}\\b`) });
/** A template's `<details>` panel (without the script), found by its row's name. */
export const templatePanel = (page: Page, name: string) =>
	templates(page)
		.locator('details[name="template"] > summary')
		.filter({ hasText: new RegExp(`^\\s*${name}\\b`) })
		.locator('..');
/** A template's sheet, named by the template. */
export const sheet = (page: Page, name: string) => page.getByRole('dialog', { name });

/** The labels a sheet asks for, in order. */
export const askedFor = (dialog: Locator) =>
	dialog.locator('form > div > div > label').allInnerTexts();

/** Opens a template's sheet once the script runs; the first field takes the focus. */
export async function openSheet(page: Page, name: string) {
	await page.waitForLoadState('networkidle');
	await templateRow(page, name).click();
	await expect(sheet(page, name)).toBeVisible();
	return sheet(page, name);
}

/** Logs `name` with `description` and nothing else typed. */
export async function logFromTemplate(page: Page, name: string, description: string) {
	const dialog = await openSheet(page, name);
	await dialog.getByLabel('Description').fill(description);
	await dialog.getByRole('button', { name: 'Log', exact: true }).click();
	await expect(dialog).toBeHidden();
}
