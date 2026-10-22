import { describe, expect, it } from 'vitest';
import { tokenItems, userItems } from './items';

describe('userItems', () => {
	it('offers Set password… and, after a rule, Disable for another active user', () => {
		const items = userItems({ id: 'u2', disabled: false }, 'u1');
		expect(items.map((i) => i.id)).toEqual(['password', 'disable']);
		const [password, disable] = items;
		expect(password).toMatchObject({ kind: 'pick', label: 'Set password…', href: '?password=u2' });
		expect(password?.ruleBefore).toBeFalsy();
		expect(disable).toMatchObject({
			kind: 'post',
			label: 'Disable',
			ruleBefore: true,
			action: '?/disable',
			fields: { userId: 'u2' }
		});
		expect(disable?.tone).toBeUndefined();
	});

	it('offers Enable for a disabled user', () => {
		const items = userItems({ id: 'u2', disabled: true }, 'u1');
		expect(items.map((i) => i.id)).toEqual(['password', 'enable']);
		expect(items[1]).toMatchObject({
			kind: 'post',
			label: 'Enable',
			ruleBefore: true,
			action: '?/enable',
			fields: { userId: 'u2' }
		});
		expect(items[1]?.tone).toBeUndefined();
	});

	it("offers neither Disable nor Enable on the actor's own row", () => {
		const items = userItems({ id: 'u1', disabled: false }, 'u1');
		expect(items.map((i) => i.id)).toEqual(['password']);
		expect(items[0]).toMatchObject({ kind: 'pick', href: '?password=u1' });
	});
});

describe('tokenItems', () => {
	it('offers one destructive Revoke… that opens the confirm', () => {
		const items = tokenItems({ id: 't1' });
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			id: 'revoke',
			kind: 'pick',
			label: 'Revoke…',
			tone: 'destructive',
			href: '?revoke=t1'
		});
	});
});
