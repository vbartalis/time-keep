<script lang="ts">
	import type { Snippet } from 'svelte';

	let { id, title, aside }: { id: string; title: string; aside?: Snippet } = $props();
</script>

<div class="flex items-end justify-between gap-3 border-b border-foreground pb-1.5">
	<h2 {id} class="caps">{title}</h2>
	{@render aside?.()}
</div>
