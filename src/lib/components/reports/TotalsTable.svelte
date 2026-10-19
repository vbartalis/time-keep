<script lang="ts">
	import * as Table from '#lib/components/ui/table/index.js';
	import SectionHead from '#lib/components/today/SectionHead.svelte';

	let {
		id,
		title,
		rows,
		total,
		punched = false
	}: {
		/** The title's id: the section is named by it. */
		id: string;
		title: string;
		rows: { key: string; label: string; duration: string }[];
		total: string;
		/** The labels are dates, so they are punched. */
		punched?: boolean;
	} = $props();
</script>

<section aria-labelledby={id}>
	<SectionHead {id} {title} />
	<Table.Root>
		<Table.Header class="sr-only">
			<Table.Row>
				<Table.Head>{title}</Table.Head>
				<Table.Head>Total</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each rows as row (row.key)}
				<Table.Row class="border-b border-border hover:bg-accent">
					<Table.Cell class={punched ? 'punch whitespace-normal' : 'whitespace-normal'}
						>{row.label}</Table.Cell
					>
					<Table.Cell class="text-right punch">{row.duration}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
		<Table.Footer class="bg-transparent">
			<Table.Row class="border-t border-foreground">
				<Table.Cell class="font-semibold">Total</Table.Cell>
				<Table.Cell class="text-right punch font-semibold">{total}</Table.Cell>
			</Table.Row>
		</Table.Footer>
	</Table.Root>
</section>
