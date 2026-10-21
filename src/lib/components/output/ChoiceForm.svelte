<script lang="ts">
	import type { Snippet } from 'svelte';
	import { applyForm } from '#lib/components/timesheet/live.js';
	import { filterQuery, type Filter } from '#lib/filter/filter.js';
	import type { Column } from '#lib/output.js';

	/**
	 * The output choice's `GET` form (`id`, `output` by default): the filter in view as hidden fields,
	 * then the chips and options it is given (`children`, or fields naming it with
	 * `form="output"`). With the script each change shows at once and Apply is hidden;
	 * without it Apply sends the form. `columns`, for a screen without chips (Reports),
	 * keeps the columns as a hidden field.
	 */
	let {
		id = 'output',
		action,
		filter,
		columns,
		class: className = '',
		children
	}: {
		/** The form's id, which its fields name with `form=`. */
		id?: string;
		action: string;
		filter: Filter;
		columns?: Column[];
		class?: string;
		children: Snippet;
	} = $props();

	const kept = $derived([...new URLSearchParams(filterQuery(filter))]);

	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (e.currentTarget instanceof HTMLFormElement)
			void applyForm(e.currentTarget, { replace: true });
	}
</script>

<form {id} method="GET" {action} {onsubmit} class={className}>
	{#each kept as [name, value], i (i)}
		<input type="hidden" {name} {value} />
	{/each}
	{#if columns}
		<input type="hidden" name="cols" value={columns.join(',')} />
	{/if}
	{@render children()}
	<div data-nojs>
		<button
			type="submit"
			class="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-9 lg:px-3"
			>Apply</button
		>
	</div>
</form>
