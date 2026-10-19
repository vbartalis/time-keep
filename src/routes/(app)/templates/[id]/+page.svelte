<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import TemplateForm from '#lib/components/templates/TemplateForm.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import type { EditFailure } from '#lib/components/today/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const template = $derived(data.template);
	const failure = $derived(form && 'error' in form ? (form as EditFailure) : null);
	const confirming = $derived(form !== null && 'confirm' in form && form.confirm === true);
	// A refused or confirming form keeps the version it was posted with (no-JS reloads).
	const version = $derived(
		failure?.values?.version ??
			(confirming && form && 'version' in form ? form.version : undefined) ??
			String(template.version)
	);
	const here = $derived(resolve('/(app)/templates/[id]', { id: template.id }));

	let confirmButton = $state<HTMLButtonElement | null>(null);
	// The confirm step replaces the delete button; keep the focus on it.
	$effect(() => {
		if (confirming) confirmButton?.focus();
	});
</script>

<svelte:head><title>Edit template · Time Keep</title></svelte:head>

<h1 class="text-xl font-semibold tracking-[-0.01em]">Edit template</h1>

{#if failure && (failure.conflict || failure.gone || Object.keys(failure.fields).length === 0)}
	<div
		role="alert"
		class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card py-2 pr-2 pl-3.5 text-sm text-destructive"
	>
		<p class="min-w-0 flex-1 text-pretty">{failure.error}</p>
		{#if failure.gone}
			<Button href={resolve('/(app)/templates')} variant="outline">Back to templates</Button>
		{:else if failure.conflict}
			<!-- A full load, so the form takes the template as it is now. -->
			<Button href={here} variant="outline" data-sveltekit-reload>Reload</Button>
		{/if}
	</div>
{/if}

<section aria-labelledby="template-heading">
	<SectionHead id="template-heading" title="Template" />
	<TemplateForm choices={data.choices} initial={template.values} {version} {failure} />
</section>

<section aria-labelledby="delete-heading" class="pt-4">
	<SectionHead id="delete-heading" title="Delete" />
	{#if confirming}
		<form method="POST" action="?/delete" use:enhance class="flex flex-col gap-3 pt-3">
			<input type="hidden" name="version" value={version} />
			<input type="hidden" name="confirm" value="yes" />
			<p class="text-sm text-pretty">Delete this template? You can undo it from Templates.</p>
			<div class="flex flex-wrap gap-3">
				<Button
					bind:ref={confirmButton}
					type="submit"
					variant="destructive"
					class="flex-1 sm:flex-none">Yes, delete it</Button
				>
				<Button href={here} variant="outline" class="flex-1 sm:flex-none">Keep it</Button>
			</div>
		</form>
	{:else}
		<form method="POST" action="?/delete" use:enhance class="pt-3">
			<input type="hidden" name="version" value={version} />
			<Button type="submit" variant="destructive" class="w-full sm:w-auto">Delete template</Button>
		</form>
	{/if}
</section>
