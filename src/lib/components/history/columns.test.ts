import { describe, expect, it } from 'vitest';
import { keepArrows } from './columns';

describe('keepArrows', () => {
	it('keeps every "›" on the line of what comes before it', () => {
		expect(keepArrows('Tue 2026-10-20 09:30–09:45 · CompX › ClientY – ProjectZ')).toBe(
			'Tue 2026-10-20 09:30–09:45 · CompX\u00a0› ClientY – ProjectZ'
		);
		expect(keepArrows('2026-10-13 · A › B, C › D')).toBe('2026-10-13 · A\u00a0› B, C\u00a0› D');
	});

	it('leaves a line without one as it is', () => {
		expect(keepArrows('Customer CompZ')).toBe('Customer CompZ');
	});
});
