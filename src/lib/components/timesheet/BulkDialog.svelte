<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import BulkForm from './BulkForm.svelte';
	import Sheet from './Sheet.svelte';
	import type { BulkFailure, Chosen, FilterOptions } from './types';

	/**
	 * "Edit n entries" over the table while `chosen` is set: a centred dialog from `lg`, a
	 * sheet from the bottom below it (`Sheet`), so it traps focus, closes on Escape, the
	 * scrim or Back and returns focus to Edit….
	 * A refusal stays in it, naming the entry; a done change hands its redirect to `onDone`.
	 */
	let {
		chosen,
		choices,
		back,
		query,
		onDone,
		onClose
	}: {
		/** The entries to edit, with the versions shown; null while closed. */
		chosen: Chosen[] | null;
		choices: FilterOptions;
		back: string;
		query: string;
		onDone: (location: string) => void;
		onClose: () => void;
	} = $props();

	let failure = $state<BulkFailure | null>(null);
	// A new opening starts without the last one's refusal.
	$effect.pre(() => {
		if (chosen) failure = null;
	});

	const n = $derived(chosen?.length ?? 0);
</script>

<Sheet open={chosen !== null} labelledby="bulk-dialog-title" onclose={onClose} dialog>
	{#if chosen}
		<div
			class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 lg:px-5"
		>
			<h2 id="bulk-dialog-title" class="text-lg font-bold">
				Edit {n}
				{n === 1 ? 'entry' : 'entries'}
			</h2>
			<button
				type="button"
				aria-label="Close"
				class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
				onclick={onClose}
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
		<BulkForm
			{choices}
			{chosen}
			{failure}
			{back}
			{query}
			{onDone}
			onFailure={(f) => (failure = f)}
			onCancel={onClose}
			pinned
		/>
	{/if}
</Sheet>
