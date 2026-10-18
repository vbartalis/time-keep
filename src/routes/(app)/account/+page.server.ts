import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { changeOwnPassword } from '#lib/server/users.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const next = String(data.get('next') ?? '');
		const confirm = String(data.get('confirm') ?? '');
		if (next !== confirm) return fail(400, { error: 'Passwords do not match.' });
		const result = await changeOwnPassword(getDb(), user.id, current, next, locals.session!.id);
		if (!result.ok) return fail(400, { error: result.error });
		return { message: 'Password changed.' };
	}
};
