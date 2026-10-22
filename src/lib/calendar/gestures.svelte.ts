import type { Attachment } from 'svelte/attachments';

/** A horizontal swipe: at least this far across, px … */
const SWIPE = 60;
/** … and at least this many times its vertical travel. */
const LEVEL = 2;
/** Under this a press and release is a tap or a click, px. */
export const STILL = 4;

/** A sideways scroller's room when a touch began: whether it could still move. */
export type Room = { back: boolean; on: boolean };

/** Whether a swipe in `dir` (-1 previous, 1 next) is the scroller's, not the period's. */
export function swipeYields(dir: -1 | 1, room: Room | null): boolean {
	return room !== null && (dir === -1 ? room.back : room.on);
}

/** The room of the sideways scroller (`data-swipe-scroll`) under a touch; none if it fits. */
function roomAt(target: EventTarget | null): Room | null {
	const el = target instanceof Element ? target.closest('[data-swipe-scroll]') : null;
	if (!el || el.scrollWidth <= el.clientWidth + 1) return null;
	return { back: el.scrollLeft > 0, on: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 };
}

/**
 * A touch swipe across the element: `-1` for a swipe to the right (the previous period),
 * `1` for one to the left. Listens passively, so the page's own scroll is never held up,
 * and only to a single finger's touch; a vertical scroll is never a swipe. Over a sideways
 * scroller that could still move its way when the touch began, the swipe is the scroller's
 * (spec, call 17): reaching its edge mid-touch never moves the period; the next swipe does.
 */
export function swipe(opts: {
	onSwipe: (dir: -1 | 1) => void;
	enabled: () => boolean;
}): Attachment<HTMLElement> {
	return (el) => {
		let start: { x: number; y: number; room: Room | null } | null = null;
		const onstart = (e: TouchEvent) => {
			start =
				e.touches.length === 1 && opts.enabled()
					? { x: e.touches[0].clientX, y: e.touches[0].clientY, room: roomAt(e.target) }
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
			const dir = dx > 0 ? -1 : 1;
			if (!swipeYields(dir, from.room)) opts.onSwipe(dir);
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
