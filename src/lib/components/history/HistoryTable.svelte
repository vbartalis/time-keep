<script lang="ts">
	import BatchRow from './BatchRow.svelte';
	import { COLS } from './columns';
	import type { HistoryDay } from './types';

	/**
	 * The PC's ruled table in a surface panel: a caps header, then per day a head row (the
	 * day and its batches on this page) and its batch rows, newest first. A day running on
	 * to the older page says so under its last row.
	 */
	let {
		days,
		enhanced,
		isOpen,
		onToggle,
		ticked,
		onTick,
		query
	}: {
		days: HistoryDay[];
		enhanced: boolean;
		isOpen: (batchId: string) => boolean;
		onToggle: (batchId: string) => void;
		ticked: (changeId: string) => boolean;
		onTick: (changeId: string, on: boolean) => void;
		query: string;
	} = $props();

	const batches = (n: number) => `${n} ${n === 1 ? 'batch' : 'batches'}`;
	const head = 'text-xs caps font-semibold text-muted-foreground';
</script>

<div class="rounded-md border border-border bg-card">
	<!-- The column heads are for the eye; each row's cells read in order. -->
	<div
		aria-hidden="true"
		class="{COLS} hidden h-9 items-center rounded-t-md border-b border-input bg-muted px-3 {head}"
	>
		<span>Time</span>
		<span class="col-span-2">What</span>
		<span>By</span>
		<span>Changes</span>
		<span class="max-xl:hidden">State</span>
		<span></span>
	</div>
	{#each days as group, i (group.day)}
		<section aria-labelledby="day-{i}">
			<div class="flex min-h-10 items-center gap-3 border-b border-border px-3 py-2 text-sm">
				<h2 id="day-{i}" class="font-semibold figures">{group.day}</h2>
				<span class="ml-auto text-muted-foreground figures">{batches(group.batches.length)}</span>
			</div>
			<ul>
				{#each group.batches as batch (batch.id)}
					<BatchRow
						{batch}
						{enhanced}
						open={isOpen(batch.id)}
						onToggle={() => onToggle(batch.id)}
						{ticked}
						{onTick}
						{query}
					/>
				{/each}
			</ul>
			{#if group.continues}
				<p class="border-t border-border px-3 py-2 text-sm text-muted-foreground">
					Continues on the older page.
				</p>
			{/if}
			{#if i < days.length - 1}<div class="border-b border-border"></div>{/if}
		</section>
	{/each}
</div>
