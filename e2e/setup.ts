/** Shared steps for the Setup screen: a row by its name and a customer made through "+ New customer". */
import { expect, type Locator, type Page } from '@playwright/test';

/** A shown row, by its name. */
export const setupRow = (page: Page, name: string): Locator =>
	page.locator('li[data-setup-row]:visible').filter({ has: page.getByText(name, { exact: true }) });

/**
 * Adds a customer on /setup, with or without JavaScript: "+ New customer" is a button opening
 * a dialog with the script and a link to `?new=customer` without it; both end on "Create".
 */
export async function createCustomer(page: Page, name: string) {
	await page.goto('/setup');
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('button', { name: 'New customer' })
		.or(page.getByRole('link', { name: 'New customer' }))
		.click();
	await page.getByLabel('Name').fill(name);
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(setupRow(page, name)).toBeVisible();
}
