import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.js';
import { requireAdmin } from '#lib/server/guards.js';
import { createUser, listUsers, setDisabled, setPassword } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const actor = requireAdmin(locals);
	return { users: listUsers(getDb()), actorId: actor.id };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const result = await createUser(getDb(), {
			username: String(data.get('username') ?? ''),
			password: String(data.get('password') ?? ''),
			isAdmin: data.get('isAdmin') === 'on'
		});
		if (!result.ok) return fail(400, { error: result.error });
		return { message: `Created ${result.value.username}.` };
	},
	setPassword: async ({ request, locals }) => {
		const actor = requireAdmin(locals);
		const data = await request.formData();
		const userId = String(data.get('userId') ?? '');
		const result = await setPassword(
			getDb(),
			userId,
			String(data.get('password') ?? ''),
			userId === actor.id ? locals.session?.id : undefined
		);
		if (!result.ok) return fail(400, { error: result.error });
		return { message: 'Password set.' };
	},
	disable: async ({ request, locals }) => {
		const actor = requireAdmin(locals);
		const data = await request.formData();
		const result = setDisabled(getDb(), actor.id, String(data.get('userId') ?? ''), true);
		if (!result.ok) return fail(400, { error: result.error });
		return { message: 'User disabled.' };
	},
	enable: async ({ request, locals }) => {
		const actor = requireAdmin(locals);
		const data = await request.formData();
		const result = setDisabled(getDb(), actor.id, String(data.get('userId') ?? ''), false);
		if (!result.ok) return fail(400, { error: result.error });
		return { message: 'User enabled.' };
	}
};
