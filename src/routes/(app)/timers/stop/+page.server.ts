import { redirect } from '@sveltejs/kit';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { setFlash } from '#lib/server/screens/flash.js';
import type { Actions, PageServerLoad } from './$types';

/** Stopping is a POST; a GET has nothing to show. */
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const core = openCore(getDb(), user.id, 'ui', () => Date.now());
		const back = safeBack(text(form, 'back'));
		const r = core.timers.stop({ id: text(form, 'id') });
		if (!r.ok) {
			setFlash(cookies, { label: '', batchId: null, warnings: [], error: r.error.message });
			redirect(303, back);
		}
		done(core, cookies, r, back);
	}
};
