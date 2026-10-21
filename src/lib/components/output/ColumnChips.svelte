<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { tick } from 'svelte';
	import { applyForm } from '#lib/components/timesheet/live.js';
	import { COLUMN_HEADS, COLUMNS, type Column } from '#lib/output.js';

	/**
	 * The ten columns as toggle chips in their fixed order, fields of the form `form`.
	 * With the script each is an `aria-pressed` button: a press shows the sheet at once
	 * (in the history entry's place), the focus staying on the chip. Without it each is a
	 * tick box sent with the form's Apply. A blank `cols` always goes first, so no box
	 * ticked reads as no column. With none on, "Choose at least one column." under them
	 * (`<form>-columns-error`); a chip never refuses a press.
	 */
	let { columns, form }: { columns: Column[]; form: string } = $props();

	// Writable: a press shows at once; a new load starts it again.
	let on = $derived<readonly Column[]>(columns);
	const boxes: Record<string, HTMLInputElement> = {};

	async function toggle(column: Column) {
		on = on.includes(column) ? on.filter((c) => c !== column) : [...on, column];
		await tick();
		const box = boxes[column];
		if (box?.form) await applyForm(box.form, { replace: true });
	}

	const chip =
		'inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors duration-150 ease-out lg:h-9';
	// The `checkbox` stroke: 3:1 on the band and the ground in both themes (WCAG 1.4.11).
	const pressed = 'border-checkbox bg-accent font-semibold text-foreground';
	const unpressed = 'border-checkbox bg-card text-muted-foreground hover:border-foreground/60';
	const errorId = $derived(`${form}-columns-error`);
</script>

<div class="flex min-w-0 flex-col gap-2">
	<input type="hidden" name="cols" value="" {form} />
	<ul aria-label="Columns" class="flex flex-wrap gap-2">
		{#each COLUMNS as column (column)}
			<li class="flex">
				<button
					type="button"
					data-js
					aria-pressed={on.includes(column)}
					onclick={() => void toggle(column)}
					class="{chip} {on.includes(column)
						? pressed
						: unpressed} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{#if on.includes(column)}<Check class="size-3.5 shrink-0" aria-hidden="true" />{/if}
					{COLUMN_HEADS[column]}
				</button>
				<label
					data-nojs
					class="{chip} cursor-pointer has-checked:font-semibold has-checked:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring {on.includes(
						column
					)
						? 'bg-accent'
						: 'bg-card'} border-checkbox text-muted-foreground"
				>
					<input
						bind:this={boxes[column]}
						type="checkbox"
						name="cols"
						value={column}
						checked={on.includes(column)}
						{form}
						class="size-4.5 rounded-sm accent-primary outline-none"
					/>
					{COLUMN_HEADS[column]}
				</label>
			</li>
		{/each}
	</ul>
	{#if on.length === 0}
		<p id={errorId} role="alert" class="text-sm text-destructive">Choose at least one column.</p>
	{/if}
</div>
