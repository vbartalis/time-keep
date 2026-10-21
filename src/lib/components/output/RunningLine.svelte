<script lang="ts">
	/** The running entries the rows leave out, in muted 14 px; nothing while none run. */
	let { running }: { running: number } = $props();
</script>

{#if running > 0}
	<p class="text-sm text-muted-foreground">
		{running === 1 ? '1 running entry left out.' : `${running} running entries left out.`}
	</p>
{/if}
