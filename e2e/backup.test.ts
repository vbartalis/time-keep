import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, test, type Download, type Page } from '@playwright/test';
import { PASSWORD, seedEmptyUser } from './seed';

// A restore signs every session out, so each test signs in itself afterwards and
// restores the backup it just downloaded: other tests' seeded users survive.

const SQLITE_HEADER = 'SQLite format 3\0';

async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

const signInAdmin = async (page: Page) => {
	await signIn(page, 'admin', 'admin-password-1');
	await expect(page.getByText('Signed in as admin')).toBeVisible();
};

/** Whether the downloaded file starts with the SQLite header. */
const isSqlite = async (download: Download) =>
	readFileSync(await download.path())
		.subarray(0, 16)
		.toString('latin1') === SQLITE_HEADER;

async function downloadBackup(page: Page) {
	await page.goto('/admin/backup');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('link', { name: 'Download backup' }).click()
	]);
	expect(download.suggestedFilename()).toMatch(/^time-keep-\d{4}-\d{2}-\d{2}-\d{4}\.db$/);
	expect(await isSqlite(download)).toBe(true);
	return download;
}

async function restoreFrom(page: Page, download: Download) {
	await page.goto('/admin/backup');
	await page.getByLabel('Backup file').setInputFiles(await download.path());
	await page.getByLabel('Replace all data with this backup').check();
	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page).toHaveURL(/\/login\?restored=1$/);
	await expect(page.getByText("Restored. Sign in with the backup's passwords.")).toBeVisible();
}

async function addCustomer(page: Page, name: string) {
	await page.goto('/setup');
	const form = page.locator('form', { has: page.locator('[aria-label="New customer"]') });
	await form.getByLabel('New customer').fill(name);
	await form.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByText(name).first()).toBeVisible();
}

test('backup: a user who is not an admin has no access', async ({ page }, testInfo) => {
	const user = await seedEmptyUser(`${testInfo.project.name}-nobackup`);
	await signIn(page, user.username, PASSWORD);
	await expect(page.getByText(`Signed in as ${user.username}`)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Backup' })).toHaveCount(0);

	expect((await page.request.get('/admin/backup')).status()).toBe(403);
	expect((await page.request.get('/admin/backup/download')).status()).toBe(403);
});

test('backup: download, restore, and the copy from before the restore', async ({ page }) => {
	await signInAdmin(page);
	const backup = await downloadBackup(page);
	await addCustomer(page, 'After backup');

	await restoreFrom(page, backup);
	await signInAdmin(page);

	await page.goto('/setup');
	await expect(page.getByRole('heading', { name: 'Customers' }).first()).toBeVisible();
	await expect(page.getByText('After backup')).toHaveCount(0);

	await page.goto('/admin/backup');
	await expect(page.getByRole('heading', { name: 'Before the last restore' })).toBeVisible();
	const [before] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('link', { name: 'Download', exact: true }).click()
	]);
	expect(before.suggestedFilename()).toMatch(/^time-keep-before-restore-/);
	expect(await isSqlite(before)).toBe(true);

	// Another project's restore may have written the file earlier: it must hold this one's data.
	const copy = new Database(await before.path(), { readonly: true });
	try {
		const names = copy.prepare('SELECT name FROM customer').pluck().all();
		expect(names).toContain('After backup');
		expect(copy.prepare('SELECT count(*) FROM session').pluck().get()).toBe(0);
	} finally {
		copy.close();
	}
});

test('backup: a restore without the box or without a file is refused', async ({ page }) => {
	await signInAdmin(page);
	const backup = await downloadBackup(page);

	await page.goto('/admin/backup');
	await page.getByLabel('Backup file').setInputFiles(await backup.path());
	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page.getByText('Tick the box to confirm the restore.')).toBeVisible();

	await page.goto('/admin/backup');
	await page.getByLabel('Replace all data with this backup').check();
	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page.getByText('Choose a backup file.')).toBeVisible();

	await page.goto('/admin/backup');
	await expect(page.getByRole('heading', { name: 'Backup', level: 1 })).toBeVisible();
	await expect(page).toHaveURL(/\/admin\/backup$/);
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('backup: the download link and a full restore work', async ({ page }) => {
		await signInAdmin(page);
		const backup = await downloadBackup(page);
		await addCustomer(page, 'After backup nojs');
		await restoreFrom(page, backup);
		await signInAdmin(page);
		await page.goto('/setup');
		await expect(page.getByRole('heading', { name: 'Customers' }).first()).toBeVisible();
		await expect(page.getByText('After backup nojs')).toHaveCount(0);
		await page.goto('/admin/backup');
		await expect(page.getByRole('heading', { name: 'Before the last restore' })).toBeVisible();
	});
});
