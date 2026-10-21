<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Funnel from '@lucide/svelte/icons/funnel';
	import { untrack, type Snippet } from 'svelte';
	import type { Filter, Preset, Scope } from '#lib/filter/filter.js';
	import FilterPanel from './FilterPanel.svelte';
	import Sheet from './Sheet.svelte';
	import type { FilterOptions } from './types';

	/**
	 * The phone's Filter with the script (`ph-filter`): the same button as the PC's, opening
	 * the filter as a sheet from the bottom. Every choice applies at once; the foot's "Show
	 * n entries" counts what is shown and closes it, as Escape, the scrim and Back do,
	 * keeping the choices (call 20).
	 */
	let {
		id,
		action,
		label,
		more,
		filter,
		options,
		hints = {},
		error = null,
		clear,
		count,
		range = true,
		hidden,
		icon = false,
		noun = ['entry', 'entries']
	}: {
		id: string;
		action: string;
		/** The range in view ("This month"). */
		label: string;
		/** The filters on besides the range. */
		more: number;
		filter: Scope & Partial<Pick<Filter, 'range' | 'from' | 'to'>>;
		options: FilterOptions;
		hints?: Partial<Record<Preset, string>>;
		error?: string | null;
		clear: string;
		/** The entries shown now. */
		count: number;
		/** The time range's choices; the Calendar passes false and a blank `label`. */
		range?: boolean;
		/** More hidden fields the address keeps (the Calendar's view and date). */
		hidden?: Snippet;
		/** A 44 px icon carrying the count, named "Filter" (the Calendar's phone row). */
		icon?: boolean;
		/** What `count` counts, one and many ("Show 4 rows" on Copy-out). */
		noun?: [string, string];
	} = $props();

	/** Open on the first load when a refused date shows by its fields. */
	let open = $state(untrack(() => error !== null));
	const titleId = $derived(`${id}-sheet-title`);
</script>

<button
	type="button"
	aria-haspopup="dialog"
	onclick={() => (open = true)}
	class="inline-flex h-11 cursor-pointer items-center rounded-md border border-input bg-card text-sm font-semibold text-foreground transition-colors duration-150 ease-out outline-none select-none hover:border-foreground/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {icon
		? 'w-11 shrink-0 justify-center gap-0.5'
		: 'min-w-0 flex-1 gap-2 px-3'}"
>
	<Funnel class="size-4 shrink-0" aria-hidden="true" />
	{#if label}
		<span class="sr-only">Filter</span>
		<span class="min-w-0 truncate text-left figures">{label}</span>
	{:else}
		<span class={icon ? 'sr-only' : 'min-w-0 truncate text-left'}>Filter</span>
	{/if}
	{#if more > 0}
		<span
			class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background figures {icon
				? 'px-1'
				: 'px-1.5'}">+{more}<span class="sr-only"> more filters</span></span
		>
	{/if}
	{#if !icon}
		<ChevronDown class="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
	{/if}
</button>

<Sheet {open} labelledby={titleId} onclose={() => (open = false)}>
	<div class="flex shrink-0 items-center justify-between gap-4 px-4 pt-3">
		<h2 id={titleId} class="text-lg font-bold">Filter</h2>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- an address the page resolved -->
		<a
			href={clear}
			data-sveltekit-reset="false"
			class="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
			>Clear filters</a
		>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
		<FilterPanel {id} {action} {filter} {options} {range} {hints} {error} {clear} {hidden}>
			{#snippet foot()}
				<button
					type="button"
					onclick={() => (open = false)}
					class="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>Show {count} {count === 1 ? noun[0] : noun[1]}</button
				>
			{/snippet}
		</FilterPanel>
	</div>
</Sheet>
