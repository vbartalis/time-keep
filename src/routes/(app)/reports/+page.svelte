<script lang="ts">
	import { resolve } from '$app/paths';
	import OutputOptions from '#lib/components/copy-out/OutputOptions.svelte';
	import EntryFilters from '#lib/components/entries/EntryFilters.svelte';
	import TotalsTable from '#lib/components/reports/TotalsTable.svelte';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	const link =
		'rounded-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center';
</script>

<svelte:head><title>Reports · Time Keep</title></svelte:head>

<section aria-labelledby="filters-heading">
	<SectionHead id="filters-heading" title="Filters" />
	<EntryFilters
		search={data.search}
		filters={data.filters}
		error={data.error}
		dateError={data.dateError}
		clear={resolve('/(app)/reports')}
		submit="Show"
		primary
	>
		<!-- The form says which switches were sent; without it they are the defaults. -->
		<input type="hidden" name="show" value="1" />
		<OutputOptions options={data.options} />
		{#snippet links()}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the load builds it -->
			<a href={data.thisMonth} class={link}>This month</a>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the load builds it -->
			<a href={data.lastMonth} class={link}>Last month</a>
		{/snippet}
	</EntryFilters>
</section>

{#snippet runningLine(classes: string)}
	{#if data.running > 0}
		<p class="{classes} text-muted-foreground">
			{plural(data.running, 'running entry', 'running entries')} left out.
		</p>
	{/if}
{/snippet}

{#if data.error === null}
	{#if data.entries === 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 text-sm">
			<p class="text-muted-foreground">No entries match.</p>
			<a href={resolve('/(app)/reports')} class={link}>Clear</a>
		</div>
		{@render runningLine('text-sm')}
	{:else}
		<section aria-labelledby="result-heading" class="flex flex-col gap-6">
			<div>
				<SectionHead id="result-heading" title="Result">
					{#snippet aside()}
						<p class="text-sm">
							{plural(data.entries, 'entry', 'entries')}, <span class="figures">{data.total}</span>
						</p>
					{/snippet}
				</SectionHead>
				{@render runningLine('border-b border-border py-2 text-sm')}
			</div>
			<!-- One DOM order (the phone's); at lg Days is the left column and the rest a right one, Weeks first. -->
			<div class="grid gap-x-10 gap-y-6 lg:grid-cols-2 lg:items-start">
				<div class="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
					<TotalsTable
						id="customers-heading"
						title="Customers"
						rows={data.customers}
						total={data.total}
					/>
					<TotalsTable
						id="projects-heading"
						title="Projects"
						rows={data.projects}
						total={data.total}
					/>
					<div class="lg:order-first">
						<TotalsTable
							id="weeks-heading"
							title="Weeks"
							rows={data.weeks}
							total={data.total}
							dateLabels
						/>
					</div>
				</div>
				<div class="lg:col-start-1 lg:row-start-1">
					<TotalsTable
						id="days-heading"
						title="Days"
						rows={data.days}
						total={data.total}
						dateLabels
					/>
				</div>
			</div>
		</section>
	{/if}
{/if}
