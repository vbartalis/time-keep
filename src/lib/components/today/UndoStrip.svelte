<script lang="ts">
	import { enhance } from '$app/forms';
	import { warningText } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Flash } from './types';

	let { flash, error }: { flash: Flash | null; error: string | null } = $props();
</script>

{#if error}
	<div
		role="alert"
		class="rounded-md border border-destructive/60 bg-card px-3.5 py-2.5 text-sm text-destructive"
	>
		{error}
	</div>
{:else if flash}
	<div
		role="status"
		class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-card py-2 pr-2 pl-3.5"
	>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
			{#if flash.undone}
				<p>Undone.</p>
			{:else}
				<p class="text-pretty"><span class="font-semibold">Done:</span> {flash.label}.</p>
			{/if}
			{#each flash.warnings as warning, i (i)}
				<p class="text-irregular">{warningText(warning)}</p>
			{/each}
		</div>
		{#if flash.batchId}
			<form method="POST" action="?/undo" use:enhance>
				<input type="hidden" name="batchId" value={flash.batchId} />
				<Button type="submit" variant="outline">Undo</Button>
			</form>
		{/if}
	</div>
{/if}
