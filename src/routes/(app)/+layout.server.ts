import { requireUser } from '#lib/server/guards.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const { username, isAdmin } = requireUser(locals);
	return { user: { username, isAdmin } };
};
