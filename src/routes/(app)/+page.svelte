<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { spanText } from '#lib/calendar/grid.js';
	import { nowTicker } from '#lib/components/calendar/now.svelte.js';
	import DayTable from '#lib/components/timesheet/DayTable.svelte';
	import PhoneList from '#lib/components/timesheet/PhoneList.svelte';
	import { rowRefusal } from '#lib/components/timesheet/refusal.svelte.js';
	import { createSelection } from '#lib/components/timesheet/selection.svelte.js';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import Templates from '#lib/components/today/Templates.svelte';
	import type { ActionFailure } from '#lib/components/today/types.js';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** A refused template sheet, posted without the script. */
	const failure = $derived((form as ActionFailure | null) ?? null);

	// The server's now until mounted; the device's clock from then on, never behind it.
	const clock = nowTicker(untrack(() => data.now));
	const now = $derived(Math.max(clock.now, data.now));

	/** Today's total: the entries that started today, a running one to now (call 6). */
	const total = $derived(
		spanText(
			data.day.totalMs +
				data.day.rows.filter((r) => r.running && r.since === null).length * (now - data.now)
		)
	);

	// A row's refusal belongs to the screen it was made on.
	afterNavigate(() => (rowRefusal.error = null));

	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** From `lg` the PC's table; below it the phone's list. Without the script both render, CSS shows one. */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const pc = $derived(!enhanced || wide.current);
	const phone = $derived(!enhanced || !wide.current);

	/** Today's rows are never ticked; the tables take a selection all the same. */
	const selection = createSelection(() => []);

	/** The strip's flash: a refused action replaces it (the screen shows the refusal). */
	const strip = $derived(failure || rowRefusal.error ? null : data.flash);
	const days = $derived([data.day]);

	const link =
		'inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9';
</script>

<svelte:head><title>Time Keep</title></svelte:head>

<UndoStrip flash={strip} back="/" />
{#if rowRefusal.error}
	<div
		role="alert"
		class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-destructive"
	>
		<p class="min-w-0 flex-1 text-pretty">{rowRefusal.error}</p>
		{#if rowRefusal.reload}
			<a href={resolve('/(app)')} data-sveltekit-reload class={link}>Reload</a>
		{/if}
	</div>
{/if}

<div class="flex flex-col gap-8">
	<Templates
		templates={data.templates}
		projects={data.projects}
		activities={data.activities}
		locations={data.locations}
		{failure}
		back="/"
	/>

	<section aria-labelledby="today-heading">
		<SectionHead id="today-heading" title="Today · {data.day.label}">
			{#snippet aside()}
				<span data-day-total class="text-base font-semibold figures">{total}</span>
			{/snippet}
		</SectionHead>
		{#if data.day.rows.length === 0}
			<p class="border-b border-border py-3 text-sm text-muted-foreground">Nothing logged today.</p>
		{:else}
			{#if pc}
				<div class="mt-2 rounded-md border border-border bg-card max-lg:hidden">
					<DayTable
						{days}
						back="/"
						{now}
						loadedAt={data.now}
						warnings={data.flash?.warnings ?? []}
						{selection}
						{enhanced}
						versions={{}}
						selectable={false}
						dayHeads={false}
					/>
				</div>
			{/if}
			{#if phone}
				<div class="lg:hidden">
					<PhoneList
						{days}
						back="/"
						{now}
						loadedAt={data.now}
						warnings={data.flash?.warnings ?? []}
						{selection}
						{enhanced}
						selecting={false}
						versions={{}}
						selectable={false}
						dayHeads={false}
					/>
				</div>
			{/if}
		{/if}
	</section>
</div>
