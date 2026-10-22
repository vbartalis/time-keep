export type AccountField = 'username' | 'password' | 'current' | 'next' | 'confirm' | 'name';

export type AccountForm = 'user' | 'setPassword' | 'ownPassword' | 'token';

/** The field a refusal is about, by the message's subject; null when it has no field. */
export function fieldOf(message: string, form: AccountForm): AccountField | null {
	if (message.startsWith('Username')) return 'username';
	if (message.startsWith('Password must')) return form === 'ownPassword' ? 'next' : 'password';
	if (message === 'Current password is incorrect.') return 'current';
	if (message === 'Passwords do not match.') return 'confirm';
	if (message.startsWith('Name must') || message === 'You already have a token with that name.')
		return 'name';
	return null;
}

export type Dialog =
	| { kind: 'token' }
	| { kind: 'user' }
	| { kind: 'password'; userId: string }
	| { kind: 'revoke'; tokenId: string };

/** The no-script address of a dialog: `?new=token`, `?new=user`, `?password=<id>`, `?revoke=<id>`. */
export function dialogOf(params: URLSearchParams): Dialog | null {
	const made = params.get('new');
	if (made === 'token') return { kind: 'token' };
	if (made === 'user') return { kind: 'user' };
	const password = params.get('password');
	if (password) return { kind: 'password', userId: password };
	const revoke = params.get('revoke');
	if (revoke) return { kind: 'revoke', tokenId: revoke };
	return null;
}
