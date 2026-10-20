<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import BatchLine from '#lib/components/history/BatchLine.svelte';
	import type { HistoryFailure } from '#lib/components/history/types.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failure = $derived(form && 'error' in form ? (form as HistoryFailure) : null);
	// `back` is `/history` or `/history?before=<id>`; the actions carry its query so a
	// refusal renders the page posted from.
	const query = $derived(data.back.includes('?') ? `&${data.back.split('?')[1]}` : '');

	let enhanced = $state(false);
	onMount(() => (enhanced = true));

	/** The ticks a refusal posted that are still on the page; none after a load. */
	const initial = () => {
		const shown = new Set(
			data.days.flatMap((d) => d.batches.flatMap((b) => b.changes)).map((c) => c.id)
		);
		return (failure?.selected ?? []).filter((id) => shown.has(id));
	};
	// Writable: the checkboxes change it; a new load or action result starts it again.
	let chosen = $derived<string[]>(initial());
	const toggle = (id: string, checked: boolean) => {
		chosen = checked ? [...chosen.filter((c) => c !== id), id] : chosen.filter((c) => c !== id);
	};
	// A refusal keeps open the batches holding its ticks.
	const open = $derived(new Set(failure?.selected ?? []));
	const holds = (changes: { id: string }[]) => changes.some((c) => open.has(c.id));
	const none = $derived(enhanced && chosen.length === 0);

	const link =
		'rounded-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center';
</script>

<svelte:head><title>History · Time Keep</title></svelte:head>

<!-- A refused action replaces the strip: the screen shows the failure, not an older success. -->
<UndoStrip flash={failure ? null : data.flash} back={data.back} />

{#if data.days.length === 0}
	<p class="border-b border-border py-3 text-sm text-muted-foreground">Nothing recorded yet.</p>
{:else}
	<form method="POST" action="?/undo{query}" use:enhance class="flex flex-col gap-6">
		<input type="hidden" name="back" value={data.back} />

		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-3 border-b border-border pb-3">
				<Button
					type="submit"
					variant="outline"
					formaction="?/undo{query}"
					disabled={none}
					class="flex-1 sm:flex-none">Undo selected changes</Button
				>
				<Button
					type="submit"
					variant="outline"
					formaction="?/redo{query}"
					disabled={none}
					class="flex-1 sm:flex-none">Redo selected changes</Button
				>
				{#if enhanced}
					<p class="text-sm" aria-live="polite">{chosen.length} selected</p>
				{/if}
			</div>

			{#if failure}
				<div
					role="alert"
					class="rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-pretty text-destructive"
				>
					{failure.error}
				</div>
			{/if}
		</div>

		{#each data.days as group, i (group.day)}
			{@const [date, weekday] = group.day.split(', ')}
			<section aria-labelledby="day-{i}">
				<h2
					id="day-{i}"
					class="flex items-baseline gap-2 border-b border-foreground pb-1.5 text-sm"
				>
					<span class="figures">{date}</span>
					<span class="caps">{weekday}</span>
				</h2>
				<ul>
					{#each group.batches as batch (batch.id)}
						<BatchLine {batch} {chosen} {toggle} open={holds(batch.changes)} {query} />
					{/each}
				</ul>
			</section>
		{/each}
	</form>
{/if}

{#if data.older || data.newest}
	<nav aria-label="Pages" class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
		{#if data.newest}
			<a href={resolve('/(app)/history')} class={link}>Newest</a>
		{/if}
		{#if data.older}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
			<a href="{resolve('/(app)/history')}?before={encodeURIComponent(data.older)}" class={link}
				>Older</a
			>
		{/if}
	</nav>
{/if}
