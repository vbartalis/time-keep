<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { onMount, tick, untrack } from 'svelte';
	import { screenKey } from '#lib/keys.js';
	import { applyForm } from './live';

	/**
	 * Search entries: part of the filter's form (`form`), so Enter submits it without the
	 * script. With it, the table follows the text 250 ms after typing stops: the first
	 * search typed adds a history entry and the rest of it takes that entry's place, so
	 * Back returns to the table before the search (Review Focus 4). `/` focuses it.
	 */
	let { q, form }: { q: string; form: string } = $props();

	let input = $state<HTMLInputElement | null>(null);
	let value = $state(untrack(() => q));
	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	let timer: ReturnType<typeof setTimeout> | null = null;
	/** Searches sent and not yet shown. */
	let inFlight = 0;
	/** The search last sent; an address with another came from elsewhere (Back, a link). */
	let sent = untrack(() => q);
	/** A search is being typed: the next one replaces the history entry this one added. */
	let typing = false;

	$effect(() => {
		const next = q;
		untrack(() => {
			if (next === sent) return;
			// Shown from elsewhere: the field follows, and the next search starts afresh.
			sent = next;
			typing = false;
			if (timer === null && inFlight === 0) value = next;
		});
	});

	async function apply() {
		if (!input?.form) return;
		const replace = typing;
		typing = true;
		sent = value.trim();
		inFlight++;
		try {
			await applyForm(input.form, { replace });
		} finally {
			inFlight--;
		}
	}

	function cancel() {
		if (timer !== null) clearTimeout(timer);
		timer = null;
	}

	function oninput() {
		cancel();
		timer = setTimeout(() => {
			timer = null;
			void apply();
		}, 250);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		// Applied at once, without a form submission.
		e.preventDefault();
		cancel();
		void apply();
	}

	async function clear() {
		cancel();
		value = '';
		typing = false;
		input?.focus();
		await tick();
		await apply();
		typing = false;
	}

	/** `/` from anywhere on the screen, outside fields and with nothing open over it. */
	function onwindowkeydown(e: KeyboardEvent) {
		if (e.key !== '/' || !screenKey(e)) return;
		e.preventDefault();
		input?.focus();
	}
</script>

<svelte:window onkeydown={onwindowkeydown} />

<div class="relative min-w-48 flex-1 lg:max-w-sm">
	<Search
		class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
		aria-hidden="true"
	/>
	<input
		bind:this={input}
		bind:value
		type="search"
		name="q"
		{form}
		aria-label="Search entries"
		placeholder="Search entries"
		autocomplete="off"
		maxlength="200"
		enterkeyhint="search"
		oninput={hydrated ? oninput : undefined}
		onkeydown={hydrated ? onkeydown : undefined}
		onblur={() => (typing = false)}
		class="h-11 w-full min-w-0 rounded-md border border-input bg-card pr-11 pl-9 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground hover:border-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 lg:h-9 lg:pr-9 lg:text-sm [&::-webkit-search-cancel-button]:appearance-none"
	/>
	{#if hydrated && value !== ''}
		<button
			type="button"
			aria-label="Clear search"
			onclick={clear}
			class="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
		>
			<X class="size-4" aria-hidden="true" />
		</button>
	{:else if hydrated}
		<kbd
			class="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-sm border border-input px-1.5 text-xs leading-4 text-muted-foreground lg:block"
			title="Press / to search">/</kbd
		>
	{/if}
</div>
