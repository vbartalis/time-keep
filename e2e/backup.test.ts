import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, test, type Download, type Page } from '@playwright/test';
import { PASSWORD, seedEmptyUser } from './seed';
import { createCustomer } from './setup';

// A restore signs every session out, so each test signs in itself afterwards and
// restores the backup it just downloaded: other tests' seeded users survive.

const SQLITE_HEADER = 'SQLite format 3\0';

async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

const signInAdmin = async (page: Page) => {
	await signIn(page, 'admin', 'admin-password-1');
	await expect(page.locator('aside').getByText('admin', { exact: true })).toBeAttached();
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

/** Backup, once the script runs (Restore… opens the confirm only then). */
async function openBackup(page: Page) {
	await page.goto('/admin/backup');
	await page.waitForLoadState('networkidle');
}

const restorePanel = (page: Page) => page.getByRole('region', { name: 'Restore', exact: true });
const confirmDialog = (page: Page) => page.getByRole('dialog', { name: 'Restore this backup?' });

/** Restores with the script: Restore… opens the confirm, whose Restore posts the form. */
async function restoreFrom(page: Page, download: Download) {
	await openBackup(page);
	await page.getByLabel('Backup file').setInputFiles(await download.path());
	await page.getByRole('button', { name: 'Restore…' }).click();
	await confirmDialog(page).getByRole('button', { name: 'Restore', exact: true }).click();
	await expect(page).toHaveURL(/\/login\?restored=1$/);
	await expect(page.getByText("Restored. Sign in with the backup's passwords.")).toBeVisible();
}

/** Restores without the script: the box, then Restore… posts the form. */
async function restoreFromNoJs(page: Page, download: Download) {
	await page.goto('/admin/backup');
	await page.getByLabel('Backup file').setInputFiles(await download.path());
	await page.getByLabel('Replace all data with this backup').check();
	await page.getByRole('button', { name: 'Restore…' }).click();
	await expect(page).toHaveURL(/\/login\?restored=1$/);
	await expect(page.getByText("Restored. Sign in with the backup's passwords.")).toBeVisible();
}

test('backup: a user who is not an admin has no access', async ({ page }, testInfo) => {
	const user = await seedEmptyUser(`${testInfo.project.name}-nobackup`);
	await signIn(page, user.username, PASSWORD);
	await expect(page.locator('aside').getByText(user.username, { exact: true })).toBeAttached();
	// On the phone the screens past the bar are in More.
	const more = page
		.getByRole('navigation', { name: 'Main' })
		.locator('summary, button', { hasText: 'More' });
	if (await more.isVisible()) await more.click();
	await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Backup' })).toHaveCount(0);

	expect((await page.request.get('/admin/backup')).status()).toBe(403);
	expect((await page.request.get('/admin/backup/download')).status()).toBe(403);
});

test('backup: download, restore, and the copy from before the restore', async ({ page }) => {
	await signInAdmin(page);
	const backup = await downloadBackup(page);
	await createCustomer(page, 'After backup');

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

test('backup: Restore… with no file says so and opens nothing', async ({ page }) => {
	await signInAdmin(page);
	await openBackup(page);
	const posts: string[] = [];
	page.on('request', (r) => {
		if (r.method() === 'POST') posts.push(r.url());
	});
	await page.getByRole('button', { name: 'Restore…' }).click();
	await expect(restorePanel(page).getByText('Choose a backup file.')).toBeVisible();
	await expect(confirmDialog(page)).toHaveCount(0);
	expect(posts).toEqual([]);
	// The box is the no-script page's.
	await expect(page.getByLabel('Replace all data with this backup')).toBeHidden();
});

test('backup: the confirm names the file, cancels and returns the focus', async ({ page }) => {
	await signInAdmin(page);
	const backup = await downloadBackup(page);
	const name = backup.suggestedFilename();

	await openBackup(page);
	await page.getByLabel('Backup file').setInputFiles({
		name,
		mimeType: 'application/vnd.sqlite3',
		buffer: readFileSync(await backup.path())
	});
	const restore = page.getByRole('button', { name: 'Restore…' });
	await restore.click();
	const dialog = confirmDialog(page);
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('code, .font-mono').getByText(name)).toBeVisible();
	await expect(dialog).toContainText(
		`Restoring ${name} replaces every user's data with the backup's and signs everyone out, you included.`
	);
	await expect(dialog).toContainText(
		'The data as it is now is kept, and can be downloaded under Before the last restore.'
	);
	// No field: Restore takes the focus, not the ×.
	await expect(dialog.getByRole('button', { name: 'Restore', exact: true })).toBeFocused();

	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page).toHaveURL(/\/admin\/backup$/);
	await expect(restore).toBeFocused();

	await restore.click();
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(restore).toBeFocused();
	await expect(page).toHaveURL(/\/admin\/backup$/);
});

test('backup: a file that is not a backup is refused in the Restore panel', async ({ page }) => {
	await signInAdmin(page);
	await openBackup(page);
	await page.getByLabel('Backup file').setInputFiles({
		name: 'notes.db',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from('not a database at all')
	});
	await page.getByRole('button', { name: 'Restore…' }).click();
	await confirmDialog(page).getByRole('button', { name: 'Restore', exact: true }).click();
	await expect(restorePanel(page).getByText('This file is not a time-keep backup.')).toBeVisible();
	await expect(confirmDialog(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/admin\/backup$/);
});

test('backup: Restore… is a red outline, not a red fill', async ({ page }, testInfo) => {
	await signInAdmin(page);
	// Once the script runs: Restore… is swapped for the script's button when it does.
	await openBackup(page);
	const restore = page.getByRole('button', { name: 'Restore…' });
	const { fill, text } = await restore.evaluate((el) => {
		const style = getComputedStyle(el);
		return { fill: style.backgroundColor, text: style.color };
	});
	expect(fill).not.toBe(text);
	if (testInfo.project.name === 'pc') {
		// The panel's surface.
		const panel = await restorePanel(page)
			.locator('.lg\\:bg-card')
			.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(fill).toBe(panel);
	}
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('backup: the download link and a full restore work', async ({ page }) => {
		await signInAdmin(page);
		const backup = await downloadBackup(page);
		await createCustomer(page, 'After backup nojs');
		await restoreFromNoJs(page, backup);
		await signInAdmin(page);
		await page.goto('/setup');
		await expect(page.getByRole('heading', { name: 'Customers' }).first()).toBeVisible();
		await expect(page.getByText('After backup nojs')).toHaveCount(0);
		await page.goto('/admin/backup');
		await expect(page.getByRole('heading', { name: 'Before the last restore' })).toBeVisible();
	});

	test('backup: a restore without the box or without a file is refused', async ({ page }) => {
		await signInAdmin(page);
		const backup = await downloadBackup(page);

		await page.goto('/admin/backup');
		await expect(page.getByLabel('Replace all data with this backup')).toBeVisible();
		await page.getByLabel('Backup file').setInputFiles(await backup.path());
		await page.getByRole('button', { name: 'Restore…' }).click();
		await expect(
			restorePanel(page).getByText('Tick the box to confirm the restore.')
		).toBeVisible();

		await page.goto('/admin/backup');
		await page.getByLabel('Replace all data with this backup').check();
		await page.getByRole('button', { name: 'Restore…' }).click();
		await expect(restorePanel(page).getByText('Choose a backup file.')).toBeVisible();
	});
});
