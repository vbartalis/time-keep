<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import ChoiceFields from '#lib/components/output/ChoiceFields.svelte';
	import ChoiceForm from '#lib/components/output/ChoiceForm.svelte';
	import OptionsSheet from '#lib/components/output/OptionsSheet.svelte';
	import OutputOptions from '#lib/components/output/OutputOptions.svelte';
	import RunningLine from '#lib/components/output/RunningLine.svelte';
	import TotalsTable from '#lib/components/reports/TotalsTable.svelte';
	import FilterChips from '#lib/components/timesheet/FilterChips.svelte';
	import Toolbar from '#lib/components/timesheet/Toolbar.svelte';
	import { filterQuery, scopeCount, type Scope } from '#lib/filter/filter.js';
	import { choiceQuery } from '#lib/filter/output.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const action = resolve('/(app)/reports');
	/** The screen's address with another scope; the range, search and choice kept. */
	const withScope = (scope: Scope) =>
		`${action}?${filterQuery({ ...data.filter, ...scope })}&${choiceQuery(data.choice)}`;
	const clear = $derived(withScope({ customer: '', project: '', activity: '', location: '' }));
	const filtered = $derived(scopeCount(data.filter) > 0);

	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** From `lg` the PC's options line and two columns; below it the phone's. Without the script both render, CSS shows one. */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const pc = $derived(!enhanced || wide.current);
	const phone = $derived(!enhanced || !wide.current);

	/** The core's refusal of the read (the dates' own shows in the filter). */
	const refusal = $derived(data.error !== null && !data.dateError ? data.error : null);

	const link =
		'inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9';
</script>

<svelte:head><title>Reports · Time Keep</title></svelte:head>

{#snippet list(name: 'days' | 'weeks' | 'customers' | 'projects', at: 'pc' | 'phone')}
	{#if name === 'days'}
		<TotalsTable id="{at}-days" title="Days" rows={data.days} total={data.total} dateLabels />
	{:else if name === 'weeks'}
		<TotalsTable id="{at}-weeks" title="Weeks" rows={data.weeks} total={data.total} dateLabels />
	{:else if name === 'customers'}
		<TotalsTable id="{at}-customers" title="Customers" rows={data.customers} total={data.total} />
	{:else}
		<TotalsTable id="{at}-projects" title="Projects" rows={data.projects} total={data.total} />
	{/if}
{/snippet}

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-3">
		<Toolbar
			{action}
			noun={['entry', 'entries']}
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
				<!-- The choice in view rides along with the filter, Copy-out's columns kept. -->
				<ChoiceFields choice={data.choice} />
			{/snippet}
		</Toolbar>
		<FilterChips scope={data.filter} options={data.options} href={withScope} />
		<RunningLine running={data.running} />
		{#if data.error === null && pc}
			<div class="max-lg:hidden">
				<ChoiceForm
					{action}
					filter={data.filter}
					columns={data.choice.columns}
					class="flex flex-wrap items-center gap-x-5 gap-y-3"
				>
					<OutputOptions options={data.choice.options} form="output" size="pc" />
				</ChoiceForm>
			</div>
		{/if}
	</div>

	{#if data.error === null && phone}
		<div class="max-lg:pr-14 lg:hidden">
			<OptionsSheet
				id="output-sheet"
				{action}
				filter={data.filter}
				columns={data.choice.columns}
				options={data.choice.options}
				sheet={enhanced && !wide.current}
			/>
		</div>
	{/if}

	{#if refusal !== null}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
			<p role="alert" class="text-destructive">{refusal}</p>
		</div>
	{:else if data.error === null}
		{#if data.count === 0}
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
				<p class="text-muted-foreground">No entries match.</p>
				{#if filtered}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
					<a href={clear} data-sveltekit-reset="false" class={link}>Clear filters</a>
				{/if}
			</div>
		{:else}
			{#if pc}
				<!-- Days at the left; Weeks, Customers and Projects stacked at the right. -->
				<div class="grid grid-cols-2 items-start gap-6 max-lg:hidden">
					{@render list('days', 'pc')}
					<div class="flex flex-col gap-6">
						{@render list('weeks', 'pc')}
						{@render list('customers', 'pc')}
						{@render list('projects', 'pc')}
					</div>
				</div>
			{/if}
			{#if phone}
				<!-- The month's split first, the days last (call 24). -->
				<div class="flex flex-col gap-8 lg:hidden">
					{@render list('customers', 'phone')}
					{@render list('projects', 'phone')}
					{@render list('weeks', 'phone')}
					{@render list('days', 'phone')}
				</div>
			{/if}
		{/if}
	{/if}
</div>
