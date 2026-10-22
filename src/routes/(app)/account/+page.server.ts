import { fail } from '@sveltejs/kit';
import { createToken, listTokens, revokeToken } from '#lib/server/auth/tokens.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { dialogOf, fieldOf } from '#lib/server/screens/accounts.js';
import { formatDate, formatTime } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import { changeOwnPassword } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const tokens = listTokens(getDb(), user.id).map((t) => ({
		id: t.id,
		name: t.name,
		created: formatDate(t.createdAt, zone),
		lastUsed:
			t.lastUsedAt === null
				? null
				: `${formatDate(t.lastUsedAt, zone)} ${formatTime(t.lastUsedAt, zone)}`
	}));
	return { tokens, dialog: dialogOf(url.searchParams) };
};

export const actions: Actions = {
	password: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const next = String(data.get('next') ?? '');
		const confirm = String(data.get('confirm') ?? '');
		if (next !== confirm) {
			const error = 'Passwords do not match.';
			return fail(400, { error, field: fieldOf(error, 'ownPassword') });
		}
		const result = await changeOwnPassword(getDb(), user.id, current, next, locals.session!.id);
		if (!result.ok)
			return fail(400, { error: result.error, field: fieldOf(result.error, 'ownPassword') });
		return { message: 'Password changed.' };
	},
	createToken: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const name = String(data.get('name') ?? '');
		const result = createToken(getDb(), user.id, name);
		if (!result.ok)
			return fail(400, {
				dialog: 'token',
				tokenError: result.error,
				field: fieldOf(result.error, 'token'),
				values: { name }
			});
		// Shown once: only the hash is stored.
		return { token: result.value.token, tokenName: result.value.summary.name };
	},
	revokeToken: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		// The first press only asks; the confirm button sends `confirm`.
		if (data.get('confirm') !== 'yes') return { confirmRevoke: id };
		const result = revokeToken(getDb(), user.id, id);
		if (!result.ok) return fail(400, { tokenError: result.error });
		return { tokenMessage: 'Token revoked.' };
	}
};
