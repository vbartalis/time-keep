import type { Attachment } from 'svelte/attachments';
import type { SubmitFunction } from '$app/forms';
import { goto, refreshAll } from '$app/navigation';
import { clampDay, dropTimes, keepIn, type DragKind } from '#lib/calendar/drag.js';
import { STILL } from '#lib/calendar/gestures.svelte.js';
import { snap } from '#lib/calendar/grid.js';

/** The entry being dragged, at where it would land; kept while the move saves. */
export type Moving = { id: string; kind: DragKind; startAt: number; endAt: number };

type Source = {
	id: string;
	version: number;
	startAt: number;
	endAt: number | null;
};

type Press = {
	pointer: number;
	entry: Source & { endAt: number };
	version: number;
	kind: DragKind;
	x: number;
	y: number;
	/** The day column and the minutes in it under the press. */
	col: number;
	at: number;
	moved: boolean;
	/** `Escape` put the block back; the rest of this press does nothing. */
	cancelled: boolean;
};

const MOUSE = ['mouse', 'pen'];

/** An instant as the action takes it: ISO with `Z`. */
const iso = (at: number) => new Date(at).toISOString();

/**
 * Moving and resizing blocks with a mouse or pen on the PC's grid (spec, Moving and
 * resizing). Attached to the grid's scroller; a press on a finished block that travels 4 px
 * moves it, one on its top or bottom handle stretches that end. The drop is saved through
 * the hidden form `form` (posting to `?/move`, enhanced with `submit`), and until its
 * result returns the grid ignores every press and click.
 */
export class BlockDrag {
	moving = $state<Moving | null>(null);
	saving = $state(false);
	form = $state<HTMLFormElement>();

	#entries: () => Source[];
	#zone: () => string;
	#days: () => string[];
	#hour: () => number;
	/** The move the form posts next. */
	#pending: { id: string; version: number; startAt: number; endAt: number } | null = null;

	constructor(opts: {
		entries: () => Source[];
		days: () => string[];
		zone: () => string;
		hour: () => number;
	}) {
		this.#entries = opts.entries;
		this.#days = opts.days;
		this.#zone = opts.zone;
		this.#hour = opts.hour;
	}

