<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { BatchRow } from './types';

	let {
		batch,
		chosen,
		toggle,
		open,
		query
	}: {
		batch: BatchRow;
		/** The ticked change ids of the whole list. */
		chosen: string[];
		/** Ticks or unticks a change; the list keeps one selection across its batches. */
		toggle: (id: string, checked: boolean) => void;
		/** Whether the changes start open: a refusal keeps open the batches it ticked. */
		open: boolean;
		/** Appended to the actions, so a refusal renders the page posted from. */
		query: string;
	} = $props();

	const changes = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'}`;
	const undone = $derived(batch.state.state === 'undone');
	const box =
		'mt-0.5 size-4.5 shrink-0 rounded-sm accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-lg:size-5';
</script>

<li
	class={[
		'grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-border py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-x-4',
		undone && 'text-muted-foreground'
	]}
>
	<span class="pt-0.5 figures">{batch.time}</span>

	<div class="flex min-w-0 flex-col gap-1">
		<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
			<span id="batch-{batch.id}" class="font-semibold text-pretty">{batch.label}</span>
			{#if batch.actor === 'agent'}<Badge>Agent</Badge>{/if}
			{#if batch.actor === 'system'}<Badge>System</Badge>{/if}
			{#if batch.state.state === 'undone'}
				<span class="text-muted-foreground">Undone</span>
			{:else if batch.state.state === 'partly'}
				<span class="text-muted-foreground"
					>Partly undone, {batch.state.undone} of {batch.state.total}</span
				>
			{/if}
		</p>

		<details {open} class="group text-sm">
			<summary
				aria-describedby="batch-{batch.id}"
				class="w-fit cursor-pointer rounded-sm underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:py-3"
			>
				{changes(batch.count)}
			</summary>
			<ul class="mt-1.5">
				{#each batch.changes as change (change.id)}
					<li class={['border-t border-border py-1.5', change.undone && 'text-muted-foreground']}>
						<svelte:element this={batch.tickable ? 'label' : 'div'} class="flex gap-2.5">
							{#if batch.tickable}
								<input
									type="checkbox"
									name="changeId"
									value={change.id}
									checked={chosen.includes(change.id)}
									onchange={(e) => toggle(change.id, e.currentTarget.checked)}
									class={box}
								/>
							{/if}
							<span class="flex min-w-0 flex-col gap-0.5">
								<span class="text-pretty">
									<span class="font-semibold">{change.verb}</span>
									{change.subject}
									{#if change.undone}<span class="ml-1 text-muted-foreground">Undone</span>{/if}
								</span>
								{#each change.fields as field, i (i)}
									<span class="break-words">{field}</span>
								{/each}
							</span>
						</svelte:element>
					</li>
				{/each}
				{#if batch.more > 0}
					<li class="border-t border-border py-1.5 text-muted-foreground">
						and {batch.more} more; undo or redo the whole batch.
					</li>
				{/if}
			</ul>
		</details>
	</div>

	<div class="col-start-2 flex flex-wrap gap-2 sm:col-start-3 sm:row-start-1 sm:justify-end">
		{#if batch.state.undone < batch.state.total}
			<Button
				type="submit"
				variant="outline"
				name="batchId"
				value={batch.id}
				formaction="?/undo{query}"
				aria-describedby="batch-{batch.id}">Undo</Button
			>
		{/if}
		{#if batch.state.undone > 0}
			<Button
				type="submit"
				variant="outline"
				name="batchId"
				value={batch.id}
				formaction="?/redo{query}"
				aria-describedby="batch-{batch.id}">Redo</Button
			>
		{/if}
	</div>
</li>
