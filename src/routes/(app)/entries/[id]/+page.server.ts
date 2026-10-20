import { error, fail, redirect } from '@sveltejs/kit';
import type { EntryFormData } from '#lib/components/entry/types.js';
import { openCore, type Result } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text, wholeNumber } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import {
	coreFailure,
	formPickers,
	goneFailure,
	unreadFailure,
	updateInput,
	valuesFromEntry
} from '#lib/server/screens/entry-form.js';
import type { Actions, PageServerLoad } from './$types';

const core = (locals: App.Locals) =>
	openCore(getDb(), requireUser(locals).id, 'ui', () => Date.now());

export const load: PageServerLoad = ({ locals, params, url }): EntryFormData => {
	const c = core(locals);
	const r = c.entries.get({ id: params.id });
	if (!r.ok) error(404, 'Entry not found');
	const e = r.value;
	return {
		mode: 'edit',
		values: valuesFromEntry(e),
		...formPickers(c, e),
		back: safeBack(url.searchParams.get('back')),
		zoneFixed: true,
		failure: null
	};
};

/** Whether the form was filled from a version other than the entry's current one. */
const stale = (form: FormData, current: Result<{ version: number }>) =>
	current.ok && text(form, 'version') !== String(current.value.version);

export const actions: Actions = {
	save: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const current = c.entries.get({ id: params.id });
		if (!current.ok) {
			return fail(
				400,
				current.error.code === 'not_found'
					? goneFailure('save', form)
					: coreFailure('save', current.error, form)
			);
		}
		const read = updateInput(form, current.value);
		if (!read.ok) return fail(400, unreadFailure(read.fields, form));
		const r = c.entries.update(read.input);
		if (!r.ok)
			return fail(400, coreFailure('save', r.error, form, { stale: stale(form, current) }));
		// Nothing changed: no batch was stored, so there is nothing to show or undo.
		if (r.value.version === current.value.version) redirect(303, back);
		done(c, cookies, r, back);
	},

	saveAsTemplate: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const r = c.templates.fromEntry({ entryId: params.id, name: text(form, 'name') });
		if (r.ok) done(c, cookies, r, back);
		if (r.error.code === 'not_found') return fail(400, goneFailure('saveAsTemplate', form));
		return fail(400, coreFailure('saveAsTemplate', r.error, form));
	},

	/** Deletes at once, with the version the form was loaded with; the strip offers it back. */
	delete: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const current = c.entries.get({ id: params.id });
		const r = c.entries.delete({
			id: params.id,
			expectedVersion: wholeNumber(text(form, 'version'))
		});
		if (r.ok) done(c, cookies, r, back);
		if (!current.ok && current.error.code === 'not_found') {
			return fail(400, goneFailure('delete', form));
		}
		return fail(400, coreFailure('delete', r.error, form, { stale: stale(form, current) }));
	}
};
