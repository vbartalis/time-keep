<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { warningText } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Flash } from './today/types';

	/** `back` is where `/undo` returns to: the screen this strip is on. */
	let { flash, back }: { flash: Flash | null; back: string } = $props();

	let strip = $state<HTMLDivElement | null>(null);
	/** Scrolled past its place, it is pinned under the sticky bars and floats over the page. */
	let pinned = $state(false);
	$effect(() => {
		const node = strip;
		void flash; // checked again for each new message
		if (!node) return;
		const check = () => {
			const top = parseFloat(getComputedStyle(node).top);
			pinned = !Number.isNaN(top) && Math.abs(node.getBoundingClientRect().top - top) < 1;
		};
		/** Keyboard focus on the page lands clear of the pinned strip, not under it (WCAG 2.4.11). */
		const clear = (e: FocusEvent) => {
			const target = e.target;
			check();
			if (!pinned || !(target instanceof Element) || !scrollsWithPage(target)) return;
			const below = node.getBoundingClientRect().bottom + 8;
			const top = target.getBoundingClientRect().top;
			if (top < below) window.scrollBy(0, top - below);
		};
		check();
		// A new message (Done → Undone, a warning line) changes its height without a scroll.
		const resized = new ResizeObserver(check);
		resized.observe(node);
		addEventListener('scroll', check, { passive: true });
		addEventListener('resize', check);
		document.addEventListener('focusin', clear);
		return () => {
			resized.disconnect();
			removeEventListener('scroll', check);
			removeEventListener('resize', check);
			document.removeEventListener('focusin', clear);
		};
	});

	/**
	 * A control in the screen's content, which a scroll can move: in `main`, not in a dialog,
	 * and neither it nor an ancestor sticky or fixed (the strip itself, the bars, the "+").
	 */
	function scrollsWithPage(el: Element): boolean {
		const main = el.closest('main');
		if (!main || el.closest('dialog')) return false;
		for (let at: Element | null = el; at && at !== main; at = at.parentElement) {
			const position = getComputedStyle(at).position;
			if (position === 'sticky' || position === 'fixed') return false;
		}
		return true;
	}

	/** Undo and Restart return to this screen as it was scrolled, not to its top. */
	const inPlace: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type !== 'redirect') return update();
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
			await goto(result.location, { refreshAll: true, reset: false });
		};
</script>

{#if flash}
	<!-- In its place at the top; scrolled past, pinned under the sticky bars (with the
	     script, which measures them), so its Undo stays in view. -->
	<div
		bind:this={strip}
		data-undo-strip
		role={flash.error ? 'alert' : 'status'}
		class={[
			'sticky top-[calc(var(--bars-height)+0.5rem)] z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-card py-2 pr-2 pl-3.5',
			flash.error ? 'border-destructive/60' : 'border-border',
			// Pinned, the gap above it is the page's ground, so no row shows through over it.
			pinned &&
				'shadow-[0_8px_24px_rgb(0_0_0/0.12)] before:absolute before:inset-x-[-1px] before:-top-3 before:h-[calc(0.75rem-1px)] before:bg-background'
		]}
	>
		<!-- On the phone the buttons go under the message, at the left, out of the "+" column. -->
		<div class="flex min-w-0 flex-1 flex-col gap-0.5 text-sm max-lg:basis-full">
			{#if flash.error}
				<p class="text-destructive">{flash.error}</p>
			{:else if flash.undone}
				<p>Undone.</p>
			{:else}
				<p class="text-pretty"><span class="font-semibold">Done:</span> {flash.label}.</p>
			{/if}
			{#each flash.warnings as warning, i (i)}
				<p class="text-irregular">{warningText(warning)}</p>
			{/each}
		</div>
		{#if flash.restartId && !flash.undone && !flash.error}
			<!-- After a Stop: the stopped entry, started again now with its fields. -->
			<form method="POST" action="/timers/restart" use:enhance={inPlace}>
				<input type="hidden" name="id" value={flash.restartId} />
				<input type="hidden" name="back" value={back} />
				<Button type="submit" variant="outline"
					><Play class="size-3.5 fill-current" aria-hidden="true" />Restart</Button
				>
			</form>
		{/if}
		{#if flash.batchId}
			<form method="POST" action="/undo" use:enhance={inPlace}>
				<input type="hidden" name="batchId" value={flash.batchId} />
				<input type="hidden" name="back" value={back} />
				<Button type="submit" variant="outline">Undo</Button>
			</form>
		{/if}
	</div>
{/if}
