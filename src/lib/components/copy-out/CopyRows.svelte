<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { toTsv, type Column, type OutputRow } from '#lib/output.js';

	let { columns, rows }: { columns: Column[]; rows: OutputRow[] } = $props();

	// The button needs JavaScript; without it the table is selected and copied by hand.
	let enhanced = $state(false);
	onMount(() => (enhanced = true));

	/** The last copy's outcome, kept only while the same rows are shown. */
	let outcome = $state.raw<{ rows: OutputRow[]; text: string } | null>(null);
	const status = $derived(outcome?.rows === rows ? outcome.text : '');

	async function copy() {
		const shown = rows;
		outcome = null;
		try {
			await navigator.clipboard.writeText(toTsv(shown, columns));
			const n = shown.length;
			outcome = { rows: shown, text: n === 1 ? 'Copied 1 row.' : `Copied ${n} rows.` };
		} catch {
			outcome = { rows: shown, text: 'Copy failed; select the table and copy it.' };
		}
	}
</script>

{#if enhanced}
	<Button variant="outline" class="flex-1 sm:flex-none" onclick={copy}>Copy</Button>
{/if}
<p class="order-last text-sm" aria-live="polite">{status}</p>
