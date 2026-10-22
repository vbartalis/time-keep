<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A page outside the shell (sign-in, an error before the shell's load): the wordmark
	 * centred on the ground and, 24 px under it, a surface card with the page's h1. The card
	 * is vertically centred from `sm`, 56 px from the top below.
	 */
	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<main class="flex min-h-dvh flex-col items-center px-4 pt-14 pb-10 sm:justify-center sm:pt-6">
	<p class="flex items-center gap-2.5 text-2xl font-bold" aria-hidden="true">
		<span class="size-4 rounded-full border-[3px] border-sidebar-ring"></span>
		time-keep
	</p>
	<div
		class="mt-6 flex w-full max-w-[25rem] flex-col gap-4 rounded-md border border-border bg-card p-5 sm:p-8"
	>
		<h1 class="text-center text-xl font-semibold tracking-[-0.01em]">{title}</h1>
		{@render children()}
	</div>
</main>
