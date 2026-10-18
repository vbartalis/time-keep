import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { ensureAdmin } from '#lib/server/auth/bootstrap.js';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	setSessionCookie,
	validateSessionToken
} from '#lib/server/auth/sessions.js';
import { ADMIN_PASSWORD, ADMIN_USERNAME, DATABASE_PATH } from '$app/env/private';
import { getDb, initDb } from '#lib/server/db/index.js';
import { runMigrations } from '#lib/server/db/migrate.js';

export const init: ServerInit = async () => {
	const db = initDb(DATABASE_PATH);
	runMigrations(db);
	await ensureAdmin(db, { ADMIN_USERNAME, ADMIN_PASSWORD });
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	const secure = event.url.protocol === 'https:';
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const result = validateSessionToken(getDb(), token);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
			if (result.renewed) {
				setSessionCookie(event.cookies, token, result.session.expiresAt, secure);
			}
		} else {
			clearSessionCookie(event.cookies, secure);
		}
	}
	return resolve(event);
};
