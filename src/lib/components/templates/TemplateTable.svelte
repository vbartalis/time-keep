<script lang="ts">
	import Timer from '@lucide/svelte/icons/timer';
	import type { TemplateCard } from '#lib/components/today/types.js';
	import { openForm } from '#lib/entry-link.js';
	import { templateTimes } from '#lib/format.js';
	import TemplateMenu from './TemplateMenu.svelte';
	import { dotOf, editHref } from './rows';

	/**
	 * The PC's templates (`pc-templates`): Entries' ruled table, by name. Name (the
	 * project's dot, the name in semibold, a link to the form for the keyboard), Customer
	 * › project (the customer muted), Activity and Location (from 1280 px), Times, the mark
	 * (TIMER muted with a timer icon, LOG muted) and ⋯. A click anywhere on a row off its
	 * controls opens the template form in place.
	 */
	let {
		templates,
		back,
		onuse
	}: {
		templates: TemplateCard[];
		/** The screen's own address: where the form, Log… and Delete return to. */
		back: string;
		/** Opens a template's sheet (Log… / Start timer…). */
		onuse: (t: TemplateCard) => void;
	} = $props();

	function onrowclick(e: MouseEvent, t: TemplateCard) {
		const target = e.target instanceof Element ? e.target : null;
		if (!target || target.closest('a, button, input, label, summary, details, form')) return;
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		void openForm(editHref(t, back));
	}

	const head = 'h-9 px-3 text-left align-middle text-xs caps font-semibold text-muted-foreground';
	const cell = 'border-b border-border px-3 py-2 align-middle';
</script>

{#snippet none()}<span class="text-muted-foreground">—</span>{/snippet}

<table class="w-full border-separate border-spacing-0 text-sm lg:table-fixed">
	<thead>
		<tr class="bg-muted">
			<th class="{head} w-[24%] border-b border-input">Name</th>
			<th class="{head} border-b border-input">Customer › project</th>
			<th class="{head} w-[13%] border-b border-input max-xl:hidden">Activity</th>
			<th class="{head} w-[11%] border-b border-input max-xl:hidden">Location</th>
			<th class="{head} w-28 border-b border-input">Times</th>
			<th class="{head} w-20 border-b border-input">Mark</th>
			<th class="{head} w-11 border-b border-input"><span class="sr-only">Actions</span></th>
		</tr>
	</thead>
	<tbody>
		{#each templates as t (t.id)}
			{@const times = templateTimes(t)}
			<tr
				data-template={t.id}
				onclick={(e) => onrowclick(e, t)}
				class="cursor-pointer transition-colors duration-150 ease-out hover:bg-accent/50"
			>
				<td class={cell}>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- editHref resolves it -->
					<a
						href={editHref(t, back)}
						data-entry-form
						class="inline-flex max-w-full min-w-0 items-center gap-2 rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						<span class="size-2 shrink-0 rounded-full {dotOf(t)}" aria-hidden="true"></span>
						<span class="min-w-0 truncate" title={t.name}>{t.name}</span>
					</a>
				</td>
				<td class="{cell} truncate">
					{#if t.customerName && t.projectName}
						<span class="text-muted-foreground">{t.customerName} ›</span> {t.projectName}
					{:else if t.customerName ?? t.projectName}
						{t.customerName ?? t.projectName}
					{:else}
						{@render none()}
					{/if}
				</td>
				<td class="{cell} truncate max-xl:hidden">
					{#if t.activityName}{t.activityName}{:else}{@render none()}{/if}
				</td>
				<td class="{cell} truncate max-xl:hidden">
					{#if t.locationName}{t.locationName}{:else}{@render none()}{/if}
				</td>
				<td class="{cell} whitespace-nowrap figures">
					{#if times}{times}{:else}{@render none()}{/if}
				</td>
				<td class="{cell} text-xs caps font-semibold text-muted-foreground">
					{#if t.runs}
						<span class="inline-flex items-center gap-1"
							><Timer class="size-3.5" aria-hidden="true" />Timer</span
						>
					{:else}
						Log
					{/if}
				</td>
				<td class="border-b border-border py-0 pr-1 align-middle">
					<TemplateMenu template={t} {back} surface="pc" onuse={() => onuse(t)} />
				</td>
			</tr>
		{/each}
	</tbody>
</table>
