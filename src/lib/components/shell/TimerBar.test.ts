import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import TimerBar from './TimerBar.svelte';
import type { BarTimer } from './types.js';

const now = Date.UTC(2026, 9, 20, 10, 0);

const timer = (over: Partial<BarTimer>): BarTimer => ({
	id: 't',
	customerName: 'CompX',
	projectName: 'ClientY - ProjectZ',
	activityName: null,
	description: null,
	startAt: now - 3_600_000,
	start: '08:00',
	startDate: null,
	colour: 1,
	...over
});

const text = (html: string) =>
	html
		.replace(/<!--.*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');

describe('TimerBar, the others behind +N', () => {
	it('shows the start date of an earlier-day timer that has an activity', () => {
		const timers = [
			timer({ id: 'a' }),
			timer({
				id: 'b',
				projectName: 'time-keep',
				activityName: 'Development',
				description: 'shell',
				start: '22:10',
				startDate: '2026-10-19'
			})
		];
		for (const variant of ['header', 'strip'] as const) {
			const { body } = render(TimerBar, { props: { timers, now, back: '/', variant } });
			expect(text(body)).toMatch(/Development[^<]*since 2026-10-19 22:10/);
		}
	});

	it("shows a today timer's activity without a since", () => {
		const timers = [
			timer({ id: 'a' }),
			timer({ id: 'b', activityName: 'Meeting', start: '09:00', startAt: now - 1_800_000 })
		];
		const { body } = render(TimerBar, { props: { timers, now, back: '/', variant: 'header' } });
		expect(text(body)).toContain('Meeting');
		expect(text(body)).not.toContain('since 09:00');
	});
});
