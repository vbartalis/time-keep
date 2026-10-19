<script lang="ts">
	import { resolve } from '$app/paths';
	import CopyRows from '#lib/components/copy-out/CopyRows.svelte';
	import OutputFields from '#lib/components/copy-out/OutputFields.svelte';
	import SheetTable from '#lib/components/copy-out/SheetTable.svelte';
	import EntryFilters from '#lib/components/entries/EntryFilters.svelte';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	const shown = $derived(data.error === null && data.columnsError === null);

	const link =
		'rounded-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring';
</script>

<svelte:head><title>Copy-out · Time Keep</title></svelte:head>

<h1 class="text-xl font-semibold tracking-[-0.01em]">Copy-out</h1>

<section aria-labelledby="filters-heading">
	<SectionHead id="filters-heading" title="Filters" />
	<EntryFilters
		search={data.search}
		filters={data.filters}
		error={data.error}
		dateError={data.dateError}
		clear={resolve('/(app)/copy-out')}
		submit="Show"
		primary
	>
		<OutputFields columns={data.columns} options={data.options} columnsError={data.columnsError} />
		{#snippet links()}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the load builds it -->
			<a href={data.thisMonth} class={link}>This month</a>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the load builds it -->
			<a href={data.lastMonth} class={link}>Last month</a>
		{/snippet}
	</EntryFilters>
</section>

{#if shown}
	{#if data.rows.length === 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 text-sm">
			<p class="text-muted-foreground">No entries match.</p>
			<a href={resolve('/(app)/copy-out')} class={link}>Clear</a>
		</div>
		{#if data.running > 0}
			<p class="text-sm text-muted-foreground">
				{plural(data.running, 'running entry', 'running entries')} left out.
			</p>
		{/if}
	{:else}
		<section aria-labelledby="result-heading">
			<SectionHead id="result-heading" title="Result">
				{#snippet aside()}
					<p class="text-sm">
						{plural(data.rows.length, 'row', 'rows')}, <span class="punch">{data.total}</span>
					</p>
				{/snippet}
			</SectionHead>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border py-3">
				<CopyRows columns={data.columns} rows={data.rows} />
				<!-- A file, not a page: the browser fetches it whole. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the load builds it -->
				<Button
					href={data.csvHref}
					variant="outline"
					class="flex-1 sm:flex-none"
					data-sveltekit-reload>Download CSV</Button
				>
			</div>
			{#if data.running > 0}
				<p class="border-b border-border py-2 text-sm text-muted-foreground">
					{plural(data.running, 'running entry', 'running entries')} left out.
				</p>
			{/if}
			<SheetTable columns={data.columns} rows={data.rows} />
		</section>
	{/if}
{/if}
