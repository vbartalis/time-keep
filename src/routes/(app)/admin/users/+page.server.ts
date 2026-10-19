import { fail } from '@sveltejs/kit';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireAdmin } from '#lib/server/guards.js';
import { formatDate } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import { createUser, listUsers, setDisabled, setPassword } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => {
	const actor = requireAdmin(locals);
	const now = Date.now();
	const core = openCore(getDb(), actor.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const users = listUsers(getDb()).map((u) => ({ ...u, createdAt: formatDate(u.createdAt, zone) }));
	return { users, actorId: actor.id };
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
