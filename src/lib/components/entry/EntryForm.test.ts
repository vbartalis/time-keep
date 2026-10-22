import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import EntryForm from './EntryForm.svelte';
import type { EntryFormData, EntryFormValues } from './types';

const values = (over: Partial<EntryFormValues> = {}): EntryFormValues => ({
	id: 'e1',
	version: '3',
	date: '2026-10-19',
	start: '09:00',
	end: '14:30',
	duration: '5:30',
	endDays: 0,
	endZone: null,
	startNow: '',
	timeZone: 'Europe/Budapest',
	projectId: 'p2',
	activityId: '',
	locationId: '',
	reference: '#4512',
	description: 'Login loop on SSO',
	running: false,
	name: '',
	customerId: '',
	...over
});

const data = (over: Partial<EntryFormData> = {}): EntryFormData => ({
	kind: 'entry',
	mode: 'edit',
	values: values(),
	projects: [
		{
			id: 'p1',
			name: 'ClientY - ProjectZ',
			customerId: 'c1',
			customerName: 'CompX',
			colour: 1,
			archived: false
		},
		{
			id: 'p2',
			name: 'CompY - Support',
			customerId: 'c1',
			customerName: 'CompX',
			colour: 2,
			archived: false
		},
		{
			id: 'p3',
			name: 'time-keep',
			customerId: 'c2',
			customerName: 'Myself',
			colour: 3,
			archived: false
		}
	],
	activities: [{ id: 'a1', name: 'Support ticket', archived: false }],
	locations: [{ id: 'l1', name: 'Home office', archived: false }],
	templates: [
		{
			id: 't1',
			name: 'Standup',
			colour: 1,
			label: 'CompX › ClientY - ProjectZ',
			timeZone: null,
			startTime: '09:00',
			endTime: null,
			durationMinutes: 15,
			projectId: 'p1',
			activityId: null,
			locationId: null,
			reference: null,
			description: 'Standup'
		},
		{
			id: 't2',
			name: 'Ticket',
			colour: null,
			label: null,
			timeZone: null,
			startTime: null,
			endTime: null,
			durationMinutes: null,
			projectId: null,
			activityId: null,
			locationId: null,
			reference: null,
			description: null
		}
	],
	back: '/entries',
	zoneFixed: true,
	failure: null,
	...over
});

const newData = (over: Partial<EntryFormValues> = {}, zoneFixed = false) =>
	data({
		mode: 'new',
		zoneFixed,
		values: values({
			id: null,
			version: '',
			start: '',
			end: '',
			duration: '',
			projectId: '',
			reference: '',
			description: '',
			...over
		})
	});

const html = (d: EntryFormData) => render(EntryForm, { props: { data: d, action: '?/save' } }).body;