	attach: Attachment<HTMLElement> = (el) => {
		let press: Press | null = null;
		/** A drag just ended (or a press came while saving): its click opens nothing. */
		let swallow = false;

		/** The day column under `x` (the nearest, outside the columns) and the minutes at `y`. */
		const where = (x: number, y: number) => {
			const bodies = [...el.querySelectorAll<HTMLElement>('[data-date] > [data-body]')];
			const rects = bodies.map((b) => b.getBoundingClientRect());
			const col = rects.findIndex((r) => x < r.right);
			const top = rects[0]?.top ?? 0;
			return {
				col: clampDay(col === -1 ? rects.length - 1 : col, rects.length),
				at: Math.min(1440, Math.max(0, ((y - top) / this.#hour()) * 60))
			};
		};

		const dropOf = (p: Press, e: PointerEvent): Moving => {
			const w = where(e.clientX, e.clientY);
			const delta = { days: w.col - p.col, minutes: snap(w.at - p.at, 5) };
			const zone = this.#zone();
			const days = this.#days();
			const drop = dropTimes(p.entry, p.kind, delta, zone);
			// The block stays in the period shown, whatever the pointer did.
			const period = { first: days[0], last: days[days.length - 1] };
			return { id: p.entry.id, kind: p.kind, ...keepIn(drop, p.entry, p.kind, period, zone) };
		};

		const ondown = (e: PointerEvent) => {
			if (!MOUSE.includes(e.pointerType) || !el.checkVisibility()) return;
			if (this.saving) {
				// One release is one update: nothing else starts until it returns.
				e.preventDefault();
				e.stopPropagation();
				swallow = true;
				return;
			}
			if (!e.isPrimary || e.button !== 0) return;
			const target = e.target instanceof Element ? e.target : null;
			const block = target?.closest<HTMLElement>('a[data-entry-id]');
			const entry = this.#entries().find((x) => x.id === block?.dataset.entryId);
			// The running block is not dragged; its click opens its form (call 20).
			if (!target || !entry || entry.endAt === null) return;
			const handle = target.closest<HTMLElement>('[data-handle]')?.dataset.handle;
			// No text selection and no link drag; a press without movement still clicks.
			e.preventDefault();
			press = {
				pointer: e.pointerId,
				entry: { ...entry, endAt: entry.endAt },
				version: entry.version,
				kind: handle === 'start' || handle === 'end' ? handle : 'move',
				x: e.clientX,
				y: e.clientY,
				...where(e.clientX, e.clientY),
				moved: false,
				cancelled: false
			};
		};

		const onmove = (e: PointerEvent) => {
			if (!press || e.pointerId !== press.pointer || press.cancelled) return;
			if (!press.moved) {
				if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < STILL) return;
				press.moved = true;
				// The drag goes on outside the grid.
				el.setPointerCapture(e.pointerId);
			}
			this.moving = dropOf(press, e);
		};

		const onup = (e: PointerEvent) => {
			if (!press || e.pointerId !== press.pointer) return;
			const p = press;
			press = null;
			// A press without movement is a click: the layout opens the form.
			if (!p.moved) return;
			swallow = true;
			const drop = dropOf(p, e);
			const box = el.getBoundingClientRect();
			// Over the toolbar or the sidebar (above or left of the grid) it is put back.
			const away = e.clientX < box.left || e.clientY < box.top;
			const same = drop.startAt === p.entry.startAt && drop.endAt === p.entry.endAt;
			if (p.cancelled || away || same) {
				this.moving = null;
				return;
			}
			this.moving = drop;
			this.saving = true;
			this.#pending = {
				id: p.entry.id,
				version: p.version,
				startAt: drop.startAt,
				endAt: drop.endAt
			};
			this.form?.requestSubmit();
		};

		const oncancel = (e: PointerEvent) => {
			if (!press || e.pointerId !== press.pointer) return;
			press = null;
			if (!this.saving) this.moving = null;
		};

		const onkey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || !press?.moved || press.cancelled) return;
			// Put back, saving nothing; nothing else hears this Escape.
			e.preventDefault();
			e.stopImmediatePropagation();
			press.cancelled = true;
			this.moving = null;
		};

		const onclick = (e: MouseEvent) => {
			const inside = e.target instanceof Node && el.contains(e.target);
			if (!swallow && !(this.saving && inside)) return;
			swallow = false;
			e.preventDefault();
			e.stopImmediatePropagation();
		};
		// Any new press ends what a past release swallows (the grid's own may start it again).
		const reset = () => (swallow = false);
		const ondragstart = (e: DragEvent) => {
			if (e.target instanceof Element && e.target.closest('a[data-entry-id]')) e.preventDefault();
		};

		el.addEventListener('pointerdown', ondown, true);
		el.addEventListener('pointermove', onmove);
		el.addEventListener('pointerup', onup);
		el.addEventListener('pointercancel', oncancel);
		el.addEventListener('dragstart', ondragstart);
		// Before the layout's click on a form link (a document capture listener).
		window.addEventListener('click', onclick, true);
		window.addEventListener('pointerdown', reset, true);
		window.addEventListener('keydown', onkey, true);
		return () => {
			el.removeEventListener('pointerdown', ondown, true);
			el.removeEventListener('pointermove', onmove);
			el.removeEventListener('pointerup', onup);
			el.removeEventListener('pointercancel', oncancel);
			el.removeEventListener('dragstart', ondragstart);
			window.removeEventListener('click', onclick, true);
			window.removeEventListener('pointerdown', reset, true);
			window.removeEventListener('keydown', onkey, true);
		};
	};

	/** The hidden form's enhancement: posts the drop, then shows the calendar as it is now. */
	submit: SubmitFunction = ({ formData, cancel }) => {
		const p = this.#pending;
		this.#pending = null;
		if (!p) {
			cancel();
			this.saving = false;
			this.moving = null;
			return;
		}
		formData.set('id', p.id);
		formData.set('version', String(p.version));
		formData.set('start', iso(p.startAt));
		formData.set('end', iso(p.endAt));
		return async ({ result }) => {
			try {
				if (result.type === 'redirect')
					// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
					await goto(result.location, { refreshAll: true, reset: false });
				else await refreshAll();
			} finally {
				this.moving = null;
				this.saving = false;
			}
		};
	};
}
