import { fail, redirect } from '@sveltejs/kit';
import { openCore, type Core, type Result } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, formFailure, rows, text } from '#lib/server/screens/actions.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import {
	readShow,
	setupTree,
	type SetupAction,
	type SetupFailure,
	type SetupKind,
	type Show
} from '#lib/server/screens/setup.js';
import type { Actions, PageServerLoad } from './$types';

const KINDS: readonly string[] = ['customer', 'project', 'activity', 'location'];

export const load: PageServerLoad = ({ locals, url, cookies }) => {
	const core = openCore(getDb(), requireUser(locals).id, 'ui');
	const show = readShow(url.searchParams);
	const tree = setupTree(core, show);
	const rename = url.searchParams.get('rename');
	const kind = url.searchParams.get('new');
	const customer = url.searchParams.get('customer');
	return {
		show,
		...tree,
		/** The active customers, for a new project's Customer select. */
		customerOptions: rows(core.customers.list()).map((c) => ({ id: c.id, name: c.name })),
		/** The row whose rename form `?rename=<id>` asks for. */
		rename: rename || null,
		/** The create dialog `?new=<kind>[&customer=<id>]` asks for. */
		creating: KINDS.includes(kind ?? '')
			? { kind: kind as SetupKind, customerId: kind === 'project' ? customer || null : null }
			: null,
		flash: takeFlash(cookies)
	};
};

/** `/setup` under the filter it was posted from. */
const backTo = (show: Show) => (show === 'active' ? '/setup' : `/setup?show=${show}`);

const invalid = () => fail(400, { error: 'invalid' });

function run(
	core: Core,
	action: SetupAction,
	kind: SetupKind,
	form: FormData
): { result: Result<unknown>; id?: string; customerId?: string } {
	const target = core[
		kind === 'customer'
			? 'customers'
			: kind === 'project'
				? 'projects'
				: kind === 'activity'
					? 'activities'
					: 'locations'
	] as Core['customers'];
	const id = text(form, 'id');
	const name = text(form, 'name');
	const expectedVersion = /^\d+$/.test(text(form, 'expectedVersion'))
		? Number(text(form, 'expectedVersion'))
		: undefined;
	if (action === 'create') {
		if (kind === 'project') {
			const customerId = text(form, 'customerId');
			return { result: core.projects.create({ customerId, name }), customerId };
		}
		return { result: target.create({ name }) };
	}
	if (action === 'rename') return { result: target.rename({ id, name, expectedVersion }), id };
	return { result: target[action]({ id, expectedVersion }), id };
}

async function handle(
	action: SetupAction,
	{ request, locals, cookies }: Parameters<Actions[string]>[0]
) {
	const form = await request.formData();
	const kind = text(form, 'kind');
	if (!KINDS.includes(kind)) return invalid();
	const core = openCore(getDb(), requireUser(locals).id, 'ui');
	// The filter the form was posted under.
	const show = readShow(new URLSearchParams({ show: text(form, 'show') }));
	const posted = /^\d+$/.test(text(form, 'expectedVersion'))
		? Number(text(form, 'expectedVersion'))
		: undefined;
	const { result, id, customerId } = run(core, action, kind as SetupKind, form);
	if (result.ok) {
		// A create made in Archived is active: land on All, where the new row shows.
		const back = backTo(action === 'create' && show === 'archived' ? 'all' : show);
		// Nothing changed (a rename to the same name): no batch was stored, so there is
		// nothing to show or undo.
		const value = result.value as { version?: number };
		if (action !== 'create' && value.version !== undefined && value.version === posted) {
			redirect(303, back);
		}
		done(core, cookies, result, back);
	}
	const { code } = result.error;
	const shown = formFailure(result.error, ['name']);
	const failure: SetupFailure = {
		action,
		kind: kind as SetupKind,
		...(id ? { id } : {}),
		...(customerId ? { customerId } : {}),
		...shown,
		show,
		conflict: code === 'conflict' && !shown.fields.name,
		values: { name: text(form, 'name') }
	};
	return fail(400, failure);
}

export const actions: Actions = {
	create: (event) => handle('create', event),
	rename: (event) => handle('rename', event),
	archive: (event) => handle('archive', event),
	unarchive: (event) => handle('unarchive', event)
};
