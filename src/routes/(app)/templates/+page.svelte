<script lang="ts">
	import { resolve } from '$app/paths';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { templateTimes } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const where = (t: { customerName: string | null; projectName: string | null }) =>
		t.customerName && t.projectName
			? `${t.customerName} › ${t.projectName}`
			: (t.customerName ?? t.projectName);
	const link =
		'rounded-sm font-semibold text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center';
</script>

<svelte:head><title>Templates · Time Keep</title></svelte:head>

<div class="flex flex-wrap items-end justify-end gap-x-4 gap-y-3">
	<Button href={resolve('/(app)/templates/new')} class="w-full sm:w-auto">New template</Button>
</div>

<UndoStrip flash={data.flash} back="/templates" />

{#if data.templates.length === 0}
	<div class="flex flex-col items-start gap-3 border-y border-border py-4">
		<p class="text-sm text-muted-foreground">No templates yet.</p>
		<Button href={resolve('/(app)/templates/new')} class="w-full sm:w-auto">New template</Button>
	</div>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row class="border-b border-foreground">
				<Table.Head>Name</Table.Head>
				<Table.Head class="max-md:hidden">Customer › project</Table.Head>
				<Table.Head class="max-lg:hidden">Activity</Table.Head>
				<Table.Head class="max-lg:hidden">Location</Table.Head>
				<Table.Head>Times</Table.Head>
				<Table.Head>Mark</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.templates as t (t.id)}
				{@const times = templateTimes(t)}
				<Table.Row class="border-b border-border">
					<Table.Cell class="whitespace-normal">
						<a href={resolve('/(app)/templates/[id]', { id: t.id })} class={link}>{t.name}</a>
						{#if where(t)}
							<span class="block text-sm font-normal text-muted-foreground md:hidden"
								>{where(t)}</span
							>
						{/if}
					</Table.Cell>
					<Table.Cell class="whitespace-normal max-md:hidden">{where(t) ?? ''}</Table.Cell>
					<Table.Cell class="whitespace-normal max-lg:hidden">{t.activityName ?? ''}</Table.Cell>
					<Table.Cell class="whitespace-normal max-lg:hidden">{t.locationName ?? ''}</Table.Cell>
					<Table.Cell class="whitespace-nowrap figures">{times ?? ''}</Table.Cell>
					<Table.Cell class="text-xs caps {t.runs ? 'text-live' : 'text-muted-foreground'}">
						{t.runs ? 'Timer' : 'Log'}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
