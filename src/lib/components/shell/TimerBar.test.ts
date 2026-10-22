import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import StartList from './StartList.svelte';
import TimerBar from './TimerBar.svelte';
import type { BarTemplate, BarTimer } from './types.js';

const now = Date.UTC(2026, 9, 20, 10, 0);

const timer = (over: Partial<BarTimer>): BarTimer => ({
	id: 't',
	customerName: 'CompX',
	projectName: 'ClientY - ProjectZ',
	activityName: null,
	description: null,
	startAt: now - 3_600_000,
	start: '08:00',
	startDate: null,
	colour: 1,
	...over
});

const text = (html: string) =>
	html
		.replace(/<!--.*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');

describe('TimerBar, the others behind +N', () => {
	it('shows the start date of an earlier-day timer that has an activity', () => {
		const timers = [
			timer({ id: 'a' }),
			timer({
				id: 'b',
				projectName: 'time-keep',
				activityName: 'Development',
				description: 'shell',
				start: '22:10',
				startDate: '2026-10-19'
			})
		];
		for (const variant of ['header', 'strip'] as const) {
			const { body } = render(TimerBar, {
				props: { timers, templates: [], now, back: '/', variant }
			});
			expect(text(body)).toMatch(/Development[^<]*since 2026-10-19 22:10/);
		}
	});

	it("shows a today timer's activity without a since", () => {
		const timers = [
			timer({ id: 'a' }),
			timer({ id: 'b', activityName: 'Meeting', start: '09:00', startAt: now - 1_800_000 })
		];
		const { body } = render(TimerBar, {
			props: { timers, templates: [], now, back: '/', variant: 'header' }
		});
		expect(text(body)).toContain('Meeting');
		expect(text(body)).not.toContain('since 09:00');
	});
});

const tpl = (over: Partial<BarTemplate>): BarTemplate => ({
	id: 'tp',
	name: 'Standup',
	colour: 1,
	label: 'CompX › ClientY - ProjectZ',
	hasProject: true,
	hasDescription: false,
	...over
});

/** The markup outside the header's pill. */
const outsidePill = (html: string) => html.replace(/<section[\s\S]*?<\/section>/, '');

describe('TimerBar, the header', () => {
	const timers = [timer({ id: 'a' }), timer({ id: 'b', projectName: 'Other' })];
	const header = () =>
		render(TimerBar, {
			props: { timers, templates: [], now, back: '/reports?x=1', variant: 'header' }
		}).body;

	it('has a Start outside the pill', () => {
		expect(outsidePill(header())).toMatch(/<summary[^>]*>[\s\S]*?Start[\s\S]*?<\/summary>/);
		const pill = header().match(/<section[\s\S]*?<\/section>/)?.[0] ?? '';
		expect(text(pill)).not.toMatch(/\bStart\b/);
	});

	it("links the running timer's time and name to its form", () => {
		const link = header().match(/<a[^>]*href="\/entries\/a\?back=[^"]*"[^>]*>[\s\S]*?<\/a>/)?.[0];
		expect(link).toBeDefined();
		expect(link).toContain('data-entry-form');
		expect(link).toContain('back=%2Freports%3Fx%3D1');
		expect(text(link ?? '')).toContain('1:00:00');
		expect(text(link ?? '')).toContain('CompX › ClientY - ProjectZ');
	});

	it('marks only the shown Stop, titled with its key', () => {
		const body = header();
		const shown = body.match(/<button[^>]*data-shown-stop[^>]*>/g) ?? [];
		expect(shown).toHaveLength(1);
		expect(shown[0]).toContain('title="Stop (s)"');
		expect(shown[0]).toContain('Stop ClientY - ProjectZ');
		// The "+N" list's Stop is a plain one.
		const other = body.match(/<button[^>]*aria-label="Stop Other[^"]*"[^>]*>/)?.[0];
		expect(other).toBeDefined();
		expect(other).not.toContain('data-shown-stop');
	});

	it("leaves the Start's ▶ uncoloured: blue is never an icon tint", () => {
		const start = outsidePill(header()).match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? '';
		expect(start).toContain('<svg');
		expect(start).not.toMatch(/(^|\s)text-primary(\s|")/);
	});

	it('has a Start with no timer running', () => {
		const { body } = render(TimerBar, {
			props: { timers: [], templates: [], now, back: '/', variant: 'header' }
		});
		expect(text(body)).toContain('No timer running');
		expect(outsidePill(body)).toContain('Start a timer');
	});
});

describe('TimerBar, the phone strip', () => {
	const strip = (timers: BarTimer[]) =>
		render(TimerBar, {
			props: { timers, templates: [tpl({})], now, back: '/', variant: 'strip' }
		}).body;

	it('shows customer › project and no description', () => {
		const body = strip([timer({ id: 'a', activityName: 'Development', description: 'CSV' })]);
		expect(text(body)).toContain('CompX › ClientY - ProjectZ');
		expect(text(body)).toContain('Development · since 08:00');
		expect(text(body)).not.toContain('CSV');
	});

	it('has a ▶ beside Stop, both 44 px', () => {
		const body = strip([timer({ id: 'a' })]);
		const start = body.match(/<summary[^>]*aria-label="Start a timer"[^>]*>/)?.[0];
		expect(start).toBeDefined();
		expect(start).toMatch(/\bh-11\b/);
		expect(start).toMatch(/\bmin-w-11\b/);
		const stop = body.match(/<button[^>]*data-shown-stop[^>]*>/)?.[0];
		expect(stop).toMatch(/\bsize-11\b/);
		expect(stop).toMatch(/\bmin-w-11\b/);
	});

	it('has a square Stop, its word for screen readers only, so the name keeps the room', () => {
		const body = strip([timer({ id: 'a' })]);
		const stop = body.match(/<button[^>]*data-shown-stop[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
		expect(stop).toMatch(/\bsize-11\b/);
		expect(stop).toMatch(/\bpx-0\b/);
		expect(stop).toContain('title="Stop (s)"');
		expect(stop).toMatch(/<span class="sr-only">Stop<\/span>/);
		expect(body).toMatch(/<section[^>]*\bgap-x-2\b[^>]*>/);
	});

	it('has the ▶ alone when nothing runs', () => {
		const body = strip([]);
		expect(text(body)).toContain('No timer running');
		expect(body).toMatch(/<summary[^>]*aria-label="Start a timer"/);
	});
});

describe('StartList', () => {
	const list = (templates: BarTemplate[]) =>
		render(StartList, { props: { templates, back: '/setup' } }).body;

	it('lists the templates by name under its head, each with its label', () => {
		const body = list([
			tpl({ id: 'a', name: 'Standup', label: 'CompX › ClientY - ProjectZ' }),
			tpl({ id: 'b', name: 'Ticket', label: 'CompX › CompY - Support', colour: 2 })
		]);
		const t = text(body);
		expect(t).toMatch(
			/Start a timer.*Standup.*CompX › ClientY - ProjectZ.*Ticket.*CompY - Support/
		);
		expect(body).toContain('bg-project-2');
	});

	it('starts a template with a description at once', () => {
		const body = list([tpl({ id: 'a', hasDescription: true })]);
		const form = body.match(/<form[^>]*action="\/timers\/start"[^>]*>[\s\S]*?<\/form>/)?.[0] ?? '';
		expect(form).toContain('name="templateId" value="a"');
		expect(form).toContain('name="back" value="/setup"');
		expect(form).toContain('name="timeZone"');
		expect(form).not.toContain('name="description"');
		expect(form).toMatch(/<button[^>]*type="submit"[\s\S]*Standup/);
		expect(body).not.toMatch(/<details/);
	});

	it('asks for a description first when the template has none', () => {
		const body = list([tpl({ id: 'a', hasDescription: false })]);
		const details = body.match(/<details[\s\S]*?<\/details>/)?.[0] ?? '';
		expect(text(details)).toContain('Standup');
		const form = details.match(/<form[^>]*action="\/timers\/start"[\s\S]*?<\/form>/)?.[0] ?? '';
		expect(form).toContain('name="templateId" value="a"');
		expect(form).toMatch(/<input[^>]*name="description"/);
		expect(form).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*?Start[\s\S]*?<\/button>/);
	});

	it('opens the form for a template with no project', () => {
		const body = list([tpl({ id: 'a', hasProject: false, label: null, colour: null })]);
		const link = body.match(/<a[^>]*href="\/entries\/new\?template=a&amp;timer=1[^"]*"[^>]*>/)?.[0];
		expect(link).toBeDefined();
		expect(link).toContain('data-entry-form');
	});

	it('ends with "Start on a project…", which opens the form in timer mode', () => {
		const body = list([tpl({})]);
		const t = text(body);
		expect(t.trim()).toMatch(/Start on a project… opens the form$/);
		const link = body.match(/<a[^>]*href="\/entries\/new\?timer=1[^"]*"[^>]*>/)?.[0];
		expect(link).toContain('data-entry-form');
		expect(link).toContain('back=%2Fsetup');
		expect(t).not.toContain('Create a template');
	});

	it('offers to create a template when there are none, in place over the screen', () => {
		const body = list([]);
		expect(body).toMatch(/href="\/entries\/new\?timer=1/);
		expect(body).toMatch(
			/<a[^>]*href="\/templates\/new\?back=%2Fsetup"[^>]*data-entry-form[^>]*>\s*Create a template/
		);
	});
});

describe('TimerBar, the phone strip', () => {
	const three = [
		timer({ id: 'a', start: '10:00' }),
		timer({ id: 'b', projectName: 'CompY - Support', start: '09:00' }),
		timer({ id: 'c', customerName: 'Myself', projectName: 'time-keep', start: '08:00' })
	];
	const strip = (timers: BarTimer[]) =>
		render(TimerBar, { props: { timers, templates: [], now, back: '/', variant: 'strip' } }).body;

	it('shows customer › project in the strip and in every row of +N', () => {
		const body = strip(three);
		for (const t of three) expect(text(body)).toContain(`${t.customerName} › ${t.projectName}`);
		expect(body.match(/data-timer-name/g)).toHaveLength(3);
	});

	it('never truncates a name', () => {
		const tags = strip(three).match(/<[^>]*data-timer-name[^>]*>/g) ?? [];
		expect(tags).toHaveLength(3);
		for (const tag of tags) expect(tag).not.toMatch(/truncate|text-ellipsis|line-clamp-/);
	});

	it('keeps the earlier-day since in the strip', () => {
		const body = strip([
			timer({ activityName: 'Development', start: '22:10', startDate: '2026-10-19' })
		]);
		expect(text(body)).toMatch(/Development · since 2026-10-19 22:10/);
	});
});
