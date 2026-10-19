<script lang="ts">
	import SectionHead from './SectionHead.svelte';
	import TemplateSheet from './TemplateSheet.svelte';
	import type { ActionFailure, ProjectGroup, TemplateCard } from './types';

	let {
		templates,
		projects,
		failure
	}: { templates: TemplateCard[]; projects: ProjectGroup[]; failure: ActionFailure | null } =
		$props();
</script>

<section aria-labelledby="templates-heading">
	<SectionHead id="templates-heading" title="Templates" />
	{#if templates.length === 0}
		<p class="border-b border-border px-3 py-3 text-sm text-muted-foreground">
			Templates are set up on the PC.
		</p>
	{:else}
		{#each templates as template (template.id)}
			<TemplateSheet {template} {projects} {failure} />
		{/each}
	{/if}
</section>
