<script lang="ts">
	import { resolve } from '$app/paths';
	import { warningText } from '#lib/format.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import SectionHead from './SectionHead.svelte';
	import type { EntryRow, FlashWarning } from './types';

	let { entries, warnings }: { entries: EntryRow[]; warnings: FlashWarning[] } = $props();

	const columns =
		'grid-cols-[3.5rem_3.75rem_3.5rem_minmax(0,1fr)] lg:grid-cols-[4.5rem_4.5rem_4.5rem_minmax(0,1fr)]';
	const marksOf = (id: string) => warnings.filter((w) => w.subject === id);
</script>

<section aria-labelledby="entries-heading">
	<SectionHead id="entries-heading" title="Today’s entries" />
	{#if entries.length === 0}
		<p class="border-b border-border px-3 py-3 text-sm text-muted-foreground">
			Nothing logged today.
		</p>
	{:else}
		<div
			class="grid h-9 divide-x divide-border border-b border-input bg-muted text-xs caps text-muted-foreground {columns}"
			aria-hidden="true"
		>
			<span class="flex items-center px-3">In</span>
			<span class="flex items-center px-3">Out</span>
			<span class="flex items-center px-3">Hours</span>
			<span class="flex items-center px-3">Customer › project</span>
		</div>
		<ul>
			{#each entries as entry (entry.id)}
				{@const marks = marksOf(entry.id)}
				<li class="border-b border-border">
					<a
						href={resolve('/(app)/entries/[id]', { id: entry.id })}
						class="grid min-h-11 divide-x divide-border text-sm transition-colors duration-150 ease-out outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset {columns}"
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
				</li>
			{/each}
		</ul>
	{/if}
</section>
