<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	/**
	 * The surface panel (4 px corners, `border` stroke) from `lg`, on the ground edge to edge
	 * below, ruled above and under: `PanelSection`'s, and the error page's in the shell.
	 * `class` adds the inside's layout and padding.
	 */
	let { class: className, children }: { class?: ClassValue; children: Snippet } = $props();
</script>

<div class={['-mx-4 border-y border-border lg:mx-0 lg:rounded-md lg:border lg:bg-card', className]}>
	{@render children()}
</div>
