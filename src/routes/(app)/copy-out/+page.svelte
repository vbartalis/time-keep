<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import CopyRows from '#lib/components/copy-out/CopyRows.svelte';
	import SheetTable from '#lib/components/copy-out/SheetTable.svelte';
	import ChoiceFields from '#lib/components/output/ChoiceFields.svelte';
	import ChoiceForm from '#lib/components/output/ChoiceForm.svelte';
	import ColumnChips from '#lib/components/output/ColumnChips.svelte';
	import OutputOptions from '#lib/components/output/OutputOptions.svelte';
	import RunningLine from '#lib/components/output/RunningLine.svelte';
	import FilterChips from '#lib/components/timesheet/FilterChips.svelte';
	import Toolbar from '#lib/components/timesheet/Toolbar.svelte';
	import { filterQuery, scopeCount, type Scope } from '#lib/filter/filter.js';
	import { choiceQuery } from '#lib/filter/output.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const action = resolve('/(app)/copy-out');
	/** The screen's address with another scope; the range, search and choice kept. */
	const withScope = (scope: Scope) =>
		`${action}?${filterQuery({ ...data.filter, ...scope })}&${choiceQuery(data.choice)}`;
	const clear = $derived(withScope({ customer: '', project: '', activity: '', location: '' }));
	const filtered = $derived(scopeCount(data.filter) > 0);

	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** From `lg` the PC's band and sheet; below it the phone's. Without the script both render, CSS shows one. */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const pc = $derived(!enhanced || wide.current);
	const phone = $derived(!enhanced || !wide.current);

	/** No column on: the message, both actions off, no sheet. */
	const noColumns = $derived(data.columnsError !== null);
	/** Nothing to copy (no column, or no row): both actions off, described by why. */
	const off = $derived(noColumns || data.count === 0);
	/** The core's refusal of the read (the dates' own shows in the filter). */
	const refusal = $derived(data.error !== null && !data.dateError ? data.error : null);
	const EMPTY = 'output-empty';
	const reason = $derived(noColumns ? 'output-columns-error' : EMPTY);

	const link =
		'inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9';
</script>

<svelte:head><title>Copy-out · Time Keep</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-3">
		<Toolbar
			{action}
			noun={['row', 'rows']}
			filter={data.filter}
			options={data.options}
			hints={data.hints}
			error={data.dateError ? data.error : null}
			{clear}
			count={data.count}
			total={data.total}
			sheet={enhanced && !wide.current}
		>
			{#snippet hidden()}
				<!-- The choice in view rides along with the filter. -->
				<ChoiceFields choice={data.choice} />
			{/snippet}
		</Toolbar>
		<FilterChips scope={data.filter} options={data.options} href={withScope} />
		<RunningLine running={data.running} />
	</div>

	{#if data.error === null}
		<ChoiceForm
			{action}
			filter={data.filter}
			class="flex flex-col gap-6 lg:grid lg:grid-cols-1 lg:gap-x-6 lg:gap-y-3 lg:rounded-md lg:border lg:border-border lg:bg-card lg:p-4 xl:grid-cols-[minmax(0,1fr)_auto]"
		>
			{#if phone}
				<div class="max-lg:pr-14 lg:hidden">
					<CopyRows
						columns={data.choice.columns}
						rows={data.rows}
						csvHref={data.csvHref}
						{off}
						{reason}
					/>
				</div>
			{/if}
			<div class="flex min-w-0 flex-col gap-6 max-lg:pr-14 lg:gap-3">
				<section aria-labelledby="output-columns" class="flex flex-col gap-3 lg:flex-row">
					<h2
						id="output-columns"
						class="max-lg:border-b max-lg:border-foreground max-lg:pb-1.5 max-lg:text-xs max-lg:caps lg:flex lg:h-9 lg:shrink-0 lg:items-center lg:text-sm lg:font-semibold"
					>
						Columns
					</h2>
					<ColumnChips columns={data.choice.columns} form="output" />
				</section>
				<section
					aria-labelledby="output-options"
					class="flex flex-col gap-3 lg:border-t lg:border-border lg:pt-3"
				>
					<h2 id="output-options" class="border-b border-foreground pb-1.5 text-xs caps lg:sr-only">
						Options
					</h2>
					<OutputOptions options={data.choice.options} form="output" size="pc" />
				</section>
			</div>
			{#if pc}
				<!-- At the band's right from `xl`; below it a row under the options, on a rule. -->
				<div class="max-lg:hidden lg:border-t lg:border-border lg:pt-3 xl:border-t-0 xl:pt-0">
					<CopyRows
						columns={data.choice.columns}
						rows={data.rows}
						csvHref={data.csvHref}
						{off}
						{reason}
					/>
				</div>
			{/if}
		</ChoiceForm>
	{/if}

	{#if refusal !== null}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
			<p role="alert" class="text-destructive">{refusal}</p>
		</div>
	{:else if data.error === null && !noColumns}
		{#if data.count === 0}
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
				<p id={EMPTY} class="text-muted-foreground">No entries match.</p>
				{#if filtered}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
					<a href={clear} data-sveltekit-reset="false" class={link}>Clear filters</a>
				{/if}
			</div>
		{:else if pc}
			<div class="max-lg:hidden">
				<SheetTable columns={data.choice.columns} rows={data.rows} total={data.total} />
			</div>
		{/if}
	{/if}
</div>
