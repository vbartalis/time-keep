import { error, fail } from '@sveltejs/kit';
import type { EntryFormData } from '#lib/components/entry/types.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import {
	coreFailure,
	createInput,
	formPickers,
	newEntryValues,
	newEntryZoneFixed,
	unreadFailure
} from '#lib/server/screens/entry-form.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

const core = (locals: App.Locals, now: number) =>
	openCore(getDb(), requireUser(locals).id, 'ui', () => now);

export const load: PageServerLoad = ({ locals, cookies, url }): EntryFormData => {
	const now = Date.now();
	const c = core(locals, now);
	const { zone } = zoneFor(c, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const values = newEntryValues(c, url.searchParams, zone, now);
	if (values === null) error(404, 'Not found');
	return {
		kind: 'entry',
		mode: 'new',
		values,
		...formPickers(c, {
			projectId: values.projectId,
			activityId: values.activityId || null,
			locationId: values.locationId || null
		}),
		back: safeBack(url.searchParams.get('back')),
		zoneFixed: newEntryZoneFixed(c, url.searchParams),
		failure: null
	};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const c = core(locals, Date.now());
		const back = safeBack(text(form, 'back'));
		const read = createInput(form);
		if (!read.ok) return fail(400, unreadFailure(read.fields, form));
		const r = c.entries.create(read.input);
		if (!r.ok) return fail(400, coreFailure('save', r.error, form));
		done(c, cookies, r, back);
	}
};
