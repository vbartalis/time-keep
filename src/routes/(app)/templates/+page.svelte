<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { onMount, tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import TemplateList from '#lib/components/templates/TemplateList.svelte';
	import TemplateTable from '#lib/components/templates/TemplateTable.svelte';
	import { rowRefusal } from '#lib/components/timesheet/refusal.svelte.js';
	import TemplateSheet from '#lib/components/today/TemplateSheet.svelte';
	import type { TemplateCard } from '#lib/components/today/types.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const BACK = '/templates';
	const newHref = `${resolve('/(app)/templates/new')}?back=${encodeURIComponent(BACK)}`;

	// A row's refusal belongs to the screen it was made on.
	afterNavigate(() => (rowRefusal.error = null));

	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** From `lg` the PC's table; below it the phone's rows. Without the script both render, CSS shows one. */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const pc = $derived(!enhanced || wide.current);
	const phone = $derived(!enhanced || !wide.current);

	/** The template whose sheet is up (Log… / Start timer…); kept while it closes. */
	let chosen = $state<TemplateCard | null>(null);
	let sheetOpen = $state(false);

	/** Log… from a menu: once the menu (or the phone's row sheet) has closed, the sheet opens. */
	async function use(t: TemplateCard) {
		await tick();
		chosen = t;
		sheetOpen = true;
	}

	/** A refused Delete replaces the strip: the screen shows the refusal. */
	const strip = $derived(rowRefusal.error ? null : data.flash);
	const count = $derived(data.templates.length);

	const link =
		'inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9';
</script>

<svelte:head><title>Templates · Time Keep</title></svelte:head>

<UndoStrip flash={strip} back={BACK} />
{#if rowRefusal.error}
	<div
		role="alert"
		class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-destructive"
	>
		<p class="min-w-0 flex-1 text-pretty">{rowRefusal.error}</p>
		{#if rowRefusal.reload}
			<a href={resolve('/(app)/templates')} data-sveltekit-reload class={link}>Reload</a>
		{/if}
	</div>
{/if}

<div class="flex flex-col gap-3">
	<!-- The header's "+ New entry" stays the one primary; out of the phone's "+" column. -->
	<div class="flex flex-wrap items-center gap-x-4 gap-y-1 max-lg:pr-14">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus its back -->
		<Button href={newHref} data-entry-form variant="outline" class="max-lg:w-full">
			<Plus class="size-4" aria-hidden="true" />New template
		</Button>
		{#if count === 0}
			<p class="text-sm text-muted-foreground">No templates yet.</p>
		{:else}
			<p data-count class="text-sm text-muted-foreground figures lg:ml-auto">
				<span class="font-semibold text-foreground">{count}</span>
				{count === 1 ? 'template' : 'templates'}
			</p>
		{/if}
	</div>

	{#if count > 0}
		{#if pc}
			<div class="rounded-md border border-border bg-card max-lg:hidden">
				<TemplateTable templates={data.templates} back={BACK} onuse={use} />
			</div>
		{/if}
		{#if phone}
			<div class="lg:hidden">
				<TemplateList templates={data.templates} back={BACK} {enhanced} onuse={use} />
			</div>
		{/if}
	{/if}
</div>

{#if chosen}
	<TemplateSheet
		template={chosen}
		projects={data.projects}
		activities={data.activities}
		locations={data.locations}
		back={BACK}
		open={sheetOpen}
		onclose={() => (sheetOpen = false)}
		failure={null}
	/>
{/if}
