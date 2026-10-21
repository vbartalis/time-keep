<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import ChangeList from './ChangeList.svelte';
	import { COLS, keepArrows } from './columns';
	import type { BatchRow } from './types';

	/**
	 * One batch: its time, label and what it touched, who made it, its changes' count and
	 * state, and its own Undo and Redo. A click on the row but its buttons, or its
	 * disclosure, opens its changes under it. Without the script the changes are a native
	 * `<details>` and the buttons sit over the summary's actions column.
	 */
	let {
		batch,
		enhanced,
		open,
		onToggle,
		ticked,
		onTick,
		query
	}: {
		batch: BatchRow;
		/** The script runs: the disclosure is a button, not a `<details>`. */
		enhanced: boolean;
		open: boolean;
		onToggle: () => void;
		ticked: (changeId: string) => boolean;
		onTick: (changeId: string, on: boolean) => void;
		/** Appended to the actions, so a refusal renders the page posted from. */
		query: string;
	} = $props();

	const changes = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'}`;
	const undone = $derived(batch.state.state === 'undone');
	const panel = $derived(`changes-${batch.id}`);

	/** A click on the row outside its buttons and tick boxes opens or closes it. */
	function onrowclick(e: MouseEvent) {
		const target = e.target instanceof Element ? e.target : null;
		if (!target || target.closest('a, button, input, label')) return;
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		if (getSelection()?.toString()) return;
		onToggle();
	}

	const row = `${COLS} flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2`;
	const button =
		'relative h-11 lg:h-8 lg:px-2.5 after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[""]';
</script>

{#snippet text()}
	<span class={['figures max-lg:w-12', undone && 'text-muted-foreground']}>{batch.time}</span>
	<ChevronRight
		aria-hidden="true"
		class="size-4 text-muted-foreground transition-transform duration-150 ease-out max-lg:hidden {open
			? 'rotate-90'
			: ''} {enhanced ? '' : 'group-open:rotate-90'}"
	/>
	<span class="flex min-w-0 flex-col max-lg:flex-1">
		<span
			data-label
			class={['truncate font-semibold', undone && 'font-medium text-muted-foreground']}
			>{batch.label}</span
		>
		{#if batch.touched}
			<!-- From lg to xl What is narrow: the touched line takes two lines before a cut. -->
			<span
				class="truncate text-xs text-muted-foreground lg:max-xl:line-clamp-2 lg:max-xl:whitespace-normal"
				>{keepArrows(batch.touched)}</span
			>
		{/if}
	</span>
{/snippet}

{#snippet meta()}
	<span class="max-lg:order-1">
		{#if batch.actor === 'agent'}<Badge>Agent</Badge>{/if}
		{#if batch.actor === 'system'}<Badge>System</Badge>{/if}
	</span>
	<!-- From lg to xl one column: the count, the state under it in 12 px. -->
	<span class="contents lg:max-xl:flex lg:max-xl:flex-col">
		<span data-count class="whitespace-nowrap figures max-lg:order-1">{changes(batch.count)}</span>
		<span
			data-state
			class="text-muted-foreground max-lg:order-1 lg:max-xl:text-xs lg:max-xl:whitespace-nowrap"
		>
			{#if batch.state.state === 'undone'}
				Undone
			{:else if batch.state.state === 'partly'}
				Partly undone, {batch.state.undone} of {batch.state.total}
			{/if}
		</span>
	</span>
{/snippet}

{#snippet actions()}
	{#if batch.state.undone < batch.state.total}
		<Button
			type="submit"
			variant="outline"
			name="batchId"
			value={batch.id}
			formaction="?/undo{query}"
			aria-label="Undo {batch.label}"
			class={button}><Undo2 aria-hidden="true" />Undo</Button
		>
	{/if}
	{#if batch.state.undone > 0}
		<Button
			type="submit"
			variant="outline"
			name="batchId"
			value={batch.id}
			formaction="?/redo{query}"
			aria-label="Redo {batch.label}"
			class={button}><Redo2 aria-hidden="true" />Redo</Button
		>
	{/if}
{/snippet}

<li data-batch={batch.id} class="relative border-b border-border text-sm last:border-b-0">
	{#if enhanced}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<!-- The keyboard's way in is the disclosure button; the click is a larger target. -->
		<div
			class="{row} cursor-pointer transition-colors duration-150 ease-out hover:bg-accent/50"
			onclick={onrowclick}
		>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panel}
				data-disclosure={batch.id}
				onclick={onToggle}
				class="flex min-h-11 min-w-0 items-center rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:basis-full max-lg:gap-x-3 lg:col-[1/4] lg:-ml-1.5 lg:grid lg:min-h-10 lg:grid-cols-subgrid lg:pl-1.5"
			>
				{@render text()}
			</button>
			{@render meta()}
			<span class="flex justify-end gap-2 max-lg:order-2 max-lg:basis-full max-lg:justify-start">
				{@render actions()}
			</span>
		</div>
		<div id={panel} hidden={!open}>
			<ChangeList {batch} {ticked} {onTick} />
		</div>
	{:else}
		<details {open} class="group">
			<summary
				class="{row} cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden"
			>
				<span class="flex min-h-11 min-w-0 items-center gap-x-3 max-lg:basis-full lg:contents">
					{@render text()}
				</span>
				{@render meta()}
				<!-- The actions sit here, over the summary, outside it (a button in a summary is
				     a control in a control); with the script they are in the row. -->
				<span class="max-lg:hidden"></span>
			</summary>
			<ChangeList {batch} {ticked} {onTick} />
		</details>
		<span class="flex gap-2 max-lg:px-3 max-lg:pb-2 lg:absolute lg:top-3 lg:right-3">
			{@render actions()}
		</span>
	{/if}
</li>
