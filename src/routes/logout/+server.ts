import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, invalidateSession } from '#lib/server/auth/sessions.js';
import { getDb } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ locals, cookies, url }) => {
	if (locals.session) invalidateSession(getDb(), locals.session.id);
	clearSessionCookie(cookies, url.protocol === 'https:');
	redirect(303, '/login');
};
