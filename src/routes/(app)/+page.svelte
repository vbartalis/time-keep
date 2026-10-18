<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Not features: the regions the next phases fill, so the shell is built for them.
	const desk = [
		{ title: 'Entries', text: 'Find entries and edit them in bulk.' },
		{
			title: 'Customers, projects, activities, locations',
			text: 'Managed here. Finished ones are archived, never deleted.'
		},
		{ title: 'Templates', text: 'Saved partial entries, so a new one is a tap and a description.' },
		{ title: 'History', text: 'Every change kept; any batch undone in one step.' }
	];

	// The card's printed columns, ruled down through the empty lines.
	const timerColumns =
		'grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_4.5rem_minmax(0,1fr)]';
	const entryColumns =
		'grid-cols-[4.5rem_4.5rem_minmax(0,1fr)] md:grid-cols-[4.5rem_4.5rem_4rem_minmax(0,1fr)_8rem]';
</script>

<svelte:head><title>Time Keep</title></svelte:head>

{#snippet head(id: string, title: string)}
	<div class="flex items-end justify-between gap-3 border-b border-foreground pb-1.5">
		<h2 {id} class="text-sm printed">{title}</h2>
		<Badge variant="outline">Not built yet</Badge>
	</div>
{/snippet}

{#snippet blankLines(columns: string, cells: string[])}
	{#each [0, 1] as line (line)}
		<div
			class="grid h-9 divide-x divide-border border-b border-border {columns}"
			aria-hidden="true"
		>
			{#each cells as cell, i (i)}<span class={cell}></span>{/each}
		</div>
	{/each}
{/snippet}

<div class="flex flex-col gap-1">
	<h1 class="text-xl font-semibold tracking-[-0.01em]">Today</h1>
	<p class="text-sm text-muted-foreground">Signed in as {data.user.username}</p>
</div>

<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_19rem]">
	<div class="flex flex-col gap-10">
		<section aria-labelledby="timers-heading">
			{@render head('timers-heading', 'Timers')}
			<div
				class="grid h-9 divide-x divide-border border-b border-input bg-muted text-xs printed text-muted-foreground {timerColumns}"
				aria-hidden="true"
			>
				<span class="flex items-center px-3">In</span>
				<span class="hidden items-center px-3 sm:flex">Running</span>
				<span class="flex items-center px-3">Customer › project</span>
			</div>
			<p class="border-b border-border px-3 py-3 text-sm text-pretty text-muted-foreground">
				Running timers show here, each punched in with no end yet. Starting and stopping them comes
				with the phone screens.
			</p>
			{@render blankLines(timerColumns, ['', 'hidden sm:block', ''])}
		</section>

		<section aria-labelledby="entries-heading">
			{@render head('entries-heading', 'Today’s entries')}
			<div
				class="grid h-9 divide-x divide-border border-b border-input bg-muted text-xs printed text-muted-foreground {entryColumns}"
				aria-hidden="true"
			>
				<span class="flex items-center px-3">In</span>
				<span class="flex items-center px-3">Out</span>
				<span class="hidden items-center px-3 md:flex">Hours</span>
				<span class="flex items-center px-3">Customer › project</span>
				<span class="hidden items-center px-3 md:flex">Activity</span>
			</div>
			<p class="border-b border-border px-3 py-3 text-sm text-pretty text-muted-foreground">
				Today’s entries are listed here, in and out times on one line, ready to correct. Logging
				from a template comes with the phone screens.
			</p>
			{@render blankLines(entryColumns, ['', '', 'hidden md:block', '', 'hidden md:block'])}
		</section>
	</div>

	<section aria-labelledby="desk-heading">
		{@render head('desk-heading', 'At the desk')}
		<ul class="divide-y divide-border border-b border-border">
			{#each desk as item (item.title)}
				<li class="flex flex-col gap-0.5 px-3 py-3">
					<span class="text-sm font-semibold">{item.title}</span>
					<span class="text-sm text-pretty text-muted-foreground">{item.text}</span>
				</li>
			{/each}
		</ul>
	</section>
</div>