const text = (body: string) =>
	body
		.replace(/<!--.*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');

/** The text of each `<label>` in DOM order. */
const labels = (body: string) =>
	[...body.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map((m) => text(m[1]).trim());

/** The opening tag of the element with `id`. */
const tagWithId = (body: string, id: string) =>
	new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`).exec(body)?.[0] ?? '';

/** A `disabled` attribute (not a `disabled:` class variant). */
const DISABLED = /\sdisabled(=""|\s|$)/;

/** The opening tag of the button whose text includes `name`. */
const button = (body: string, name: string) =>
	[...body.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)].find((m) =>
		text(m[3]).includes(name)
	);

describe('EntryForm rendered on the server (no JavaScript)', () => {
	it('posts startNow from a new entry that holds it, and from an edit never', () => {
		const hidden = /<input[^>]*name="startNow"[^>]*>/;
		const tag = hidden.exec(html(newData({ startNow: '2026-10-19T09:00' })))?.[0] ?? '';
		expect(tag).toContain('type="hidden"');
		expect(tag).toContain('value="2026-10-19T09:00"');
		expect(html(newData())).not.toMatch(hidden);
		expect(html(data({ values: values({ startNow: '2026-10-19T09:00' }) }))).not.toMatch(hidden);
	});
	it('keeps the refused post startNow when the reloaded load has none', () => {
		const base = newData({ startNow: '' });
		const body = html({
			...base,
			failure: {
				action: 'save',
				error: 'The input is not valid.',
				fields: { description: 'Too long.' },
				conflict: false,
				gone: false,
				back: '/entries',
				values: { ...base.values, startNow: '2026-10-19T09:00' } as unknown as Record<
					string,
					string
				>
			}
		});
		const tag = /<input[^>]*name="startNow"[^>]*>/.exec(body)?.[0] ?? '';
		expect(tag).toContain('value="2026-10-19T09:00"');
	});
	it('labels the fields in order', () => {
		const order = [
			'Date',
			'Start',
			'End',
			'Duration',
			'Customer › project',
			'Activity',
			'Location',
			'Reference',
			'Description'
		];
		for (const d of [data(), newData()]) {
			const found = labels(html(d)).filter((l) => order.includes(l));
			expect(found).toEqual(order);
		}
	});

	it('offers Fill from on a new entry only, with each template', () => {
		const fresh = text(html(newData()));
		expect(fresh).toContain('Fill from');
		expect(fresh).toContain('Standup');
		expect(fresh).toContain('Ticket');
		expect(text(html(data()))).not.toContain('Fill from');
	});

	it('offers Delete, Copy, Restart and Save as template on an existing entry only', () => {
		const edit = html(data());
		const fresh = html(newData());
		for (const name of ['Delete', 'Copy', 'Restart', 'Save as template']) {
			expect(text(edit)).toContain(name);
			expect(text(fresh)).not.toContain(name);
		}
		expect(edit).toMatch(/href="\/entries\/new\?copy=e1&amp;back=%2Fentries"/);
		expect(edit).toMatch(/<form[^>]*action="\/timers\/restart"/);
	});

	it("disables a running entry's Restart, saying why", () => {
		const body = html(data({ values: values({ end: '', duration: '', running: true }) }));
		const restart = button(body, 'Restart');
		expect(restart?.[2]).toMatch(DISABLED);
		expect(text(restart?.[3] ?? '')).toContain('Already running');
		expect(button(html(data()), 'Restart')?.[2]).not.toMatch(DISABLED);
	});

	it('says an empty end and duration start a timer', () => {
		expect(text(html(newData({ start: '09:00' })))).toContain('No end: this starts a timer.');
		expect(text(html(data()))).not.toContain('No end: this starts a timer.');
	});

	it('says a running entry keeps running, not that it starts a timer', () => {
		const body = text(html(data({ values: values({ end: '', duration: '', running: true }) })));
		expect(body).toContain('No end: the timer keeps running.');
		expect(body).not.toContain('this starts a timer');
	});

	it('pins only Cancel and Save: the stored-entry actions come before the footer', () => {
		const dirty = html(data());
		const at = dirty.indexOf('data-entry-footer');
		expect(at).toBeGreaterThan(0);
		const footer = text(dirty.slice(at));
		expect(footer).toContain('Cancel');
		expect(footer).toContain('Save');
		for (const name of ['Delete', 'Copy', 'Restart', 'Save as template']) {
			expect(footer).not.toContain(name);
			expect(text(dirty.slice(0, at))).toContain(name);
		}
	});

	it('marks an end days later, and the next day', () => {
		expect(text(html(data({ values: values({ end: '07:15', endDays: 2 }) })))).toContain('+2 days');
		expect(text(html(data({ values: values({ end: '01:00', endDays: 1 }) })))).toContain(
			'next day'
		);
		expect(text(html(data()))).not.toMatch(/next day|\+\d days/);
	});

	it("shows an end's other zone beside it", () => {
		const body = text(html(data({ values: values({ endZone: 'America/New_York' }) })));
		expect(body).toContain('America/New_York');
	});

	it('gives the hint line', () => {
		expect(text(html(newData()))).toContain(
			'Times: 9, 900, 9:00, 1330 · Duration: 5:30, 5.5, 5h30, 90 (minutes)'
		);
	});

	it('has one submit button, the primary Save', () => {
		for (const body of [html(data()), html(newData())]) {
			const submits = [...body.matchAll(/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/g)];
			const primary = submits.filter((m) => /bg-primary/.test(m[0]));
			expect(primary).toHaveLength(1);
			expect(text(primary[0][1]).trim()).toBe('Save');
		}
	});

	it('posts the project from a select grouped by customer', () => {
		const body = html(data());
		expect(body).toMatch(/<select[^>]*name="projectId"/);
		expect(body).toMatch(/<optgroup label="CompX">/);
		expect(body).toMatch(/<optgroup label="Myself">/);
		expect(body).toMatch(/<option value="p2"[^>]*selected/);
	});

	it('shows times and dates as text fields that read forgivingly', () => {
		const body = html(data());
		for (const id of ['start', 'end', 'duration']) {
			const tag = tagWithId(body, `entry-${id}`);
			expect(tag).toMatch(/type="text"/);
			expect(tag).toMatch(/inputmode="text"/);
			expect(tag).toMatch(/autocomplete="off"/);
		}
		const date = tagWithId(body, 'entry-date');
		expect(date).toMatch(/inputmode="decimal"/);
		expect(date).toMatch(/value="2026-10-19"/);
	});

	it('puts a refusal beside its field and keeps what was typed', () => {
		const body = html(
			data({
				failure: {
					action: 'save',
					error: 'The input is not valid.',
					fields: { start: 'Not a time. Type 9, 900, 9:00 or 1330.' },
					conflict: false,
					gone: false,
					back: '/entries',
					values: { ...values(), start: 'nine' } as unknown as Record<string, string>
				}
			})
		);
		const start = tagWithId(body, 'entry-start');
		expect(start).toMatch(/aria-invalid="true"/);
		expect(start).toMatch(/aria-describedby="[^"]*start-error/);
		expect(start).toMatch(/value="nine"/);
		expect(text(body)).toContain('Not a time. Type 9, 900, 9:00 or 1330.');
	});

	it('offers a reload on a conflict, and the way back when the entry is gone', () => {
		const failure = {
			action: 'save' as const,
			error: 'This was changed elsewhere; reload and try again.',
			fields: {},
			conflict: true,
			gone: false,
			back: '/entries'
		};
		const stale = html(data({ failure }));
		expect(button(stale, 'Reload')?.[2]).toMatch(/href="\/entries\/e1\?back=%2Fentries"/);
		const gone = html(
			data({
				failure: {
					...failure,
					action: 'delete',
					error: 'This entry was deleted elsewhere.',
					conflict: false,
					gone: true,
					values: { description: '' }
				}
			})
		);
		expect(text(gone)).toContain('This entry was deleted elsewhere.');
		expect(button(gone, 'Back to Entries')?.[2]).toMatch(/href="\/entries"/);
		// A delete's echo does not replace the form's values.
		expect(gone).toContain('Login loop on SSO');
	});

	it("keeps an edit's zone from the device zone filler", () => {
		expect(tagWithId(html(data()), 'entry-zone')).toMatch(/data-zone-fixed/);
		expect(tagWithId(html(newData()), 'entry-zone')).not.toMatch(/data-zone-fixed/);
	});

	it("keeps a copy's or a template's zone on a new entry when the load says so", () => {
		expect(tagWithId(html(newData({ timeZone: 'America/New_York' }, true)), 'entry-zone')).toMatch(
			/data-zone-fixed/
		);
	});

	it("returns to the refused form's back, not the bare action's", () => {
		const body = html(
			data({
				back: '/',
				failure: {
					action: 'save',
					error: 'No.',
					fields: {},
					conflict: false,
					gone: false,
					back: '/entries?from=2026-10-01'
				}
			})
		);
		expect(button(body, 'Cancel')?.[2]).toMatch(/href="\/entries\?from=2026-10-01"/);
		expect(body).toMatch(/name="back" value="\/entries\?from=2026-10-01"/);
		expect(body).not.toMatch(/name="back" value="\/"/);
	});
});

describe('EntryForm in its template kind (no JavaScript)', () => {
	const tpl = (over: Partial<EntryFormValues> = {}, mode: 'new' | 'edit' = 'edit') =>
		data({
			kind: 'template',
			mode,
			templates: [],
			back: '/templates',
			customers: [
				{ id: 'c1', name: 'CompX', archived: false },
				{ id: 'c2', name: 'Myself', archived: false },
				{ id: 'c3', name: 'Initech', archived: false }
			],
			values: values({
				id: mode === 'edit' ? 't1' : null,
				version: mode === 'edit' ? '2' : '',
				date: '',
				start: '09:30',
				end: '09:45',
				duration: '0:15',
				timeZone: '',
				name: mode === 'edit' ? 'Standup' : '',
				customerId: 'c1',
				projectId: 'p1',
				reference: '',
				description: '',
				...over
			})
		});

	it('labels Name first, then the times, the pickers and Time zone, with no Date', () => {
		const order = [
			'Name',
			'Start',
			'End',
			'Duration',
			'Customer › project',
			'Activity',
			'Location',
			'Reference',
			'Description',
			'Time zone'
		];
		for (const d of [tpl(), tpl({}, 'new')]) {
			const body = html(d);
			expect(labels(body).filter((l) => [...order, 'Date'].includes(l))).toEqual(order);
			expect(tagWithId(body, 'entry-date')).toBe('');
		}
	});

	it('posts the name, required, and focuses it first', () => {
		const name = tagWithId(html(tpl()), 'entry-name');
		expect(name).toMatch(/name="name"/);
		expect(name).toMatch(/\srequired/);
		expect(name).toMatch(/value="Standup"/);
	});

	it('gives the note under the time row and the zone hint, with the zone list', () => {
		const body = html(tpl());
		expect(text(body)).toContain(
			'Any field may stay blank; only the blanks are asked when it is used.'
		);
		expect(text(body)).toContain("Blank uses the device's zone");
		const zone = tagWithId(body, 'entry-time-zone');
		expect(zone).toMatch(/name="timeZone"/);
		expect(zone).toMatch(/type="text"/);
		expect(zone).toMatch(/list="entry-zones"/);
		expect(body).toMatch(/<datalist id="entry-zones"/);
		// One zone field: the visible one, never replaced by the device's zone.
		expect(body.match(/name="timeZone"/g)).toHaveLength(1);
		expect(text(body)).not.toContain('this starts a timer');
	});

	it('shows a template’s zone in its field', () => {
		expect(tagWithId(html(tpl({ timeZone: 'Europe/Budapest' })), 'entry-time-zone')).toMatch(
			/value="Europe\/Budapest"/
		);
	});

	it('offers no Copy, Restart or Save as template; Delete only when editing', () => {
		const edit = text(html(tpl()));
		const fresh = text(html(tpl({}, 'new')));
		for (const name of ['Copy', 'Restart', 'Save as template', 'Fill from']) {
			expect(edit).not.toContain(name);
			expect(fresh).not.toContain(name);
		}
		expect(edit).toContain('Delete');
		expect(fresh).not.toContain('Delete');
		const page = render(EntryForm, { props: { data: tpl(), action: '/templates/t1?/save' } }).body;
		expect(page).toMatch(/<form[^>]*action="\/templates\/t1\?\/delete"/);
	});

	it('says an end not after the start is the next day', () => {
		expect(
			text(html(tpl({ start: '22:00', end: '01:00', duration: '3:00', endDays: 1 })))
		).toContain('next day');
		expect(text(html(tpl()))).not.toContain('next day');
	});

	it('lets a customer alone be chosen without JavaScript', () => {
		const body = html(tpl({ projectId: '', customerId: 'c3' }));
		expect(body).toMatch(/<select[^>]*name="customerId"/);
		expect(body).toMatch(/<option value="c3"[^>]*selected/);
		expect(body).toMatch(/<select[^>]*name="projectId"/);
		// A project is not required: the customer alone is a choice.
		expect(tagWithId(body, 'entry-project')).not.toMatch(/\srequired/);
	});

	it('puts a refused name beside its field', () => {
		const body = html({
			...tpl({}, 'new'),
			failure: {
				action: 'save',
				error: 'The input is not valid.',
				fields: { name: 'A template is already called "Standup".' },
				conflict: false,
				gone: false,
				back: '/templates',
				values: { name: 'Standup', start: '', end: '', duration: '', linked: '' }
			}
		});
		const name = tagWithId(body, 'entry-name');
		expect(name).toMatch(/aria-invalid="true"/);
		expect(name).toMatch(/aria-describedby="name-error"/);
		expect(text(body)).toContain('A template is already called "Standup".');
	});

	it('offers the way back to Templates when the template is gone', () => {
		const body = html({
			...tpl(),
			failure: {
				action: 'save',
				error: 'This template was deleted elsewhere.',
				fields: {},
				conflict: false,
				gone: true,
				back: '/templates'
			}
		});
		expect(button(body, 'Back to Templates')?.[2]).toMatch(/href="\/templates"/);
	});

	it('reloads the template, not an entry, on a conflict', () => {
		const body = html({
			...tpl(),
			failure: {
				action: 'save',
				error: 'Changed elsewhere.',
				fields: {},
				conflict: true,
				gone: false,
				back: '/templates'
			}
		});
		expect(button(body, 'Reload')?.[2]).toMatch(/href="\/templates\/t1\?back=%2Ftemplates"/);
	});
});
