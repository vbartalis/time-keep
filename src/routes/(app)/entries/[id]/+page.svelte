<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import SectionHead from '#lib/components/today/SectionHead.svelte';
	import { line, selectClass } from '#lib/components/today/field.js';
	import type { EditFailure } from '#lib/components/today/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const entry = $derived(data.entry);
	const failure = $derived(form && 'error' in form ? (form as EditFailure) : null);
	const confirming = $derived(form !== null && 'confirm' in form && form.confirm === true);
	const saveFailure = $derived(failure?.action === 'save' ? failure : null);
	const fields = $derived(saveFailure?.fields ?? {});
	const typed = $derived(saveFailure?.values);
	// A refused or confirming form keeps the version it was posted with (no-JS reloads).
	const version = $derived(
		failure?.values?.version ??
			(confirming && form && 'version' in form ? form.version : undefined) ??
			String(entry.version)
	);
	const templateFailure = $derived(failure?.action === 'saveAsTemplate' ? failure : null);
	const nameError = $derived(templateFailure?.fields.name);
	const value = (name: string, fallback: string | null) => typed?.[name] ?? fallback ?? '';

	// A refused or confirming form keeps `back` too: the posted URL has no query string.
	const back = $derived(
		failure?.back ?? (confirming && form && 'back' in form ? form.back : undefined) ?? data.back
	);
	const entryPath = $derived(resolve('/(app)/entries/[id]', { id: entry.id }));
	const here = $derived(back === '/' ? entryPath : `${entryPath}?back=${encodeURIComponent(back)}`);
	const backLabel = $derived(back.startsWith('/entries') ? 'Back to Entries' : 'Back to Today');
	const zones = $derived(
		entry.endZone && entry.endZone !== entry.startZone
			? `Start in ${entry.startZone}, end in ${entry.endZone}.`
			: `Times in ${entry.startZone}.`
	);

	let editForm = $state<HTMLFormElement | null>(null);
	let templateName = $state<HTMLInputElement | null>(null);
	let confirmButton = $state<HTMLButtonElement | null>(null);

	// After a refused save, take the user to the first field the core refused.
	$effect(() => {
		if (saveFailure && Object.keys(fields).length > 0) {
			editForm?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	});
	// A refused template save reopens the disclosure (by attribute, so it works without
	// JavaScript); with JavaScript the field also takes the focus, as `autofocus` only acts on load.
	$effect(() => {
		if (templateFailure) templateName?.focus();
	});
	// The confirm step replaces the delete button; keep the focus on it.
	$effect(() => {
		if (confirming) confirmButton?.focus();
	});

	const textareaClass =
		'min-h-24 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground hover:border-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 lg:px-2.5 lg:text-sm';
</script>

<svelte:head><title>Edit entry · Time Keep</title></svelte:head>

{#snippet fieldError(name: string)}
	{#if fields[name]}
		<p id="{name}-error" class="text-sm text-irregular lg:col-start-2">{fields[name]}</p>
	{/if}
{/snippet}

<div class="flex flex-col gap-1">
	<p class="text-sm font-semibold text-pretty">{entry.label}</p>
	<p class="text-sm text-muted-foreground">{zones}</p>
</div>

{#if failure && (failure.conflict || failure.gone || Object.keys(failure.fields).length === 0)}
	<div
		role="alert"
		class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card py-2 pr-2 pl-3.5 text-sm text-destructive"
	>
		<p class="min-w-0 flex-1 text-pretty">{failure.error}</p>
		{#if failure.gone}
			<Button href={back} variant="outline">{backLabel}</Button>
		{:else if failure.conflict}
			<!-- A full load, so the form takes the entry as it is now. -->
			<Button href={here} variant="outline" data-sveltekit-reload>Reload</Button>
		{/if}
	</div>
{/if}

<section aria-labelledby="edit-heading">
	<SectionHead id="edit-heading" title="Entry" />
	<form bind:this={editForm} method="POST" action="?/save" use:enhance class="flex flex-col">
		<input type="hidden" name="version" value={version} />
		<input type="hidden" name="back" value={back} />

		<div class={line}>
			<Label for="edit-start">Start</Label>
			<Input
				id="edit-start"
				name="start"
				type="datetime-local"
				required
				value={value('start', entry.start)}
				aria-invalid={fields.start ? 'true' : undefined}
				aria-describedby={fields.start ? 'start-error' : undefined}
			/>
			{@render fieldError('start')}
		</div>

		<div class={line}>
			<Label for="edit-end">End</Label>
			<div class="flex flex-col gap-1">
				<Input
					id="edit-end"
					name="end"
					type="datetime-local"
					value={value('end', entry.end)}
					aria-invalid={fields.end ? 'true' : undefined}
					aria-describedby={fields.end ? 'end-error end-hint' : 'end-hint'}
				/>
				<p id="end-hint" class="text-sm text-muted-foreground">
					{entry.running
						? 'Running. Give an end to stop it.'
						: 'Clear it to make the entry running again.'}
				</p>
			</div>
			{@render fieldError('end')}
		</div>

		<div class={line}>
			<Label for="edit-project">Project</Label>
			<select
				id="edit-project"
				name="projectId"
				required
				class={selectClass}
				aria-invalid={fields.projectId ? 'true' : undefined}
				aria-describedby={fields.projectId ? 'projectId-error' : undefined}
			>
				{#each data.projects as group (group.customerId)}
					<optgroup label={group.customerName}>
						{#each group.projects as p (p.id)}
							<option value={p.id} selected={value('projectId', entry.projectId) === p.id}
								>{p.name}</option
							>
						{/each}
					</optgroup>
				{/each}
			</select>
			{@render fieldError('projectId')}
		</div>

		{#each [{ name: 'activityId', label: 'Activity', options: data.activities, current: entry.activityId }, { name: 'locationId', label: 'Location', options: data.locations, current: entry.locationId }] as picker (picker.name)}
			<div class={line}>
				<Label for="edit-{picker.name}">{picker.label}</Label>
				<select
					id="edit-{picker.name}"
					name={picker.name}
					class={selectClass}
					aria-invalid={fields[picker.name] ? 'true' : undefined}
					aria-describedby={fields[picker.name] ? `${picker.name}-error` : undefined}
				>
					<option value="" selected={value(picker.name, picker.current) === ''}>None</option>
					{#each picker.options as o (o.id)}
						<option value={o.id} selected={value(picker.name, picker.current) === o.id}
							>{o.name}</option
						>
					{/each}
				</select>
				{@render fieldError(picker.name)}
			</div>
		{/each}

		<div class={line}>
			<Label for="edit-reference">Reference</Label>
			<Input
				id="edit-reference"
				name="reference"
				value={value('reference', entry.reference)}
				placeholder="Optional"
				autocomplete="off"
				aria-invalid={fields.reference ? 'true' : undefined}
				aria-describedby={fields.reference ? 'reference-error' : undefined}
			/>
			{@render fieldError('reference')}
		</div>

		<div class={line}>
			<Label for="edit-description">Description</Label>
			<textarea
				id="edit-description"
				name="description"
				rows="3"
				placeholder="Optional"
				class={textareaClass}
				aria-invalid={fields.description ? 'true' : undefined}
				aria-describedby={fields.description ? 'description-error' : undefined}
				>{value('description', entry.description)}</textarea
			>
			{@render fieldError('description')}
		</div>

		{#if saveFailure && !saveFailure.conflict && Object.keys(fields).length > 0 && saveFailure.error}
			<p role="alert" class="pt-3 text-sm text-irregular lg:pl-[11rem]">{saveFailure.error}</p>
		{/if}

		<div class="flex flex-wrap gap-3 pt-4 lg:pl-[11rem]">
			<Button type="submit" class="flex-1 sm:flex-none">Save</Button>
			<Button href={back} variant="outline" class="flex-1 sm:flex-none">Cancel</Button>
		</div>
	</form>
</section>

<section aria-labelledby="template-heading" class="pt-4">
	<SectionHead id="template-heading" title="Template" />
	<details open={templateFailure !== null} class="group/template pt-3">
		<summary
			class="flex h-11 w-fit cursor-pointer list-none items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
			>Save as template</summary
		>
		<form method="POST" action="?/saveAsTemplate" use:enhance class="flex flex-col pt-1">
			<input type="hidden" name="back" value={back} />
			<div class={line}>
				<Label for="template-name">Name</Label>
				<Input
					bind:ref={templateName}
					id="template-name"
					name="name"
					required
					autocomplete="off"
					autofocus={templateFailure !== null}
					value={templateFailure?.values?.name ?? ''}
					aria-invalid={nameError ? 'true' : undefined}
					aria-describedby={nameError ? 'name-error' : undefined}
				/>
				{#if nameError}
					<p id="name-error" class="text-sm text-irregular lg:col-start-2">{nameError}</p>
				{/if}
			</div>
			<div class="pt-4 lg:pl-[11rem]">
				<Button type="submit" variant="outline" class="w-full sm:w-auto">Save template</Button>
			</div>
		</form>
	</details>
</section>

<section aria-labelledby="delete-heading" class="pt-4">
	<SectionHead id="delete-heading" title="Delete" />
	{#if confirming}
		<form method="POST" action="?/delete" use:enhance class="flex flex-col gap-3 pt-3">
			<input type="hidden" name="version" value={version} />
			<input type="hidden" name="back" value={back} />
			<input type="hidden" name="confirm" value="yes" />
			<p class="text-sm text-pretty">
				Delete this entry? You can undo it from {back.startsWith('/entries') ? 'Entries' : 'Today'}.
			</p>
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
			<input type="hidden" name="back" value={back} />
			<Button type="submit" variant="destructive" class="w-full sm:w-auto">Delete entry</Button>
		</form>
	{/if}
</section>
