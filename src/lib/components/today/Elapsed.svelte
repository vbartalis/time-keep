<script lang="ts">
	import { onMount } from 'svelte';
	import { formatElapsed } from '#lib/format.js';

	// The server's value without JavaScript; with it, ticks every second.
	let { startAt, serverNow }: { startAt: number; serverNow: number } = $props();

	let clientNow = $state<number | null>(null);

	onMount(() => {
		clientNow = Date.now();
		const timer = setInterval(() => (clientNow = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const shown = $derived(formatElapsed((clientNow ?? serverNow) - startAt));
</script>

<span class="figures">{shown}</span>
