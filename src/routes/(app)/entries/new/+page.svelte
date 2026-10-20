<script lang="ts">
	import { resolve } from '$app/paths';
	import EntryForm from '#lib/components/entry/EntryForm.svelte';
	import type { EntryFormFailure } from '#lib/components/entry/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>New entry · Time Keep</title></svelte:head>

<div class="w-full max-w-[41rem]">
	<EntryForm
		data={{ ...data, failure: (form as EntryFormFailure | null) ?? null }}
		action={resolve('/(app)/entries/new')}
	/>
</div>
