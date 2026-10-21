<script lang="ts">
	import { COLUMN_HEADS, type Column, type OutputRow } from '#lib/output.js';

	/**
	 * The rows as Copy writes them, in Entries' ruled table in a surface panel: the muted
	 * head band of `caps` heads, `border` hairlines, dates, times and durations in figures
	 * (Duration right-aligned). The short columns keep a name of up to 24 characters on one
	 * line (never broken at its hyphen); Description takes the rest of the width and wraps,
	 * so nothing is cut. Should the columns still not fit, the panel scrolls sideways
	 * inside itself. With the Duration column, a Total row at the foot under it.
	 */
	let { columns, rows, total }: { columns: Column[]; rows: OutputRow[]; total: string } = $props();

	const FIGURE_COLUMNS = new Set<Column>(['date', 'start', 'end', 'duration']);
	/** A short column's value up to this long stays on one line; a longer one wraps. */
	const SHORT = 24;
	const align = (column: Column) => (column === 'duration' ? 'text-right' : 'text-left');
	const cell = (column: Column, value: string) =>
		FIGURE_COLUMNS.has(column)
			? // An end on another day ("2026-09-25 01:00") may put its time under its date.
				`figures ${column === 'end' ? '' : 'whitespace-nowrap'} ${align(column)}`
			: column === 'description'
				? 'w-full min-w-48 break-words text-pretty'
				: value.length <= SHORT
					? 'whitespace-nowrap'
					: 'min-w-32 break-words';

	const head = 'h-9 border-b border-input px-2.5 align-middle text-xs caps text-muted-foreground';
	const foot = 'border-t border-foreground px-2.5 py-2 align-middle font-semibold';
	const hasDuration = $derived(columns.includes('duration'));
</script>

<div class="overflow-x-auto rounded-md border border-border bg-card" data-sheet>
	<table class="w-full border-separate border-spacing-0 text-sm">
		<thead>
			<tr class="bg-muted">
				{#each columns as column (column)}
					<th scope="col" class="{head} {align(column)} whitespace-nowrap"
						>{COLUMN_HEADS[column]}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row, i (i)}
				<!-- The last row's hairline gives way to the Total's rule or the panel's edge. -->
				<tr class="[&:last-child>td]:border-b-0">
					{#each columns as column (column)}
						{@const value = row[column]}
						{@const [date, time] = value.split(' ')}
						<td class="border-b border-border px-2.5 py-2 align-top {cell(column, value)}">
							{#if column === 'end' && time !== undefined}<span class="whitespace-nowrap"
									>{date}</span
								> <span class="whitespace-nowrap">{time}</span>{:else}{value}{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
		{#if hasDuration}
			<tfoot>
				<tr>
					{#each columns as column, i (column)}
						{#if column === 'duration'}
							<td class="{foot} text-right figures">
								{#if i === 0}<span class="sr-only">Total </span>{/if}{total}
							</td>
						{:else}
							<td class={foot}>{i === 0 ? 'Total' : ''}</td>
						{/if}
					{/each}
				</tr>
			</tfoot>
		{/if}
	</table>
</div>
