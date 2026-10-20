import type { Attachment } from 'svelte/attachments';

/** A horizontal swipe: at least this far across, px … */
const SWIPE = 60;
/** … and at least this many times its vertical travel. */
const LEVEL = 2;
/** Under this a press and release is a tap or a click, px. */
export const STILL = 4;

/**
 * A touch swipe across the element: `-1` for a swipe to the right (the previous period),
 * `1` for one to the left. Listens passively, so the page's own scroll is never held up,
 * and only to a single finger's touch; a vertical scroll is never a swipe.
 */
export function swipe(opts: {
	onSwipe: (dir: -1 | 1) => void;
	enabled: () => boolean;
}): Attachment<HTMLElement> {
	return (el) => {
		let start: { x: number; y: number } | null = null;
		const onstart = (e: TouchEvent) => {
			start =
				e.touches.length === 1 && opts.enabled()
					? { x: e.touches[0].clientX, y: e.touches[0].clientY }
					: null;
		};
		const onend = (e: TouchEvent) => {
			const from = start;
			start = null;
			const t = e.changedTouches[0];
			if (!from || !t || !opts.enabled()) return;
			const dx = t.clientX - from.x;
			const dy = t.clientY - from.y;
			if (Math.abs(dx) < SWIPE || Math.abs(dx) < LEVEL * Math.abs(dy)) return;
			opts.onSwipe(dx > 0 ? -1 : 1);
		};
		const oncancel = () => (start = null);
		el.addEventListener('touchstart', onstart, { passive: true });
		el.addEventListener('touchend', onend, { passive: true });
		el.addEventListener('touchcancel', oncancel, { passive: true });
		return () => {
			el.removeEventListener('touchstart', onstart);
			el.removeEventListener('touchend', onend);
			el.removeEventListener('touchcancel', oncancel);
		};
	};
}

/** Minutes past midnight as `HH:mm`; the day's end, 1440, is the next day's `00:00`. */
export function clockOf(minutes: number): string {
	const m = minutes % 1440;
	return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** A new entry's range in a day, in minutes past midnight; `held` while a handle is. */
export type Draft = { date: string; from: number; to: number; held?: boolean };
