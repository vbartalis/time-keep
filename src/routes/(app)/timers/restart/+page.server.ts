import { redirect } from '@sveltejs/kit';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { setFlash } from '#lib/server/screens/flash.js';
import { restartInput } from '#lib/server/screens/timer-actions.js';
import type { Actions, PageServerLoad } from './$types';

/** Restarting is a POST; a GET has nothing to show. */
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	/** A timer now with the entry's fields, in its start zone. */
	default: async ({ request, locals, cookies }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const core = openCore(getDb(), user.id, 'ui', () => Date.now());
		const back = safeBack(text(form, 'back'));
		const e = core.entries.get({ id: text(form, 'id') });
		const r = e.ok ? core.timers.start(restartInput(e.value)) : e;
		if (!r.ok) {
			const error =
				r.error.code === 'not_found' ? 'This entry was deleted elsewhere.' : r.error.message;
			setFlash(cookies, { label: '', batchId: null, warnings: [], error });
			redirect(303, back);
		}
		done(core, cookies, r, back);
	}
};
