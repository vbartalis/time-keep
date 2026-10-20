import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import UndoStrip from './UndoStrip.svelte';

const flash = { label: 'Stop timer on Acme › Website', batchId: 'b1', warnings: [] };

describe('UndoStrip', () => {
	it('offers Restart beside Undo after a Stop', () => {
		const { body } = render(UndoStrip, {
			props: { flash: { ...flash, restartId: 'e1' }, back: '/account' }
		});
		const restart = body.match(/<form[^>]*action="\/timers\/restart"[^>]*>[\s\S]*?<\/form>/)?.[0];
		expect(restart).toBeDefined();
		expect(restart).toContain('name="id" value="e1"');
		expect(restart).toContain('name="back" value="/account"');
		expect(restart).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*?Restart[\s\S]*?<\/button>/);
		expect(body).toMatch(/action="\/undo"/);
	});

	it('has no Restart after anything else', () => {
		const { body } = render(UndoStrip, { props: { flash, back: '/' } });
		expect(body).not.toContain('/timers/restart');
		expect(body).toContain('Undo');
	});
});
