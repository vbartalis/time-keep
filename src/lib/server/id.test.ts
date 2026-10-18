import { describe, expect, it } from 'vitest';
import { newId } from './id';

describe('newId', () => {
	it('is 26 lowercase base32 characters', () => {
		expect(newId()).toMatch(/^[a-z2-7]{26}$/);
	});

	it('does not repeat', () => {
		const ids = new Set(Array.from({ length: 1000 }, () => newId()));
		expect(ids.size).toBe(1000);
	});
});
