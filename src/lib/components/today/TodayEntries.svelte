<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { warningText } from '#lib/format.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import SectionHead from './SectionHead.svelte';
	import type { EntryRow, FlashWarning } from './types';

	let { entries, warnings }: { entries: EntryRow[]; warnings: FlashWarning[] } = $props();

	const columns =
		'grid-cols-[3.5rem_3.75rem_3.5rem_minmax(0,1fr)] lg:grid-cols-[4.5rem_4.5rem_4.5rem_minmax(0,1fr)]';
	const marksOf = (id: string) => warnings.filter((w) => w.subject === id);
	// The form opens over Today and returns to it.
	const edit = (id: string) => `${resolve('/(app)/entries/[id]', { id })}?back=%2F`;
	// The row's ▶ beside its link: 44 px below `lg`, 36 px from it. On the phone it leads
	// the row, out of the fixed "+"'s column at the right.
	const side = 'w-11 shrink-0 max-lg:order-first lg:w-9';
</script>

<section aria-labelledby="entries-heading">
	<SectionHead id="entries-heading" title="Today’s entries" />
	{#if entries.length === 0}
		<p class="border-b border-border px-3 py-3 text-sm text-muted-foreground">
			Nothing logged today.
		</p>
	{:else}
		<div
			class="flex h-9 border-b border-input bg-muted text-xs caps text-muted-foreground"
			aria-hidden="true"
		>
			<div class="grid flex-1 divide-x divide-border {columns}">
				<span class="flex items-center px-3">In</span>
				<span class="flex items-center px-3">Out</span>
				<span class="flex items-center px-3">Hours</span>
				<span class="flex items-center px-3">Customer › project</span>
			</div>
			<span class={side}></span>
		</div>
		<ul>
			{#each entries as entry (entry.id)}
				{@const marks = marksOf(entry.id)}
				<li class="flex border-b border-border">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- edit() resolves it -->
					<a
						href={edit(entry.id)}
						data-entry-form
						class="grid min-h-11 flex-1 divide-x divide-border text-sm transition-colors duration-150 ease-out outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset {columns}"
					>
						<span class="px-3 py-2.5 figures">{entry.in}</span>
						{#if entry.out}
							<span class="px-3 py-2.5 figures">{entry.out}</span>
						{:else}
							<span class="px-1.5 py-2.5 text-xs leading-5 font-semibold text-live lg:px-3"
								>Running</span
							>
						{/if}
						<span class="px-3 py-2.5 figures {entry.out ? '' : 'text-live'}">{entry.hours}</span>
						<div class="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
							<span class="font-semibold text-pretty"
								>{entry.customerName} › {entry.projectName}</span
							>
							{#if entry.startDate}
								<span class="text-muted-foreground"
									>Since <span class="figures">{entry.startDate}</span></span
								>
							{/if}
							{#if entry.description}
								<span class="text-pretty text-muted-foreground">{entry.description}</span>
							{/if}
							{#if marks.length > 0}
								<span class="flex flex-wrap gap-1 pt-0.5">
									{#each marks as mark, i (i)}
										<Badge variant="destructive">{warningText(mark)}</Badge>
									{/each}
								</span>
							{/if}
						</div>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<!-- Outside the row's link: a timer now with the entry's fields. -->
					<div class="flex justify-center pt-0.5 {side}">
						{#if entry.out}
							<form method="POST" action={resolve('/(app)/timers/restart')} use:enhance>
								<input type="hidden" name="id" value={entry.id} />
								<input type="hidden" name="back" value="/" />
								<button
									type="submit"
									title="Restart"
									aria-label="Restart {entry.customerName} › {entry.projectName}"
									class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
									><Play class="size-3.5 fill-current" aria-hidden="true" /></button
								>
							</form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
