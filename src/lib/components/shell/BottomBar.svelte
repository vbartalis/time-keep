<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { barItems, moreItems } from '#lib/shell.js';
	import NavIcon from './NavIcon.svelte';
	import type { NavRoute } from './types.js';

	let { isAdmin, current }: { isAdmin: boolean; current: string | null } = $props();

	const bar = barItems();
	const rest = $derived(moreItems(isAdmin));
	const inMore = $derived(rest.some((i) => i.route === current));

	// A <details>, so More opens without JavaScript; with it, choosing an item closes it.
	let details = $state<HTMLDetailsElement | null>(null);
	let summary = $state<HTMLElement | null>(null);
	// The element's own state, which holds even when it opened before the page hydrated.
	afterNavigate(() => {
		if (details) details.open = false;
	});

	const cell =
		'flex h-14 flex-col items-center justify-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:font-semibold aria-[current=page]:text-primary';
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && details?.open) {
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
			<li>
				<a
					href={resolve(item.route as NavRoute)}
					aria-current={current === item.route ? 'page' : undefined}
					class={cell}
				>
					<NavIcon icon={item.icon} class="size-5" />
					{item.label}
				</a>
			</li>
		{/each}
		<li>
			<details bind:this={details}>
				<summary
					bind:this={summary}
					class="{cell} cursor-pointer list-none [&::-webkit-details-marker]:hidden {inMore
						? 'font-semibold text-primary'
						: ''}"
				>
					<Ellipsis class="size-5" aria-hidden="true" />
					More
				</summary>
				<!-- The sheet: over the page, just above the bar, never pushing the page down. -->
				<div
					class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-border bg-card px-2 py-2 shadow-[0_-8px_24px_rgb(0_0_0/0.12)]"
				>
					<ul class="mx-auto flex max-w-md flex-col">
						{#each rest as item (item.route)}
							<li>
								<a
									href={resolve(item.route as NavRoute)}
									aria-current={current === item.route ? 'page' : undefined}
									class="flex min-h-11 items-center gap-3 rounded-sm px-3 text-base font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:font-semibold aria-[current=page]:text-primary"
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
									class="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-base font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
								>
									<LogOut class="size-5 shrink-0" aria-hidden="true" />
									Sign out
								</button>
							</form>
						</li>
					</ul>
				</div>
			</details>
		</li>
	</ul>
</nav>
