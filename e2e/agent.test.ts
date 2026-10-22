/**
 * Account's Agent access (`pc-account`, `pc-account-token-made`, `ph-account`,
 * `ph-account-token-made`) and `/mcp`: "+ New token" in its dialog (a sheet on the
 * phone), the token shown once with Copy and Done, the ⋯ menu's Revoke… and its
 * confirm, and the no-JavaScript pages. Both widths.
 */
import {
	expect,
	test,
	type APIRequestContext,
	type BrowserContext,
	type Locator,
	type Page
} from '@playwright/test';
import { PASSWORD, noonZone, seedEmptyUser } from './seed';
import { setupRow } from './setup';

const zone = noonZone();
test.use({ timezoneId: zone });

const isPc = () => test.info().project.name === 'pc';

/** A user of its own for each test, with no token until the test makes one. */
const newUser = (label: string) => seedEmptyUser(`${test.info().project.name}-${label}`);

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

const TOKEN = /^tk_[a-z2-7]{32}$/;

/** Opens Account and, with the script, waits for it, so "+ New token" and ⋯ act in place. */
const openAccount = async (page: Page) => {
	await page.goto('/account');
	await expect(page.getByRole('heading', { name: 'Agent access', level: 2 })).toBeVisible();
	await page.waitForLoadState('networkidle');
};

const agentAccess = (page: Page) => page.getByRole('region', { name: 'Agent access' });

/** "+ New token": a button with the script, a link to `?new=token` without it. */
const newTokenButton = (page: Page) =>
	agentAccess(page)
		.getByRole('button', { name: 'New token', exact: true })
		.or(agentAccess(page).getByRole('link', { name: 'New token', exact: true }));

const dialog = (page: Page, title: string) => page.getByRole('dialog', { name: title });

/** A token's line in the list, found by its name. */
const tokenLine = (page: Page, name: string) =>
	agentAccess(page)
		.getByRole('listitem')
		.filter({ has: page.getByText(name, { exact: true }) });

/** A line's ⋯: the PC's popover summary or the phone's row-sheet button. */
const opener = (page: Page, name: string) => tokenLine(page, name).locator('[data-menu-for]');

/** Opens "+ New token", names it `name`, creates it, and answers the made dialog and token. */
async function makeToken(page: Page, name: string): Promise<{ made: Locator; token: string }> {
	await newTokenButton(page).click();
	const form = dialog(page, 'New token');
	await expect(form).toBeVisible();
	const field = form.getByLabel('Name', { exact: true });
	await expect(field).toBeFocused();
	await field.fill(name);
	await form.getByRole('button', { name: 'Create token' }).click();
	const made = dialog(page, `Token made: ${name}`);
	await expect(made).toBeVisible();
	const shown = made.getByRole('textbox');
	await expect(shown).toHaveValue(TOKEN);
	return { made, token: await shown.inputValue() };
}

/** No `tk_` anywhere: not in the page's text, not in a field's value. */
async function expectNoToken(page: Page) {
	await expect(page.locator('body')).not.toContainText('tk_');
	const values = await page
		.locator('input, textarea')
		.evaluateAll((fields) => fields.map((f) => (f as HTMLInputElement).value));
	expect(values.filter((v) => v.includes('tk_'))).toEqual([]);
}

/** Opens a line's ⋯ and picks Revoke…: the popover's item on the PC, the row sheet's on the phone. */
async function pickRevoke(page: Page, name: string) {
	await opener(page, name).click();
	const menu = isPc()
		? page.getByRole('menu', { name: `Actions for ${name}` })
		: page.getByRole('dialog', { name });
	await expect(menu).toBeVisible();
	await menu.locator('[data-menu-item]', { hasText: 'Revoke…' }).click();
	const confirm = dialog(page, `Revoke "${name}"?`);
	await expect(confirm).toBeVisible();
	await expect(confirm).toContainText(
		'Agents using it lose access at once. This cannot be undone.'
	);
	return confirm;
}

const tidy = {
	jsonrpc: '2.0',
	id: 1,
	method: 'tools/call',
	params: {
		name: 'change',
		arguments: {
			label: 'Agent tidy',
			operations: [{ command: 'customers.create', input: { name: 'Agent Co' } }]
		}
	}
};

/** An MCP call to `/mcp`, with `token` as the bearer when given. */
const callMcp = (request: APIRequestContext, token?: string) =>
	request.post('/mcp', {
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...(token ? { authorization: `Bearer ${token}` } : {})
		},
		data: tidy
	});

/** A Setup row's line, found by its name. */
const setupLine = setupRow;

/** A History batch's row, found by its label exactly. */
const batch = (page: Page, label: string) =>
	page.locator('[data-batch]').filter({ has: page.getByText(label, { exact: true }) });

