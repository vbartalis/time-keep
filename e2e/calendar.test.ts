import {
	expect,
	test,
	type BrowserContext,
	type Locator,
	type Page,
	type Request
} from '@playwright/test';
import {
	addDays,
	dayName,
	isoWeek,
	periodTitle,
	shift,
	weekStart
} from '../src/lib/calendar/dates';
import {
	PASSWORD,
	dateIn,
	earlyZone,
	editElsewhere,
	noonZone,
	seedCalendarWeek,
	seedCrowdedDay,
	seedCustomer,
	seedEmptyUser,
	seedEntry,
	seedProject,
	seedSpan,
	startElsewhere,
	type CalendarWeek
} from './seed';
import { LANE_FLOOR } from '../src/lib/components/calendar/block';

const zone = noonZone();
test.use({ timezoneId: zone });

const isPc = () => test.info().project.name === 'pc';

const rememberZone = (context: BrowserContext, at = zone) =>
	context.addCookies([
		{ name: 'tz', value: encodeURIComponent(at), domain: 'localhost', path: '/' }
	]);

async function signIn(page: Page, username: string, at = zone) {
	await rememberZone(page.context(), at);
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

const user = (name: string): Promise<CalendarWeek> =>
	seedCalendarWeek(`${test.info().project.name}-cal-${name}`, zone);

const toolbar = (page: Page) => page.getByRole('group', { name: 'Calendar toolbar' });
/** The date picker's summary (the Filter button is a summary too). */
const dateSummary = (page: Page) =>
	toolbar(page)
		.locator('summary')
		.filter({ hasNotText: /^\s*Filter/ });
const main = (page: Page) => page.getByRole('navigation', { name: 'Main' });

/** The address's query, as the toolbar's links make it. */
const query = (page: Page) => new URL(page.url()).searchParams;

/** Two frames drawn: the events dispatched before have been handled and rendered. */
const drawn = (page: Page) =>
	page.evaluate(
		() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
	);

/**
 * Does `act`, which must not move the calendar: once its events are handled and drawn, no
 * calendar data was asked for (a navigation would have) and the address is unchanged.
 */
async function staysPut(page: Page, act: () => Promise<unknown>) {
	const before = page.url();
	const asked: string[] = [];
	const onRequest = (r: Request) => {
		if (r.url().includes('/calendar/__data.json')) asked.push(r.url());
	};
	page.on('request', onRequest);
	await act();
	await drawn(page);
	page.off('request', onRequest);
	expect(asked).toEqual([]);
	expect(page.url()).toBe(before);
}

/** The period's title as this layout prints it: the phone's short, the PC's long. */
const titleOf = (view: 'day' | 'week' | 'month', date: string) =>
	periodTitle(view, date, isPc() ? 'long' : 'short').title;

/** A week's total as this layout prints it: the phone's after the week's number. */
const weekTotal = (date: string, total: string) =>
	isPc() ? `Week ${total}` : `Week ${isoWeek(date)} · ${total}`;

test('the sidebar opens this week, with its number and total', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s sidebar');
	const u = await user('sidebar');
	await signIn(page, u.username);
	await main(page).getByRole('link', { name: 'Calendar', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
	await expect(toolbar(page).getByText(`Week ${isoWeek(u.today)}`, { exact: true })).toBeVisible();
	await expect(toolbar(page).getByText('Week 0:00', { exact: true })).toBeVisible();
	await expect(toolbar(page).getByText(titleOf('week', u.today))).toBeVisible();
	await expect(toolbar(page).getByRole('link', { name: 'Week', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
});

test('the arrows, Today and the views move the address', async ({ page }) => {
	const u = await user('moves');
	await signIn(page, u.username);
	await page.goto('/calendar');
	const last = addDays(u.today, -7);

	await toolbar(page).getByRole('link', { name: 'Previous week' }).click();
	await expect(page).toHaveURL(new RegExp(`date=${last}`));
	expect(query(page).get('view')).toBe('week');
	await expect(toolbar(page).getByText(titleOf('week', last))).toBeVisible();
	// Last week's total, in the seed's shapes (a day's start date holds an entry's whole time).
	await expect(toolbar(page).getByText(weekTotal(last, '23:45'), { exact: true })).toBeVisible();
	if (isPc())
		await expect(toolbar(page).getByText(`Week ${isoWeek(last)}`, { exact: true })).toBeVisible();

	await toolbar(page).getByRole('link', { name: 'Next week' }).click();
	await expect(page).toHaveURL(new RegExp(`date=${u.today}`));

	await toolbar(page).getByRole('link', { name: 'Previous week' }).click();
	await expect(page).toHaveURL(new RegExp(`date=${last}`));
	await toolbar(page).getByRole('link', { name: 'Today', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`date=${u.today}`));

	await toolbar(page).getByRole('link', { name: 'Previous week' }).click();
	for (const view of ['Day', 'Month', 'Week'] as const) {
		await toolbar(page).getByRole('link', { name: view, exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`view=${view.toLowerCase()}&date=${last}`));
		await expect(toolbar(page).getByRole('link', { name: view, exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
	}
});

test('the totals follow the view', async ({ page }) => {
	const u = await user('totals');
	await signIn(page, u.username);
	const tuesday = u.lastWeekDay(1);
	await page.goto(`/calendar?view=day&date=${tuesday}`);
	// Tuesday: 0:15 + 2:00 + 1:30 + 1:30 + the late entry's 2:00 by its start date.
	await expect(toolbar(page).getByText('Day 7:15 · Week 23:45', { exact: true })).toBeVisible();
	await page.goto(`/calendar?view=month&date=${tuesday}`);
	await expect(toolbar(page).getByText(/^Month \d+:\d\d$/)).toBeVisible();
});

test('the picker reaches a day of last month', async ({ page }) => {
	const u = await user('picker');
	await signIn(page, u.username);
	await page.goto('/calendar');
	const picker = page.getByRole('group', { name: 'Choose a date' });
	await dateSummary(page).click();
	await picker.getByRole('link', { name: 'Previous month' }).click();
	const last = shift('month', `${u.today.slice(0, 8)}01`, -1).slice(0, 7);
	await expect(page).toHaveURL(new RegExp(`pick=${last}`));
	await expect(picker.getByText(/^[A-Z][a-z]+ \d{4}$/)).toBeVisible();
	await picker.getByRole('link', { name: '15', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`view=week&date=${last}-15$`));
	await expect(
		toolbar(page).getByText(titleOf('week', `${last}-15`), { exact: true })
	).toBeVisible();
	// The picker is closed again on the new period.
	await expect(picker.getByRole('link', { name: '15', exact: true })).toBeHidden();
});

test('the phone’s bar opens the day view of today', async ({ page }) => {
	test.skip(isPc(), 'the phone’s bar');
	const u = await user('bar');
	await signIn(page, u.username);
	await main(page).getByRole('link', { name: 'Calendar', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
	expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/calendar?view=day');
	await expect(toolbar(page).getByText(titleOf('day', u.today), { exact: true })).toBeVisible();
	await expect(toolbar(page).getByRole('link', { name: 'Day', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(main(page).getByRole('link', { name: 'Calendar', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
});

test('new entry carries the date in view', async ({ page }) => {
	const u = await user('new');
	await signIn(page, u.username);
	const tuesday = u.lastWeekDay(1);
	await page.goto(`/calendar?view=week&date=${tuesday}`);
	const link = page.getByRole('link', { name: 'New entry' }).locator('visible=true');
	await expect(link).toHaveAttribute('href', new RegExp(`&date=${tuesday}$`));
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('every toolbar link and the picker work', async ({ page }) => {
		const u = await user('nojs');
		await signIn(page, u.username);
		await page.goto('/calendar');
		const last = addDays(u.today, -7);

		await toolbar(page).getByRole('link', { name: 'Previous week' }).click();
		await expect(page).toHaveURL(new RegExp(`date=${last}`));
		await toolbar(page).getByRole('link', { name: 'Next week' }).click();
		await toolbar(page).getByRole('link', { name: 'Today', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`date=${u.today}`));
		await toolbar(page).getByRole('link', { name: 'Day', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`view=day&date=${u.today}`));
		await toolbar(page).getByRole('link', { name: 'Month', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`view=month&date=${u.today}`));
		await toolbar(page).getByRole('link', { name: 'Week', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`view=week&date=${u.today}`));

		const picker = page.getByRole('group', { name: 'Choose a date' });
		await dateSummary(page).click();
		await picker.getByRole('link', { name: 'Previous month' }).click();
		const month = shift('month', `${u.today.slice(0, 8)}01`, -1).slice(0, 7);
		await picker.getByRole('link', { name: '15', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`view=week&date=${month}-15$`));
		await expect(
			toolbar(page).getByText(
				isPc() ? `Week ${isoWeek(`${month}-15`)}` : titleOf('week', `${month}-15`),
				{
					exact: true
				}
			)
		).toBeVisible();
	});
});

test('the toolbar’s focus order is its on-screen order', async ({ page }) => {
	const u = await user('order');
	await signIn(page, u.username);
	await page.goto('/calendar');
	// Server-rendered, the phone's Filter is a <summary> between Month and Today; once the
	// page hydrates it becomes the sheet's <button>, which this read leaves out. Read only
	// the hydrated order (the PC's Filter is the same <summary> either way).
	if (!isPc()) await expect(toolbar(page).getByRole('button', { name: 'Filter' })).toBeVisible();
	const controls = await toolbar(page)
		.locator('a[href], summary')
		.evaluateAll((els) =>
			els
				.filter((el) => el.checkVisibility())
				.map((el) => {
					const r = el.getBoundingClientRect();
					return {
						name: el.getAttribute('aria-label') ?? el.textContent!.trim(),
						y: r.y,
						bottom: r.bottom,
						x: r.x
					};
				})
		);
	// Each layout has its own order: the phone's rows, the PC's row.
	const first = controls.map((c) => c.name.split(/\s+/)[0]);
	expect(first).toEqual(
		isPc()
			? ['Previous', 'Today', 'Next', expect.stringMatching(/\d/), 'Filter', 'Day', 'Week', 'Month']
			: ['Day', 'Week', 'Month', 'Today', 'Previous', expect.stringMatching(/\d/), 'Next']
	);
	// Rows top to bottom, then left to right within a row (controls whose boxes share
	// height are one row).
	const visual = [...controls].sort((a, b) =>
		a.y < b.bottom && b.y < a.bottom ? a.x - b.x : a.y - b.y
	);
	expect(controls.map((c) => c.name)).toEqual(visual.map((c) => c.name));
});

// The day and week grid.

/** The grid in view (the phone's and the PC's are drawn apart; one is shown). */
const grid = (page: Page, view: 'Week' | 'Day') =>
	page.getByRole('region', { name: `${view} grid` });
const column = (page: Page, view: 'Week' | 'Day', date: string) =>
	grid(page, view).locator(`[data-date="${date}"]`);
const head = (page: Page, view: 'Week' | 'Day', date: string) =>
	column(page, view, date).locator('[data-day-head]');
const block = (page: Page, view: 'Week' | 'Day', id: string) =>
	grid(page, view).locator(`[data-entry-id="${id}"]`);

/** Every block's text ends inside it: nothing is cut through a line. */
async function textFits(page: Page, view: 'Week' | 'Day') {
	const cut = await grid(page, view)
		.locator('[data-entry-id]')
		.evaluateAll((els) =>
			els
				.filter((el) => el.scrollHeight > el.clientHeight + 1)
				.map((el) => `${el.getAttribute('title')}: ${el.scrollHeight} > ${el.clientHeight}`)
		);
	expect(cut).toEqual([]);
}

/** Whether an element's text runs past its box: at its side, or past its last line. */
const overflow = (el: Locator) =>
	el.evaluate((e) => ({
		wide: e.scrollWidth > e.clientWidth + 1,
		tall: e.scrollHeight > e.clientHeight + 1
	}));

test('last week’s grid: blocks, totals, the overlap and the late entry', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s week');
	const u = await user('grid');
	await signIn(page, u.username);
	await page.goto(`/calendar?view=week&date=${u.lastMonday}`);

	for (let n = 0; n < 5; n++) {
		const col = column(page, 'Week', u.lastWeekDay(n));
		await expect(col.getByRole('link', { name: /ClientY – ProjectZ/ })).toHaveCount(2);
		await expect(col.getByRole('link', { name: /CompY – Support/ })).toHaveCount(1);
		await expect(col.getByText('ClientY – ProjectZ').first()).toBeVisible();
	}
	// Each head's total is the seed's sum for that day (the late entry counts on Tuesday).
	const totals = ['3:15', '7:15', '4:15', '4:45', '4:15', '0:00', '0:00'];
	for (const [n, total] of totals.entries())
		await expect(
			head(page, 'Week', u.lastWeekDay(n)).getByText(total, { exact: true })
		).toBeVisible();

	// Wednesday's overlap: side by side, each marked.
	const wednesday = column(page, 'Week', u.lastWeekDay(2));
	const marked = wednesday.getByRole('link', { name: /Overlaps another entry/ });
	await expect(marked).toHaveCount(2);
	const [a, b] = await Promise.all([marked.nth(0).boundingBox(), marked.nth(1).boundingBox()]);
	expect(a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x).toBe(true);

	// The late entry runs on into Wednesday, saying so.
	const late = block(page, 'Week', u.entries.late);
	await expect(late).toHaveCount(2);
	const next = wednesday.locator(`[data-entry-id="${u.entries.late}"]`);
	await expect(next.getByText('from the previous day')).toBeVisible();
	await expect(next).toHaveAttribute('data-first', 'false');
	await expect(next).toHaveAttribute('data-last', 'true');
	// A block names its day, which the screen shows only by its column: each piece its own.
	await expect(next).toHaveAccessibleName(new RegExp(`^${dayName(u.lastWeekDay(2))}, `));
	await expect(block(page, 'Week', u.entries.tuesdaySupport)).toHaveAccessibleName(
		new RegExp(`^${dayName(u.lastWeekDay(1))}, .*CompY – Support, `)
	);

	// A block's tooltip holds its description.
	await expect(block(page, 'Week', u.entries.tuesdaySupport)).toHaveAttribute(
		'title',
		/Support on tuesday/
	);

	// Scrolled to the working day: 07:00 at the top, under the heads.
	const headBottom = await head(page, 'Week', u.lastMonday).evaluate(
		(el) => el.getBoundingClientRect().bottom
	);
	const seven = grid(page, 'Week').locator('[data-hour="7"]');
	await expect
		.poll(async () => Math.round((await seven.boundingBox())!.y - headBottom))
		.toBeLessThanOrEqual(4);
	expect((await seven.boundingBox())!.y).toBeGreaterThanOrEqual(headBottom - 2);
	await textFits(page, 'Week');
});

test('three overlapping entries: one and a chip in the week, all three in the day', async ({
	page
}) => {
	test.skip(!isPc(), 'the PC’s week');
	const u = await user('three');
	seedEntry(u.id, zone, {
		projectId: u.projects.support,
		date: u.lastWeekDay(2),
		start: '10:45',
		end: '11:15',
		description: 'A third on top'
	});
	await signIn(page, u.username);
	await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
	// Three lanes do not fit a week's column: the first is drawn, a chip counts the others.
	const wednesday = column(page, 'Week', u.lastWeekDay(2));
	const marked = wednesday.getByRole('link', { name: /Overlaps another entry/ });
	await expect(marked).toHaveCount(1);
	const shown = marked.locator('[data-name]');
	await expect(shown).toHaveText('ClientY – ProjectZ');
	expect(await overflow(shown)).toEqual({ wide: false, tall: false });
	await expect(wednesday.locator('[data-more-chip]')).toHaveText('+2');
	await textFits(page, 'Week');

	// The day hides nothing: each shows its project whole.
	await openCalendar(page, `/calendar?view=day&date=${u.lastWeekDay(2)}`);
	const all = grid(page, 'Day').getByRole('link', { name: /Overlaps another entry/ });
	await expect(all).toHaveCount(3);
	for (const name of ['ClientY – ProjectZ', 'time-keep', 'CompY – Support']) {
		const text = all.filter({ hasText: name }).locator('[data-name]');
		await expect(text).toBeVisible();
		await expect(text).toContainText(name);
		// The whole name shows: nothing cut off at its side or its foot.
		expect(await overflow(text)).toEqual({ wide: false, tall: false });
	}
	await textFits(page, 'Day');
});

test('back-to-back short entries are drawn apart', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s week');
	const u = await user('backtoback');
	const saturday = u.lastWeekDay(5);
	const first = seedEntry(u.id, zone, {
		projectId: u.projects.support,
		date: saturday,
		start: '09:30',
		end: '09:45',
		description: 'First quarter'
	});
	const second = seedEntry(u.id, zone, {
		projectId: u.projects.timeKeep,
		date: saturday,
		start: '09:45',
		end: '10:00',
		description: 'Second quarter'
	});
	await signIn(page, u.username);
	await page.goto(`/calendar?view=week&date=${u.lastMonday}`);
	const a = (await block(page, 'Week', first).boundingBox())!;
	const b = (await block(page, 'Week', second).boundingBox())!;
	const apart =
		a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
	expect(apart).toBe(true);
	await textFits(page, 'Week');
});

// Crowded columns: only blocks drawn into each other share a column (spec, item 19).

/** The suite's tests in a zone where it is early morning now: the crowded timer is short. */
const early = test.extend<{ earlyAt: string }>({
	// eslint-disable-next-line no-empty-pattern
	earlyAt: async ({}, use) => use(earlyZone())
});

/** Pairs of boxes drawn over each other, by name. */
const intersecting = (
	boxes: { name: string; x: number; y: number; width: number; height: number }[]
) =>
	boxes.flatMap((a, i) =>
		boxes
			.slice(i + 1)
			.filter(
				(b) =>
					a.x < b.x + b.width - 0.5 &&
					b.x < a.x + a.width - 0.5 &&
					a.y < b.y + b.height - 0.5 &&
					b.y < a.y + a.height - 0.5
			)
			.map((b) => `${a.name} × ${b.name}`)
	);

/** Every block and chip in an element, with its box. */
const drawnIn = (el: Locator) =>
	el.locator('[data-entry-id], [data-more-chip]').evaluateAll((els) =>
		els.map((e) => {
			const r = e.getBoundingClientRect();
			return {
				name: e.getAttribute('aria-label') ?? '',
				x: r.x,
				y: r.y,
				width: r.width,
				height: r.height
			};
		})
	);

test.describe('crowded columns', () => {
	// The browser in that zone too (over the file's), so the zone it reports keeps the cookie's.
	early.use({ timezoneId: async ({ earlyAt }, use) => use(earlyAt) });
	async function crowdedWeek(page: Page, at: string, name: string) {
		const u = await seedCrowdedDay(`${test.info().project.name}-crowd-${name}`, at);
		await signIn(page, u.username, at);
		await openCalendar(page, `/calendar?view=week&date=${u.today}`);
		return u;
	}
	const bodyOf = (page: Page, date: string) =>
		column(page, 'Week', date).locator('[data-body]').boundingBox();

	early('a lone block takes the column’s width', async ({ page, earlyAt }) => {
		test.skip(!isPc(), 'the PC’s week');
		const u = await crowdedWeek(page, earlyAt, 'lone');
		const body = (await bodyOf(page, u.today))!;
		await expect
			.poll(async () =>
				Math.abs((await block(page, 'Week', u.entries.audit).boundingBox())!.width - body.width + 2)
			)
			.toBeLessThanOrEqual(1);
	});

	early('the crowded minute shows what fits and a chip', async ({ page, earlyAt }) => {
		test.skip(!isPc(), 'the PC’s week');
		const u = await crowdedWeek(page, earlyAt, 'minute');
		await expect(block(page, 'Week', u.entries.running)).toBeVisible();
		for (const id of u.entries.crowded.slice(1))
			await expect(block(page, 'Week', id)).toHaveCount(0);
		const chip = column(page, 'Week', u.today).locator('[data-more-chip]');
		await expect(chip).toHaveCount(1);
		await expect(chip).toHaveText('+4');
		await expect(chip).toHaveAccessibleName(
			`4 more entries from ${u.crowdAt}, ${dayName(u.today)}; open the day`
		);
		await expect(chip).toHaveAttribute('href', `/calendar?view=day&date=${u.today}`);
	});

	early('names wrap only between words', async ({ page, earlyAt }) => {
		test.skip(!isPc(), 'the PC’s week');
		const u = await crowdedWeek(page, earlyAt, 'words');
		await expect(block(page, 'Week', u.entries.long).locator('[data-word]').first()).toBeVisible();
		const bad = await grid(page, 'Week').evaluate((g) => {
			const out: string[] = [];
			// One line per word: an ellipsis may split a word's box where it cuts, never its line.
			for (const w of g.querySelectorAll('[data-word]')) {
				const tops = [...w.getClientRects()].map((r) => Math.round(r.top));
				if (tops.length === 0 || tops.some((t) => Math.abs(t - tops[0]) > 1))
					out.push(`"${w.textContent}" in "${w.closest('[data-name]')?.textContent}" breaks`);
			}
			for (const name of g.querySelectorAll('[data-name]')) {
				const first = name.querySelector('[data-word]');
				if (!first) {
					out.push(`"${name.textContent}" has no words`);
					continue;
				}
				const w = first.getBoundingClientRect();
				const n = name.getBoundingClientRect();
				if (w.right > n.right + 0.5 || w.bottom > n.bottom + 0.5)
					out.push(`"${first.textContent}" cut (${Math.round(w.right)} > ${Math.round(n.right)})`);
			}
			return out;
		});
		expect(bad).toEqual([]);
		await textFits(page, 'Week');
	});

	early('the overlapping three share two lanes', async ({ page, earlyAt }) => {
		test.skip(!isPc(), 'the PC’s week');
		const u = await crowdedWeek(page, earlyAt, 'three');
		const body = (await bodyOf(page, u.today))!;
		const half = body.width / 2 - 2;
		const box = async (id: string) => (await block(page, 'Week', id).boundingBox())!;
		const [long, meeting, afternoon] = [
			await box(u.entries.long),
			await box(u.entries.meeting),
			await box(u.entries.afternoon)
		];
		expect(Math.abs(long.width - half)).toBeLessThanOrEqual(1);
		expect(Math.abs(meeting.width - half)).toBeLessThanOrEqual(1);
		expect(Math.abs(afternoon.width - long.width)).toBeLessThanOrEqual(1);
		// Side by side: the long one in the first lane, the other two in the second.
		expect(meeting.x).toBeGreaterThanOrEqual(long.x + long.width);
		expect(afternoon.x).toBeGreaterThanOrEqual(long.x + long.width);
		// A lane this narrow draws the narrow block's 2 px padding, which the floor counts on.
		await expect(block(page, 'Week', u.entries.long).locator('> span').first()).toHaveCSS(
			'padding-left',
			'2px'
		);
	});

	early('the chip opens the day by keyboard', async ({ page, earlyAt }) => {
		test.skip(!isPc(), 'the PC’s week');
		const u = await crowdedWeek(page, earlyAt, 'chip');
		await column(page, 'Week', u.today).locator('[data-more-chip]').focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(new RegExp(`view=day&date=${u.today}`));
		const ids = u.entries.crowded;
		for (const id of ids) await expect(block(page, 'Day', id)).toBeVisible();
		const boxes = await Promise.all(
			ids.map(async (id) => (await block(page, 'Day', id).boundingBox())!)
		);
		boxes.sort((a, b) => a.x - b.x);
		for (let i = 1; i < boxes.length; i++)
			expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
	});

	early('at 1100 px a column still draws two lanes', async ({ page, earlyAt }) => {
		test.skip(!isPc(), 'the PC’s week');
		await page.setViewportSize({ width: 1100, height: 900 });
		const u = await crowdedWeek(page, earlyAt, 'narrow');
		const today = column(page, 'Week', u.today);
		// Two lanes even under two floors' width: the crowd is one block and a chip, the
		// running block drawn; the three overlapping ones all drawn.
		await expect(today.locator('[data-more-chip]')).toHaveText(['+4']);
		for (const id of [
			u.entries.running,
			u.entries.audit,
			u.entries.long,
			u.entries.meeting,
			u.entries.afternoon
		])
			await expect(block(page, 'Week', id)).toBeVisible();
		await expect(today.locator('[data-entry-id]')).toHaveCount(5);
		expect(intersecting(await drawnIn(grid(page, 'Week')))).toEqual([]);
	});

	early(
		'a tall block in a shared lane keeps its times and description',
		async ({ page, earlyAt }) => {
			test.skip(!isPc(), 'the PC’s week');
			const u = await crowdedWeek(page, earlyAt, 'tall');
			const long = block(page, 'Week', u.entries.long);
			await expect(long.locator('[data-times]')).toBeVisible();
			await expect(long.locator('[data-times]')).toHaveText('08:00–13:30');
			await expect(long.getByText('Long development')).toBeVisible();
			await textFits(page, 'Week');
		}
	);
});

test('the grid keeps its scroll as now moves on', async ({ page }) => {
	const u = await user('keepscroll');
	await page.clock.install();
	await signIn(page, u.username);
	const view = isPc() ? 'week' : 'day';
	await page.goto(`/calendar?view=${view}`);
	await page.waitForLoadState('networkidle');
	const scroller = grid(page, isPc() ? 'Week' : 'Day').locator('[data-grid-scroll]');
	// It opened on the working day; the user scrolls up to midnight.
	await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
	await scroller.evaluate((el) => (el.scrollTop = 0));
	// Two ticks of the clock: the line at now moves, the scroll does not.
	const nowTag = grid(page, isPc() ? 'Week' : 'Day').locator('[data-now-tag]');
	const before = await nowTag.textContent();
	await page.clock.runFor(65_000);
	await expect(nowTag).not.toHaveText(before!);
	expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
});

test('past midnight with the page open, the calendar reloads for the new day', async ({ page }) => {
	const u = await user('midnight');
	await page.clock.install();
	await signIn(page, u.username);
	await openCalendar(page, `/calendar?view=${isPc() ? 'week' : 'day'}`);
	// The device's clock (in the screen's zone) to just past the next midnight.
	const toMidnight = await page.evaluate(() => {
		const d = new Date();
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - d.getTime();
	});
	const reload = page.waitForRequest((r) => r.url().includes('/calendar/__data.json'));
	await page.clock.fastForward(toMidnight + 31_000);
	await reload;
});

test('a long-running timer’s block says how long, uncut, in the week', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s week');
	const u = await user('runninglong');
	const ago = new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(Date.now() - 100 * 60_000);
	const id = startElsewhere(u.id, u.projects.projectZ, zone, ago, 'Calendar views: the week grid');
	await signIn(page, u.username);
	await page.goto('/calendar?view=week');
	const label = block(page, 'Week', id).locator('[data-running]');
	await expect(label).toHaveText(/^now · Running 1:4\d$/);
	expect(await overflow(block(page, 'Week', id).locator('[data-times]'))).toEqual({
		wide: false,
		tall: false
	});
});

test('a block opens its entry over the calendar, and Back returns to the week', async ({
	page
}) => {
	const u = await user('open');
	await signIn(page, u.username);
	const tuesday = u.lastWeekDay(1);
	const view = isPc() ? 'Week' : 'Day';
	await page.goto(`/calendar?view=${view.toLowerCase()}&date=${tuesday}`);
	await page.waitForLoadState('networkidle');
	await block(page, view, u.entries.tuesdaySupport).click();
	const form = page.getByRole('dialog', { name: 'Edit entry' });
	await expect(form).toBeVisible();
	await expect(form.getByLabel('Description')).toHaveValue('Support on tuesday');
	await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
	await page.goBack();
	await expect(form).toBeHidden();
	expect(query(page).get('view')).toBe(view.toLowerCase());
	expect(query(page).get('date')).toBe(tuesday);
	await expect(block(page, view, u.entries.tuesdaySupport)).toBeVisible();
});

test('a running timer grows to now, with the line at now in today’s column', async ({ page }) => {
	const u = await user('running');
	const halfHourAgo = new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(Date.now() - 30 * 60_000);
	const id = startElsewhere(u.id, u.projects.projectZ, zone, halfHourAgo, 'Calendar views');
	await signIn(page, u.username);
	const view = isPc() ? 'Week' : 'Day';
	await page.goto(`/calendar?view=${view.toLowerCase()}`);
	const running = block(page, view, id);
	await expect(running).toBeVisible();
	await expect(running.getByText(/Running 0:3\d/)).toBeVisible();
	await expect(running).toHaveAccessibleName(/Running/);
	const line = column(page, view, u.today).locator('[data-now-line]');
	await expect(line).toBeVisible();
	await expect(grid(page, view).locator('[data-now-line]')).toHaveCount(1);
	await expect(head(page, view, u.today).getByText(/^0:3\d$/)).toBeVisible();
});

test('the day’s now dot is not covered by the hour gutter', async ({ page }) => {
	const u = await user('nowdot');
	await signIn(page, u.username);
	await page.goto('/calendar?view=day');
	const dot = grid(page, 'Day').locator('[data-now-dot]');
	await dot.scrollIntoViewIfNeeded();
	await expect(dot).toBeVisible();
	// The dot takes no pointer, so it is never the hit: what is drawn over its box is the
	// gutter (the sticky hour column) or it is not.
	const covered = await dot.evaluate((el) => {
		const r = el.getBoundingClientRect();
		const y = r.top + r.height / 2;
		return [r.left + 1, r.left + r.width / 2, r.right - 1].some((x) =>
			document.elementFromPoint(x, y)?.closest('.sticky.left-0')
		);
	});
	expect(covered).toBe(false);
});

test('a long unbroken word in a description wraps within the block', async ({ page }) => {
	const u = await user('longword');
	const tuesday = u.lastWeekDay(1);
	const id = seedEntry(u.id, zone, {
		projectId: u.projects.support,
		date: tuesday,
		start: '05:00',
		end: '07:00',
		description: 'https://example.com/a/very/long/unbroken/address/that/must/wrap/somewhere'
	});
	await signIn(page, u.username);
	await page.goto(`/calendar?view=day&date=${tuesday}`);
	const b = block(page, 'Day', id);
	await expect(b).toBeVisible();
	// Wrapped in the word, no line of it runs past the block's right edge.
	const clipped = await b.evaluate((el) => {
		const d = [...el.querySelectorAll('span')].find((s) => s.textContent?.startsWith('https://'))!;
		const range = document.createRange();
		range.selectNodeContents(d);
		return (
			Math.max(...[...range.getClientRects()].map((r) => r.right)) >
			el.getBoundingClientRect().right + 0.5
		);
	});
	expect(clipped).toBe(false);
});

test('the phone’s day: blocks run the full width, text ends on whole lines', async ({ page }) => {
	test.skip(isPc(), 'the phone’s day');
	const u = await user('phoneday');
	await signIn(page, u.username);
	const tuesday = u.lastWeekDay(1);
	await page.goto(`/calendar?view=day&date=${tuesday}`);
	const col = column(page, 'Day', tuesday);
	const width = (await col.boundingBox())!.width;
	for (const id of [u.entries.tuesdayDevelopment, u.entries.tuesdaySupport]) {
		const box = (await block(page, 'Day', id).boundingBox())!;
		expect(box.width).toBeGreaterThan(width * 0.9);
	}
	await expect(block(page, 'Day', u.entries.tuesdayDevelopment)).toContainText(
		'ClientY – ProjectZ'
	);
	await textFits(page, 'Day');
});

test('the phone’s week: letter, date and total per column; a tap opens the day', async ({
	page
}) => {
	test.skip(isPc(), 'the phone’s week');
	const u = await user('phoneweek');
	await signIn(page, u.username);
	await page.goto(`/calendar?view=week&date=${u.lastMonday}`);
	const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	const totals = ['3:15', '7:15', '4:15', '4:45', '4:15', '–', '–'];
	for (let n = 0; n < 7; n++) {
		const h = head(page, 'Week', u.lastWeekDay(n));
		await expect(h.getByText(letters[n], { exact: true })).toBeVisible();
		await expect(
			h.getByText(String(Number(u.lastWeekDay(n).slice(8))), { exact: true })
		).toBeVisible();
		await expect(h.getByText(totals[n], { exact: true })).toBeVisible();
	}
	const thursday = column(page, 'Week', u.lastWeekDay(3));
	await expect(thursday).toHaveAttribute('href', /view=day/);
	await thursday.click({ position: { x: 20, y: 200 } });
	await expect(page).toHaveURL(new RegExp(`view=day&date=${u.lastWeekDay(3)}`));
	await expect(grid(page, 'Day')).toBeVisible();
});

test.describe('the grid without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('shows from 00:00 and its blocks are links to their forms', async ({ page }) => {
		const u = await user('gridnojs');
		await signIn(page, u.username);
		const view = isPc() ? 'Week' : 'Day';
		const tuesday = u.lastWeekDay(1);
		await page.goto(`/calendar?view=${view.toLowerCase()}&date=${tuesday}`);
		await expect(grid(page, view).locator('[data-grid-scroll]')).toHaveJSProperty('scrollTop', 0);
		await block(page, view, u.entries.tuesdaySupport).first().click();
		await expect(page).toHaveURL(new RegExp(`/entries/${u.entries.tuesdaySupport}\\?back=`));
	});
});

// The month.

/** A fresh user with this month's 10th (three entries, 2:45) and 11th (five, 2:30). */
async function monthUser(name: string) {
	const u = await seedEmptyUser(`${test.info().project.name}-month-${name}`);
	const today = dateIn(zone);
	const ym = today.slice(0, 7);
	const customer = seedCustomer(u.id, 'CompX');
	const one = seedProject(u.id, customer, 'ClientY – ProjectZ');
	const two = seedProject(u.id, customer, 'CompY – Support');
	const put = (date: string, start: string, end: string, projectId: string, description: string) =>
		seedEntry(u.id, zone, { projectId, start, end, description, date });
	const a = `${ym}-10`;
	const b = `${ym}-11`;
	const ids = [
		put(a, '09:00', '09:30', one, 'Standup'),
		put(a, '10:00', '11:00', one, 'Tuned the search'),
		put(a, '13:00', '14:15', two, 'Support ticket')
	];
	const five = ['08:00', '09:00', '10:00', '11:00', '12:00'].map((start, n) =>
		put(b, start, start.replace(':00', ':30'), n % 2 ? two : one, `Entry ${n}`)
	);
	return { ...u, today, ym, a, b, ids, five, first: `${ym}-01` };
}

const month = (page: Page) => page.getByRole('region', { name: 'Month grid' });
const cell = (page: Page, date: string) => month(page).locator(`[data-date="${date}"]`);

test.describe('the PC’s month', () => {
	test.skip(({ isMobile }) => isMobile, 'the PC’s month');

	test('cells show each day’s total, the week column its sum', async ({ page }) => {
		const u = await monthUser('totals');
		await signIn(page, u.username);
		await page.goto(`/calendar?view=month&date=${u.first}`);
		await expect(cell(page, u.a).getByText('2:45', { exact: true })).toBeVisible();
		await expect(cell(page, u.b).getByText('2:30', { exact: true })).toBeVisible();
		const row = (date: string) => month(page).locator(`[data-week="${weekStart(date)}"]`);
		await expect(row(u.a)).toContainText(`${isoWeek(u.a)}`);
		const sum = weekStart(u.a) === weekStart(u.b) ? '5:15' : '2:45';
		await expect(row(u.a).locator('[data-week-total]')).toHaveText(sum);
		await expect(toolbar(page).getByText('Month 5:15', { exact: true })).toBeVisible();
		// An entry line names its day; today's date says it is today.
		await expect(cell(page, u.a).locator('a[data-entry-form]').first()).toHaveAccessibleName(
			`${dayName(u.a)}, CompX › ClientY – ProjectZ, 09:00–09:30`
		);
		await expect(
			cell(page, u.today).getByRole('link', { name: String(Number(u.today.slice(8))) })
		).toHaveAttribute('aria-current', 'date');
	});

	test('a day of five shows four and “+1 more”', async ({ page }) => {
		const u = await monthUser('more');
		await signIn(page, u.username);
		await page.goto(`/calendar?view=month&date=${u.first}`);
		await expect(cell(page, u.b).locator('a[data-entry-form]')).toHaveCount(4);
		await expect(cell(page, u.b).getByRole('link', { name: '+1 more' })).toHaveAttribute(
			'href',
			new RegExp(`view=day&date=${u.b}`)
		);
		await expect(cell(page, u.a).getByText('more')).toHaveCount(0);
	});

	test('a date opens its day view; an entry line its form', async ({ page }) => {
		const u = await monthUser('open');
		await signIn(page, u.username);
		await page.goto(`/calendar?view=month&date=${u.first}`);
		await cell(page, u.a)
			.getByRole('link', { name: String(Number(u.a.slice(8))), exact: true })
			.click();
		await expect(page).toHaveURL(new RegExp(`view=day&date=${u.a}`));
		// The cell's empty space, under its entries, opens the day too.
		await page.goto(`/calendar?view=month&date=${u.first}`);
		await cell(page, u.a).click({ position: { x: 20, y: 130 } });
		await expect(page).toHaveURL(new RegExp(`view=day&date=${u.a}`));
		await page.goto(`/calendar?view=month&date=${u.first}`);
		await cell(page, u.a).locator('a[data-entry-form]').first().click();
		await expect(page).toHaveURL(new RegExp(`/entries/${u.ids[0]}\\?back=`));
	});
});

test.describe('the phone’s month', () => {
	test.skip(({ isMobile }) => !isMobile, 'the phone’s month');

	test('a tap lists the day under the grid; a row opens its form', async ({ page }) => {
		const u = await monthUser('phone');
		await signIn(page, u.username);
		await page.goto(`/calendar?view=month&date=${u.first}`);
		await expect(cell(page, u.a)).toContainText('2:45');
		await cell(page, u.a).click();
		await expect(page).toHaveURL(new RegExp(`view=month&date=${u.a}`));
		const list = page.getByRole('region', { name: 'Day list' });
		await expect(list.locator(`a[href*="view=day&date=${u.a}"]`)).toContainText('2:45');
		await expect(list.locator('a[data-entry-form]')).toHaveCount(3);
		await list.locator('a[data-entry-form]').nth(1).click();
		await expect(page).toHaveURL(new RegExp(`/entries/${u.ids[1]}\\?back=`));
	});

	test('the last row clears the “+” at the end of the page', async ({ page }) => {
		const u = await monthUser('clear');
		await signIn(page, u.username);
		await page.goto(`/calendar?view=month&date=${u.b}`);
		const rows = page.getByRole('region', { name: 'Day list' }).locator('a[data-entry-form]');
		await expect(rows).toHaveCount(5);
		await rows.last().scrollIntoViewIfNeeded();
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		const last = (await rows.last().boundingBox())!;
		const plus = (await page
			.getByRole('link', { name: 'New entry' })
			.locator('visible=true')
			.boundingBox())!;
		expect(last.y + last.height).toBeLessThanOrEqual(plus.y);
	});
});

// Keys, swipe and creating from the grid.

/** Opens a calendar address and waits for its script, so keys, clicks and drags are heard. */
async function openCalendar(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

const field = (page: Page, id: string) => page.locator(`#entry-${id}`);
const newForm = (page: Page) => page.getByRole('dialog', { name: 'New entry' });
const done = (page: Page) => page.getByRole('status').filter({ hasText: 'Done:' });

/** The page's y of `minutes` past midnight in the visible grid, by its hour labels. */
async function yOf(page: Page, view: 'Week' | 'Day', minutes: number) {
	const h = Math.floor(minutes / 60);
	const label = grid(page, view).locator(`[data-hour="${h}"]`);
	const next = grid(page, view).locator(`[data-hour="${h + 1}"]`);
	const a = (await label.boundingBox())!.y - 3;
	const b = (await next.boundingBox())!.y - 3;
	return a + ((b - a) * (minutes % 60)) / 60;
}

/** Scrolls the visible grid so `minutes` past midnight is near its top. */
async function scrollTo(page: Page, view: 'Week' | 'Day', minutes: number) {
	const scroller = grid(page, view).locator('[data-grid-scroll]');
	const hour = await grid(page, view)
		.locator('[data-hour="1"]')
		.evaluate(
			(el) => el.getBoundingClientRect().top - el.parentElement!.getBoundingClientRect().top - 3
		);
	await scroller.evaluate((el, top) => (el.scrollTop = top), ((minutes - 60) / 60) * hour);
}

/** A touch drag through Chromium's own input, so the page sees real touch and pointer events. */
async function touchDrag(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
	steps = 10
) {
	const cdp = await page.context().newCDPSession(page);
	const point = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y) }];
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: point(from.x, from.y)
	});
	for (let i = 1; i <= steps; i++) {
		const x = from.x + ((to.x - from.x) * i) / steps;
		const y = from.y + ((to.y - from.y) * i) / steps;
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) });
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

test('keys move the week, switch the view and return to today, not while typing', async ({
	page
}) => {
	test.skip(!isPc(), 'the PC’s keys');
	const u = await user('keys');
	await signIn(page, u.username);
	await openCalendar(page, `/calendar?view=week&date=${u.today}`);
	const last = addDays(u.today, -7);
	const at = async (view: string, date: string) => {
		await expect(page).toHaveURL(new RegExp(`view=${view}&date=${date}$`));
		await expect(
			toolbar(page).getByRole('link', { name: view[0].toUpperCase() + view.slice(1), exact: true })
		).toHaveAttribute('aria-current', 'page');
	};

	await page.keyboard.press('k');
	await at('week', last);
	await page.keyboard.press('j');
	await at('week', u.today);
	await page.keyboard.press('ArrowLeft');
	await at('week', last);
	await page.keyboard.press('ArrowRight');
	await at('week', u.today);
	await page.keyboard.press('k');
	await at('week', last);
	await page.keyboard.press('m');
	await at('month', last);
	await page.keyboard.press('w');
	await at('week', last);
	await page.keyboard.press('d');
	await at('day', last);
	await page.keyboard.press('t');
	await at('day', u.today);

	// Typing in the form moves nothing.
	await page.keyboard.press('n');
	await expect(newForm(page)).toBeVisible();
	await field(page, 'description').fill('');
	await field(page, 'description').pressSequentially('kjtdwm');
	await page.keyboard.press('ArrowLeft');
	await expect(field(page, 'description')).toHaveValue('kjtdwm');
	await expect(page).toHaveURL(/\/entries\/new/);
	await page.keyboard.press('Escape');
	await expect(newForm(page)).toBeHidden();
	await at('day', u.today);
});

test('a drag on empty time opens the form with its range, and the save lands', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s drag');
	const u = await user('drag');
	await signIn(page, u.username);
	const thursday = u.lastWeekDay(3);
	await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
	const col = (await column(page, 'Week', thursday).boundingBox())!;
	const x = col.x + col.width / 2;
	const from = await yOf(page, 'Week', 16 * 60);
	const to = await yOf(page, 'Week', 17 * 60 + 30);

	// A press a hair under the 16:00 line still starts at 16:00.
	await page.mouse.move(x, from + 3);
	await page.mouse.down();
	await page.mouse.move(x, (from + to) / 2, { steps: 5 });
	await page.mouse.move(x, to, { steps: 5 });
	// Drawn as it grows, with its times.
	await expect(grid(page, 'Week').locator('[data-new-block]')).toContainText('16:00–17:30');
	await page.mouse.up();

	await expect(newForm(page)).toBeVisible();
	await expect(field(page, 'date')).toHaveValue(thursday);
	await expect(field(page, 'start')).toHaveValue('16:00');
	await expect(field(page, 'end')).toHaveValue('17:30');
	const project = page.getByRole('combobox', { name: 'Customer › project' });
	await expect(project).toBeFocused();
	await project.fill('support');
	await expect(page.getByRole('listbox', { name: 'Customer › project' })).toBeVisible();
	await project.press('Enter');
	await expect(project).toHaveValue('CompX › CompY – Support');
	await page.locator('button[form="entry-form"]').click();

	await expect(newForm(page)).toBeHidden();
	await expect(page).toHaveURL(new RegExp(`/calendar\\?view=week&date=${u.lastMonday}$`));
	await expect(
		column(page, 'Week', thursday).getByRole('link', { name: /CompY – Support/ })
	).toHaveCount(2);
	// Thursday's 4:45 grew by 1:30.
	await expect(head(page, 'Week', thursday).getByText('6:15', { exact: true })).toBeVisible();
	await expect(done(page).getByRole('button', { name: 'Undo' })).toBeVisible();
});

test('a click on empty time opens the half hour clicked for an hour', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s click');
	const u = await user('click');
	await signIn(page, u.username);
	const saturday = u.lastWeekDay(5);
	await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
	const col = (await column(page, 'Week', saturday).boundingBox())!;
	await page.mouse.click(col.x + col.width / 2, await yOf(page, 'Week', 10 * 60 + 40));
	await expect(newForm(page)).toBeVisible();
	await expect(field(page, 'date')).toHaveValue(saturday);
	await expect(field(page, 'start')).toHaveValue('10:30');
	await expect(field(page, 'end')).toHaveValue('11:30');
});

test('a swipe right on the phone’s day moves to the day before', async ({ page }) => {
	test.skip(isPc(), 'the phone’s swipe');
	const u = await user('swipe');
	await signIn(page, u.username);
	await openCalendar(page, `/calendar?view=day&date=${u.today}`);
	const box = (await grid(page, 'Day').boundingBox())!;
	const y = box.y + box.height / 2;
	await touchDrag(page, { x: box.x + 60, y }, { x: box.x + box.width - 40, y: y + 10 });
	await expect(page).toHaveURL(new RegExp(`view=day&date=${addDays(u.today, -1)}$`));
	// A vertical scroll is no swipe.
	await page.waitForLoadState('networkidle');
	const again = (await grid(page, 'Day').boundingBox())!;
	await staysPut(page, () =>
		touchDrag(
			page,
			{ x: again.x + 100, y: again.y + again.height - 40 },
			{ x: again.x + 160, y: again.y + 80 }
		)
	);
	await expect(page).toHaveURL(new RegExp(`view=day&date=${addDays(u.today, -1)}$`));
});

// A crowded day: the phone's folds a run past its lanes into a "+n" chip and keeps to the
// screen's width, the swipe changing the day anywhere; the PC's draws every lane (item 21).

test.describe('a crowded day', () => {
	early.use({ timezoneId: async ({ earlyAt }, use) => use(earlyAt) });
	async function crowdedDay(page: Page, at: string, name: string, late = false) {
		const u = await seedCrowdedDay(`${test.info().project.name}-sideways-${name}`, at, 8, late);
		await signIn(page, u.username, at);
		await openCalendar(page, `/calendar?view=day&date=${u.day}`);
		return u;
	}
	const scroller = (page: Page) => grid(page, 'Day').locator('[data-grid-scroll]');
	const widths = (page: Page) =>
		scroller(page).evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
	const chipOf = (page: Page) => grid(page, 'Day').locator('[data-more-chip]');
	/** The crowded minute's blocks drawn, with their widths. */
	const drawnCrowd = (page: Page, ids: string[]) =>
		grid(page, 'Day')
			.locator('[data-entry-id]')
			.evaluateAll(
				(els, ids) =>
					els
						.filter((e) => ids.includes(e.getAttribute('data-entry-id')!))
						.map((e) => ({
							id: e.getAttribute('data-entry-id')!,
							width: e.getBoundingClientRect().width
						})),
				ids
			);

	early('the phone’s crowded day keeps to the screen’s width', async ({ page, earlyAt }) => {
		test.skip(isPc(), 'the phone’s day');
		await page.setViewportSize({ width: 390, height: 844 });
		const u = await crowdedDay(page, earlyAt, 'width');
		await expect(chipOf(page)).toHaveText(['+5']);
		await expect(block(page, 'Day', u.entries.running)).toBeVisible();
		const { scrollWidth, clientWidth } = await widths(page);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
		const crowd = await drawnCrowd(page, u.entries.crowded);
		expect(crowd).toHaveLength(3);
		expect(crowd.map((c) => c.id)).toContain(u.entries.running);
		for (const { width } of crowd) expect(width).toBeGreaterThanOrEqual(LANE_FLOOR - 2);
		// A lone block runs the column's width.
		const body = (await column(page, 'Day', u.today).locator('[data-body]').boundingBox())!;
		const audit = (await block(page, 'Day', u.entries.audit).boundingBox())!;
		expect(Math.abs(audit.width - body.width)).toBeLessThanOrEqual(2);
		// The day's total is on the screen.
		const total = (await head(page, 'Day', u.today).boundingBox())!;
		expect(total.x).toBeGreaterThanOrEqual(0);
		expect(total.x + total.width).toBeLessThanOrEqual(390);
		expect(intersecting(await drawnIn(grid(page, 'Day')))).toEqual([]);
	});

	early('at 412 px the phone’s crowded day still fits', async ({ page, earlyAt }) => {
		test.skip(isPc(), 'the phone’s day');
		await page.setViewportSize({ width: 412, height: 915 });
		const u = await crowdedDay(page, earlyAt, 'wider');
		await expect(chipOf(page)).toHaveCount(1);
		const { scrollWidth, clientWidth } = await widths(page);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
		// Five lanes fit: four of the crowd drawn, the running one among them, and the chip.
		await expect(chipOf(page)).toHaveText(['+4']);
		const crowd = await drawnCrowd(page, u.entries.crowded);
		expect(crowd).toHaveLength(4);
		expect(crowd.map((c) => c.id)).toContain(u.entries.running);
		const count = Number((await chipOf(page).textContent())!.replace('+', ''));
		expect(crowd.length + count).toBe(8);
	});

	early('a swipe on the crowded phone day changes the day', async ({ page, earlyAt }) => {
		test.skip(isPc(), 'the phone’s swipe');
		await page.setViewportSize({ width: 390, height: 844 });
		const u = await crowdedDay(page, earlyAt, 'swipe');
		await drawn(page);
		const box = (await grid(page, 'Day').boundingBox())!;
		const y = box.y + box.height / 2;
		await touchDrag(page, { x: box.x + 60, y }, { x: box.x + box.width - 40, y: y + 10 });
		await expect(page).toHaveURL(new RegExp(`view=day&date=${addDays(u.today, -1)}$`));

		await openCalendar(page, `/calendar?view=day&date=${u.today}`);
		await drawn(page);
		await touchDrag(page, { x: box.x + box.width - 40, y }, { x: box.x + 60, y: y + 10 });
		await expect(page).toHaveURL(new RegExp(`view=day&date=${addDays(u.today, 1)}$`));
	});

	early('the phone day’s chip grows toward 44 px into free time', async ({ page, earlyAt }) => {
		test.skip(isPc(), 'the phone’s day');
		await page.setViewportSize({ width: 390, height: 844 });
		await crowdedDay(page, earlyAt, 'chip');
		// Free time under the chip: nothing in its lane starts before the audit at 07:00.
		await expect(chipOf(page)).toHaveCount(1);
		expect((await chipOf(page).boundingBox())!.height).toBeGreaterThanOrEqual(43);
	});

	// The chip on the phone's day opens a sheet of what it folds (spec, items 5-10).
	const sheetOf = (page: Page, u: { crowdAt: string }, n = 5) =>
		page.getByRole('dialog', { name: `${n} more entries from ${u.crowdAt}` });
	/** The crowded ids the grid does not draw. */
	const folded = async (page: Page, ids: string[]) => {
		const shown = (await drawnCrowd(page, ids)).map((c) => c.id);
		return ids.filter((id) => !shown.includes(id));
	};
	early('a chip in the day’s last minutes grows up toward 44 px', async ({ page, earlyAt }) => {
		test.skip(isPc(), 'the phone’s day');
		await page.setViewportSize({ width: 390, height: 844 });
		const u = await crowdedDay(page, earlyAt, 'late', true);
		await expect(chipOf(page)).toHaveText(['+5']);
		// No free time under it, the day ends at 24:00: it takes the free time above.
		const chip = (await chipOf(page).boundingBox())!;
		const body = (await column(page, 'Day', u.day).locator('[data-body]').boundingBox())!;
		expect(chip.height).toBeGreaterThanOrEqual(43);
		expect(chip.y + chip.height).toBeLessThanOrEqual(body.y + body.height + 0.5);
		// Its name and its sheet keep the run's start.
		await expect(chipOf(page)).toHaveAccessibleName('5 more entries from 23:56; show them');
		await chipOf(page).tap();
		const sheet = sheetOf(page, u);
		await expect(sheet).toBeVisible();
		const rows = sheet.locator('a[data-entry-form]');
		await expect(rows).toHaveCount(5);
		const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-entry-id')));
		expect(new Set(ids)).toEqual(new Set(await folded(page, u.entries.crowded)));
		expect(intersecting(await drawnIn(grid(page, 'Day')))).toEqual([]);
	});

	async function openSheet(page: Page, at: string, name: string) {
		await page.setViewportSize({ width: 390, height: 844 });
		const u = await crowdedDay(page, at, name);
		await expect(chipOf(page)).toHaveText(['+5']);
		await chipOf(page).tap();
		await expect(sheetOf(page, u)).toBeVisible();
		return u;
	}

	early('the chip opens a sheet of exactly the folded entries', async ({ page, earlyAt }) => {
		test.skip(isPc(), 'the phone’s day');
		const u = await openSheet(page, earlyAt, 'sheet');
		await expect(chipOf(page)).toHaveAccessibleName(`5 more entries from ${u.crowdAt}; show them`);
		const rows = sheetOf(page, u).locator('a[data-entry-form]');
		await expect(rows).toHaveCount(5);
		const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-entry-id')));
		expect(new Set(ids)).toEqual(new Set(await folded(page, u.entries.crowded)));
		// Every row is a touch target, and nothing in it is cut.
		const cut = await rows.evaluateAll((els) =>
			els.flatMap((a) => [
				...(a.getBoundingClientRect().height < 43.5 ? [`${a.textContent} is short`] : []),
				...[...a.querySelectorAll('span')]
					.filter((s) => s.scrollWidth > s.clientWidth + 1)
					.map((s) => `"${s.textContent}" is cut`)
			])
		);
		expect(cut).toEqual([]);
		await expect(rows.first()).toContainText('›');
		// A tap on the scrim, above the sheet, closes it.
		const box = (await sheetOf(page, u).boundingBox())!;
		expect(box.y).toBeGreaterThan(20);
		await page.touchscreen.tap(10, 10);
		await expect(sheetOf(page, u)).toBeHidden();
	});

	early(
		'the sheet’s head is the other sheets’: 16 px in, 12 px above and below',
		async ({ page, earlyAt }) => {
			test.skip(isPc(), 'the phone’s day');
			const u = await openSheet(page, earlyAt, 'head');
			const sheet = (await sheetOf(page, u).boundingBox())!;
			const title = (await sheetOf(page, u).getByRole('heading').boundingBox())!;
			const close = (await sheetOf(page, u).getByRole('button', { name: 'Close' }).boundingBox())!;
			expect(Math.round(title.x - sheet.x)).toBe(16);
			expect(Math.round(sheet.x + sheet.width - (close.x + close.width))).toBe(16);
			// The 44 px × with 12 px above and below it, as the form dialog's and the template's.
			expect(Math.round(close.y - sheet.y)).toBe(12 + 1);
			const rows = sheetOf(page, u).locator('ul');
			expect(Math.round((await rows.boundingBox())!.y - (close.y + close.height))).toBe(12 + 1);
		}
	);

	early(
		'a folded entry opens its form from the sheet, and Undo restores it',
		async ({ page, earlyAt }) => {
			test.skip(isPc(), 'the phone’s day');
			const u = await openSheet(page, earlyAt, 'edit');
			const row = sheetOf(page, u).locator('a[data-entry-form]').first();
			const id = (await row.getAttribute('data-entry-id'))!;
			await row.tap();
			const form = page.getByRole('dialog', { name: 'Edit entry' });
			await expect(form).toBeVisible();
			await expect(sheetOf(page, u)).toBeHidden();
			const old = await field(page, 'description').inputValue();
			expect(old).toMatch(/^Crowded \d+$/);
			await field(page, 'description').fill('Fixed from the sheet');
			await form.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(form).toBeHidden();
			await expect(grid(page, 'Day')).toBeVisible();
			await expect(done(page)).toBeVisible();
			await chipOf(page).tap();
			const again = sheetOf(page, u).locator(`[data-entry-id="${id}"]`);
			await expect(again).toContainText('Fixed from the sheet');
			await page.keyboard.press('Escape');
			await expect(sheetOf(page, u)).toBeHidden();
			await done(page).getByRole('button', { name: 'Undo' }).click();
			await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
			await chipOf(page).tap();
			await expect(again).toContainText(old);
			await expect(again).not.toContainText('Fixed from the sheet');
		}
	);

	early('Delete from the sheet’s form: the chip counts one fewer', async ({ page, earlyAt }) => {
		test.skip(isPc(), 'the phone’s day');
		const u = await openSheet(page, earlyAt, 'delete');
		await sheetOf(page, u).locator('a[data-entry-form]').first().tap();
		const form = page.getByRole('dialog', { name: 'Edit entry' });
		await form.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(form).toBeHidden();
		await expect(chipOf(page)).toHaveText(['+4']);
		await chipOf(page).tap();
		await expect(sheetOf(page, u, 4).locator('a[data-entry-form]')).toHaveCount(4);
		await page.keyboard.press('Escape');
		await expect(sheetOf(page, u, 4)).toBeHidden();
		await done(page).getByRole('button', { name: 'Undo' }).click();
		await expect(chipOf(page)).toHaveText(['+5']);
	});

	early(
		'the chip by keyboard: Enter opens the sheet, Escape returns to the chip',
		async ({ page, earlyAt }) => {
			test.skip(isPc(), 'the phone’s day');
			await page.setViewportSize({ width: 390, height: 844 });
			const u = await crowdedDay(page, earlyAt, 'keys');
			await chipOf(page).focus();
			await page.keyboard.press('Enter');
			await expect(sheetOf(page, u)).toBeVisible();
			expect(await sheetOf(page, u).evaluate((d) => d.contains(document.activeElement))).toBe(true);
			await page.keyboard.press('Escape');
			await expect(sheetOf(page, u)).toBeHidden();
			expect(await chipOf(page).evaluate((c) => c === document.activeElement)).toBe(true);
			await expect(page).toHaveURL(new RegExp(`view=day&date=${u.today}$`));
		}
	);

	early(
		'a tap on the chip with a block pending drops the block and opens nothing',
		async ({ page, earlyAt }) => {
			test.skip(isPc(), 'the phone’s day');
			await page.setViewportSize({ width: 390, height: 844 });
			const u = await crowdedDay(page, earlyAt, 'pending');
			await tapAt(page, u.today, 20 * 60 + 10);
			await expect(newBlock(page)).toBeVisible();
			await scrollTo(page, 'Day', 6 * 60);
			await staysPut(page, () => chipOf(page).tap());
			await expect(newBlock(page)).toHaveCount(0);
			await expect(createBar(page)).toHaveCount(0);
			await expect(sheetOf(page, u)).toBeHidden();
		}
	);

	early(
		'a swipe that starts on the chip changes the day, with no sheet',
		async ({ page, earlyAt }) => {
			test.skip(isPc(), 'the phone’s swipe');
			await page.setViewportSize({ width: 390, height: 844 });
			const u = await crowdedDay(page, earlyAt, 'cswipe');
			await drawn(page);
			const c = (await chipOf(page).boundingBox())!;
			const from = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
			// The chip is in the last lane, at the screen's right edge: 200 px left, to the next day.
			await touchDrag(page, from, { x: from.x - 200, y: from.y + 10 });
			await expect(page).toHaveURL(new RegExp(`view=day&date=${addDays(u.today, 1)}$`));
			await expect(page.getByRole('dialog')).toHaveCount(0);
		}
	);

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		early('the chip links to Entries on that day, in scope', async ({ page, earlyAt }) => {
			test.skip(isPc(), 'the phone’s day');
			await page.setViewportSize({ width: 390, height: 844 });
			// Ten crowded, so the filter's one project still folds some.
			const u = await seedCrowdedDay(`${test.info().project.name}-sideways-nojs`, earlyAt, 10);
			await signIn(page, u.username, earlyAt);
			const entries = `/entries?range=custom&from=${u.today}&to=${u.today}`;
			await page.goto(`/calendar?view=day&date=${u.today}`);
			await expect(chipOf(page)).toHaveAttribute('href', entries);
			const hidden = await folded(page, u.entries.crowded);
			expect(hidden.length).toBeGreaterThan(0);

			const scope = `project=${u.projects.timeKeep}`;
			await page.goto(`/calendar?view=day&date=${u.today}&${scope}`);
			await expect(chipOf(page)).toHaveAttribute('href', `${entries}&${scope}`);

			await page.goto(`/calendar?view=day&date=${u.today}`);
			await chipOf(page).click();
			await expect(page).toHaveURL(new RegExp(`/entries\\?range=custom&from=${u.today}`));
			for (const id of hidden) {
				const description = `Crowded ${u.entries.crowded.indexOf(id) + 1}`;
				await expect(
					page.getByText(description, { exact: true }).locator('visible=true').first()
				).toBeVisible();
			}
		});
	});

	early(
		'the PC day draws eight side by side without sideways scroll',
		async ({ page, earlyAt }) => {
			test.skip(!isPc(), 'the PC’s day');
			const u = await crowdedDay(page, earlyAt, 'pc');
			const boxes = await Promise.all(
				u.entries.crowded.map(async (id) => {
					await expect(block(page, 'Day', id)).toBeVisible();
					return (await block(page, 'Day', id).boundingBox())!;
				})
			);
			expect(boxes).toHaveLength(8);
			await expect(grid(page, 'Day').locator('[data-more-chip]')).toHaveCount(0);
			boxes.sort((a, b) => a.x - b.x);
			for (let i = 1; i < boxes.length; i++)
				expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
			const { scrollWidth, clientWidth } = await widths(page);
			expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
		}
	);
});

/** The phone's create bar, its block and the "+". */
const createBar = (page: Page) => page.locator('[data-create-bar]');
const newBlock = (page: Page) => grid(page, 'Day').locator('[data-new-block]');
const plus = (page: Page) => page.getByRole('link', { name: 'New entry', exact: true });

/** Taps the phone's day at `minutes` past midnight. */
async function tapAt(page: Page, date: string, minutes: number) {
	await scrollTo(page, 'Day', minutes);
	const col = (await column(page, 'Day', date).boundingBox())!;
	await page.touchscreen.tap(col.x + col.width / 2, await yOf(page, 'Day', minutes));
}

test('a tap on the phone’s day makes an hour, its handles stretch it, New entry opens it', async ({
	page
}) => {
	test.skip(isPc(), 'the phone’s tap');
	const u = await user('tap');
	await signIn(page, u.username);
	const saturday = u.lastWeekDay(5);
	await openCalendar(page, `/calendar?view=day&date=${saturday}`);
	await tapAt(page, saturday, 18 * 60 + 10);

	await expect(newBlock(page)).toContainText('18:00–19:00');
	await expect(createBar(page)).toContainText('18:00 – 19:00');
	await expect(createBar(page)).toContainText('Drag the handles to change it');
	await expect(plus(page)).toBeHidden();
	// The bar's buttons are 44 px tall.
	for (const name of ['Cancel', 'New entry']) {
		const b = (await createBar(page).getByRole('button', { name, exact: true }).boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(43);
	}

	const handle = newBlock(page).locator('[data-handle="end"]');
	const h = (await handle.boundingBox())!;
	expect(h.height).toBeGreaterThanOrEqual(43);
	const c = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
	const halfHour = (await yOf(page, 'Day', 19 * 60 + 30)) - (await yOf(page, 'Day', 19 * 60));
	await touchDrag(page, c, { x: c.x, y: c.y + halfHour + 2 });
	await expect(createBar(page)).toContainText('18:00 – 19:30');
	await expect(newBlock(page)).toContainText('18:00–19:30');

	await createBar(page).getByRole('button', { name: 'New entry', exact: true }).click();
	await expect(newForm(page)).toBeVisible();
	await expect(field(page, 'date')).toHaveValue(saturday);
	await expect(field(page, 'start')).toHaveValue('18:00');
	await expect(field(page, 'end')).toHaveValue('19:30');
});

test('Cancel drops the phone’s new block and saves nothing', async ({ page }) => {
	test.skip(isPc(), 'the phone’s tap');
	const u = await user('cancel');
	await signIn(page, u.username);
	const saturday = u.lastWeekDay(5);
	await openCalendar(page, `/calendar?view=day&date=${saturday}`);
	await tapAt(page, saturday, 18 * 60 + 10);
	await expect(newBlock(page)).toBeVisible();
	await createBar(page).getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(newBlock(page)).toHaveCount(0);
	await expect(createBar(page)).toHaveCount(0);
	await expect(plus(page)).toBeVisible();
	await expect(newForm(page)).toBeHidden();
	await expect(head(page, 'Day', saturday).getByText('0:00', { exact: true })).toBeVisible();
	await expect(grid(page, 'Day').locator('[data-entry-id]')).toHaveCount(0);
});

test('a pending block drops on any tap elsewhere, and on a swipe', async ({ page }) => {
	test.skip(isPc(), 'the phone’s tap');
	const u = await user('drop');
	await signIn(page, u.username);
	const thursday = u.lastWeekDay(3);
	await openCalendar(page, `/calendar?view=day&date=${thursday}`);

	// A tap on an entry: the block drops and the entry's form opens.
	await tapAt(page, thursday, 16 * 60 + 10);
	await expect(newBlock(page)).toBeVisible();
	await scrollTo(page, 'Day', 13 * 60);
	await block(page, 'Day', u.entries.thursdaySupport).tap();
	await expect(page.getByRole('dialog', { name: 'Edit entry' })).toBeVisible();
	await expect(newBlock(page)).toHaveCount(0);
	await expect(createBar(page)).toHaveCount(0);
	await page.goBack();
	await expect(page.getByRole('dialog', { name: 'Edit entry' })).toBeHidden();

	// A tap on the day's head, the hour gutter, or outside the grid.
	for (const where of ['head', 'gutter', 'outside'] as const) {
		await tapAt(page, thursday, 16 * 60 + 10);
		await expect(newBlock(page)).toBeVisible();
		if (where === 'head') await head(page, 'Day', thursday).tap();
		else if (where === 'gutter') {
			const g = (await grid(page, 'Day').locator('[data-hour="17"]').boundingBox())!;
			await page.touchscreen.tap(g.x + g.width / 2, g.y + 20);
		} else await page.getByRole('heading', { name: 'Calendar', level: 1 }).tap();
		await expect(newBlock(page), where).toHaveCount(0);
		await expect(createBar(page)).toHaveCount(0);
	}

	// A swipe drops it, and the period stays.
	await tapAt(page, thursday, 16 * 60 + 10);
	await expect(newBlock(page)).toBeVisible();
	const box = (await grid(page, 'Day').boundingBox())!;
	const y = box.y + box.height / 2;
	await staysPut(page, async () => {
		await touchDrag(page, { x: box.x + 60, y }, { x: box.x + box.width - 40, y: y + 10 });
		await expect(newBlock(page)).toHaveCount(0);
	});
	await expect(page).toHaveURL(new RegExp(`view=day&date=${thursday}$`));

	// A tap on the block opens the form with its times.
	await tapAt(page, thursday, 16 * 60 + 10);
	await newBlock(page).getByRole('button').tap();
	await expect(newForm(page)).toBeVisible();
	await expect(field(page, 'start')).toHaveValue('16:00');
	await expect(field(page, 'end')).toHaveValue('17:00');
});

// Moving and resizing on the PC.

/** The block's piece in a day's column. */
const pieceIn = (page: Page, date: string, id: string) =>
	column(page, 'Week', date).locator(`[data-entry-id="${id}"]`);
const tag = (page: Page) => grid(page, 'Week').locator('[data-drag-tag]');
const lifted = (page: Page) => grid(page, 'Week').locator('[data-lifted]');
const refusal = (page: Page) => page.getByRole('alert').filter({ hasText: 'changed elsewhere' });

/** The point at `minutes` past midnight in a day's column of the PC's week. */
async function pointAt(page: Page, date: string, minutes: number, dx = 0) {
	const col = (await column(page, 'Week', date).boundingBox())!;
	return { x: col.x + col.width / 2 + dx, y: await yOf(page, 'Week', minutes) };
}

/** Presses at `from` and moves to `to` with the mouse, held. */
async function hold(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 4 });
}

