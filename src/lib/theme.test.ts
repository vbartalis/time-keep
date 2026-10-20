import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/routes/layout.css', 'utf8');

describe('theme tokens', () => {
	it("uses Public Sans and none of round 1's faces", () => {
		expect(css).toContain('Public Sans');
		expect(css).not.toContain('Archivo');
		expect(css).not.toContain('Martian');
	});

	it('defines eight project colours with fill and ink', () => {
		for (let n = 1; n <= 8; n++) {
			expect(css).toContain(`--project-${n}:`);
			expect(css).toContain(`--project-${n}-fill:`);
			expect(css).toContain(`--project-${n}-ink:`);
		}
	});

	it('drops the punch-card utilities', () => {
		expect(css).toContain('@utility figures');
		expect(css).toContain('@utility caps');
		expect(css).not.toContain('@utility punch');
		expect(css).not.toContain('@utility printed');
	});
});
