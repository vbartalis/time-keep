<script lang="ts">
	import { choiceQuery, type OutputChoice } from '#lib/filter/output.js';

	/**
	 * The choice in view (columns and options) as hidden fields, all four names, so a
	 * form that shows another part of the view (the filter's) keeps it: on Reports too,
	 * which never resets Copy-out's kept columns.
	 */
	let { choice }: { choice: OutputChoice } = $props();

	const fields = $derived([...new URLSearchParams(choiceQuery(choice))]);
</script>

{#each fields as [name, value] (name)}
	<input type="hidden" {name} {value} />
{/each}
