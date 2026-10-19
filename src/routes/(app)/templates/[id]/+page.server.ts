import { error, fail, redirect } from '@sveltejs/kit';
import type { EditFailure } from '#lib/components/today/types.js';
import { openCore, type CoreError, type Result } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, formFailure, text, wholeNumber } from '#lib/server/screens/actions.js';
import { postedValues } from '#lib/server/screens/edit.js';
import {
	customerOf,
	TEMPLATE_FIELDS,
	templateChoices,
	templateInput
} from '#lib/server/screens/templates.js';
import type { Actions, PageServerLoad } from './$types';

const core = (locals: App.Locals) => openCore(getDb(), requireUser(locals).id, 'ui');

export const load: PageServerLoad = ({ locals, params }) => {
	const c = core(locals);
	const r = c.templates.get({ id: params.id });
	if (!r.ok) error(404, 'Template not found');
	const t = r.value;
	return {
		template: {
			id: t.id,
			version: t.version,
			values: {
				name: t.name,
				customerId: t.customerId ?? '',
				projectId: t.projectId ?? '',
				activityId: t.activityId ?? '',
				locationId: t.locationId ?? '',
				startTime: t.startTime ?? '',
				endTime: t.endTime ?? '',
				durationMinutes: t.durationMinutes === null ? '' : String(t.durationMinutes),
				timeZone: t.timeZone ?? '',
				reference: t.reference ?? '',
				description: t.description ?? ''
			}
		},
		choices: templateChoices(c, t)
	};
};

/** The refusal for a template that no longer exists. */
const gone = (action: EditFailure['action']) => {
	const failure: EditFailure = {
		action,
		conflict: false,
		gone: true,
		error: 'This template was deleted elsewhere.',
		fields: {}
	};
	return fail(400, failure);
};

/** Whether the form was filled from a version other than the template's current one. */
const stale = (form: FormData, current: Result<{ version: number }>) =>
	current.ok && text(form, 'version') !== String(current.value.version);

function refuse(
	action: EditFailure['action'],
	err: CoreError,
	shown: readonly string[],
	opts: { stale: boolean; values: Record<string, string> }
) {
	// Only a stale form is helped by a reload; any other conflict reads like a refusal.
	const conflict = err.code === 'conflict' && opts.stale;
	const failure: EditFailure = {
		action,
		conflict,
		...(conflict ? { error: err.message, fields: {} } : formFailure(err, shown)),
		values: opts.values
	};
	return fail(400, failure);
}

export const actions: Actions = {
	save: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const values = postedValues(form, TEMPLATE_FIELDS);
		const current = c.templates.get({ id: params.id });
		if (!current.ok) {
			return current.error.code === 'not_found'
				? gone('save')
				: refuse('save', current.error, [], { stale: false, values });
		}
		const r = c.templates.update({
			...templateInput(form, customerOf(c)),
			id: params.id,
			expectedVersion: wholeNumber(text(form, 'version'))
		});
		if (!r.ok) {
			return refuse('save', r.error, TEMPLATE_FIELDS, { stale: stale(form, current), values });
		}
		// Nothing changed: no batch was stored, so there is nothing to show or undo.
		if (r.value.version === current.value.version) redirect(303, '/templates');
		done(c, cookies, r, '/templates');
	},

	delete: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const version = text(form, 'version');
		// The first press only asks; the confirm button sends `confirm`.
		if (text(form, 'confirm') !== 'yes') {
			return { action: 'delete' as const, confirm: true, version };
		}
		const c = core(locals);
		const current = c.templates.get({ id: params.id });
		const r = c.templates.delete({ id: params.id, expectedVersion: wholeNumber(version) });
		if (!r.ok && !current.ok && current.error.code === 'not_found') return gone('delete');
		if (!r.ok) {
			return refuse('delete', r.error, [], {
				stale: stale(form, current),
				values: postedValues(form, [])
			});
		}
		done(c, cookies, r, '/templates');
	}
};
