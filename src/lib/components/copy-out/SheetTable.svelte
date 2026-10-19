<script lang="ts">
	import * as Table from '#lib/components/ui/table/index.js';
	import { COLUMN_HEADS, type Column, type OutputRow } from '#lib/output.js';

	let { columns, rows }: { columns: Column[]; rows: OutputRow[] } = $props();

	/** Dates, times and durations are punched; the text columns wrap. */
	const PUNCHED = new Set<Column>(['date', 'start', 'end', 'duration']);
	const cell = (column: Column) =>
		PUNCHED.has(column)
			? 'punch'
			: column === 'description'
				? 'min-w-48 whitespace-normal text-pretty'
				: 'min-w-28 whitespace-normal';
</script>

<!-- The sheet: it never stacks; at any width it scrolls sideways inside its own box. -->
<Table.Root>
	<Table.Header>
		<Table.Row class="border-b border-input bg-muted hover:bg-muted">
			{#each columns as column (column)}
				<Table.Head>{COLUMN_HEADS[column]}</Table.Head>
			{/each}
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each rows as row, i (i)}
			<Table.Row class="border-b border-border hover:bg-accent">
				{#each columns as column (column)}
					<Table.Cell class={cell(column)}>{row[column]}</Table.Cell>
				{/each}
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
