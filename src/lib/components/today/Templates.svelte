<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Timer from '@lucide/svelte/icons/timer';
	import type { PickerOption, PickerProject } from '#lib/components/entry/types.js';
	import { fills } from './fills';
	import SectionHead from './SectionHead.svelte';
	import TemplateSheetForm from './TemplateSheetForm.svelte';
	import TemplateSheet from './TemplateSheet.svelte';
	import type { ActionFailure, TemplateCard } from './types';

	/**
	 * Today's TEMPLATES (`pc-today`, `ph-today`): a row per template on a ruled surface,
	 * its project's dot, its name over a muted line of what it fills, and a mark of what a
	 * tap does (TIMER and LOG both muted, TIMER with a timer icon: blue is for running; at
	 * the right with a chevron on the PC, leading the line on the phone, clear of the "+").
	 * A tap opens the template's sheet; without the script each row is a `<details>` panel
	 * holding the same form.
	 */
	let {
		templates,
		projects,
		activities,
		locations,
		failure,
		back
	}: {
		templates: TemplateCard[];
		projects: PickerProject[];
		activities: PickerOption[];
		locations: PickerOption[];
		failure: ActionFailure | null;
		back: string;
	} = $props();

	let hydrated = $state(false);
	let chosen = $state<TemplateCard | null>(null);
	let open = $state(false);
	/** A refusal the page rendered (no script, or a reload): its sheet opens with it once. */
	let carried = $state(untrack(() => failure));

	onMount(() => {
		hydrated = true;
		const failed = carried && templates.find((t) => t.id === carried?.subject);
		if (failed) {
			chosen = failed;
			open = true;
		}
	});

	function show(t: TemplateCard) {
		chosen = t;
		open = true;
	}
	function close() {
		open = false;
		carried = null;
	}

	// Whole class names, so Tailwind sees them.
	const DOTS = [
		'bg-project-1',
		'bg-project-2',
		'bg-project-3',
		'bg-project-4',
		'bg-project-5',
		'bg-project-6',
		'bg-project-7',
		'bg-project-8'
	];
	const dot = (colour: number) => DOTS[(colour - 1) % DOTS.length] ?? DOTS[0];

	const link =
		'inline-flex min-h-11 items-end rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0';
	const rowClass =
		'flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors duration-150 ease-out outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:items-center lg:px-3.5';
</script>

{#snippet mark(t: TemplateCard)}
	<span class="inline-flex items-center gap-1 text-xs caps font-semibold text-muted-foreground">
		{#if t.runs}<Timer class="size-3.5" aria-hidden="true" />Timer{:else}Log{/if}
	</span>
{/snippet}

{#snippet face(t: TemplateCard)}
	<span
		class="mt-1.5 size-2 shrink-0 rounded-full lg:mt-0 {t.colour === null ? '' : dot(t.colour)}"
		aria-hidden="true"
	></span>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="text-base leading-tight font-semibold text-pretty">{t.name}</span>
		<span class="text-xs text-pretty text-muted-foreground figures">
			<span class="lg:hidden">{@render mark(t)} ·</span>
			{fills(t)}
		</span>
	</span>
	<span class="flex shrink-0 items-center gap-3 max-lg:hidden">
		{@render mark(t)}
		<ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
	</span>
{/snippet}

<section aria-labelledby="templates-heading">
	<SectionHead id="templates-heading" title="Templates">
		{#snippet aside()}
			<!-- Out of the phone's "+" column; its 44 px target spills into the margins, not the head's height. -->
			<a
				href={resolve('/(app)/templates')}
				class="{link} max-lg:-my-3 max-lg:mr-14 max-lg:py-3"
				aria-label="Manage templates"
				><span class="lg:hidden">Manage</span><span class="max-lg:hidden">Manage templates</span></a
			>
		{/snippet}
	</SectionHead>
	{#if templates.length === 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border py-3 text-sm">
			<p class="text-muted-foreground">No templates yet.</p>
			<!-- The template form, opened in place over Today (a page without the script). -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus its back -->
			<a
				href="{resolve('/(app)/templates/new')}?back={encodeURIComponent(back)}"
				data-entry-form
				class={link}>Create a template</a
			>
		</div>
	{:else}
		<ul
			class="-mx-4 mt-2 bg-card max-lg:border-b max-lg:border-border lg:mx-0 lg:rounded-md lg:border lg:border-border"
		>
			{#each templates as t (t.id)}
				<li class="border-border not-last:border-b">
					{#if hydrated}
						<button type="button" aria-haspopup="dialog" class={rowClass} onclick={() => show(t)}>
							{@render face(t)}
						</button>
					{:else}
						<details name="template" open={failure?.subject === t.id} class="group">
							<summary class="{rowClass} list-none [&::-webkit-details-marker]:hidden">
								{@render face(t)}
							</summary>
							<TemplateSheetForm
								template={t}
								{projects}
								{activities}
								{locations}
								{back}
								failure={failure?.subject === t.id ? failure : null}
							/>
						</details>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if chosen}
	<TemplateSheet
		template={chosen}
		{projects}
		{activities}
		{locations}
		{back}
		{open}
		onclose={close}
		failure={carried}
	/>
{/if}
