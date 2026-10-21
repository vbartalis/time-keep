import { error, fail, redirect } from '@sveltejs/kit';
import type { Result } from '#lib/server/core/index.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text, wholeNumber } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { coreFailure, goneFailure, unreadFailure } from '#lib/server/screens/entry-form.js';
import {
	customerOf,
	templateFormData,
	templateFromForm,
	templateUnread,
	withLinked
} from '#lib/server/screens/templates.js';
import type { Actions, PageServerLoad } from './$types';

const core = (locals: App.Locals) => openCore(getDb(), requireUser(locals).id, 'ui');

export const load: PageServerLoad = ({ locals, params, url }) => {
	const c = core(locals);
	const r = c.templates.get({ id: params.id });
	if (!r.ok) error(404, 'Template not found');
	return templateFormData(c, r.value, url.searchParams.get('back') ?? '');
};

/** Whether the form was filled from a version other than the template's current one. */
const stale = (form: FormData, current: Result<{ version: number }>) =>
	current.ok && text(form, 'version') !== String(current.value.version);

const template = { kind: 'template' } as const;

export const actions: Actions = {
	save: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const current = c.templates.get({ id: params.id });
		if (!current.ok) {
			return fail(
				400,
				current.error.code === 'not_found'
					? goneFailure('save', form, 'template')
					: coreFailure('save', current.error, form, template)
			);
		}
		const posted = withLinked(form, current.value);
		const unread = templateUnread(posted);
		if (Object.keys(unread).length > 0) return fail(400, unreadFailure(unread, form, 'template'));
		const r = c.templates.update({
			...templateFromForm(posted, customerOf(c)),
			id: params.id,
			expectedVersion: wholeNumber(text(form, 'version'))
		});
		if (!r.ok) {
			return fail(
				400,
				coreFailure('save', r.error, form, { ...template, stale: stale(form, current) })
			);
		}
		// Nothing changed: no batch was stored, so there is nothing to show or undo.
		if (r.value.version === current.value.version) redirect(303, back);
		done(c, cookies, r, back);
	},

	/** Deletes at once, with the version the form was loaded with; the strip offers it back. */
	delete: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const current = c.templates.get({ id: params.id });
		const r = c.templates.delete({
			id: params.id,
			expectedVersion: wholeNumber(text(form, 'version'))
		});
		if (r.ok) done(c, cookies, r, back);
		if (!current.ok && current.error.code === 'not_found') {
			return fail(400, goneFailure('delete', form, 'template'));
		}
		return fail(
			400,
			coreFailure('delete', r.error, form, { ...template, stale: stale(form, current) })
		);
	}
};
