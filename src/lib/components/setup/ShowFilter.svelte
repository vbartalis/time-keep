<script lang="ts">
	import type { Show } from '#lib/server/screens/setup.js';
	import { setupHref } from './act';

	/**
	 * Active | Archived | All: three links dressed as the Calendar's view switch (joined
	 * outline segments, the chosen one filled with accent over a 2 px foot), so the filter
	 * is the address and works without the script. On the phone it takes the width but for
	 * the "+"'s column.
	 */
	let { show }: { show: Show } = $props();

	const CHOICES: { show: Show; label: string }[] = [
		{ show: 'active', label: 'Active' },
		{ show: 'archived', label: 'Archived' },
		{ show: 'all', label: 'All' }
	];
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- setupHref resolves every address -->

<nav aria-label="Show" class="flex max-lg:pr-14">
	{#each CHOICES as c (c.show)}
		<a
			href={setupHref(c.show)}
			aria-current={c.show === show ? 'page' : undefined}
			class="flex h-11 flex-1 items-center justify-center border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-150 ease-out outline-none not-first:-ml-px first:rounded-l-md last:rounded-r-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:bg-accent aria-[current=page]:shadow-[inset_0_-2px_0_var(--foreground)] lg:h-9 lg:flex-none"
		>
			{c.label}
		</a>
	{/each}
</nav>
