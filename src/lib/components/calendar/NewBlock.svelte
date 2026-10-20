<script lang="ts">
	import { clockOf } from '#lib/calendar/gestures.svelte.js';
	import { snap } from '#lib/calendar/grid.js';
	import { durationText } from '#lib/time-input.js';

	let {
		from,
		to,
		hour,
		handles = false,
		onchange,
		onopen,
		onhold
	}: {
		/** Minutes past midnight. */
		from: number;
		to: number;
		/** One hour's height, px. */
		hour: number;
		/**
		 * The phone's block: a tap opens the form, and a round handle at its top and bottom
		 * stretches it. Without, the PC's drag drawn as it grows (no pointer of its own).
		 */
		handles?: boolean;
		onchange?: (from: number, to: number) => void;
		onopen?: () => void;
		/** A handle is held (true) and let go (false). */
		onhold?: (held: boolean) => void;
	} = $props();

	/** The handles' step and the shortest block, minutes (call 18). */
	const STEP = 15;

	const times = $derived(`${clockOf(from)}–${clockOf(to)}`);
	const duration = $derived(durationText(to - from));

	/**
	 * A handle follows its pointer from where it was taken, in 15-minute steps, keeping 15
	 * minutes at least and staying inside the day.
	 */
	function grab(edge: 'start' | 'end') {
		return (e: PointerEvent) => {
			if (!e.isPrimary || e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			const handle = e.currentTarget as HTMLElement;
			handle.setPointerCapture(e.pointerId);
			const y = e.clientY;
			const at = edge === 'start' ? from : to;
			const fixed = edge === 'start' ? to : from;
			onhold?.(true);
			const move = (m: PointerEvent) => {
				if (m.pointerId !== e.pointerId) return;
				const minutes = snap(at + ((m.clientY - y) / hour) * 60, STEP);
				if (edge === 'start') onchange?.(Math.min(Math.max(0, minutes), fixed - STEP), fixed);
				else onchange?.(fixed, Math.max(Math.min(1440, minutes), fixed + STEP));
			};
			const done = (u: PointerEvent) => {
				if (u.pointerId !== e.pointerId) return;
				handle.removeEventListener('pointermove', move);
				handle.removeEventListener('pointerup', done);
				handle.removeEventListener('pointercancel', done);
				onhold?.(false);
			};
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', done);
			handle.addEventListener('pointercancel', done);
		};
	}

	const box =
		'block size-full overflow-hidden rounded-sm border-2 border-primary bg-primary/10 px-1.5 pt-0.5 text-left text-xs leading-[15px] text-foreground';
</script>

<div
	data-new-block
	class="absolute inset-x-0 z-[4] px-px"
	style:top="{(from / 60) * hour}px"
	style:height="{Math.max(((to - from) / 60) * hour - 1, 0)}px"
>
	{#if handles}
		<button
			type="button"
			aria-label="New entry, {times}"
			class="{box} outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
			onclick={onopen}
		>
			<span class="block truncate figures"
				><span class="font-semibold">{times}</span> · {duration}</span
			>
			<span class="block truncate">New entry</span>
		</button>
		<!-- Round handles (Google's): their 44 px hit areas centred on the top and bottom edges.
			Pointer only; the form changes the times by keyboard. -->
		{#each ['start', 'end'] as const as edge (edge)}
			<span
				data-handle={edge}
				aria-hidden="true"
				class="absolute flex size-11 touch-none items-center justify-center {edge === 'start'
					? 'top-0 right-6 translate-x-1/2 -translate-y-1/2'
					: 'bottom-0 left-6 -translate-x-1/2 translate-y-1/2'}"
				onpointerdown={grab(edge)}
			>
				<span class="size-3.5 rounded-full border-2 border-primary bg-card"></span>
			</span>
		{/each}
	{:else}
		<div aria-hidden="true" class="{box} pointer-events-none">
			<span class="block truncate font-semibold figures">{times}</span>
			<span class="block truncate figures">{duration}</span>
		</div>
	{/if}
</div>
