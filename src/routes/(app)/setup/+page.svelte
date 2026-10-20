<script lang="ts">
	import { resolve } from '$app/paths';
	import AddLine from '#lib/components/setup/AddLine.svelte';
	import AddProject from '#lib/components/setup/AddProject.svelte';
	import SetupRow from '#lib/components/setup/SetupRow.svelte';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import type { SetupFailure } from '#lib/server/screens/setup.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failure = $derived(form && 'kind' in form ? (form as SetupFailure) : null);
	const base = $derived(resolve('/(app)/setup'));
	// Posted as the return path, so a literal: `resolve()` gives a relative path while rendering.
	const back = $derived(data.showArchived ? '/setup?archived=1' : '/setup');
	const here = $derived(data.showArchived ? `${base}?archived=1` : base);
	const query = $derived(data.showArchived ? '&archived=1' : '');
	const toggle = $derived(data.showArchived ? base : `${base}?archived=1`);

	const link =
		'rounded-sm text-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center';
	const list = 'flex flex-col';
	const ruled = 'border-b border-border';
</script>

<svelte:head><title>Setup · Time Keep</title></svelte:head>

<div class="flex flex-wrap items-end justify-end gap-x-4 gap-y-1">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href={toggle} class={link}>{data.showArchived ? 'Hide archived' : 'Show archived'}</a>
</div>

<!-- A refused action replaces the strip: the screen shows the failure, not an older success. -->
<UndoStrip flash={failure ? null : data.flash} {back} />

<div class="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-x-10">
	<section aria-labelledby="customers-heading">
		<SectionHead id="customers-heading" title="Customers and projects" />
		{#if data.customers.length === 0}
			<p class="{ruled} px-1 py-3 text-sm text-muted-foreground">No customers yet.</p>
		{:else}
			<ul class={list}>
				{#each data.customers as customer (customer.id)}
					<li class="border-t border-foreground first:border-t-0">
						<SetupRow kind="customer" row={customer} {failure} {back} {here} {query}>
							{#snippet extra()}
								{#if !customer.archived}
									<AddProject
										customerId={customer.id}
										customerName={customer.name}
										{failure}
										{back}
										{here}
										{query}
									/>
								{/if}
							{/snippet}
						</SetupRow>
						<ul class="{list} ml-4 border-l border-border pl-3 sm:ml-6">
							{#each customer.projects as project (project.id)}
								<li class="border-t border-border first:border-t-0">
									<SetupRow kind="project" row={project} {failure} {back} {here} {query} />
								</li>
							{:else}
								<li class="py-2 text-sm text-muted-foreground">No active projects.</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{/if}
		<AddLine kind="customer" label="New customer" {failure} {back} {query} />
	</section>

	<div class="flex flex-col gap-6">
		{#each [{ kind: 'activity', id: 'activities', title: 'Activities', empty: 'No activities yet.', label: 'New activity', rows: data.activities }, { kind: 'location', id: 'locations', title: 'Locations', empty: 'No locations yet.', label: 'New location', rows: data.locations }] as const as region (region.kind)}
			<section aria-labelledby="{region.id}-heading">
				<SectionHead id="{region.id}-heading" title={region.title} />
				{#if region.rows.length === 0}
					<p class="{ruled} px-1 py-3 text-sm text-muted-foreground">{region.empty}</p>
				{:else}
					<ul class={list}>
						{#each region.rows as row (row.id)}
							<li class="border-t border-border first:border-t-0">
								<SetupRow kind={region.kind} {row} {failure} {back} {here} {query} />
							</li>
						{/each}
					</ul>
				{/if}
				<AddLine kind={region.kind} label={region.label} {failure} {back} {query} />
			</section>
		{/each}
	</div>
</div>
