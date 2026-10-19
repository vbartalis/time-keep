<script lang="ts">
	import { enhance } from '$app/forms';
	import { warningText } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Flash } from './today/types';

	/** `back` is where `/undo` returns to: the screen this strip is on. */
	let { flash, back }: { flash: Flash | null; back: string } = $props();
</script>

{#if flash}
	<div
		role={flash.error ? 'alert' : 'status'}
		class={[
			'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-card py-2 pr-2 pl-3.5',
			flash.error ? 'border-destructive/60' : 'border-border'
		]}
	>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
			{#if flash.error}
				<p class="text-destructive">{flash.error}</p>
			{:else if flash.undone}
				<p>Undone.</p>
			{:else}
				<p class="text-pretty"><span class="font-semibold">Done:</span> {flash.label}.</p>
			{/if}
			{#each flash.warnings as warning, i (i)}
				<p class="text-irregular">{warningText(warning)}</p>
			{/each}
		</div>
		{#if flash.batchId}
			<form method="POST" action="/undo" use:enhance>
				<input type="hidden" name="batchId" value={flash.batchId} />
				<input type="hidden" name="back" value={back} />
				<Button type="submit" variant="outline">Undo</Button>
			</form>
		{/if}
	</div>
{/if}
