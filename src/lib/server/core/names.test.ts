import { describe, expect, it } from 'vitest';
import { nameKey, nameSchema } from './names';

describe('nameKey', () => {
	it('is case-insensitive for Hungarian letters', () => {
		expect(nameKey('Ügyfél')).toBe(nameKey('ügyfél'));
	});

	it('normalises to NFC', () => {
		expect(nameKey('é')).toBe(nameKey('é'));
	});
});

describe('nameSchema', () => {
	const message = 'Name must be 1–100 characters.';

	it('trims', () => {
		expect(nameSchema.parse('  A  ')).toBe('A');
	});

	it('rejects empty and over-long names with the message', () => {
		for (const bad of ['', '   ', 'a'.repeat(101)]) {
			const r = nameSchema.safeParse(bad);
			expect(r.success).toBe(false);
			expect(r.error?.issues[0].message).toBe(message);
		}
	});

	it('accepts 100 characters', () => {
		expect(nameSchema.parse('a'.repeat(100))).toHaveLength(100);
	});
});
