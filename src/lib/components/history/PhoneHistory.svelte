<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import ChangeList from './ChangeList.svelte';
	import { keepArrows } from './columns';
	import type { BatchRow, HistoryDay } from './types';

	/**
	 * The phone's History (`ph-history`), below `lg`: per day a head (the day, its batches
	 * on this page), then its rows on the surface, ruled. A row leads with its Undo or
	 * Redo, both on a partly undone batch, Undo over Redo (call 2); then the time and the
	 * text: the label and what it touched, both wrapping, and a meta line (the chip, "n
	 * changes" opening the changes under the row, the state). The disclosure's 44 px
	 * target reaches 14 px up over the touched line's foot, its text low in it, so the
	 * row is not 44 px taller for it; the line wraps between its parts, the "·" ending a line, never starting one, as
	 * Entries' meta line. The right 72 px stay clear
	 * of the "+". While `selecting` the leading buttons give way and the open batches'
	 * change lines carry tick boxes. Without the script "n changes" is a `<details>`.
	 */
	let {
		days,
		enhanced,
		selecting,
		isOpen,
		onToggle,
		ticked,
		onTick,
		query,
		form
	}: {
		days: HistoryDay[];
		enhanced: boolean;
		/** Select (or `select=1` without the script): tick boxes, no leading buttons. */
		selecting: boolean;
		isOpen: (batchId: string) => boolean;
		onToggle: (batchId: string) => void;
		ticked: (changeId: string) => boolean;
		onTick: (changeId: string, on: boolean) => void;
		/** Appended to the actions, so a refusal renders the page posted from. */
		query: string;
		/** The form the tick boxes post with: the phone's own without the script. */
		form?: string;
	} = $props();

	const batches = (n: number) => `${n} ${n === 1 ? 'batch' : 'batches'}`;
	const changes = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'}`;
	/** The leading column, the time's and the text's; the right 72 px kept for the "+". */
	const ROW = 'grid grid-cols-[2.75rem_2.75rem_minmax(0,1fr)] gap-x-2 pr-18 pl-1';
	const disclosure =
		'inline-flex min-h-11 items-center gap-1 rounded-sm pt-3.5 pb-2.5 font-medium underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring';
</script>

{#snippet meta(batch: BatchRow, open: boolean)}
	{#if batch.actor === 'agent'}<Badge>Agent</Badge>{/if}
	{#if batch.actor === 'system'}<Badge>System</Badge>{/if}
	<!-- The disclosure and the "·" after it are one part: a wrap leaves the dot at the
	     line's end. -->
	<span class="inline-flex items-baseline gap-x-2 whitespace-nowrap">
		{#if enhanced}
			<button
				type="button"
				aria-expanded={open}
				aria-controls="pchanges-{batch.id}"
				data-disclosure={batch.id}
				onclick={() => onToggle(batch.id)}
				class={disclosure}
			>
				<span data-count class="figures">{changes(batch.count)}</span>
				<ChevronRight
					aria-hidden="true"
					class="size-3.5 text-muted-foreground transition-transform duration-150 ease-out {open
						? 'rotate-90'
						: ''}"
				/>
			</button>
		{:else}
			<span class={disclosure}>
				<span data-count class="figures">{changes(batch.count)}</span>
				<ChevronRight
					aria-hidden="true"
					class="size-3.5 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-90"
				/>
			</span>
		{/if}
		{#if batch.state.state !== 'standing'}<span aria-hidden="true" class="text-muted-foreground"
				>·</span
			>{/if}
	</span>
	<span data-state class="whitespace-nowrap text-muted-foreground"
		>{#if batch.state.state === 'undone'}Undone{:else if batch.state.state === 'partly'}Partly
			undone, {batch.state.undone} of {batch.state.total}{/if}</span
	>
{/snippet}

<div data-phone-history class="-mx-4 border-b border-border bg-card">
	{#each days as group, i (group.day)}
		<section aria-labelledby="pday-{i}">
			<div class="flex min-h-11 items-center gap-3 border-b border-border pr-18 pl-4 text-sm">
				<h2 id="pday-{i}" class="font-semibold figures">{group.day}</h2>
				<span class="ml-auto text-muted-foreground figures">{batches(group.batches.length)}</span>
			</div>
			<ul>
				{#each group.batches as batch (batch.id)}
					{@const undone = batch.state.state === 'undone'}
					{@const open = isOpen(batch.id)}
					<li data-batch={batch.id} class="{ROW} border-b border-border text-sm last:border-b-0">
						<!-- Where Entries' rows have their ⋯: the batch's own Undo, Redo or both. -->
						<div class="row-span-3 flex flex-col gap-1 py-1.5">
							{#if !selecting}
								{#if batch.state.undone < batch.state.total}
									<Button
										type="submit"
										variant="outline"
										size="icon"
										name="batchId"
										value={batch.id}
										formaction="?/undo{query}"
										aria-label="Undo {batch.label}"><Undo2 aria-hidden="true" /></Button
									>
								{/if}
								{#if batch.state.undone > 0}
									<Button
										type="submit"
										variant="outline"
										size="icon"
										name="batchId"
										value={batch.id}
										formaction="?/redo{query}"
										aria-label="Redo {batch.label}"><Redo2 aria-hidden="true" /></Button
									>
								{/if}
							{/if}
						</div>
						<span
							class={['pt-2 text-base leading-tight figures', undone && 'text-muted-foreground']}
							>{batch.time}</span
						>
						<span class="flex min-w-0 flex-col gap-0.5 pt-2">
							<span
								data-label
								class={[
									'text-base leading-tight font-semibold wrap-break-word',
									undone && 'font-medium text-muted-foreground'
								]}>{batch.label}</span
							>
							{#if batch.touched}
								<span class="text-xs wrap-break-word text-muted-foreground"
									>{keepArrows(batch.touched)}</span
								>
							{/if}
						</span>
						{#if enhanced}
							<div class="col-start-3 -mt-3.5 flex flex-wrap items-baseline gap-x-2">
								{@render meta(batch, open)}
							</div>
							<div id="pchanges-{batch.id}" hidden={!open} class="col-[2/-1]">
								<ChangeList {batch} {ticked} {onTick} phone boxes={selecting} {form} />
							</div>
						{:else}
							<details {open} class="group col-[2/-1] -mt-3.5">
								<!-- Indented to the text; the whole meta line opens it. -->
								<summary
									class="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 rounded-sm pl-13 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
								>
									{@render meta(batch, open)}
								</summary>
								<ChangeList {batch} {ticked} {onTick} phone boxes={selecting} {form} />
							</details>
						{/if}
					</li>
				{/each}
			</ul>
			{#if group.continues}
				<p class="border-t border-border py-2 pr-18 pl-4 text-sm text-muted-foreground">
					Continues on the older page.
				</p>
			{/if}
			{#if i < days.length - 1}<div class="border-b border-border"></div>{/if}
		</section>
	{/each}
</div>
