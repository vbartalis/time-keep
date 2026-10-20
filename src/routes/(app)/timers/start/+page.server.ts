import { redirect } from '@sveltejs/kit';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { setFlash } from '#lib/server/screens/flash.js';
import { startFromTemplateInput } from '#lib/server/screens/timer-actions.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

/** Starting is a POST; a GET has nothing to show. */
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	/** A timer now from a template; one without a project opens the form in timer mode. */
	default: async ({ request, locals, cookies }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const now = Date.now();
		const core = openCore(getDb(), user.id, 'ui', () => now);
		const back = safeBack(text(form, 'back'));
		const t = core.templates.get({ id: text(form, 'templateId') });
		if (!t.ok) {
			setFlash(cookies, { label: '', batchId: null, warnings: [], error: t.error.message });
			redirect(303, back);
		}
		if (t.value.projectId === null) {
			const query = new URLSearchParams({ template: t.value.id, timer: '1', back });
			redirect(303, `/entries/new?${query}`);
		}
		const { zone } = zoneFor(
			core,
			{ field: text(form, 'timeZone'), cookie: cookies.get(ZONE_COOKIE) },
			now
		);
		const r = core.timers.start(startFromTemplateInput(t.value, text(form, 'description'), zone));
		if (!r.ok) {
			setFlash(cookies, { label: '', batchId: null, warnings: [], error: r.error.message });
			redirect(303, back);
		}
		done(core, cookies, r, back);
	}
};
