import { fail } from '@sveltejs/kit';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { coreFailure, unreadFailure } from '#lib/server/screens/entry-form.js';
import {
	customerOf,
	templateFormData,
	templateFromForm,
	templateUnread
} from '#lib/server/screens/templates.js';
import type { Actions, PageServerLoad } from './$types';

const core = (locals: App.Locals) => openCore(getDb(), requireUser(locals).id, 'ui');

export const load: PageServerLoad = ({ locals, url }) =>
	templateFormData(core(locals), null, url.searchParams.get('back') ?? '');

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const unread = templateUnread(form);
		if (Object.keys(unread).length > 0) return fail(400, unreadFailure(unread, form, 'template'));
		const r = c.templates.create(templateFromForm(form, customerOf(c)));
		if (!r.ok) return fail(400, coreFailure('save', r.error, form, { kind: 'template' }));
		done(c, cookies, r, back);
	}
};
