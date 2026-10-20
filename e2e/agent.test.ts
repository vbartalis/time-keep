import {
	expect,
	test,
	type APIRequestContext,
	type BrowserContext,
	type Page
} from '@playwright/test';
import { PASSWORD, noonZone, seedEmptyUser } from './seed';

const zone = noonZone();
test.use({ timezoneId: zone });

/** A user of its own for each test, with no token until the test makes one. */
const newUser = (label: string) => seedEmptyUser(`${test.info().project.name}-${label}`);

async function signIn(page: Page, username: string) {
	await rememberZone(page.context());
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

const rememberZone = (context: BrowserContext) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(zone), domain: 'localhost', path: '/' }
	]);

const TOKEN = /^tk_[a-z2-7]{32}$/;

const openAccount = async (page: Page) => {
	await page.goto('/account');
	await expect(page.getByRole('heading', { name: 'Agent access', level: 2 })).toBeVisible();
};

/** Creates a token named `name` and answers it, read from the shown-once field. */
async function createToken(page: Page, name: string): Promise<string> {
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByRole('button', { name: 'Create token' }).click();
	const field = page.getByRole('textbox', { name, exact: true });
	await expect(field).toHaveValue(TOKEN);
	return field.inputValue();
}

const agentAccess = (page: Page) => page.getByRole('region', { name: 'Agent access' });

/** A token's line in the list, found by its name. */
const tokenLine = (page: Page, name: string) =>
	agentAccess(page)
		.getByRole('listitem')
		.filter({ has: page.getByText(name, { exact: true }) });

/** Revokes the token named `name` through both steps. */
async function revoke(page: Page, name: string) {
	await page.getByRole('button', { name: `Revoke ${name}` }).click();
	await expect(page.getByText(`Revoke "${name}"?`)).toBeVisible();
	await page.getByRole('button', { name: 'Yes, revoke' }).click();
	await expect(page.getByText('Token revoked.')).toBeVisible();
	await expect(page.getByText('No tokens yet.')).toBeVisible();
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
const setupLine = (page: Page, name: string) =>
	page.locator('details', { has: page.locator('summary', { hasText: name }) });

/** A History batch's row, found by its label exactly. */
const batch = (page: Page, label: string) =>
	page
		.getByRole('listitem')
		.filter({ has: page.getByText(label, { exact: true }) })
		.filter({ has: page.locator('details') });

test('makes a token shown once, lists it and refuses a duplicate name', async ({ page }) => {
	const user = await newUser('make');
	await signIn(page, user.username);
	await openAccount(page);
	await expect(page.getByText('No tokens yet.')).toBeVisible();

	const token = await createToken(page, 'Laptop');
	expect(token).toMatch(TOKEN);
	await expect(page.getByText('Copy it now: it is not shown again.')).toBeVisible();
	await expect(tokenLine(page, 'Laptop')).toContainText('Never used');

	await openAccount(page);
	await expect(page.getByRole('textbox', { name: 'Laptop', exact: true })).toHaveCount(0);
	await expect(page.getByText('Copy it now: it is not shown again.')).toHaveCount(0);
	await expect(tokenLine(page, 'Laptop')).toContainText('Never used');

	await page.getByLabel('Name', { exact: true }).fill('laptop');
	await page.getByRole('button', { name: 'Create token' }).click();
	await expect(page.getByRole('alert')).toHaveText('You already have a token with that name.');
	await expect(agentAccess(page).getByRole('listitem')).toHaveCount(1);
});

test('an agent change with the token shows on History and undoes in one step', async ({
	page,
	request
}) => {
	const user = await newUser('change');
	await signIn(page, user.username);
	await openAccount(page);
	const token = await createToken(page, 'Laptop');

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
	await expect(row.locator('p').first()).toHaveText('Agent tidy Agent');
	await row.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Done: Undo "Agent tidy".');

	await page.goto('/setup');
	await expect(page.getByText('No customers yet.')).toBeVisible();
	await expect(setupLine(page, 'Agent Co')).toHaveCount(0);

	await openAccount(page);
	const line = tokenLine(page, 'Laptop');
	await expect(line).not.toContainText('Never used');
	// The hidden prefix ends in a no-break space, so the name reads "Last used 2026-…".
	await expect(line.locator('.figures').filter({ hasText: 'Last used' })).toHaveText(
		/^Last used\s\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
	);
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

test('a revoked token is refused', async ({ page, request }) => {
	const user = await newUser('revoke');
	await signIn(page, user.username);
	await openAccount(page);
	const token = await createToken(page, 'Laptop');
	expect((await callMcp(request, token)).status()).toBe(200);

	await revoke(page, 'Laptop');
	expect((await callMcp(request, token)).status()).toBe(401);
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('makes a token and revokes it through both steps', async ({ page }) => {
		const user = await newUser('nojs');
		await signIn(page, user.username);
		await openAccount(page);

		await createToken(page, 'Laptop');
		await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(0);
		await expect(tokenLine(page, 'Laptop')).toContainText('Never used');

		await revoke(page, 'Laptop');
	});
});
