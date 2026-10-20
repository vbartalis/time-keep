<script lang="ts">
	import { resolve } from '$app/paths';
	import SectionHead from './SectionHead.svelte';
	import TemplateSheet from './TemplateSheet.svelte';
	import type { ActionFailure, ProjectGroup, TemplateCard } from './types';

	let {
		templates,
		projects,
		failure
	}: { templates: TemplateCard[]; projects: ProjectGroup[]; failure: ActionFailure | null } =
		$props();

	const link =
		'rounded-sm text-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center';
</script>

<section aria-labelledby="templates-heading">
	<SectionHead id="templates-heading" title="Templates">
		{#snippet aside()}
			<!-- Out of the phone's "+" column. -->
			<a href={resolve('/(app)/templates')} class="{link} max-lg:mr-14">Edit templates</a>
		{/snippet}
	</SectionHead>
	{#if templates.length === 0}
		<p class="border-b border-border px-3 py-3 text-sm text-muted-foreground">
			Templates are set up on the PC.
			<a href={resolve('/(app)/templates/new')} class={link}>Create a template</a>
		</p>
	{:else}
		{#each templates as template (template.id)}
			<TemplateSheet {template} {projects} {failure} />
		{/each}
	{/if}
</section>
