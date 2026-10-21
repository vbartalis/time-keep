<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import SlidersVertical from '@lucide/svelte/icons/sliders-vertical';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import type { Filter } from '#lib/filter/filter.js';
	import { optionsLabel, type OutputOptions as Options } from '#lib/filter/output.js';
	import type { Column } from '#lib/output.js';
	import ChoiceForm from './ChoiceForm.svelte';
	import OutputOptions from './OutputOptions.svelte';

	/**
	 * The phone's Options on Reports: an outline button summarising the options ("Options
	 * · h:mm, rounded"). With the script it opens a bottom sheet (Entries' `Sheet`): the
	 * head "Options", the options at 44 px, each change shown at once, and a pinned "Done"
	 * closing it, the focus back on the button. Without it the button is a `<details>`
	 * whose form has its own Apply.
	 */
	let {
		id,
		action,
		filter,
		columns,
		options,
		sheet
	}: {
		/** The options' form id, apart from the PC's line. */
		id: string;
		action: string;
		filter: Filter;
		/** Kept as a hidden field, so the kept columns stay as they are. */
		columns: Column[];
		options: Options;
		/** The script runs: the sheet; else the `<details>`. */
		sheet: boolean;
	} = $props();

	let open = $state(false);
	const titleId = $derived(`${id}-title`);
	const label = $derived(optionsLabel(options));

	const button =
		'inline-flex h-11 max-w-full cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors duration-150 ease-out outline-none select-none hover:border-foreground/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden';
</script>

{#snippet face()}
	<SlidersVertical class="size-4 shrink-0" aria-hidden="true" />
	<span class="min-w-0 truncate">{label}</span>
	<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
{/snippet}

{#if sheet}
	<button type="button" aria-haspopup="dialog" onclick={() => (open = true)} class={button}>
		{@render face()}
	</button>
	<Sheet {open} labelledby={titleId} onclose={() => (open = false)}>
		<h2 id={titleId} class="shrink-0 px-4 pt-3 text-lg font-bold">Options</h2>
		<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
			<ChoiceForm {id} {action} {filter} {columns}>
				<OutputOptions {options} form={id} size="phone" />
			</ChoiceForm>
		</div>
		<div class="shrink-0 border-t border-border px-4 py-3">
			<button
				type="button"
				onclick={() => (open = false)}
				class="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-150 ease-out outline-none hover:border-foreground/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>Done</button
			>
		</div>
	</Sheet>
{:else}
	<details class="group/options">
		<summary class="{button} group-open/options:bg-accent">
			{@render face()}
		</summary>
		<div
			role="group"
			aria-label="Options"
			class="mt-2 rounded-md border border-border bg-card px-4 py-2"
		>
			<ChoiceForm {id} {action} {filter} {columns} class="flex flex-col gap-2 pb-2">
				<OutputOptions {options} form={id} size="phone" />
			</ChoiceForm>
		</div>
	</details>
{/if}
