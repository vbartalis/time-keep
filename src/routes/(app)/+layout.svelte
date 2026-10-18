<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<main class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
	{@render children()}
</main>
