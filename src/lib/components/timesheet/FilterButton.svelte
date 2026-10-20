<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Funnel from '@lucide/svelte/icons/funnel';
	import { untrack, type Snippet } from 'svelte';

	/**
	 * Filter: an outline button naming the range ("This month") and "+n" for the other
	 * filters on. A `<details>`, so its panel opens without the script; with it Escape and a
	 * click outside close it, the focus back on the button. From `lg` the panel is a
	 * popover under the button.
	 */
	let {
		label,
		count,
		open = false,
		fill = false,
		icon = false,
		children
	}: {
		/** The range in view; blank on the Calendar, which names its own period. */
		label: string;
		/** The filters on besides the range. */
		count: number;
		/** Open on the first load (a refused date shows by its fields). */
		open?: boolean;
		/** Below `lg`, the button takes the row's free width (the Entries toolbar's). */
		fill?: boolean;
		/**
		 * A 44 px icon carrying the count, named "Filter" (the Calendar's phone row); its
		 * panel hangs under the nearest positioned box (the toolbar) across its width.
		 */
		icon?: boolean;
		children: Snippet;
	} = $props();

	let details = $state<HTMLDetailsElement | null>(null);
	let summary = $state<HTMLElement | null>(null);
	/** Bound, so a re-render never resets what the user opened or closed. */
	let shown = $state(untrack(() => open));

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !shown || e.defaultPrevented) return;
		e.preventDefault();
		shown = false;
		summary?.focus();
	}

	function onclick(e: MouseEvent) {
		if (!shown || !details) return;
		const target = e.target instanceof Node ? e.target : null;
		// A target the click removed (a picked option) was inside.
		if (target && target.isConnected && !details.contains(target)) shown = false;
	}
</script>

<svelte:window {onkeydown} />
<svelte:document {onclick} />

<!-- Open, the screen's keys wait (`screenKey`). -->
<details
	bind:this={details}
	bind:open={shown}
	data-holds-keys
	class="group/filter {icon ? 'shrink-0' : 'relative'} {fill ? 'min-w-0 flex-1 lg:flex-none' : ''}"
>
	<summary
		bind:this={summary}
		class="inline-flex h-11 cursor-pointer list-none items-center rounded-md border border-input bg-card text-sm font-semibold text-foreground transition-colors duration-150 ease-out outline-none select-none group-open/filter:bg-accent hover:border-foreground/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-9 [&::-webkit-details-marker]:hidden {icon
			? 'w-11 justify-center gap-0.5'
			: 'gap-2 px-3'} {fill ? 'w-full lg:w-auto' : ''}"
	>
		<Funnel class="size-4 shrink-0" aria-hidden="true" />
		<span class={label || icon ? 'sr-only' : ''}>Filter</span>
		{#if label}<span class="figures">{label}</span>{/if}
		{#if count > 0}
			<span
				class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background figures {icon
					? 'px-1'
					: 'px-1.5'}">+{count}<span class="sr-only"> more filters</span></span
			>
		{/if}
		{#if !icon}
			<ChevronDown
				class="size-4 shrink-0 text-muted-foreground {fill ? 'ml-auto lg:ml-0' : ''}"
				aria-hidden="true"
			/>
		{/if}
	</summary>
	<div
		role="group"
		aria-label="Filter"
		class="mt-2 rounded-md border border-border bg-card {icon
			? 'absolute inset-x-0 top-full z-20 p-4 shadow-[0_8px_24px_rgb(0_0_0/0.12)]'
			: 'lg:absolute lg:top-full lg:left-0 lg:z-20 lg:mt-1 lg:w-[40rem] lg:shadow-[0_8px_24px_rgb(0_0_0/0.12)]'}"
	>
		{@render children()}
	</div>
</details>