test('makes a token shown once in its dialog, copies it, and never shows it again', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const user = await newUser('make');
	await signIn(page, user.username);
	await openAccount(page);
	await expect(agentAccess(page).getByText('No tokens yet.')).toBeVisible();
	await expect(
		page.getByText(
			'Agents use a token to reach time-keep through the MCP server. A token is shown once, when it is made.'
		)
	).toBeVisible();

	const { made, token } = await makeToken(page, 'kimai-import');
	await expect(made).toContainText('Copy it now: it is not shown again.');
	const copy = made.getByRole('button', { name: 'Copy' });
	await expect(copy).toBeFocused();
	// The list behind already holds it.
	await expect(tokenLine(page, 'kimai-import')).toContainText('Never used');

	await copy.click();
	await expect(made.getByRole('button', { name: 'Copied' })).toBeVisible();
	await expect(made.locator('[aria-live="polite"]')).toHaveText('Copied');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(token);

	await made.getByRole('button', { name: 'Done' }).click();
	await expect(made).toBeHidden();
	await expect(newTokenButton(page)).toBeFocused();
	await expect(tokenLine(page, 'kimai-import')).toContainText('Never used');
	await expectNoToken(page);

	await page.reload();
	await expect(tokenLine(page, 'kimai-import')).toContainText('Never used');
	await expectNoToken(page);

	// Back out of the page and into it again.
	await page.goBack();
	await expect(page).not.toHaveURL(/\/account$/);
	await page.goForward();
	await expect(tokenLine(page, 'kimai-import')).toBeVisible();
	await expectNoToken(page);

	// Reopened: an empty name, no token.
	await page.waitForLoadState('networkidle');
	await newTokenButton(page).click();
	const form = dialog(page, 'New token');
	await expect(form.getByLabel('Name', { exact: true })).toHaveValue('');
	await expectNoToken(page);

	// Escape closes it onto its opener.
	await page.keyboard.press('Escape');
	await expect(form).toBeHidden();
	await expect(newTokenButton(page)).toBeFocused();
});

test('closed by Escape or Back, the made token is gone for good', async ({ page }) => {
	const user = await newUser('close');
	await signIn(page, user.username);
	// Into Account from the navigation, so Back has a screen of the app's own to go to.
	await page.waitForLoadState('networkidle');
	const more = page
		.getByRole('navigation', { name: 'Main' })
		.locator('summary, button', { hasText: 'More' });
	if (await more.isVisible()) await more.click();
	await page.getByRole('link', { name: 'Account' }).click();
	await expect(page).toHaveURL(/\/account$/);
	await expect(newTokenButton(page)).toBeVisible();

	const first = await makeToken(page, 'first');
	await page.keyboard.press('Escape');
	await expect(first.made).toBeHidden();
	await expect(newTokenButton(page)).toBeFocused();
	await expectNoToken(page);

	const second = await makeToken(page, 'second');
	await page.evaluate(() => history.back());
	await expect(second.made).toBeHidden();
	await expect(page).toHaveURL(/\/account$/);
	await expect(tokenLine(page, 'second')).toContainText('Never used');
	await expectNoToken(page);

	await newTokenButton(page).click();
	await expect(dialog(page, 'New token').getByLabel('Name', { exact: true })).toHaveValue('');
	await expectNoToken(page);
});

test('Back out of a full load with the token shown, then Forward: the token is gone', async ({
	page
}) => {
	const user = await newUser('bfcache');
	await signIn(page, user.username);
	await openAccount(page);
	const { made } = await makeToken(page, 'kimai-import');
	await expect(made).toBeVisible();

	await page.goBack();
	await expect(page).not.toHaveURL(/\/account$/);
	await page.goForward();
	await expect(page).toHaveURL(/\/account$/);
	await expect(page.getByRole('heading', { name: 'Agent access', level: 2 })).toBeVisible();
	await expect(dialog(page, 'Token made: kimai-import')).toHaveCount(0);
	await expectNoToken(page);
});

test('a refused name stays in the dialog under Name, the name kept', async ({ page }) => {
	const user = await newUser('refuse');
	await signIn(page, user.username);
	await openAccount(page);
	const { made } = await makeToken(page, 'kimai-import');
	await made.getByRole('button', { name: 'Done' }).click();

	await newTokenButton(page).click();
	const form = dialog(page, 'New token');
	const name = form.getByLabel('Name', { exact: true });
	await name.fill('kimai-import');
	await form.getByRole('button', { name: 'Create token' }).click();
	await expect(form.getByText('You already have a token with that name.')).toBeVisible();
	await expect(form).toBeVisible();
	await expect(name).toHaveValue('kimai-import');
	await expect(name).toBeFocused();
	await expect(name).toHaveAccessibleDescription(/You already have a token with that name\./);
	await expect(agentAccess(page).getByRole('listitem')).toHaveCount(1);

	await page.keyboard.press('Escape');
	await expect(form).toBeHidden();
	await expect(newTokenButton(page)).toBeFocused();
	await expect(page.getByText('You already have a token with that name.')).toHaveCount(0);
});

test('a 100-character name wraps: no sideways scroll, its ⋯ in view', async ({ page }) => {
	const user = await newUser('long');
	await signIn(page, user.username);
	await openAccount(page);
	const long = 'a'.repeat(100);

	const { made } = await makeToken(page, long);
	const title = made.getByRole('heading', { name: `Token made: ${long}` });
	const [titleBox, dialogBox] = [await title.boundingBox(), await made.boundingBox()];
	expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
	await made.getByRole('button', { name: 'Done' }).click();

	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await expect(opener(page, long)).toBeInViewport({ ratio: 1 });
});

