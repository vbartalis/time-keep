import { fail, redirect } from '@sveltejs/kit';
import { createSession, setSessionCookie } from '#lib/server/auth/sessions.js';
import { getDb } from '#lib/server/db/index.js';
import { authenticate } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url, getClientAddress }) => {
		if (locals.user) redirect(303, '/');
		const data = await request.formData();
		const username = String(data.get('username') ?? '');
		const password = String(data.get('password') ?? '');
		const db = getDb();
		const result = await authenticate(db, username, password, getClientAddress());
		if (!result.ok) return fail(400, { error: result.error });
		const { token, session } = createSession(db, result.value.id);
		setSessionCookie(cookies, token, session.expiresAt, url.protocol === 'https:');
		redirect(303, '/');
	}
};
