import { expect, test, type Browser, type Page } from '@playwright/test';

async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page) {
	await page.goto('/');
	await openMore(page);
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);
}

/** On the phone, opens More, where the screens past the bar and Sign out are. */
async function openMore(page: Page) {
	const more = page
		.getByRole('navigation', { name: 'Main' })
		.locator('summary, button', { hasText: 'More' });
	if (await more.isVisible()) await more.click();
}

async function signedInAdmin(browser: Browser, extraHTTPHeaders: Record<string, string> = {}) {
	const context = await browser.newContext({ extraHTTPHeaders });
	const page = await context.newPage();
	await signIn(page, 'admin', 'admin-password-1');
	await expect(page.locator('aside').getByText('admin', { exact: true })).toBeAttached();
	return { context, page };
}

test('accounts: sign in, manage users, change password, disable', async ({
	page,
	browser,
	baseURL
}, testInfo) => {
	const name = `u-${testInfo.project.name}`;

	await test.step('admin signs in with a messy username', async () => {
		await signIn(page, '  ADMIN ', 'admin-password-1');
		await expect(page.locator('aside').getByText('admin', { exact: true })).toBeAttached();
	});

	await test.step('admin creates a user, and a duplicate is refused', async () => {
		await openMore(page);
		await page.getByRole('link', { name: 'Users' }).click();
		await expect(page).toHaveURL(/\/admin\/users$/);
		const create = async () => {
			await page.locator('#create-username').fill(name);
			await page.locator('#create-password').fill('first-password-1');
			await page.getByRole('button', { name: 'Create user' }).click();
		};
		await create();
		await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
		await create();
		await expect(page.getByText('Username is taken.')).toBeVisible();
		await signOut(page);
	});

	await test.step('the user has no admin access', async () => {
		await signIn(page, name, 'first-password-1');
		await expect(page.locator('aside').getByText(name, { exact: true })).toBeAttached();
		await openMore(page);
		await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);

		const get = await page.request.get('/admin/users');
		expect(get.status()).toBe(403);

		const post = await page.request.post('/admin/users?/create', {
			headers: { Origin: baseURL! },
			form: { username: `x-${name}`, password: 'first-password-1' }
		});
		expect(post.status()).toBe(403);
		expect(await post.text()).toContain('Admins only');
	});

	await test.step('the user changes the password', async () => {
		await page.getByRole('link', { name: 'Account' }).click();
		await page.getByLabel('Current password').fill('first-password-1');
		await page.getByLabel('New password', { exact: true }).fill('second-password-1');
		await page.getByLabel('Confirm new password').fill('second-password-1');
		await page.getByRole('button', { name: 'Change password' }).click();
		await expect(page.getByText('Password changed.')).toBeVisible();
		await signOut(page);
		await signIn(page, name, 'second-password-1');
		await expect(page.locator('aside').getByText(name, { exact: true })).toBeAttached();
	});

	await test.step('disabling ends the user session', async () => {
		const admin = await signedInAdmin(browser, testInfo.project.use.extraHTTPHeaders);
		await admin.page.goto('/admin/users');
		await admin.page
			.getByRole('row', { name: new RegExp(name) })
			.getByRole('button', { name: 'Disable' })
			.click();
		await expect(
			admin.page.getByRole('row', { name: new RegExp(name) }).getByText('Disabled')
		).toBeVisible();
		await admin.context.close();

		await page.reload();
		await expect(page).toHaveURL(/\/login$/);
		await signIn(page, name, 'second-password-1');
		await expect(page.getByText('Wrong username or password.')).toBeVisible();
	});
});

test('healthz answers ok', async ({ request }) => {
	const res = await request.get('/healthz');
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({ status: 'ok' });
});