test.describe('moving and resizing on the PC', () => {
	test.beforeEach(() => test.skip(!isPc(), 'the PC’s drag'));

	test('a block moves to another day, its foot stretches, and Undo puts back one step', async ({
		page
	}) => {
		const u = await user('move');
		await signIn(page, u.username);
		const [tuesday, friday] = [u.lastWeekDay(1), u.lastWeekDay(4)];
		const id = u.entries.tuesdaySupport;
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);

		await hold(
			page,
			await pointAt(page, tuesday, 14 * 60),
			await pointAt(page, friday, 14 * 60 + 46)
		);
		// Lifted where it will land, its tag saying so, a dashed outline where it was.
		await expect(tag(page)).toHaveText(/^Fri 14:15–15:45$/);
		await expect(lifted(page)).toHaveCount(1);
		// The tag sits above the lifted block, not over its name.
		const [t, l] = [(await tag(page).boundingBox())!, (await lifted(page).boundingBox())!];
		expect(t.y + t.height).toBeLessThanOrEqual(l.y);
		await expect(pieceIn(page, tuesday, id).and(page.locator('[data-ghost]'))).toHaveCount(1);
		await page.mouse.up();

		await expect(pieceIn(page, friday, id)).toHaveAttribute('title', /14:15–15:45, 1:30/);
		await expect(pieceIn(page, tuesday, id)).toHaveCount(0);
		await expect(done(page)).toContainText('Done: Edit entry on "CompY – Support".');
		await expect(done(page).getByRole('button', { name: 'Undo' })).toBeVisible();
		await expect(tag(page)).toHaveCount(0);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(head(page, 'Week', friday).getByText('5:45', { exact: true })).toBeVisible();

		// Its foot, on hover, to 16:00.
		await pieceIn(page, friday, id).hover();
		const foot = pieceIn(page, friday, id).locator('[data-handle="end"]');
		await expect(foot).toBeVisible();
		const f = (await foot.boundingBox())!;
		const grip = { x: f.x + f.width / 2, y: f.y + f.height / 2 };
		// A quarter of an hour further down than wherever the grip was taken.
		const quarter = (await yOf(page, 'Week', 16 * 60)) - (await yOf(page, 'Week', 15 * 60 + 45));
		await hold(page, grip, { x: grip.x, y: grip.y + quarter + 1 });
		await expect(tag(page)).toHaveText('Fri 14:15–16:00');
		await page.mouse.up();
		await expect(pieceIn(page, friday, id)).toHaveAttribute('title', /14:15–16:00, 1:45/);
		await expect(page.getByRole('dialog')).toHaveCount(0);

		// Undo once: the stretch only.
		await done(page).getByRole('button', { name: 'Undo' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
		await expect(pieceIn(page, friday, id)).toHaveAttribute('title', /14:15–15:45, 1:30/);
	});

	test('Escape, a release over the toolbar or the sidebar change nothing; a still press opens the form', async ({
		page
	}) => {
		const u = await user('escape');
		await signIn(page, u.username);
		const [tuesday, thursday] = [u.lastWeekDay(1), u.lastWeekDay(3)];
		const id = u.entries.tuesdaySupport;
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);

		await hold(page, await pointAt(page, tuesday, 14 * 60), await pointAt(page, thursday, 16 * 60));
		await expect(tag(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(tag(page)).toHaveCount(0);
		await page.mouse.up();

		const over = [
			toolbar(page).getByRole('link', { name: 'Today', exact: true }),
			main(page).getByRole('link', { name: 'Calendar', exact: true })
		];
		for (const target of over) {
			await hold(
				page,
				await pointAt(page, tuesday, 14 * 60),
				await pointAt(page, thursday, 16 * 60)
			);
			await expect(tag(page)).toBeVisible();
			const b = (await target.boundingBox())!;
			await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
			await page.mouse.up();
			await expect(tag(page)).toHaveCount(0);
		}
		await page.waitForLoadState('networkidle');
		await expect(pieceIn(page, tuesday, id)).toHaveAttribute('title', /13:30–15:00/);
		await expect(page.locator('[data-undo-strip]')).toHaveCount(0);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page).toHaveURL(new RegExp(`/calendar\\?view=week&date=${u.lastMonday}$`));

		// A press and release without movement is a click: the form opens.
		const still = await pointAt(page, tuesday, 14 * 60);
		await page.mouse.move(still.x, still.y);
		await page.mouse.down();
		await page.mouse.move(still.x + 2, still.y + 1);
		await page.mouse.up();
		await expect(page.getByRole('dialog', { name: 'Edit entry' })).toBeVisible();
	});

	test('the running block has no handles and does not move', async ({ page }) => {
		const u = await user('runs');
		const twoHoursAgo = new Intl.DateTimeFormat('en-GB', {
			timeZone: zone,
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).format(Date.now() - 120 * 60_000);
		const id = startElsewhere(u.id, u.projects.projectZ, zone, twoHoursAgo, 'Running');
		await signIn(page, u.username);
		await openCalendar(page, `/calendar?view=week&date=${u.today}`);
		const running = pieceIn(page, u.today, id);
		await running.hover();
		await expect(running.locator('[data-handle]')).toHaveCount(0);
		const b = (await running.boundingBox())!;
		const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
		await hold(page, from, { x: from.x, y: from.y + 3 * 44 });
		await expect(tag(page)).toHaveCount(0);
		await expect(lifted(page)).toHaveCount(0);
		await page.mouse.up();
		await page.waitForLoadState('networkidle');
		await expect(running).toHaveAttribute('title', new RegExp(`^.*\\n${twoHoursAgo}–now`));
		await expect(page.locator('[data-undo-strip]')).toHaveCount(0);
	});

	test('the late entry: handles at its real start and end, and any piece moves it whole', async ({
		page
	}) => {
		const u = await user('late');
		await signIn(page, u.username);
		const [tuesday, wednesday] = [u.lastWeekDay(1), u.lastWeekDay(2)];
		const id = u.entries.late;
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
		await scrollTo(page, 'Week', 19 * 60);
		const [start, end] = [pieceIn(page, tuesday, id), pieceIn(page, wednesday, id)];
		await expect(start.locator('[data-handle="start"]')).toHaveCount(1);
		await expect(start.locator('[data-handle="end"]')).toHaveCount(0);
		await expect(end.locator('[data-handle="end"]')).toHaveCount(1);
		await expect(end.locator('[data-handle="start"]')).toHaveCount(0);

		await scrollTo(page, 'Week', 60);
		// Wednesday's piece, 30 minutes on: the whole entry moves.
		await hold(page, await pointAt(page, wednesday, 30), await pointAt(page, wednesday, 60 + 1));
		await expect(tag(page)).toHaveText('Tue 23:30–01:30');
		await page.mouse.up();
		await expect(done(page)).toBeVisible();
		await expect(end).toHaveAttribute('title', /23:30–01:30, 2:00/);
	});

	test('an entry over a whole day: its middle piece has no handles and moves it whole', async ({
		page
	}) => {
		const u = await user('long');
		// Over Saturday, which has nothing else: its middle piece runs the column's width.
		const [friday, saturday, sunday] = [u.lastWeekDay(4), u.lastWeekDay(5), u.lastWeekDay(6)];
		const id = seedSpan(
			u.id,
			zone,
			u.projects.timeKeep,
			`${friday}T22:00`,
			`${sunday}T02:00`,
			'Long migration'
		);
		await signIn(page, u.username);
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
		const middle = pieceIn(page, saturday, id);
		await expect(middle).toHaveAttribute('data-first', 'false');
		await expect(middle).toHaveAttribute('data-last', 'false');
		await expect(middle.locator('[data-handle]')).toHaveCount(0);
		await expect(pieceIn(page, friday, id).locator('[data-handle="start"]')).toHaveCount(1);
		await expect(pieceIn(page, sunday, id).locator('[data-handle="end"]')).toHaveCount(1);

		// Saturday's 16:00, an hour on: the whole entry moves.
		const m = (await middle.boundingBox())!;
		const y = await yOf(page, 'Week', 16 * 60);
		const from = { x: m.x + m.width / 2, y };
		await hold(page, from, { x: from.x, y: y + ((await yOf(page, 'Week', 17 * 60)) - y) + 1 });
		await expect(tag(page)).toHaveText('Fri 23:00–03:00');
		await page.mouse.up();
		await expect(done(page)).toBeVisible();
		await expect(middle).toHaveAttribute('title', /23:00–03:00, 28:00/);
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('a crowded group: the chip spans its hidden run; the long block moved stays drawn', async ({
		page
	}) => {
		const u = await user('crowdmove');
		const saturday = u.lastWeekDay(5);
		const at = (start: string, end: string, projectId: string, description: string) =>
			seedEntry(u.id, zone, { projectId, date: saturday, start, end, description });
		const long = at('08:00', '13:30', u.projects.projectZ, 'Long development');
		at('08:13', '10:13', u.projects.support, 'Two hours');
		at('09:00', '10:30', u.projects.support, 'Meeting');
		const afternoon = at('13:00', '15:30', u.projects.timeKeep, 'Afternoon');
		for (let n = 0; n < 5; n++) at('10:12', '10:15', u.projects.timeKeep, `Timer ${n + 1}`);
		await signIn(page, u.username);
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);

		// The longest are drawn; one chip over the hidden run, 08:13 to the timers' one-line foot.
		const col = column(page, 'Week', saturday);
		await expect(block(page, 'Week', long)).toBeVisible();
		await expect(block(page, 'Week', afternoon)).toBeVisible();
		await expect(col.locator('[data-entry-id]')).toHaveCount(2);
		const chip = col.locator('[data-more-chip]');
		await expect(chip).toHaveText('+7');
		const c = (await chip.boundingBox())!;
		const line = 25; // a 3-minute timer is drawn a line tall: 18 px at 44 px an hour
		expect(Math.abs(c.y - (await yOf(page, 'Week', 8 * 60 + 13)))).toBeLessThanOrEqual(2);
		expect(
			Math.abs(c.y + c.height - (await yOf(page, 'Week', 10 * 60 + 12 + line)))
		).toBeLessThanOrEqual(2);
		expect(intersecting(await drawnIn(col))).toEqual([]);

		// The 5.5 h block, an hour later, is still drawn at its new time.
		const b = (await block(page, 'Week', long).boundingBox())!;
		const y = await yOf(page, 'Week', 12 * 60);
		await hold(
			page,
			{ x: b.x + b.width / 2, y },
			{ x: b.x + b.width / 2, y: (await yOf(page, 'Week', 13 * 60)) + 1 }
		);
		await expect(tag(page)).toHaveText('Sat 09:00–14:30');
		await page.mouse.up();
		await expect(done(page)).toBeVisible();
		await expect(block(page, 'Week', long)).toHaveAttribute('title', /09:00–14:30/);
		await expect(block(page, 'Week', long)).toBeVisible();
		expect(intersecting(await drawnIn(col))).toEqual([]);
	});

	test('a drop above Monday’s midnight stays on Monday at 00:00', async ({ page }) => {
		const u = await user('top');
		await signIn(page, u.username);
		const monday = u.lastMonday;
		const id = u.entries.mondaySupport;
		await openCalendar(page, `/calendar?view=week&date=${monday}`);
		await scrollTo(page, 'Week', 0);
		const from = await pointAt(page, monday, 14 * 60 + 15);
		const h = (await head(page, 'Week', monday).boundingBox())!;
		// Over Monday's head: the pointer at 00:00, the block's start before it.
		await hold(page, from, { x: from.x, y: h.y + h.height - 4 });
		await expect(tag(page)).toHaveText(/^Mon /);
		await page.mouse.up();
		await expect(done(page)).toBeVisible();
		await expect(pieceIn(page, monday, id)).toHaveAttribute('title', /00:00–01:00, 1:00/);
	});

	test('a drop below the grid on Sunday stays on Sunday, in view', async ({ page }) => {
		const u = await user('foot');
		await signIn(page, u.username);
		const [friday, sunday] = [u.lastWeekDay(4), u.lastWeekDay(6)];
		const id = u.entries.fridayReading;
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
		await scrollTo(page, 'Week', 24 * 60);
		const from = await pointAt(page, friday, 15 * 60 + 15);
		const g = (await grid(page, 'Week').boundingBox())!;
		const s = (await column(page, 'Week', sunday).boundingBox())!;
		await hold(page, from, { x: s.x + s.width / 2, y: g.y + g.height + 30 });
		await expect(tag(page)).toHaveText(/^Sun /);
		await page.mouse.up();
		await expect(done(page)).toBeVisible();
		await expect(pieceIn(page, sunday, id)).toHaveAttribute('title', /\d\d:\d\d–\d\d:\d\d, 1:00/);
	});

	test('a drop past Sunday lands on Sunday', async ({ page }) => {
		const u = await user('edge');
		await signIn(page, u.username);
		const [friday, sunday] = [u.lastWeekDay(4), u.lastWeekDay(6)];
		const id = u.entries.fridayReading;
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
		const from = await pointAt(page, friday, 15 * 60 + 30);
		const g = (await grid(page, 'Week').boundingBox())!;
		await hold(page, from, { x: g.x + g.width + 12, y: from.y });
		await expect(tag(page)).toHaveText('Sun 15:00–16:00');
		await page.mouse.up();
		await expect(pieceIn(page, sunday, id)).toHaveAttribute('title', /15:00–16:00/);
		await expect(done(page)).toBeVisible();
	});

	test('an entry changed elsewhere before the drop is refused and stays', async ({ page }) => {
		const u = await user('stale');
		await signIn(page, u.username);
		const [tuesday, friday] = [u.lastWeekDay(1), u.lastWeekDay(4)];
		const id = u.entries.tuesdaySupport;
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
		editElsewhere(u.id, id, 'Changed on the phone');
		await hold(
			page,
			await pointAt(page, tuesday, 14 * 60),
			await pointAt(page, friday, 14 * 60 + 46)
		);
		await page.mouse.up();
		await expect(refusal(page)).toHaveText(
			'This entry changed elsewhere. The calendar shows it as it is now.'
		);
		await expect(pieceIn(page, tuesday, id)).toHaveAttribute('title', /13:30–15:00/);
		await expect(pieceIn(page, tuesday, id)).toHaveAttribute('title', /Changed on the phone/);
		await expect(pieceIn(page, friday, id)).toHaveCount(0);
	});

	test('a second drag while the first saves is ignored: one release, one undo', async ({
		page
	}) => {
		const u = await user('twice');
		await signIn(page, u.username);
		const [tuesday, friday, saturday] = [u.lastWeekDay(1), u.lastWeekDay(4), u.lastWeekDay(5)];
		const id = u.entries.tuesdaySupport;
		const other = u.entries.thursdaySupport;
		await openCalendar(page, `/calendar?view=week&date=${u.lastMonday}`);
		// The first save takes a while, so the second drag surely comes before it returns.
		await page.route(/\/calendar\?\/move$/, async (route) => {
			await new Promise((r) => setTimeout(r, 600));
			await route.continue();
		});
		const thursday = u.lastWeekDay(3);
		const second = [
			await pointAt(page, thursday, 14 * 60),
			await pointAt(page, saturday, 17 * 60)
		] as const;
		await hold(
			page,
			await pointAt(page, tuesday, 14 * 60),
			await pointAt(page, friday, 14 * 60 + 46)
		);
		await page.mouse.up();
		// At once, before the first returns: another block, another day.
		await page.mouse.move(second[0].x, second[0].y);
		await page.mouse.down();
		await page.mouse.move(second[1].x, second[1].y, { steps: 3 });
		await page.mouse.up();

		await expect(done(page)).toBeVisible();
		await page.waitForLoadState('networkidle');
		await expect(pieceIn(page, friday, id)).toHaveAttribute('title', /14:15–15:45/);
		await expect(pieceIn(page, thursday, other)).toHaveAttribute('title', /13:30–14:30/);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await done(page).getByRole('button', { name: 'Undo' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
		await expect(pieceIn(page, tuesday, id)).toHaveAttribute('title', /13:30–15:00/);
	});
});

// Fit and finish (the critique of Task 10).

test('the picker shows today; Escape or a click outside closes it, and keys wait while it is open', async ({
	page
}) => {
	const u = await user('pickerkeys');
	await signIn(page, u.username);
	await openCalendar(page, `/calendar?view=week&date=${u.today}`);
	const picker = page.getByRole('group', { name: 'Choose a date' });
	const summary = dateSummary(page);
	await summary.click();
	await expect(picker).toBeVisible();
	// Today's date is drawn in the surface colour on its text-colour circle.
	const today = picker.locator(`a[href$="date=${u.today}"]`).first();
	const { color, background } = await today.evaluate((el) => {
		const s = getComputedStyle(el);
		return { color: s.color, background: s.backgroundColor };
	});
	expect(color).not.toBe(background);
	// And says so to a screen reader.
	await expect(today).toHaveAccessibleName(`${Number(u.today.slice(8))}, today`);

	if (isPc()) {
		// A screen key does nothing while the picker is open.
		await staysPut(page, () => page.keyboard.press('j'));
		expect(query(page).get('date')).toBe(u.today);
	}
	await page.keyboard.press('Escape');
	await expect(picker).toBeHidden();
	await expect(summary).toBeFocused();
	if (isPc()) {
		await page.keyboard.press('j');
		await expect(page).toHaveURL(new RegExp(`date=${addDays(u.today, 7)}$`));
	}

	await summary.click();
	await expect(picker).toBeVisible();
	await page.getByRole('heading', { name: 'Calendar', level: 1 }).click();
	await expect(picker).toBeHidden();
});

test('the PC’s total sets its figures in the text colour', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s toolbar');
	const u = await user('figure');
	await signIn(page, u.username);
	await page.goto(`/calendar?view=day&date=${u.lastWeekDay(1)}`);
	const total = toolbar(page).getByText('Day 7:15 · Week 23:45', { exact: true });
	await expect(total).toBeVisible();
	const [label, figure] = await total.evaluate((el) => [
		getComputedStyle(el).color,
		getComputedStyle(el.querySelector('span')!).color
	]);
	expect(figure).not.toBe(label);
	await expect(total.locator('span').first()).toHaveCSS('font-weight', '600');
});

test('the phone’s toolbar: a one-line title over the totals, one height from day to day', async ({
	page
}) => {
	test.skip(isPc(), 'the phone’s toolbar');
	const u = await user('phonebar');
	await signIn(page, u.username);
	const heights: number[] = [];
	// A Wednesday and a Friday: the longest weekday name and a short one.
	for (const [date, totals] of [
		[u.lastWeekDay(2), 'Day 4:15 · Week 23:45'],
		[u.lastWeekDay(4), 'Day 4:15 · Week 23:45']
	]) {
		await page.goto(`/calendar?view=day&date=${date}`);
		await expect(toolbar(page).getByText(titleOf('day', date), { exact: true })).toBeVisible();
		await expect(toolbar(page).getByText(totals, { exact: true })).toBeVisible();
		await expect(toolbar(page).getByText(`Week ${isoWeek(date)}`, { exact: true })).toHaveCount(0);
		// The title and its totals share the arrows' 44 px row.
		const summary = (await dateSummary(page).boundingBox())!;
		expect(summary.height).toBeLessThanOrEqual(45);
		heights.push((await toolbar(page).boundingBox())!.height);
	}
	expect(heights[0]).toBe(heights[1]);

	await page.goto(`/calendar?view=week&date=${u.lastMonday}`);
	await expect(
		toolbar(page).getByText(`Week ${isoWeek(u.lastMonday)} · 23:45`, { exact: true })
	).toBeVisible();
	expect((await toolbar(page).boundingBox())!.height).toBe(heights[0]);
});

test('the phone’s toolbar: Filter a 44 px icon in the first row, the title its own row, uncut', async ({
	page
}) => {
	test.skip(isPc(), 'the phone’s toolbar');
	await page.setViewportSize({ width: 390, height: 844 });
	const u = await user('pbfilter');
	await signIn(page, u.username);
	const date = u.lastWeekDay(1);
	await page.goto(`/calendar?view=day&date=${date}&project=${u.projects.timeKeep}`);
	await page.waitForLoadState('networkidle');

	const filter = toolbar(page).getByRole('button', { name: /^Filter/ });
	await expect(filter).toHaveAccessibleName('Filter +1 more filters');
	const f = (await filter.boundingBox())!;
	expect(f.width).toBe(44);
	expect(f.height).toBe(44);
	const badge = (await filter.getByText('+1').boundingBox())!;
	expect(badge.x).toBeGreaterThanOrEqual(f.x);
	expect(badge.x + badge.width).toBeLessThanOrEqual(f.x + f.width);

	// Row 1: the views, Filter and Today; row 2: the arrows round the title.
	const today = (await toolbar(page)
		.getByRole('link', { name: 'Today', exact: true })
		.boundingBox())!;
	const day = (await toolbar(page).getByRole('link', { name: 'Day', exact: true }).boundingBox())!;
	const prev = (await toolbar(page).getByRole('link', { name: 'Previous day' }).boundingBox())!;
	const next = (await toolbar(page).getByRole('link', { name: 'Next day' }).boundingBox())!;
	expect(Math.abs(f.y - today.y)).toBeLessThan(1);
	expect(Math.abs(f.y - day.y)).toBeLessThan(1);
	expect(f.x + f.width).toBeLessThanOrEqual(today.x);
	expect(prev.y).toBeGreaterThanOrEqual(f.y + f.height);

	// The title and its totals line, "(filtered)" included, read whole between the arrows.
	const title = toolbar(page).getByText(titleOf('day', date), { exact: true });
	const sub = toolbar(page).getByText(/^Day \d+:\d{2} · Week \d+:\d{2} \(filtered\)$/);
	for (const line of [title, sub]) {
		await expect(line).toBeVisible();
		expect(await line.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
	}
	const summary = (await dateSummary(page).boundingBox())!;
	expect(summary.x).toBeGreaterThanOrEqual(prev.x + prev.width);
	expect(summary.x + summary.width).toBeLessThanOrEqual(next.x);
	expect(summary.width).toBeGreaterThan(200);
});

test('the phone’s week tag at now fits its gutter', async ({ page }) => {
	test.skip(isPc(), 'the phone’s week');
	const u = await user('nowtag');
	await signIn(page, u.username);
	await openCalendar(page, `/calendar?view=week&date=${u.today}`);
	const tag = grid(page, 'Week').locator('[data-now-tag]');
	await expect(tag).toHaveText(/^\d{1,2}:\d\d$/);
	const [t, g] = [(await tag.boundingBox())!, (await grid(page, 'Week').boundingBox())!];
	expect(t.x).toBeGreaterThanOrEqual(g.x);
	const firstColumn = (await column(page, 'Week', u.thisMonday).boundingBox())!;
	expect(t.x + t.width).toBeLessThanOrEqual(firstColumn.x + 1);
});

test('the phone’s day draws a short block taller into free time, never over the next', async ({
	page
}) => {
	test.skip(isPc(), 'the phone’s day');
	const u = await user('target');
	const saturday = u.lastWeekDay(5);
	const alone = seedEntry(u.id, zone, {
		projectId: u.projects.support,
		date: saturday,
		start: '09:30',
		end: '09:45',
		description: 'A quarter alone'
	});
	await signIn(page, u.username);
	await openCalendar(page, `/calendar?view=day&date=${saturday}`);
	expect((await block(page, 'Day', alone).boundingBox())!.height).toBeGreaterThanOrEqual(43);
	// Alone, it has room for its times under its name.
	await expect(block(page, 'Day', alone)).toContainText('09:30–09:45');

	// Tuesday's standup grows up to the development block at 10:00, both full width.
	const tuesday = u.lastWeekDay(1);
	await openCalendar(page, `/calendar?view=day&date=${tuesday}`);
	const standup = (await block(page, 'Day', u.entries.tuesdayStandup).boundingBox())!;
	const development = (await block(page, 'Day', u.entries.tuesdayDevelopment).boundingBox())!;
	expect(standup.height).toBeGreaterThan(25);
	expect(standup.y + standup.height).toBeLessThanOrEqual(development.y);
	expect(standup.width).toBeGreaterThan(development.width * 0.9);
	await textFits(page, 'Day');
});

test('a timer just started has no dashed foot until its block reaches now', async ({ page }) => {
	const u = await user('justrunning');
	const now = new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(Date.now());
	const id = startElsewhere(u.id, u.projects.projectZ, zone, now, 'Just started');
	await signIn(page, u.username);
	const view = isPc() ? 'Week' : 'Day';
	await page.goto(`/calendar?view=${view.toLowerCase()}`);
	await expect(block(page, view, id)).toBeVisible();
	await expect(block(page, view, id)).not.toHaveCSS('border-bottom-style', 'dashed');
});

/** `HH:mm` in the suite's zone, `minutes` from now. */
const clockFromNow = (minutes: number) =>
	new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(Date.now() + minutes * 60_000);

/**
 * The text in a column the line at now or its dot is drawn over, as the eye would see it:
 * along the line, wherever a block's text sits under it, whatever is on top there. The
 * line and the dot take no pointer, so they take one for the measure.
 */
async function crossedByNow(page: Page, view: 'Week' | 'Day', date: string) {
	const line = column(page, view, date).locator('[data-now-line]');
	await line.scrollIntoViewIfNeeded();
	return column(page, view, date).evaluate((col) => {
		const line = col.querySelector<HTMLElement>('[data-now-line]')!;
		const marks = [
			line,
			...line.querySelectorAll<HTMLElement>('*'),
			...col.querySelectorAll<HTMLElement>('[data-now-dot]')
		];
		const saved = marks.map((m) => m.style.pointerEvents);
		for (const m of marks) m.style.pointerEvents = 'auto';
		const band = line.getBoundingClientRect();
		const crossed = new Set<string>();
		try {
			for (const block of col.querySelectorAll<HTMLElement>('[data-entry-id]')) {
				const box = block.getBoundingClientRect();
				const texts = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
				for (let n = texts.nextNode(); n; n = texts.nextNode()) {
					const text = n.textContent?.trim();
					if (!text) continue;
					const range = document.createRange();
					range.selectNodeContents(n);
					for (const r of range.getClientRects()) {
						// The text as drawn: inside its block, where the line runs.
						const top = Math.max(r.top, box.top, band.top);
						const bottom = Math.min(r.bottom, box.bottom, band.bottom);
						const left = Math.max(r.left, box.left, band.left);
						const right = Math.min(r.right, box.right, band.right);
						if (bottom <= top || right <= left) continue;
						for (let x = Math.ceil(left); x < right; x += 2) {
							const hit = document.elementFromPoint(x, (top + bottom) / 2);
							if (hit && marks.some((m) => m === hit || m.contains(hit))) crossed.add(text);
						}
					}
				}
			}
		} finally {
			marks.forEach((m, i) => (m.style.pointerEvents = saved[i]));
		}
		return [...crossed];
	});
}

test('the line at now crosses no block’s text, however young the timer', async ({ page }) => {
	const view = isPc() ? 'Week' : 'Day';
	for (const age of [0, 4, 15, 60]) {
		const u = await user(`nowclear${age}`);
		// A finished entry beside it, drawn a line tall past its end, past now.
		seedEntry(u.id, zone, {
			projectId: u.projects.timeKeep,
			start: clockFromNow(-age - 15),
			end: clockFromNow(-1),
			description: 'Beside the timer'
		});
		const id = startElsewhere(u.id, u.projects.support, zone, clockFromNow(-age), 'Running');
		await page.context().clearCookies();
		await signIn(page, u.username);
		await page.goto(`/calendar?view=${view.toLowerCase()}`);
		await expect(block(page, view, id)).toBeVisible();
		expect(await crossedByNow(page, view, u.today), `a timer ${age} minutes old`).toEqual([]);
		await expect(column(page, view, u.today).locator('[data-now-dot]')).toBeVisible();
	}
});

test('a tall running block in a shared week lane shows its running time', async ({ page }) => {
	test.skip(!isPc(), 'the PC’s week');
	const u = await user('tallrun');
	seedEntry(u.id, zone, {
		projectId: u.projects.timeKeep,
		start: clockFromNow(-80),
		end: clockFromNow(-20),
		description: 'Beside'
	});
	const id = startElsewhere(u.id, u.projects.support, zone, clockFromNow(-90), 'Running');
	await signIn(page, u.username);
	await openCalendar(page, '/calendar?view=week');
	const running = block(page, 'Week', id);
	expect((await running.boundingBox())!.width).toBeLessThan(80);
	await expect(running.locator('[data-running]')).toBeVisible();
	await expect(running.locator('[data-running]')).toContainText(/Running 1:3\d/);
});

test('a running block in a narrow lane keeps its elapsed time whole', async ({ page }) => {
	const view = isPc() ? 'Week' : 'Day';
	const u = await user('narrowrun');
	seedEntry(u.id, zone, {
		projectId: u.projects.timeKeep,
		start: clockFromNow(-20),
		end: clockFromNow(-2),
		description: 'One beside'
	});
	seedEntry(u.id, zone, {
		projectId: u.projects.projectZ,
		start: clockFromNow(-12),
		end: clockFromNow(-3),
		description: 'Another beside'
	});
	const id = startElsewhere(u.id, u.projects.support, zone, clockFromNow(-5), 'Running');
	await signIn(page, u.username);
	await page.goto(`/calendar?view=${view.toLowerCase()}`);
	const running = block(page, view, id);
	await expect(running).toBeVisible();
	if (isPc()) expect((await running.boundingBox())!.width).toBeLessThan(80);
	// The elapsed time's glyphs inside every box that clips them, up to the block.
	const cut = await running.locator('[data-running]').evaluate((el) => {
		const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		for (let n = texts.nextNode(); n; n = texts.nextNode()) {
			const at = /\d+:\d\d/.exec(n.textContent ?? '');
			if (!at) continue;
			const range = document.createRange();
			range.setStart(n, at.index);
			range.setEnd(n, at.index + at[0].length);
			const r = range.getBoundingClientRect();
			for (let a = n.parentElement; a; a = a.parentElement) {
				const clips = getComputedStyle(a).overflowX !== 'visible';
				const box = a.getBoundingClientRect();
				if (clips && (r.left < box.left - 0.5 || r.right > box.right + 0.5))
					return `${at[0]} cut at ${Math.round(box.right)} (ends ${Math.round(r.right)})`;
				if (a.hasAttribute('data-entry-id')) break;
			}
			return null;
		}
		return 'no elapsed time';
	});
	expect(cut).toBeNull();
});

test('the phone’s day draws a running block to now, not grown past it', async ({ page }) => {
	test.skip(isPc(), 'the phone’s day');
	const clock = (ms: number) =>
		new Intl.DateTimeFormat('en-GB', {
			timeZone: zone,
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).format(ms);
	// Just started: no taller than one line (1 + marks 2 + padding 2 + 15 px).
	const fresh = await user('runfresh');
	const a = startElsewhere(fresh.id, fresh.projects.projectZ, zone, clock(Date.now()), 'Fresh');
	await signIn(page, fresh.username);
	await page.goto('/calendar?view=day');
	await expect(block(page, 'Day', a)).toBeVisible();
	expect((await block(page, 'Day', a).boundingBox())!.height).toBeLessThanOrEqual(21);

	// An hour on: it reaches now, with the dashed blue foot.
	const older = await user('runhour');
	const b = startElsewhere(
		older.id,
		older.projects.projectZ,
		zone,
		clock(Date.now() - 60 * 60_000),
		'An hour'
	);
	await page.context().clearCookies();
	await signIn(page, older.username);
	await page.goto('/calendar?view=day');
	await expect(block(page, 'Day', b)).toHaveCSS('border-bottom-style', 'dashed');
});

test('the phone’s month rings its chosen day in the text colour', async ({ page }) => {
	test.skip(isPc(), 'the phone’s month');
	const u = await user('ring');
	await signIn(page, u.username);
	await page.goto(`/calendar?view=month&date=${u.lastMonday}`);
	const chosen = cell(page, u.lastMonday);
	await expect(chosen).toHaveAttribute('aria-current', 'date');
	const [ring, text] = await chosen.evaluate((el) => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--foreground)';
		document.body.append(probe);
		const text = getComputedStyle(probe).color;
		probe.remove();
		return [getComputedStyle(el).boxShadow, text];
	});
	expect(ring).toContain(text);
});

// The Calendar's filter.

const filterOpener = (page: Page) =>
	isPc()
		? toolbar(page).locator('summary', { hasText: /^\s*Filter/ })
		: page.getByRole('button', { name: /^Filter/ });
const filterPanel = (page: Page) =>
	isPc()
		? page.getByRole('group', { name: 'Filter' })
		: page.getByRole('dialog', { name: 'Filter' });

test('filtering on Myself › time-keep: its blocks, the totals, the chip, kept by every link', async ({
	page
}) => {
	const u = await user('filter');
	await signIn(page, u.username);
	const view = isPc() ? 'week' : 'day';
	const date = isPc() ? u.lastMonday : u.lastWeekDay(1);
	await page.goto(`/calendar?view=${view}&date=${date}`);
	const View = isPc() ? 'Week' : 'Day';
	const e = u.entries;

	await test.step('unfiltered: every block, the whole week', async () => {
		await expect(block(page, View, e.tuesdayStandup)).toHaveCount(1);
		await expect(toolbar(page).getByText('(filtered)')).toHaveCount(0);
		await expect(toolbar(page).getByText('Week 23:45', { exact: false })).toBeVisible();
	});

	await test.step('pick the project: only its blocks, reduced totals, the chip', async () => {
		await filterOpener(page).click();
		const scope = filterPanel(page).getByRole('combobox', { name: 'Customer › project' });
		await scope.fill('time-keep');
		await scope.press('Enter');
		await expect(page).toHaveURL(
			new RegExp(`view=${view}&date=${date}&project=${u.projects.timeKeep}`)
		);
		await expect(block(page, View, e.tuesdayStandup)).toHaveCount(0);
		await expect(block(page, View, e.tuesdayEvening)).toHaveCount(1);
		// Tuesday: the evening 1:30 and the late fix 2:00 by its start date; the week adds Thursday's
		// 1:30, Friday's 1:00 and Wednesday's 1:00.
		await expect(
			toolbar(page).getByText(
				isPc() ? 'Week 7:00 (filtered)' : /^Day 3:30 · Week 7:00 \(filtered\)$/
			)
		).toBeVisible();
		await expect(page.getByRole('list', { name: 'Filters' }).getByRole('listitem')).toHaveText([
			'Myself › time-keep'
		]);
		if (isPc()) {
			// Its partner is filtered out; the block keeps its mark (call 38).
			await expect(block(page, View, e.overlap)).toHaveAccessibleName(/Overlaps another entry/);
			await expect(
				head(page, View, u.lastWeekDay(1)).getByText('3:30', { exact: true })
			).toBeVisible();
			await expect(
				head(page, View, u.lastWeekDay(0)).getByText('0:00', { exact: true })
			).toBeVisible();
		}
	});

	await test.step('the arrows, the views, Today and the picker keep it', async () => {
		await page.keyboard.press('Escape');
		const keep = () => expect(query(page).get('project')).toBe(u.projects.timeKeep);
		await toolbar(page)
			.getByRole('link', { name: `Previous ${view}` })
			.click();
		await expect(page).toHaveURL(new RegExp(`date=${addDays(date, isPc() ? -7 : -1)}`));
		await keep();
		await expect(toolbar(page).getByText('(filtered)')).toBeVisible();
		await expect(page.getByRole('list', { name: 'Filters' })).toBeVisible();
		await toolbar(page).getByRole('link', { name: 'Month', exact: true }).click();
		await expect(page).toHaveURL(/view=month/);
		await keep();
		await toolbar(page).getByRole('link', { name: 'Today', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`date=${u.today}`));
		await keep();
		await dateSummary(page).click();
		const picker = page.getByRole('group', { name: 'Choose a date' });
		await picker.getByRole('link', { name: '15', exact: true }).click();
		await expect(page).toHaveURL(/date=\d{4}-\d{2}-15/);
		await keep();
		await expect(toolbar(page).getByText('(filtered)')).toBeVisible();
	});

	await test.step('Clear filters', async () => {
		await page.getByRole('link', { name: 'Clear filters' }).click();
		await expect(page).not.toHaveURL(/project=/);
		await expect(toolbar(page).getByText('(filtered)')).toHaveCount(0);
		await expect(page.getByRole('list', { name: 'Filters' })).toHaveCount(0);
	});
});

test.describe('the filter without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('on the phone, Filter is a 44 px icon beside Today, never over it', async ({ page }) => {
		test.skip(isPc(), 'the phone’s toolbar');
		await page.setViewportSize({ width: 390, height: 844 });
		const u = await user('fnojsph');
		await signIn(page, u.username);
		await page.goto(`/calendar?view=day&date=${u.lastWeekDay(1)}`);
		const filter = toolbar(page).locator('summary', { hasText: /^\s*Filter/ });
		const today = toolbar(page).getByRole('link', { name: 'Today', exact: true });
		const f = (await filter.boundingBox())!;
		const t = (await today.boundingBox())!;
		expect(f.width).toBe(44);
		expect(f.height).toBe(44);
		expect(f.x + f.width).toBeLessThanOrEqual(t.x);
		expect(t.x + t.width).toBeLessThanOrEqual(390);
		// Open, its panel hangs under the toolbar across the screen; Today stays a link to tap.
		await filter.click();
		const panel = page.getByRole('group', { name: 'Filter' });
		await expect(panel.getByRole('button', { name: 'Show' })).toBeVisible();
		const p = (await panel.boundingBox())!;
		expect(p.y).toBeGreaterThanOrEqual(f.y + f.height);
		expect(p.width).toBeGreaterThan(340);
		await today.click();
		await expect(page).toHaveURL(new RegExp(`date=${u.today}`));
	});

	test('the panel is a form: Show applies it, the view and date kept', async ({ page }) => {
		const u = await user('filter-nojs');
		await signIn(page, u.username);
		await page.goto(`/calendar?view=week&date=${u.lastMonday}`);
		await toolbar(page)
			.locator('summary', { hasText: /^\s*Filter/ })
			.click();
		const panel = page.getByRole('group', { name: 'Filter' });
		await panel.getByLabel('Customer › project').selectOption({ label: 'time-keep' });
		await panel.getByRole('button', { name: 'Show' }).click();
		await expect(page).toHaveURL(
			new RegExp(`view=week&date=${u.lastMonday}&scope=project%3A${u.projects.timeKeep}`)
		);
		// The page's links carry the scope as the address has it.
		await expect(toolbar(page).getByRole('link', { name: 'Previous week' })).toHaveAttribute(
			'href',
			new RegExp(`project=${u.projects.timeKeep}`)
		);
		await expect(toolbar(page).getByText('(filtered)')).toBeVisible();
	});
});
