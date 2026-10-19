<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { line, selectClass } from '#lib/components/today/field.js';
	import type { ProjectGroup } from '#lib/components/today/types.js';
	import type { BulkFailure, Option } from './types';

	let {
		id,
		choices,
		failure,
		query,
		back,
		count,
		enhanced
	}: {
		/** The form's id: the list's checkboxes post with it through their `form` attribute. */
		id: string;
		choices: { projects: ProjectGroup[]; activities: Option[]; locations: Option[] };
		failure: BulkFailure | null;
		/** The search's query string, appended to the action so a refusal renders the same search. */
		query: string;
		back: string;
		/** How many entries are selected; only known once the script runs. */
		count: number;
		enhanced: boolean;
	} = $props();

	const fields = $derived(failure?.action === 'apply' ? failure.fields : {});
	const value = (name: string) => failure?.values[name] ?? '';
	const none = $derived(enhanced && count === 0);

	let form = $state<HTMLFormElement | null>(null);
	$effect(() => {
		if (Object.keys(fields).length > 0) {
			form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	});

	/** A done change clears the form, as a full reload would; the confirm step keeps it. */
	const keep: SubmitFunction =
		({ formElement }) =>
		async ({ result, update }) => {
			if (result.type === 'redirect') formElement.reset();
			await update({ reset: false });
		};
</script>

{#snippet fieldError(name: string)}
	{#if fields[name]}
		<p id="change-{name}-error" class="text-sm text-irregular lg:col-start-2">{fields[name]}</p>
	{/if}
{/snippet}

<form
	{id}
	bind:this={form}
	method="POST"
	action="?/apply&{query}"
	use:enhance={keep}
	class="flex flex-col"
>
	<input type="hidden" name="back" value={back} />

	<div class={line}>
		<Label for="change-project">Project</Label>
		<select
			id="change-project"
			name="projectId"
			class={selectClass}
			aria-invalid={fields.projectId ? 'true' : undefined}
			aria-describedby={fields.projectId ? 'change-projectId-error' : undefined}
		>
			<option value="" selected={value('projectId') === ''}>Keep</option>
			{#each choices.projects as group (group.customerId)}
				<optgroup label={group.customerName}>
					{#each group.projects as p (p.id)}
						<option value={p.id} selected={value('projectId') === p.id}>{p.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		{@render fieldError('projectId')}
	</div>

	{#each [{ name: 'activity', field: 'activityId', label: 'Activity', options: choices.activities }, { name: 'location', field: 'locationId', label: 'Location', options: choices.locations }] as picker (picker.name)}
		{@const chosen = value(picker.name) || 'keep'}
		<div class={line}>
			<Label for="change-{picker.name}">{picker.label}</Label>
			<select
				id="change-{picker.name}"
				name={picker.name}
				class={selectClass}
				aria-invalid={fields[picker.field] ? 'true' : undefined}
				aria-describedby={fields[picker.field] ? `change-${picker.field}-error` : undefined}
			>
				<option value="keep" selected={chosen === 'keep'}>Keep</option>
				<option value="none" selected={chosen === 'none'}>None</option>
				{#each picker.options as o (o.id)}
					<option value={o.id} selected={chosen === o.id}>{o.name}</option>
				{/each}
			</select>
			{@render fieldError(picker.field)}
		</div>
	{/each}

	<div class={line}>
		<Label for="change-reference">Reference</Label>
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
			<Input
				id="change-reference"
				name="reference"
				value={value('reference')}
				placeholder="Blank keeps it"
				autocomplete="off"
				class="sm:flex-1"
				aria-invalid={fields.reference ? 'true' : undefined}
				aria-describedby={fields.reference ? 'change-reference-error' : undefined}
			/>
			<div class="flex min-h-11 items-center gap-2.5 lg:min-h-0">
				<input
					id="change-clear-reference"
					name="clearReference"
					type="checkbox"
					checked={value('clearReference') !== ''}
					class="size-4.5 rounded-sm border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				/>
				<Label for="change-clear-reference" class="font-normal">Clear the reference</Label>
			</div>
		</div>
		{@render fieldError('reference')}
	</div>

	<div class={line}>
		<span class="text-sm leading-none font-semibold">Description</span>
		<div class="grid gap-2 sm:grid-cols-2 sm:gap-4">
			<div class="flex min-w-0 flex-col gap-1.5">
				<Label for="change-find" class="font-normal text-muted-foreground">Find</Label>
				<Input
					id="change-find"
					name="find"
					value={value('find')}
					autocomplete="off"
					aria-invalid={fields.description ? 'true' : undefined}
					aria-describedby={fields.description ? 'change-description-error' : undefined}
				/>
			</div>
			<div class="flex min-w-0 flex-col gap-1.5">
				<Label for="change-replace" class="font-normal text-muted-foreground">Replace with</Label>
				<Input id="change-replace" name="replace" value={value('replace')} autocomplete="off" />
			</div>
		</div>
		{@render fieldError('description')}
	</div>

	<div class="flex flex-wrap items-center gap-3 pt-4 lg:pl-[11rem]">
		<Button type="submit" disabled={none} class="flex-1 sm:flex-none">Apply to selected</Button>
		<Button
			type="submit"
			variant="outline"
			formaction="?/delete&{query}"
			disabled={none}
			class="flex-1 sm:flex-none">Delete selected</Button
		>
	</div>
</form>
