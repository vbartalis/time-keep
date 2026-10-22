import { describe, expect, it } from 'vitest';
import { swipeYields } from './gestures.svelte';

describe('swipeYields', () => {
	it('yields while it can scroll', () => {
		expect(swipeYields(-1, { back: true, on: false })).toBe(true);
		expect(swipeYields(1, { back: true, on: false })).toBe(false);
		expect(swipeYields(1, { back: false, on: true })).toBe(true);
		expect(swipeYields(-1, null)).toBe(false);
	});
});
