import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { flashAfter, setFlash, takeFlash, type Flash } from './flash';

function fakeCookies(initial: Record<string, string> = {}) {
	const jar = { ...initial };
	const opts: Record<string, unknown> = {};
	const cookies = {
		get: (n: string) => jar[n],
		set: (n: string, v: string, o: unknown) => {
			jar[n] = v;
			opts[n] = o;
		},
		delete: (n: string) => {
			delete jar[n];
		}
	} as unknown as Cookies;
	return { cookies, jar, opts };
}

describe('flash', () => {
	it('round trips and clears', () => {
		const { cookies, jar, opts } = fakeCookies();
		const flash: Flash = {
			label: 'Start timer on "X"',
			batchId: 'b1',
			warnings: [{ code: 'overlap', message: 'Overlaps', subject: 'e1' }]
		};
		setFlash(cookies, flash);
		expect(opts.flash).toMatchObject({ httpOnly: true, path: '/', maxAge: 60 });
		expect(takeFlash(cookies)).toEqual(flash);
		expect(jar.flash).toBeUndefined();
		expect(takeFlash(cookies)).toBeNull();
	});
	it('round trips an error and caps it', () => {
		const { cookies } = fakeCookies();
		const flash: Flash = { label: '', batchId: 'b1', warnings: [], error: 'Nope' };
		setFlash(cookies, flash);
		expect(takeFlash(cookies)).toEqual(flash);
		setFlash(cookies, { ...flash, error: 'x'.repeat(500) });
		expect(takeFlash(cookies)?.error).toHaveLength(200);
	});
	it('round trips the stopped entry to restart and caps it', () => {
		const { cookies } = fakeCookies();
		const flash: Flash = { label: 'Stop timer', batchId: 'b1', warnings: [], restartId: 'e1' };
		setFlash(cookies, flash);
		expect(takeFlash(cookies)).toEqual(flash);
		setFlash(cookies, { ...flash, restartId: 'x'.repeat(500) });
		expect(takeFlash(cookies)?.restartId).toHaveLength(200);
	});
	it('round trips the undone mark', () => {
		const { cookies } = fakeCookies();
		const flash: Flash = { label: 'Undone', batchId: null, warnings: [], undone: true };
		setFlash(cookies, flash);
		expect(takeFlash(cookies)).toEqual(flash);
	});
	it('caps the payload so the cookie stays small', () => {
		const { cookies, jar } = fakeCookies();
		const long = 'x'.repeat(5000);
		const warnings = Array.from({ length: 40 }, (_, i) => ({
			code: 'overlap',
			message: long,
			subject: `e${i}`
		}));
		setFlash(cookies, { label: long, batchId: 'b1', warnings });
		expect(jar.flash.length).toBeLessThan(2048);
		const back = takeFlash(cookies)!;
		expect(back.label).toHaveLength(200);
		expect(back.warnings).toHaveLength(5);
		expect(back.warnings[0]).toEqual({
			code: 'overlap',
			message: long.slice(0, 200),
			subject: 'e0'
		});
	});
	it('refuses malformed cookies and clears them', () => {
		for (const bad of [
			'not json',
			'{}',
			'{"label":1,"batchId":null,"warnings":[]}',
			'{"label":"a","batchId":null,"warnings":[{"code":1}]}',
			'{"label":"a","batchId":3,"warnings":[]}',
			'null'
		]) {
			const { cookies, jar } = fakeCookies({ flash: bad });
			expect(takeFlash(cookies)).toBeNull();
			expect(jar.flash).toBeUndefined();
		}
	});
});

describe('flashAfter', () => {
	it('names the newest batch and carries the warnings', () => {
		const core = {
			history: { list: () => ({ ok: true, value: [{ id: 'b9', label: 'Stop timer on "X"' }] }) }
		} as never;
		const w = [
			{ code: 'long', message: 'Longer than 24 hours.', subject: 'e1', details: { a: 1 } }
		];
		expect(flashAfter(core, w)).toEqual({
			label: 'Stop timer on "X"',
			batchId: 'b9',
			warnings: [{ code: 'long', message: 'Longer than 24 hours.', subject: 'e1' }]
		});
	});
	it('falls back to a plain label without a batch', () => {
		const core = { history: { list: () => ({ ok: true, value: [] }) } } as never;
		expect(flashAfter(core, [])).toEqual({ label: 'Done', batchId: null, warnings: [] });
	});

	it('caps the batch id', () => {
		const { cookies, jar } = fakeCookies();
		setFlash(cookies, { label: 'x', batchId: 'b'.repeat(5000), warnings: [] });
		expect(JSON.parse(jar.flash).batchId).toHaveLength(200);
	});
});
