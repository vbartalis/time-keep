import { isHttpError, isRedirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import type { Session, User } from './db/schema';
import { requireAdmin, requireUser } from './guards';

function locals(isAdmin: boolean | null): App.Locals {
	if (isAdmin === null) return { user: null, session: null };
	return { user: { id: 'u1', username: 'ann', isAdmin } as User, session: {} as Session };
}

function thrown(fn: () => unknown): unknown {
	try {
		fn();
	} catch (e) {
		return e;
	}
	throw new Error('did not throw');
}

describe('guards', () => {
	it('redirects a signed-out visitor to /login', () => {
		for (const guard of [requireUser, requireAdmin]) {
			const e = thrown(() => guard(locals(null)));
			expect(isRedirect(e) && e.status === 303 && e.location).toBe('/login');
		}
	});

	it('returns the user for requireUser', () => {
		expect(requireUser(locals(false)).username).toBe('ann');
	});

	it('rejects a non-admin with 403', () => {
		const e = thrown(() => requireAdmin(locals(false)));
		expect(isHttpError(e, 403)).toBe(true);
	});

	it('returns the admin for requireAdmin', () => {
		expect(requireAdmin(locals(true)).isAdmin).toBe(true);
	});
});