test('Revoke… asks first; Revoke takes it from the list and from /mcp', async ({
	page,
	request
}) => {
	const user = await newUser('revoke');
	await signIn(page, user.username);
	await openAccount(page);
	const { made, token } = await makeToken(page, 'kimai-import');
	await made.getByRole('button', { name: 'Done' }).click();
	// The made token opens /mcp.
	expect((await callMcp(request, token)).status()).toBe(200);

	// Escape: nothing revoked, the focus back on the line's ⋯.
	let confirm = await pickRevoke(page, 'kimai-import');
	await expect(confirm.getByRole('button', { name: 'Revoke', exact: true })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(confirm).toBeHidden();
	await expect(opener(page, 'kimai-import')).toBeFocused();
	await expect(tokenLine(page, 'kimai-import')).toBeVisible();

	confirm = await pickRevoke(page, 'kimai-import');
	await confirm.getByRole('button', { name: 'Revoke', exact: true }).click();
	await expect(confirm).toBeHidden();
	await expect(agentAccess(page).getByText('Token revoked.')).toBeVisible();
	await expect(tokenLine(page, 'kimai-import')).toHaveCount(0);
	await expect(agentAccess(page).getByText('No tokens yet.')).toBeVisible();
	await expect(newTokenButton(page)).toBeFocused();

	expect((await callMcp(request, token)).status()).toBe(401);
});

test('an agent change with the token shows on History and undoes in one step', async ({
	page,
	request
}) => {
	const user = await newUser('change');
	await signIn(page, user.username);
	await openAccount(page);
	const { made, token } = await makeToken(page, 'Laptop');
	await made.getByRole('button', { name: 'Done' }).click();

	const res = await callMcp(request, token);
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body.result.isError).toBeUndefined();
	expect(body.result.structuredContent.batchId).toEqual(expect.any(String));

	await page.goto('/setup');
	await expect(setupLine(page, 'Agent Co')).toHaveCount(1);

	await page.goto('/history');
	await expect(page.getByRole('heading', { name: 'History', level: 1 })).toBeVisible();
	const row = batch(page, 'Agent tidy');
	await expect(row.getByText('Agent', { exact: true })).toBeVisible();
	await row.getByRole('button', { name: 'Undo Agent tidy', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Done: Undo "Agent tidy".');

	await page.goto('/setup');
	await expect(page.getByText('No customers yet.')).toBeVisible();
	await expect(setupLine(page, 'Agent Co')).toHaveCount(0);

	await openAccount(page);
	const line = tokenLine(page, 'Laptop');
	await expect(line).not.toContainText('Never used');
	await expect(line).toContainText(/Last used\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
});

test('the session cookie alone does not open /mcp', async ({ page }) => {
	const user = await newUser('cookie');
	await signIn(page, user.username);
	// The page's request client carries the signed-in session cookie.
	const res = await callMcp(page.request);
	expect(res.status()).toBe(401);
	expect(res.headers()['www-authenticate']).toBe('Bearer');
	expect(await res.json()).toEqual({ error: 'Unauthorized.' });
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('makes a token on the page, refuses a duplicate there, and revokes in two steps', async ({
		page
	}) => {
		const user = await newUser('nojs');
		await signIn(page, user.username);
		await openAccount(page);

		await newTokenButton(page).click();
		await expect(page).toHaveURL(/\/account\?new=token$/);
		const form = agentAccess(page);
		await form.getByLabel('Name', { exact: true }).fill('Laptop');
		await form.getByRole('button', { name: 'Create token' }).click();
		await expect(form.getByRole('heading', { name: 'Token made: Laptop' })).toBeVisible();
		await expect(form.getByRole('textbox')).toHaveValue(TOKEN);
		await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(0);
		await expect(tokenLine(page, 'Laptop')).toContainText('Never used');
		await form.getByRole('link', { name: 'Done' }).click();
		await expect(page).toHaveURL(/\/account$/);
		await expectNoToken(page);

		await newTokenButton(page).click();
		await form.getByLabel('Name', { exact: true }).fill('laptop');
		await form.getByRole('button', { name: 'Create token' }).click();
		await expect(form.getByText('You already have a token with that name.')).toBeVisible();
		await expect(form.getByLabel('Name', { exact: true })).toHaveValue('laptop');
		await form.getByRole('link', { name: 'Cancel' }).click();

		await opener(page, 'Laptop').click();
		await tokenLine(page, 'Laptop').getByRole('link', { name: 'Revoke…' }).click();
		await expect(page.getByRole('heading', { name: 'Revoke "Laptop"?' })).toBeVisible();
		await page.getByRole('button', { name: 'Revoke', exact: true }).click();
		await expect(page.getByText('Token revoked.')).toBeVisible();
		await expect(page.getByText('No tokens yet.')).toBeVisible();
	});
});
