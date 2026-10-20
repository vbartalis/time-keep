<script lang="ts">
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { resolve } from '$app/paths';
	import { sidebarItems } from '#lib/shell.js';
	import NavIcon from './NavIcon.svelte';
	import type { NavRoute } from './types.js';

	let {
		username,
		isAdmin,
		current
	}: { username: string; isAdmin: boolean; current: string | null } = $props();

	const items = $derived(sidebarItems(isAdmin));
</script>

<!-- The PC's sidebar: the wordmark, the screens, and who is signed in. -->
<aside
	class="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-sidebar py-5 text-sidebar-foreground lg:flex"
>
	<a
		href={resolve('/(app)')}
		class="mx-3 flex items-center gap-2.5 rounded-sm px-2 text-lg font-bold text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
	>
		<span class="size-3.5 rounded-full border-2 border-sidebar-ring" aria-hidden="true"></span>
		time-keep
	</a>

	<nav aria-label="Main" class="mt-6">
		<ul class="flex flex-col gap-0.5 px-2.5">
			{#each items as item (item.route)}
				<li>
					<a
						href={resolve(item.route as NavRoute)}
						aria-current={current === item.route ? 'page' : undefined}
						class="relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset aria-[current=page]:bg-sidebar-primary aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-0 aria-[current=page]:before:left-0 aria-[current=page]:before:w-[3px] aria-[current=page]:before:bg-sidebar-ring"
					>
						<NavIcon icon={item.icon} class="size-4 shrink-0" />
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="mt-auto flex flex-col gap-1 px-2.5 pt-6">
		<p class="flex h-9 items-center gap-3 px-3 text-sm">
			<UserRound class="size-4 shrink-0" aria-hidden="true" />
			<span class="truncate">{username}</span>
		</p>
		<form method="POST" action="/logout">
			<button
				type="submit"
				class="flex h-9 w-full items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
			>
				<LogOut class="size-4 shrink-0" aria-hidden="true" />
				Sign out
			</button>
		</form>
	</div>
</aside>
