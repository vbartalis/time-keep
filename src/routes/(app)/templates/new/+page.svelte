<script lang="ts">
	import TemplateForm from '#lib/components/templates/TemplateForm.svelte';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import type { EditFailure } from '#lib/components/today/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failure = $derived(form && 'error' in form ? (form as EditFailure) : null);
</script>

<svelte:head><title>New template · Time Keep</title></svelte:head>

<h1 class="text-xl font-semibold tracking-[-0.01em]">New template</h1>

{#if failure && Object.keys(failure.fields).length === 0}
	<div
		role="alert"
		class="rounded-md border border-destructive/60 bg-card py-2 pr-2 pl-3.5 text-sm text-destructive"
	>
		<p class="text-pretty">{failure.error}</p>
	</div>
{/if}

<section aria-labelledby="template-heading">
	<SectionHead id="template-heading" title="Template" />
	<TemplateForm choices={data.choices} initial={{}} {failure} />
</section>
