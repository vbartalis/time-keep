import { fail, type Cookies } from '@sveltejs/kit';
import type { ActionFailure } from '#lib/components/today/types.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import {
	done,
	formFailure,
	fromTemplateInput,
	sheetTimeRefusals,
	text
} from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { formPickers } from '#lib/server/screens/entry-form.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import { formatDate, formatTime, todayFor } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const { projects, activities, locations } = formPickers(core);
	return {
		now,
		...todayFor(core, zone, now),
		projects,
		activities,
		locations,
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

/** The sheet's fields, as posted: a refusal shows them again. */
const POSTED = [
	'projectId',
	'activityId',
	'locationId',
	'reference',
	'description',
	'date',
	'start',
	'end',
	'duration'
];
const TIMES = ['date', 'start', 'end', 'duration'];

const refuse = (failure: ActionFailure) => fail(400, failure);

export const actions: Actions = {
	/** An entry from a template's sheet; back to the screen it was opened over (`back`). */
	fromTemplate: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const now = Date.now();
		const { core, zone } = open(locals, cookies, form, now);
		const templateId = text(form, 'templateId');
		const values = Object.fromEntries(POSTED.map((k) => [k, text(form, k)]));
		const refused = (error: { error: string; fields: Record<string, string> }) =>
			refuse({ action: 'fromTemplate', subject: templateId, values, ...error });

		const template = core.templates.get({ id: templateId });
		if (!template.ok) return refused(formFailure(template.error, []));
		const t = template.value;
		const readIn = t.timeZone ?? zone;
		const today = formatDate(now, readIn);

		const unread = sheetTimeRefusals(form, today);
		if (Object.keys(unread).length > 0) {
			return refused({ error: 'Some times do not read.', fields: unread });
		}

		const input = fromTemplateInput(form, {
			zone,
			today,
			nowTime: formatTime(now, readIn),
			template: { timeZone: t.timeZone, startTime: t.startTime, endTime: t.endTime }
		});
		const r = core.entries.fromTemplate(input);
		if (!r.ok) {
			// The core names the duration by its input; the sheet's field is `duration`.
			const error = r.error.fields?.durationMinutes
				? {
						...r.error,
						fields: Object.fromEntries(
							Object.entries(r.error.fields).map(([k, v]) => [
								k === 'durationMinutes' ? 'duration' : k,
								v
							])
						)
					}
				: r.error;
			// As the sheet renders them: a field only where the template leaves it blank, and
			// only the times typed (the ones the template supplied are not on screen).
			const shown = [
				'description',
				...(t.projectId === null ? ['projectId'] : []),
				...(t.activityId === null ? ['activityId'] : []),
				...(t.locationId === null ? ['locationId'] : []),
				...(t.reference === null ? ['reference'] : []),
				...TIMES.filter((k) => text(form, k).trim() !== '')
			];
			return refused(formFailure(error, shown));
		}
		done(core, cookies, r, safeBack(text(form, 'back')));
	}
};
