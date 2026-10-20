<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { warningText } from '#lib/format.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import type { FlashWarning } from '#lib/components/today/types.js';
	import type { ListRow } from './types';

	let {
		form,
		entries,
		chosen = $bindable(),
		versions,
		warnings,
		back,
		enhanced
	}: {
		/** The id of the form the checkboxes post with. */
		form: string;
		entries: ListRow[];
		/** The ids checked. */
		chosen: string[];
		/** Versions to post in place of the loaded ones: a refused selection's, as it was posted. */
		versions: Record<string, string>;
		warnings: FlashWarning[];
		back: string;
		enhanced: boolean;
	} = $props();

	const marksOf = (id: string) => warnings.filter((w) => w.subject === id);
	const edit = (id: string) =>
		`${resolve('/(app)/entries/[id]', { id })}?back=${encodeURIComponent(back)}`;
	const where = (e: ListRow) => `${e.customer} › ${e.project}`;

	const every = $derived(entries.length > 0 && chosen.length === entries.length);
	const some = $derived(chosen.length > 0 && !every);
	function toggleAll(e: Event & { currentTarget: HTMLInputElement }) {
		chosen = e.currentTarget.checked ? entries.map((r) => r.id) : [];
	}

	const box =
		'size-4.5 rounded-sm border-input align-middle accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
	const link =
		'rounded-sm text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center';
	// On the phone each row stacks beside its checkbox: date and times, customer ›
	// project, then reference and description.
	const cell = 'max-lg:col-start-2 max-lg:block max-lg:px-0 max-lg:py-0.5';
</script>

<Table.Root class="max-lg:block">
	<Table.Header class="max-lg:hidden">
		<Table.Row class="border-b border-input bg-muted hover:bg-muted">
			<Table.Head class="w-11">
				{#if enhanced}
					<input
						type="checkbox"
						class={box}
						checked={every}
						indeterminate={some}
						onchange={toggleAll}
						aria-label="Select all shown"
					/>
				{/if}
			</Table.Head>
			<Table.Head>Date</Table.Head>
			<Table.Head>In</Table.Head>
			<Table.Head>Out</Table.Head>
			<Table.Head>Hours</Table.Head>
			<Table.Head>Customer › project</Table.Head>
			<Table.Head class="max-xl:hidden">Activity</Table.Head>
			<Table.Head class="max-xl:hidden">Location</Table.Head>
			<Table.Head>Reference</Table.Head>
			<Table.Head>Description</Table.Head>
			<Table.Head class="w-11"><span class="sr-only">Restart</span></Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body class="max-lg:block">
		{#each entries as e (e.id)}
			{@const marks = marksOf(e.id)}
			<Table.Row
				class="border-b border-border hover:bg-accent max-lg:grid max-lg:grid-cols-[2.75rem_minmax(0,1fr)] max-lg:py-2"
			>
				<Table.Cell
					class="max-lg:col-start-1 max-lg:row-span-2 max-lg:row-start-1 max-lg:px-0 max-lg:py-0.5 lg:w-11"
				>
					<input
						type="checkbox"
						name="id"
						value={e.id}
						{form}
						bind:group={chosen}
						class="{box} max-lg:size-5"
						aria-label="Select {e.date} {e.in}, {where(e)}"
					/>
					<input
						type="hidden"
						name="version.{e.id}"
						value={versions[e.id] ?? String(e.version)}
						{form}
					/>
				</Table.Cell>
				<!-- The phone's first line: the date and the times together. -->
				<Table.Cell class="{cell} lg:hidden">
					<span class="flex flex-wrap items-baseline gap-x-3">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- edit() resolves it -->
						<a href={edit(e.id)} data-entry-form class="figures {link}">{e.date}</a>
						<span class="figures">{e.in}–{e.out ?? ''}</span>
						{#if e.out === null}<span class="text-xs caps text-live">Running</span>{/if}
						<span class="figures {e.out ? '' : 'text-live'}">{e.hours}</span>
					</span>
				</Table.Cell>
				<Table.Cell class="max-lg:hidden">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- edit() resolves it -->
					<a href={edit(e.id)} data-entry-form class="figures {link}">{e.date}</a>
				</Table.Cell>
				<Table.Cell class="figures max-lg:hidden">{e.in}</Table.Cell>
				{#if e.out}
					<Table.Cell class="figures max-lg:hidden">{e.out}</Table.Cell>
				{:else}
					<Table.Cell class="text-xs caps text-live max-lg:hidden">Running</Table.Cell>
				{/if}
				<Table.Cell class="figures max-lg:hidden {e.out ? '' : 'text-live'}">{e.hours}</Table.Cell>
				<Table.Cell class="{cell} whitespace-normal">
					<span class="font-semibold text-pretty">{where(e)}</span>
					{#if marks.length > 0}
						<span class="flex flex-wrap gap-1 pt-0.5">
							{#each marks as mark, i (i)}
								<Badge variant="destructive">{warningText(mark)}</Badge>
							{/each}
						</span>
					{/if}
				</Table.Cell>
				<Table.Cell class="whitespace-normal max-xl:hidden">{e.activity ?? ''}</Table.Cell>
				<Table.Cell class="whitespace-normal max-xl:hidden">{e.location ?? ''}</Table.Cell>
				<Table.Cell
					class="{cell} whitespace-normal max-lg:text-muted-foreground max-lg:empty:hidden"
					>{e.reference ?? ''}</Table.Cell
				>
				<Table.Cell
					class="{cell} text-pretty whitespace-normal max-lg:text-muted-foreground max-lg:empty:hidden"
					>{e.description ?? ''}</Table.Cell
				>
				<!-- Outside the row's links: a timer now with the entry's fields. On the phone it sits
				     under the checkbox, out of the fixed "+"'s column at the right. -->
				<Table.Cell
					class="max-lg:col-start-1 max-lg:row-span-3 max-lg:row-start-3 max-lg:p-0 lg:w-11 lg:py-0"
				>
					{#if e.out}
						<form method="POST" action={resolve('/(app)/timers/restart')} use:enhance>
							<input type="hidden" name="id" value={e.id} />
							<input type="hidden" name="back" value={back} />
							<button
								type="submit"
								title="Restart"
								aria-label="Restart {where(e)}"
								class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
								><Play class="size-3.5 fill-current" aria-hidden="true" /></button
							>
						</form>
					{/if}
				</Table.Cell>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
