<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { line, selectClass } from '#lib/components/today/field.js';
	import { narrowing } from '#lib/components/narrowing.svelte.js';
	import type { EditFailure, ProjectGroup } from '#lib/components/today/types.js';

	type Option = { id: string; name: string };
	type Choices = {
		customers: Option[];
		projects: ProjectGroup[];
		activities: Option[];
		locations: Option[];
	};

	let {
		choices,
		initial,
		version,
		failure
	}: {
		choices: Choices;
		/** The field values to start from: the template's, or blank for a new one. */
		initial: Record<string, string>;
		/** The version the form was filled from; absent for a new template. */
		version?: string;
		failure: EditFailure | null;
	} = $props();

	const saveFailure = $derived(failure?.action === 'save' ? failure : null);
	const fields = $derived(saveFailure?.fields ?? {});
	const typed = $derived(saveFailure?.values);
	const value = (name: string) => typed?.[name] ?? initial[name] ?? '';

	// Without JavaScript a mismatched customer and project are sent, and the core refuses it.
	const pick = narrowing(
		() => choices.projects,
		() => ({ customerId: value('customerId'), projectId: value('projectId') })
	);
	let zones = $state<string[]>([]);
	onMount(() => {
		try {
			zones = Intl.supportedValuesOf('timeZone');
		} catch {
			zones = [];
		}
	});

	let form = $state<HTMLFormElement | null>(null);
	// After a refused save, take the user to the first field the core refused.
	$effect(() => {
		if (saveFailure && Object.keys(fields).length > 0) {
			form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	});

	const textareaClass =
		'min-h-24 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground hover:border-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 lg:px-2.5 lg:text-sm';
</script>

{#snippet fieldError(name: string)}
	{#if fields[name]}
		<p id="{name}-error" class="text-sm text-irregular lg:col-start-2">{fields[name]}</p>
	{/if}
{/snippet}

<form bind:this={form} method="POST" action="?/save" use:enhance class="flex flex-col">
	{#if version !== undefined}<input type="hidden" name="version" value={version} />{/if}

	<div class={line}>
		<Label for="tpl-name">Name</Label>
		<Input
			id="tpl-name"
			name="name"
			required
			value={value('name')}
			autocomplete="off"
			aria-invalid={fields.name ? 'true' : undefined}
			aria-describedby={fields.name ? 'name-error' : undefined}
		/>
		{@render fieldError('name')}
	</div>

	<div class={line}>
		<Label for="tpl-customer">Customer</Label>
		<select
			id="tpl-customer"
			name="customerId"
			class={selectClass}
			bind:value={pick.customerId}
			onchange={pick.pickCustomer}
			aria-invalid={fields.customerId ? 'true' : undefined}
			aria-describedby={fields.customerId ? 'customerId-error' : undefined}
		>
			<option value="">Any customer</option>
			{#each choices.customers as o (o.id)}
				<option value={o.id}>{o.name}</option>
			{/each}
		</select>
		{@render fieldError('customerId')}
	</div>

	<div class={line}>
		<Label for="tpl-project">Project</Label>
		<select
			id="tpl-project"
			name="projectId"
			class={selectClass}
			bind:value={pick.projectId}
			onchange={pick.pickProject}
			aria-invalid={fields.projectId ? 'true' : undefined}
			aria-describedby={fields.projectId ? 'projectId-error' : undefined}
		>
			<option value="">Any project</option>
			{#each pick.projects as group (group.customerId)}
				<optgroup label={group.customerName}>
					{#each group.projects as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		{@render fieldError('projectId')}
	</div>

	{#each [{ name: 'activityId', label: 'Activity', options: choices.activities }, { name: 'locationId', label: 'Location', options: choices.locations }] as picker (picker.name)}
		<div class={line}>
			<Label for="tpl-{picker.name}">{picker.label}</Label>
			<select
				id="tpl-{picker.name}"
				name={picker.name}
				class={selectClass}
				aria-invalid={fields[picker.name] ? 'true' : undefined}
				aria-describedby={fields[picker.name] ? `${picker.name}-error` : undefined}
			>
				<option value="" selected={value(picker.name) === ''}>None</option>
				{#each picker.options as o (o.id)}
					<option value={o.id} selected={value(picker.name) === o.id}>{o.name}</option>
				{/each}
			</select>
			{@render fieldError(picker.name)}
		</div>
	{/each}

	{#each [{ name: 'startTime', label: 'Start time', type: 'time' }, { name: 'endTime', label: 'End time', type: 'time' }, { name: 'durationMinutes', label: 'Duration in minutes', type: 'number' }] as f (f.name)}
		<div class={line}>
			<Label for="tpl-{f.name}">{f.label}</Label>
			<Input
				id="tpl-{f.name}"
				name={f.name}
				type={f.type as 'time' | 'number'}
				value={value(f.name)}
				class="punch lg:max-w-48"
				min={f.type === 'number' ? 1 : undefined}
				step={f.type === 'number' ? 1 : undefined}
				inputmode={f.type === 'number' ? 'numeric' : undefined}
				aria-invalid={fields[f.name] ? 'true' : undefined}
				aria-describedby={fields[f.name] ? `${f.name}-error` : undefined}
			/>
			{@render fieldError(f.name)}
		</div>
	{/each}

	<div class={line}>
		<Label for="tpl-timeZone">Time zone</Label>
		<div class="flex flex-col gap-1">
			<Input
				id="tpl-timeZone"
				name="timeZone"
				list="tpl-zones"
				value={value('timeZone')}
				placeholder="The device's zone"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				aria-invalid={fields.timeZone ? 'true' : undefined}
				aria-describedby={fields.timeZone ? 'timeZone-error' : undefined}
			/>
			<p class="text-sm text-muted-foreground">
				Blank uses the device's zone when the template is used.
			</p>
		</div>
		<datalist id="tpl-zones">
			{#each zones as zone (zone)}<option value={zone}></option>{/each}
		</datalist>
		{@render fieldError('timeZone')}
	</div>

	<div class={line}>
		<Label for="tpl-reference">Reference</Label>
		<Input
			id="tpl-reference"
			name="reference"
			value={value('reference')}
			placeholder="Optional"
			autocomplete="off"
			aria-invalid={fields.reference ? 'true' : undefined}
			aria-describedby={fields.reference ? 'reference-error' : undefined}
		/>
		{@render fieldError('reference')}
	</div>

	<div class={line}>
		<Label for="tpl-description">Description</Label>
		<textarea
			id="tpl-description"
			name="description"
			rows="3"
			placeholder="Optional"
			class={textareaClass}
			aria-invalid={fields.description ? 'true' : undefined}
			aria-describedby={fields.description ? 'description-error' : undefined}
			>{value('description')}</textarea
		>
		{@render fieldError('description')}
	</div>

	{#if saveFailure && !saveFailure.conflict && Object.keys(fields).length > 0 && saveFailure.error}
		<p role="alert" class="pt-3 text-sm text-irregular lg:pl-[11rem]">{saveFailure.error}</p>
	{/if}

	<div class="flex flex-wrap gap-3 pt-4 lg:pl-[11rem]">
		<Button type="submit" class="flex-1 sm:flex-none">Save</Button>
		<Button href={resolve('/(app)/templates')} variant="outline" class="flex-1 sm:flex-none"
			>Cancel</Button
		>
	</div>
</form>
