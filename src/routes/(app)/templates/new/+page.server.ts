import { fail } from '@sveltejs/kit';
import type { EditFailure } from '#lib/components/today/types.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, formFailure } from '#lib/server/screens/actions.js';
import { postedValues } from '#lib/server/screens/edit.js';
import {
	customerOf,
	TEMPLATE_FIELDS,
	templateChoices,
	templateInput
} from '#lib/server/screens/templates.js';
import type { Actions, PageServerLoad } from './$types';

const core = (locals: App.Locals) => openCore(getDb(), requireUser(locals).id, 'ui');

export const load: PageServerLoad = ({ locals }) => ({
	choices: templateChoices(core(locals))
});

export const actions: Actions = {
	save: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const r = c.templates.create(templateInput(form, customerOf(c)));
		if (!r.ok) {
			const failure: EditFailure = {
				action: 'save',
				conflict: false,
				...formFailure(r.error, TEMPLATE_FIELDS),
				values: postedValues(form, TEMPLATE_FIELDS)
			};
			return fail(400, failure);
		}
		done(c, cookies, r, '/templates');
	}
};
