import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'static/manifest.webmanifest'), 'utf8'));

describe('web app manifest', () => {
	it('installs as a standalone app starting at the root', () => {
		expect(manifest.name).toBe('time-keep');
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/');
	});

	it('names an icon of each kind the phone needs', () => {
		const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => [
			i.sizes,
			i.purpose ?? 'any'
		]);
		expect(sizes).toContainEqual(['192x192', 'any']);
		expect(sizes).toContainEqual(['512x512', 'any']);
		expect(sizes).toContainEqual(['512x512', 'maskable']);
	});

	it('points every icon at a file that exists', () => {
		for (const icon of manifest.icons) {
			expect(icon.src.startsWith('/')).toBe(true);
			expect(existsSync(join(root, 'static', icon.src)), icon.src).toBe(true);
		}
	});

	it('links the apple touch icon from the shell page', () => {
		const html = readFileSync(join(root, 'src/app.html'), 'utf8');
		const href = /rel="apple-touch-icon" href="([^"]+)"/.exec(html)?.[1];
		expect(href).toBeDefined();
		expect(existsSync(join(root, 'static', href!))).toBe(true);
	});
});
