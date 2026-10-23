<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CardPage from '#lib/components/shell/CardPage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { errorSentence, errorTitle } from '#lib/shell.js';

	const title = $derived(errorTitle(page.status, page.error?.message ?? ''));
</script>

<svelte:head><title>{title}</title></svelte:head>

<CardPage {title}>
	<p class="text-center text-sm text-muted-foreground">
		{errorSentence(page.status, page.error?.message ?? '')}
	</p>
	<Button href={resolve('/(app)')} variant="outline" class="w-full">Back to Today</Button>
</CardPage>
