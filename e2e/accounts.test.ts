import { expect, test, type Browser, type Page } from '@playwright/test';

async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(password);
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

const isPc = () => test.info().project.name === 'pc';

/** Opens Users from the navigation and, with the script, waits for it. */
async function openUsers(page: Page) {
	await openMore(page);
	await page.getByRole('link', { name: 'Users' }).click();
	await expect(page).toHaveURL(/\/admin\/users$/);
	await expect(page.getByRole('heading', { name: 'Users', level: 2 })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

const usersSection = (page: Page) => page.getByRole('region', { name: 'Users' });

/** "+ New user": a button with the script, a link to `?new=user` without it. */
const newUserButton = (page: Page) =>
	usersSection(page)
		.getByRole('button', { name: 'New user', exact: true })
		.or(usersSection(page).getByRole('link', { name: 'New user', exact: true }));

/** A user's row in the list, found by its username. */
const userRow = (page: Page, username: string) =>
	usersSection(page)
		.getByRole('listitem')
		.filter({ has: page.getByText(username, { exact: true }) });

/** A row's ⋯: the PC's popover summary or the phone's row-sheet button. */
const rowMenu = (page: Page, username: string) =>
	userRow(page, username).locator('[data-menu-for]');

/** Opens a row's ⋯: the popover on the PC, the row sheet on the phone. */
async function openRowMenu(page: Page, username: string) {
	await rowMenu(page, username).click();
	const menu = isPc()
		? page.getByRole('menu', { name: `Actions for ${username}` })
		: page.getByRole('dialog', { name: username, exact: true });
	await expect(menu).toBeVisible();
	return menu;
}

/** ⋯ → Set password…: its dialog, New password focused. */
async function openSetPassword(page: Page, username: string) {
	const menu = await openRowMenu(page, username);
	await menu.locator('[data-menu-item]', { hasText: 'Set password…' }).click();
	const form = page.getByRole('dialog', { name: `Set password for ${username}` });
	await expect(form).toBeVisible();
	await expect(form.getByLabel('New password', { exact: true })).toBeFocused();
	return form;
}

/** ⋯ → Disable or Enable, posted at once. */
async function pickPost(page: Page, username: string, label: 'Disable' | 'Enable') {
	const menu = await openRowMenu(page, username);
	await menu.locator('[data-menu-item]', { hasText: label }).click();
}

/** Signs in from a context of its own, so the page under test keeps its session. */
async function trySignIn(browser: Browser, username: string, password: string) {
	const context = await browser.newContext({
		extraHTTPHeaders: test.info().project.use.extraHTTPHeaders
	});
	const page = await context.newPage();
	await signIn(page, username, password);
	const today = page.getByRole('heading', { name: 'Today', level: 1 });
	const wrong = page.getByText('Wrong username or password.');
	await expect(today.or(wrong)).toBeVisible();
	const signedIn = await today.isVisible();
	await context.close();
	return signedIn;
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

	await test.step('admin creates a user in the dialog; refusals stay in it', async () => {
		await openUsers(page);
		const create = page.getByRole('dialog', { name: 'New user' });
		const username = create.getByLabel('Username');
		const password = create.getByLabel('Password', { exact: true });

		// Escape closes it onto "+ New user".
		await newUserButton(page).click();
		await expect(create).toBeVisible();
		await expect(username).toBeFocused();
		await expect(create).toContainText('3 to 32 characters: a–z, 0–9, dot, underscore, hyphen.');
		await expect(create).toContainText('10 to 256 characters.');
		await page.keyboard.press('Escape');
		await expect(create).toBeHidden();
		await expect(newUserButton(page)).toBeFocused();

		// Too short: refused under Username, the username kept, the password empty.
		await newUserButton(page).click();
		await username.fill('ab');
		await password.fill('first-password-1');
		await create.getByRole('button', { name: 'Create user' }).click();
		const short = 'Username must be 3–32 characters: a–z, 0–9, dot, underscore or hyphen.';
		await expect(create.getByText(short)).toBeVisible();
		await expect(username).toHaveValue('ab');
		await expect(password).toHaveValue('');
		await expect(username).toBeFocused();
		await expect(username).toHaveAccessibleDescription(
			`${short} 3 to 32 characters: a–z, 0–9, dot, underscore, hyphen.`
		);

		await username.fill(name);
		await password.fill('first-password-1');
		await create.getByRole('button', { name: 'Create user' }).click();
		await expect(create).toBeHidden();
		await expect(usersSection(page).getByRole('alert')).toHaveText(`Created ${name}.`);
		await expect(userRow(page, name)).toContainText('User');
		await expect(newUserButton(page)).toBeFocused();

		// A duplicate: refused in the dialog.
		await newUserButton(page).click();
		await username.fill(name);
		await password.fill('first-password-1');
		await create.getByRole('button', { name: 'Create user' }).click();
		await expect(create.getByText('Username is taken.')).toBeVisible();
		await expect(username).toHaveValue(name);
		await page.keyboard.press('Escape');
		await expect(create).toBeHidden();
		await expect(newUserButton(page)).toBeFocused();
		await expect(page.getByText('Username is taken.')).toHaveCount(0);
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
		const section = page.getByRole('region', { name: 'Change password' });
		await expect(section).toBeVisible();
		await page.waitForLoadState('networkidle');
		const confirm = section.getByLabel('Confirm new password');

		// A mismatched confirm: refused under Confirm new password.
		await section.getByLabel('Current password').fill('first-password-1');
		await section.getByLabel('New password', { exact: true }).fill('second-password-1');
		await confirm.fill('second-password-2');
		await section.getByRole('button', { name: 'Change password' }).click();
		await expect(section.getByText('Passwords do not match.')).toBeVisible();
		await expect(confirm).toHaveAccessibleDescription('Passwords do not match.');
		await expect(confirm).toBeFocused();

		await section.getByLabel('Current password').fill('first-password-1');
		await section.getByLabel('New password', { exact: true }).fill('second-password-1');
		await confirm.fill('second-password-1');
		await section.getByRole('button', { name: 'Change password' }).click();
		await expect(section.getByRole('alert')).toHaveText('Password changed.');
		await expect(section.getByText('Passwords do not match.')).toHaveCount(0);
		await signOut(page);
		await signIn(page, name, 'second-password-1');
		await expect(page.locator('aside').getByText(name, { exact: true })).toBeAttached();
	});

	await test.step('admin sets the user password from the row menu', async () => {
		const admin = await signedInAdmin(browser, testInfo.project.use.extraHTTPHeaders);
		await openUsers(admin.page);

		// Escape closes it onto the row's ⋯.
		let form = await openSetPassword(admin.page, name);
		await expect(form).toContainText(
			`10 to 256 characters. Signs ${name} out everywhere; their agent tokens keep working.`
		);
		await admin.page.keyboard.press('Escape');
		await expect(form).toBeHidden();
		await expect(rowMenu(admin.page, name)).toBeFocused();

		// Too short: refused under New password, the field empty.
		form = await openSetPassword(admin.page, name);
		const field = form.getByLabel('New password', { exact: true });
		await field.fill('short');
		await form.getByRole('button', { name: 'Set password' }).click();
		await expect(form.getByText('Password must be 10–256 characters.')).toBeVisible();
		await expect(field).toHaveValue('');
		await expect(field).toBeFocused();

		await field.fill('third-password-1');
		await form.getByRole('button', { name: 'Set password' }).click();
		await expect(form).toBeHidden();
		await expect(usersSection(admin.page).getByRole('alert')).toHaveText('Password set.');
		await expect(rowMenu(admin.page, name)).toBeFocused();
		await admin.context.close();

		// It signed the user out everywhere.
		await page.reload();
		await expect(page).toHaveURL(/\/login$/);
		expect(await trySignIn(browser, name, 'third-password-1')).toBe(true);
	});

	await test.step('disable and enable from the row menu', async () => {
		const admin = await signedInAdmin(browser, testInfo.project.use.extraHTTPHeaders);
		await openUsers(admin.page);

		if (isPc()) {
			// By keys: ⋯, Enter, the arrow to Disable, Enter; the focus stays on ⋯.
			await rowMenu(admin.page, name).focus();
			await admin.page.keyboard.press('Enter');
			const menu = admin.page.getByRole('menu', { name: `Actions for ${name}` });
			await expect(menu.getByRole('menuitem', { name: 'Set password…' })).toBeFocused();
			await admin.page.keyboard.press('ArrowDown');
			await expect(menu.getByRole('menuitem', { name: 'Disable' })).toBeFocused();
			await admin.page.keyboard.press('Enter');
		} else {
			await pickPost(admin.page, name, 'Disable');
		}
		await expect(usersSection(admin.page).getByRole('alert')).toHaveText('User disabled.');
		const row = userRow(admin.page, name);
		await expect(row.getByText('Disabled', { exact: true })).toBeVisible();
		await expect(row.getByText(name, { exact: true }).first()).toHaveCSS(
			'text-decoration-line',
			'line-through'
		);
		await expect(rowMenu(admin.page, name)).toBeFocused();
		expect(await trySignIn(browser, name, 'third-password-1')).toBe(false);

		await pickPost(admin.page, name, 'Enable');
		await expect(usersSection(admin.page).getByRole('alert')).toHaveText('User enabled.');
		await expect(userRow(admin.page, name).getByText('Disabled', { exact: true })).toHaveCount(0);
		expect(await trySignIn(browser, name, 'third-password-1')).toBe(true);
		await admin.context.close();
	});

	await test.step('the admin own row: no Disable, and a password set keeps them in', async () => {
		const admin = await signedInAdmin(browser, testInfo.project.use.extraHTTPHeaders);
		await openUsers(admin.page);
		await expect(userRow(admin.page, 'admin')).toContainText(isPc() ? '(you)' : '· you');

		const menu = await openRowMenu(admin.page, 'admin');
		await expect(menu.locator('[data-menu-item]')).toHaveText(['Set password…']);
		await menu.locator('[data-menu-item]', { hasText: 'Set password…' }).click();
		const form = admin.page.getByRole('dialog', { name: 'Set password for admin' });
		await expect(form).toContainText(
			'10 to 256 characters. Signs you out everywhere else; your agent tokens keep working.'
		);
		// The same password, so the other tests still sign in with it.
		await form.getByLabel('New password', { exact: true }).fill('admin-password-1');
		await form.getByRole('button', { name: 'Set password' }).click();
		await expect(usersSection(admin.page).getByRole('alert')).toHaveText('Password set.');
		await admin.page.reload();
		await expect(admin.page).toHaveURL(/\/admin\/users$/);
		await expect(admin.page.getByRole('heading', { name: 'Users', level: 2 })).toBeVisible();
		await admin.context.close();
	});
});

test('healthz answers ok', async ({ request }) => {
	const res = await request.get('/healthz');
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({ status: 'ok' });
});

test('a 32-character username wraps at 390 px, nothing on the "+"', async ({
	browser
}, testInfo) => {
	test.skip(isPc(), 'the phone');
	const admin = await signedInAdmin(browser, testInfo.project.use.extraHTTPHeaders);
	const page = admin.page;
	await page.setViewportSize({ width: 390, height: 844 });
	await openUsers(page);
	const long = 'l'.repeat(32);

	await newUserButton(page).click();
	const create = page.getByRole('dialog', { name: 'New user' });
	await create.getByLabel('Username').fill(long);
	await create.getByLabel('Password', { exact: true }).fill('first-password-1');
	await create.getByRole('button', { name: 'Create user' }).click();
	await expect(usersSection(page).getByRole('alert')).toHaveText(`Created ${long}.`);

	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	await expect(rowMenu(page, long)).toBeInViewport({ ratio: 1 });

	// No control's box overlaps the "+"'s, nor reaches its column.
	const plus = await page.getByRole('link', { name: 'New entry', exact: true }).boundingBox();
	const past = await page
		.locator('main :is(a[href], button, summary, input:not([type="hidden"]))')
		.evaluateAll(
			(els, p) =>
				els
					.filter((el) => el.checkVisibility())
					.map((el) => ({
						name: el.getAttribute('aria-label') ?? el.textContent?.trim(),
						box: el.getBoundingClientRect()
					}))
					.filter(
						({ box }) =>
							box.width > 0 &&
							(box.right > p.x + 0.5 ||
								(box.right > p.x &&
									box.left < p.x + p.width &&
									box.bottom > p.y &&
									box.top < p.y + p.height))
					)
					.map(({ name }) => name),
			plus!
		);
	expect(past).toEqual([]);

	// The Set password dialog's title wraps inside it.
	const form = await openSetPassword(page, long);
	const title = form.getByRole('heading', { name: `Set password for ${long}` });
	const [titleBox, formBox] = [await title.boundingBox(), await form.boundingBox()];
	expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(formBox!.x + formBox!.width);
	await admin.context.close();
});

test('a Set password refused for a user not in the list shows at the section head', async ({
	browser
}, testInfo) => {
	const admin = await signedInAdmin(browser, testInfo.project.use.extraHTTPHeaders);
	const page = admin.page;
	await openUsers(page);
	// A plain post, as from a page whose user has gone meanwhile.
	await page.evaluate(() => {
		const form = Object.assign(document.createElement('form'), {
			method: 'POST',
			action: '?/setPassword'
		});
		for (const [name, value] of [
			['userId', 'no-such-user'],
			['password', 'third-password-1']
		]) {
			form.append(Object.assign(document.createElement('input'), { type: 'hidden', name, value }));
		}
		document.body.append(form);
		form.submit();
	});
	await expect(usersSection(page).getByRole('alert')).toHaveText('User not found.');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await admin.context.close();
});

test.describe('Users without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the dialogs are forms in the page, and a refusal comes back there', async ({
		page
	}, testInfo) => {
		const name = `nojs-${testInfo.project.name}`;
		await signIn(page, 'admin', 'admin-password-1');
		await page.goto('/admin/users');

		await newUserButton(page).click();
		await expect(page).toHaveURL(/\/admin\/users\?new=user$/);
		const section = usersSection(page);
		await section.getByLabel('Username').fill('ab');
		await section.getByLabel('Password', { exact: true }).fill('first-password-1');
		await section.getByRole('button', { name: 'Create user' }).click();
		await expect(section.getByRole('heading', { name: 'New user' })).toBeVisible();
		await expect(
			section.getByText('Username must be 3–32 characters: a–z, 0–9, dot, underscore or hyphen.')
		).toBeVisible();
		await expect(section.getByLabel('Username')).toHaveValue('ab');
		await expect(section.getByLabel('Password', { exact: true })).toHaveValue('');

		await section.getByLabel('Username').fill(name);
		await section.getByLabel('Password', { exact: true }).fill('first-password-1');
		await section.getByRole('button', { name: 'Create user' }).click();
		await expect(section.getByRole('alert')).toHaveText(`Created ${name}.`);
		await expect(section.getByRole('heading', { name: 'New user' })).toHaveCount(0);

		await rowMenu(page, name).click();
		await userRow(page, name).getByRole('link', { name: 'Set password…' }).click();
		await expect(page).toHaveURL(/\/admin\/users\?password=/);
		await expect(section.getByRole('heading', { name: `Set password for ${name}` })).toBeVisible();
		await section.getByLabel('New password', { exact: true }).fill('short');
		await section.getByRole('button', { name: 'Set password' }).click();
		await expect(section.getByText('Password must be 10–256 characters.')).toBeVisible();
		await section.getByLabel('New password', { exact: true }).fill('second-password-1');
		await section.getByRole('button', { name: 'Set password' }).click();
		await expect(section.getByRole('alert')).toHaveText('Password set.');

		await rowMenu(page, name).click();
		await userRow(page, name).getByRole('button', { name: 'Disable' }).click();
		await expect(section.getByRole('alert')).toHaveText('User disabled.');
		await expect(userRow(page, name).getByText('Disabled', { exact: true })).toBeVisible();
	});
});
