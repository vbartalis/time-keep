<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Panel from '#lib/components/admin/Panel.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { errorSentence, errorTitle } from '#lib/shell.js';
</script>

<svelte:head><title>{errorTitle(page.status, page.error?.message ?? '')}</title></svelte:head>

<!-- The header's title is the layout's (it reads the error); this is the one panel. -->
<Panel class="flex max-w-3xl flex-col items-start gap-4 p-4 lg:p-5">
	<p class="text-sm">{errorSentence(page.status)}</p>
	<Button href={resolve('/(app)')} variant="outline">Back to Today</Button>
</Panel>
