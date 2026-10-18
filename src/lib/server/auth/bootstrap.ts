import { eq } from 'drizzle-orm';
import type { DB } from '../db/index';
import { user } from '../db/schema';
import { createUser } from '../users';

/** Creates the first admin from the environment when no admin exists yet. */
export async function ensureAdmin(
	db: DB,
	env: { ADMIN_USERNAME?: string; ADMIN_PASSWORD?: string }
): Promise<'exists' | 'created'> {
	if (db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true)).limit(1).get()) {
		return 'exists';
	}
	const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = env;
	if (!username || !password) {
		throw new Error('No admin exists: set ADMIN_USERNAME and ADMIN_PASSWORD to create one.');
	}
	const result = await createUser(db, { username, password, isAdmin: true });
	if (!result.ok) throw new Error(`ADMIN_USERNAME/ADMIN_PASSWORD: ${result.error}`);
	return 'created';
}
