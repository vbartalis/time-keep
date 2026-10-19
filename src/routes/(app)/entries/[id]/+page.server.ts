import { error, fail, redirect } from '@sveltejs/kit';
import type { EditFailure } from '#lib/components/today/types.js';
import { openCore, type CoreError, type Result } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { safeBack } from '#lib/server/screens/back.js';
import {
	done,
	formFailure,
	groupProjects,
	rows,
	text,
	wholeNumber
} from '#lib/server/screens/actions.js';
import { editInput, postedValues, withCurrent } from '#lib/server/screens/edit.js';
import { toLocalInput } from '#lib/server/screens/today.js';
import type { Actions, PageServerLoad } from './$types';

/** The fields the edit form shows; a core error on any other becomes the general message. */
const SHOWN = [
	'start',
	'end',
	'projectId',
	'activityId',
	'locationId',
	'reference',
	'description'
] as const;

const core = (locals: App.Locals, now = Date.now()) =>
	openCore(getDb(), requireUser(locals).id, 'ui', () => now);

export const load: PageServerLoad = ({ locals, params, url }) => {
	const c = core(locals);
	const r = c.entries.get({ id: params.id });
	if (!r.ok) error(404, 'Entry not found');
	const e = r.value;
	const archived = (name: string, isArchived: boolean) =>
		isArchived ? `${name} (archived)` : name;

	const projects = withCurrent(
		rows(c.projects.list()),
		rows(c.projects.list({ includeArchived: true })),
		e.projectId
	).map((p) => ({ ...p, name: archived(p.name, p.archived) }));
	const options = (active: { id: string; name: string }[], all: typeof active, id: string | null) =>
		withCurrent(active, all, id).map((o) => ({ id: o.id, name: archived(o.name, o.archived) }));

	return {
		back: safeBack(url.searchParams.get('back')),
		entry: {
			id: e.id,
			version: e.version,
			projectId: e.projectId,
			activityId: e.activityId,
			locationId: e.locationId,
			reference: e.reference,
			description: e.description,
			start: toLocalInput(e.startAt, e.startZone),
			end: e.endAt === null ? '' : toLocalInput(e.endAt, e.endZone ?? e.startZone),
			startZone: e.startZone,
			endZone: e.endAt === null ? null : (e.endZone ?? e.startZone),
			running: e.endAt === null,
			label: `${e.customerName} › ${e.projectName}`
		},
		projects: groupProjects(projects),
		activities: options(
			rows(c.activities.list()),
			rows(c.activities.list({ includeArchived: true })),
			e.activityId
		),
		locations: options(
			rows(c.locations.list()),
			rows(c.locations.list({ includeArchived: true })),
			e.locationId
		)
	};
};

/** The refusal for an entry that no longer exists. */
const gone = (action: EditFailure['action'], back: string) => {
	const failure: EditFailure = {
		action,
		conflict: false,
		gone: true,
		back,
		error: 'This entry was deleted elsewhere.',
		fields: {}
	};
	return fail(400, failure);
};

/** Whether the form was filled from a version other than the entry's current one. */
const stale = (form: FormData, current: Result<{ version: number }>) =>
	current.ok && text(form, 'version') !== String(current.value.version);

function refuse(
	action: EditFailure['action'],
	err: CoreError,
	shown: readonly string[],
	back: string,
	opts: { stale?: boolean; values?: Record<string, string> } = {}
) {
	const { values } = opts;
	// Only a stale form is helped by a reload; other conflicts (a timer already running
	// on the project) are read like any refusal.
	const conflict = err.code === 'conflict' && opts.stale === true;
	const failure: EditFailure = {
		action,
		back,
		conflict,
		...(conflict ? { error: err.message, fields: {} } : formFailure(err, shown)),
		...(values ? { values } : {})
	};
	return fail(400, failure);
}

export const actions: Actions = {
	save: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const values = postedValues(form, SHOWN);
		const current = c.entries.get({ id: params.id });
		if (!current.ok) {
			return current.error.code === 'not_found'
				? gone('save', back)
				: refuse('save', current.error, [], back, { values });
		}
		const r = c.entries.update(editInput(form, params.id, current.value));
		if (!r.ok) return refuse('save', r.error, SHOWN, back, { stale: stale(form, current), values });
		// Nothing changed: no batch was stored, so there is nothing to show or undo.
		if (r.value.version === current.value.version) redirect(303, back);
		done(c, cookies, r, back);
	},

	saveAsTemplate: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const c = core(locals);
		const back = safeBack(text(form, 'back'));
		const name = text(form, 'name');
		const r = c.templates.fromEntry({ entryId: params.id, name });
		if (r.ok) done(c, cookies, r, '/templates');
		if (r.error.code === 'not_found') return gone('saveAsTemplate', back);
		const failure: EditFailure = {
			action: 'saveAsTemplate',
			back,
			conflict: false,
			...formFailure(r.error, ['name']),
			values: { name }
		};
		return fail(400, failure);
	},

	delete: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const back = safeBack(text(form, 'back'));
		// The first press only asks; the confirm button sends `confirm`.
		if (text(form, 'confirm') !== 'yes') {
			return { action: 'delete' as const, confirm: true, back, version: text(form, 'version') };
		}
		const c = core(locals);
		const version = text(form, 'version');
		const current = c.entries.get({ id: params.id });
		const r = c.entries.delete({
			id: params.id,
			expectedVersion: wholeNumber(version)
		});
		if (!r.ok && !current.ok && current.error.code === 'not_found') return gone('delete', back);
		if (!r.ok)
			return refuse('delete', r.error, [], back, {
				stale: stale(form, current),
				values: postedValues(form, [])
			});
		done(c, cookies, r, back);
	}
};
