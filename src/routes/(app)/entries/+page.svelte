<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import ChangeForm from '#lib/components/entries/ChangeForm.svelte';
	import EntryFilters from '#lib/components/entries/EntryFilters.svelte';
	import EntryTable from '#lib/components/entries/EntryTable.svelte';
	import type { BulkFailure, DeleteConfirm } from '#lib/components/entries/types.js';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failure = $derived(form && 'error' in form ? (form as BulkFailure) : null);
	const confirm = $derived(form && 'confirm' in form ? (form as DeleteConfirm) : null);
	// `back` is `/entries?<query>`; actions carry the query so a refusal renders this search.
	const query = $derived(data.back.slice(data.back.indexOf('?') + 1));
	const entries = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

	let enhanced = $state(false);
	onMount(() => (enhanced = true));

	/** The rows checked: a refused or confirming selection, else every row when `all` asked. */
	const initial = () => {
		const shown = new Set(data.entries.map((e) => e.id));
		const posted = failure?.selected ?? confirm?.chosen.map((c) => c.id);
		return posted
			? posted.filter((id) => shown.has(id))
			: data.entries.filter((e) => e.checked).map((e) => e.id);
	};
	// Writable: the checkboxes change it; a new load or action result starts it again.
	let chosen = $derived<string[]>(initial());

	// Below `lg` the table's head is hidden, so the same select-all sits by the count.
	const every = $derived(data.entries.length > 0 && chosen.length === data.entries.length);
	const some = $derived(chosen.length > 0 && !every);
	function toggleAll(e: Event & { currentTarget: HTMLInputElement }) {
		chosen = e.currentTarget.checked ? data.entries.map((r) => r.id) : [];
	}

	let confirmButton = $state<HTMLButtonElement | null>(null);
	// The confirm step appears under the buttons; take the focus to it.
	$effect(() => {
		if (confirm) confirmButton?.focus();
	});

	const link =
		'rounded-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center';
</script>

<svelte:head><title>Entries · Time Keep</title></svelte:head>

<!-- A refused action replaces the strip: the screen shows the failure, not an older success. -->
<UndoStrip flash={failure ? null : data.flash} back={data.back} />

<section aria-labelledby="filters-heading">
	<SectionHead id="filters-heading" title="Filters" />
	<EntryFilters
		search={data.search}
		filters={data.filters}
		error={data.error}
		dateError={data.dateError}
	/>
</section>

{#if data.error === null}
	{#if data.entries.length === 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 text-sm">
			<p class="text-muted-foreground">No entries match.</p>
			<a href={resolve('/(app)/entries')} class={link}>Clear</a>
		</div>
	{:else}
		<section aria-labelledby="change-heading">
			<SectionHead id="change-heading" title="Change selected">
				{#snippet aside()}
					{#if enhanced}
						<p class="text-sm" aria-live="polite">{chosen.length} selected</p>
					{/if}
				{/snippet}
			</SectionHead>
			<ChangeForm
				id="bulk"
				choices={data.choices}
				{failure}
				{query}
				back={data.back}
				count={chosen.length}
				{enhanced}
			/>

			{#if failure}
				<div
					role="alert"
					class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-destructive"
				>
					<p class="min-w-0 flex-1 text-pretty">{failure.error}</p>
					{#if failure.conflict}
						<!-- A full load, so the list shows the entries as they are now. -->
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={data.back} data-sveltekit-reload class={link}>Reload</a>
					{/if}
				</div>
			{/if}

			{#if confirm}
				<form
					method="POST"
					action="?/confirmDelete&{query}"
					use:enhance
					class="mt-4 flex flex-col gap-3 border-y border-border py-3"
				>
					<input type="hidden" name="back" value={data.back} />
					{#each confirm.chosen as c (c.id)}
						<input type="hidden" name="id" value={c.id} />
						<input type="hidden" name="version.{c.id}" value={c.version} />
					{/each}
					<p class="text-sm text-pretty">Delete {entries(confirm.chosen.length)}?</p>
					<div class="flex flex-wrap gap-3">
						<Button
							bind:ref={confirmButton}
							type="submit"
							variant="destructive"
							class="flex-1 sm:flex-none">Yes, delete them</Button
						>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<Button href={data.back} variant="outline" class="flex-1 sm:flex-none">Keep them</Button
						>
					</div>
				</form>
			{/if}
		</section>

		<section aria-labelledby="list-heading">
			<SectionHead id="list-heading" title="Found">
				{#snippet aside()}
					<p class="flex flex-wrap items-baseline justify-end gap-x-4 text-sm">
						<span>{entries(data.count)}, <span class="figures">{data.total}</span></span>
						{#if enhanced}
							<label class="flex items-center gap-2 lg:hidden">
								<input
									type="checkbox"
									class="size-4.5 rounded-sm border-input align-middle accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
									checked={every}
									indeterminate={some}
									onchange={toggleAll}
								/>
								<span>Select all shown</span>
							</label>
						{:else}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href="{data.back}&all=1" class={link}>Select all</a>
						{/if}
					</p>
				{/snippet}
			</SectionHead>
			{#if data.truncated}
				<p class="border-b border-border py-2 text-sm text-muted-foreground">
					Showing the first 500 entries; narrow the filters.
				</p>
			{/if}
			<EntryTable
				form="bulk"
				entries={data.entries}
				bind:chosen
				versions={failure?.versions ?? {}}
				warnings={data.flash?.warnings ?? []}
				back={data.back}
				{enhanced}
			/>
		</section>
	{/if}
{/if}
