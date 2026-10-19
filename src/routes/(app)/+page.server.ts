import { fail, redirect, type Cookies } from '@sveltejs/kit';
import type { ActionFailure } from '#lib/components/today/types.js';
import { openCore, type EntryItem } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import {
	done,
	formFailure,
	fromTemplateInput,
	groupProjects,
	rows,
	startInput,
	text
} from '#lib/server/screens/actions.js';
import { setFlash, takeFlash } from '#lib/server/screens/flash.js';
import {
	earlierDate,
	formatDate,
	formatHours,
	formatTime,
	todayRange
} from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone, source } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const range = todayRange(now, zone);

	const timers = rows(core.entries.list({ running: true })).map((e) => ({
		id: e.id,
		projectName: e.projectName,
		customerName: e.customerName,
		description: e.description,
		startAt: e.startAt,
		start: formatTime(e.startAt, e.startZone),
		startDate: earlierDate(e.startAt, e.startZone, now),
		startZone: e.startZone
	}));

	const entries = rows(core.entries.list({ from: range.from, to: range.to })).map(
		(e: EntryItem) => ({
			id: e.id,
			projectName: e.projectName,
			customerName: e.customerName,
			description: e.description,
			in: formatTime(e.startAt, e.startZone),
			startDate: earlierDate(e.startAt, e.startZone, now),
			out: e.endAt === null ? null : formatTime(e.endAt, e.endZone ?? e.startZone),
			hours: formatHours((e.endAt ?? now) - e.startAt)
		})
	);

	const templates = rows(core.templates.list()).map((t) => ({
		id: t.id,
		name: t.name,
		customerId: t.customerId,
		customerName: t.customerName,
		projectId: t.projectId,
		projectName: t.projectName,
		activityName: t.activityName,
		locationName: t.locationName,
		startTime: t.startTime,
		endTime: t.endTime,
		durationMinutes: t.durationMinutes,
		timeZone: t.timeZone,
		reference: t.reference,
		description: t.description,
		runs: t.endTime === null && t.durationMinutes === null
	}));

	return {
		now,
		zone,
		zoneSource: source,
		today: range.date,
		timers,
		entries,
		templates,
		projects: groupProjects(rows(core.projects.list())),
		flash: takeFlash(cookies)
	};
};

/** The user's core and the request's zone, from the form's `timeZone` field or the cookie. */
function open(locals: App.Locals, cookies: Cookies, form: FormData, now: number) {
	const user = requireUser(locals);
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(
		core,
		{ field: text(form, 'timeZone'), cookie: cookies.get(ZONE_COOKIE) },
		now
	);
	return { core, zone };
}

const refuse = (failure: ActionFailure) => fail(400, failure);

export const actions: Actions = {
	stop: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const { core } = open(locals, cookies, form, Date.now());
		const id = text(form, 'id');
		const r = core.timers.stop({ id });
		if (!r.ok) return refuse({ action: 'stop', subject: id, ...formFailure(r.error, []) });
		done(core, cookies, r);
	},

	start: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const { core, zone } = open(locals, cookies, form, Date.now());
		const r = core.timers.start(startInput(form, zone));
		if (!r.ok) {
			return refuse({
				action: 'start',
				values: { projectId: text(form, 'projectId'), description: text(form, 'description') },
				...formFailure(r.error, ['projectId', 'description'])
			});
		}
		done(core, cookies, r);
	},

	fromTemplate: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const now = Date.now();
		const { core, zone } = open(locals, cookies, form, now);
		const templateId = text(form, 'templateId');
		const values = Object.fromEntries(
			['description', 'reference', 'projectId', 'date', 'start', 'end', 'durationMinutes'].map(
				(k) => [k, text(form, k)]
			)
		);
		const template = core.templates.get({ id: templateId });
		if (!template.ok) {
			return refuse({
				action: 'fromTemplate',
				subject: templateId,
				values,
				...formFailure(template.error, [])
			});
		}
		const t = template.value;
		const readIn = t.timeZone ?? zone;
		const input = fromTemplateInput(form, {
			zone,
			today: formatDate(now, readIn),
			nowTime: formatTime(now, readIn),
			template: { timeZone: t.timeZone, startTime: t.startTime, endTime: t.endTime }
		});
		const r = core.entries.fromTemplate(input);
		if (!r.ok) {
			// Times the template supplied are not on screen; only typed ones are.
			const typed = Object.keys(input).filter((k) => k !== 'templateId' && k !== 'timeZone');
			// As the sheet renders them: a picker only without a project, a reference only without one.
			const shown = [
				'description',
				...(t.projectId === null ? ['projectId'] : []),
				...(t.reference === null ? ['reference'] : []),
				...typed.filter((k) => !['description', 'projectId', 'reference'].includes(k))
			];
			return refuse({
				action: 'fromTemplate',
				subject: templateId,
				values,
				...formFailure(r.error, shown)
			});
		}
		done(core, cookies, r);
	},

	undo: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const { core } = open(locals, cookies, form, Date.now());
		const r = core.undo({ batchId: text(form, 'batchId') });
		if (!r.ok) return refuse({ action: 'undo', ...formFailure(r.error, []) });
		setFlash(cookies, { label: 'Undone', batchId: null, warnings: r.warnings, undone: true });
		redirect(303, '/');
	}
};
