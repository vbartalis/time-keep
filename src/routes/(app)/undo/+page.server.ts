import { redirect } from '@sveltejs/kit';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { setFlash } from '#lib/server/screens/flash.js';
import type { Actions, PageServerLoad } from './$types';

/** Undo is posted here from any screen; a visit to the address has nothing to show. */
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const core = openCore(getDb(), user.id, 'ui', () => Date.now());
		const batchId = text(form, 'batchId');
		const r = core.undo({ batchId });
		setFlash(
			cookies,
			r.ok
				? { label: 'Undone', batchId: null, warnings: r.warnings, undone: true }
				: { label: '', batchId, warnings: [], error: r.error.message }
		);
		redirect(303, safeBack(text(form, 'back')));
	}
};
