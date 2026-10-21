<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { barItems, inMore, moreItems } from '#lib/shell.js';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import NavIcon from './NavIcon.svelte';
	import type { NavRoute } from './types.js';

	let {
		isAdmin,
		current,
		routeId
	}: { isAdmin: boolean; current: string | null; routeId: string | null } = $props();

	const bar = barItems();
	const rest = $derived(moreItems(isAdmin));
	const more = $derived(inMore(routeId, isAdmin));

	// With the script More is a sheet over the page; without it, the <details> below.
	let hydrated = $state(false);
	onMount(() => (hydrated = true));
	let open = $state(false);
	let details = $state<HTMLDetailsElement | null>(null);
	let summary = $state<HTMLElement | null>(null);
	// Choosing an item closes it; the element's own state holds even when it opened before hydration.
	afterNavigate(() => {
		open = false;
		if (details) details.open = false;
	});

	/** The bar's height: its cell, padding and rule, plus the safe area. */
	const SHEET_ABOVE = 'calc(4rem + env(safe-area-inset-bottom))';

	const cell =
		'flex h-14 flex-col items-center justify-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:font-semibold aria-[current=page]:text-primary';
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && !hydrated && details?.open) {
			details.open = false;
			summary?.focus();
		}
	}}
/>

<!-- The phone's navigation, inside thumb reach. -->
<nav
	aria-label="Main"
	class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] lg:hidden"
>
	<ul class="mx-auto grid max-w-md grid-cols-4 gap-1">
		{#each bar as item (item.route)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- an item's own address, else resolved -->
			<li>
				<a
					href={item.href ?? resolve(item.route as NavRoute)}
					aria-current={current === item.route ? 'page' : undefined}
					class={cell}
				>
					<NavIcon icon={item.icon} class="size-5" />
					{item.label}
				</a>
			</li>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
		<li>
			{#if hydrated}
				<button
					type="button"
					aria-haspopup="dialog"
					aria-expanded={open}
					onclick={() => (open = true)}
					class="{cell} w-full cursor-pointer {more ? 'font-semibold text-primary' : ''}"
					aria-current={more ? 'true' : undefined}
				>
					<Ellipsis class="size-5" aria-hidden="true" />
					More
				</button>
			{:else}
				<details bind:this={details}>
					<summary
						bind:this={summary}
						class="{cell} cursor-pointer list-none [&::-webkit-details-marker]:hidden {more
							? 'font-semibold text-primary'
							: ''}"
					>
						<Ellipsis class="size-5" aria-hidden="true" />
						More
					</summary>
					<!-- The disclosure: over the page, just above the bar, never pushing the page down. -->
					<div
						class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-border bg-card px-2 py-2 shadow-[0_-8px_24px_rgb(0_0_0/0.12)]"
					>
						<ul class="mx-auto flex max-w-md flex-col">
							{@render rows()}
						</ul>
					</div>
				</details>
			{/if}
		</li>
	</ul>
</nav>

{#snippet rows()}
	{#each rest as item (item.route)}
		<li>
			<a
				href={resolve(item.route as NavRoute)}
				aria-current={current === item.route ? 'page' : undefined}
				class="flex h-12 items-center gap-3 rounded-sm px-4 text-base outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-primary"
			>
				<NavIcon icon={item.icon} class="size-5 shrink-0" />
				{item.label}
			</a>
		</li>
	{/each}
	<li class="mt-1 border-t border-border pt-1">
		<form method="POST" action="/logout">
			<button
				type="submit"
				class="flex h-12 w-full cursor-pointer items-center gap-3 rounded-sm px-4 text-base outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
			>
				<LogOut class="size-5 shrink-0" aria-hidden="true" />
				Sign out
			</button>
		</form>
	</li>
{/snippet}

<Sheet {open} labelledby="more-title" onclose={() => (open = false)} above={SHEET_ABOVE}>
	<h2 id="more-title" class="sr-only">More</h2>
	<ul class="mx-auto flex w-full max-w-md flex-col overflow-y-auto py-2">
		{@render rows()}
	</ul>
</Sheet>
