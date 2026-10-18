import { error, redirect } from '@sveltejs/kit';
import type { User } from './db/schema';

export function requireUser(locals: App.Locals): User {
	if (!locals.user) redirect(303, '/login');
	return locals.user;
}

export function requireAdmin(locals: App.Locals): User {
	const user = requireUser(locals);
	if (!user.isAdmin) error(403, 'Admins only');
	return user;
}
