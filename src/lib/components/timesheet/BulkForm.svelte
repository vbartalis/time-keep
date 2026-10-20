<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import ProjectPicker from '#lib/components/entry/ProjectPicker.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { line, selectClass } from '#lib/components/today/field.js';
	import type { BulkFailure, Chosen, FilterOptions } from './types';

	/**
	 * Edit n entries (`pc-bulk`): only what is set changes, posted with the chosen entries
	 * and the versions they were shown with as one batch. In the dialog `onDone` takes a
	 * done change's redirect, `onFailure` a refusal and `onCancel` closes it; on the page
	 * (no JavaScript) they are absent and Cancel is a link back to the table.
	 */
	let {
		choices,
		chosen,
		failure,
		back,
		query,
		onDone,
		onFailure,
		onCancel,
		pinned = false
	}: {
		choices: FilterOptions;
		chosen: Chosen[];
		failure: BulkFailure | null;
		back: string;
		/** The table's query string, so a refusal renders the same table. */
		query: string;
		onDone?: (location: string) => void;
		onFailure?: (failure: BulkFailure) => void;
		onCancel?: () => void;
		/**
		 * In the dialog or sheet: the fields scroll and Cancel and Apply hold a foot pinned
		 * to its bottom, in sight as it opens (as the filter sheet's Show).
		 */
		pinned?: boolean;
	} = $props();

	const n = $derived(chosen.length);
	const fields = $derived(failure?.action === 'apply' ? failure.fields : {});
	const refused = $derived(failure?.action === 'apply' ? failure : null);
	const value = (name: string) => (refused ? (refused.values[name] ?? '') : '');
	const err = (name: string) => (fields[name] ? `bulk-${name}-error` : undefined);

	// A remount (a reload of the refused page) starts from what was posted.
	let project = $state(value('projectId'));

	let form = $state<HTMLFormElement | null>(null);
	$effect(() => {
		if (Object.keys(fields).length > 0) {
			form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	});

	/** A redirect to `onDone`, a refusal to `onFailure`, when given; else as usual. */
	const submit: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'redirect' && onDone) return onDone(result.location);
			if (result.type === 'failure' && onFailure) return onFailure(result.data as BulkFailure);
			await update({ reset: false });
		};

	const pickers = $derived([
		{ name: 'activity', field: 'activityId', label: 'Activity', options: choices.activities },
		{ name: 'location', field: 'locationId', label: 'Location', options: choices.locations }
	]);
	const link =
		'inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-current underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9';
</script>

{#snippet fieldError(name: string)}
	{#if fields[name]}
		<p id="bulk-{name}-error" class="text-sm text-irregular lg:col-start-2">{fields[name]}</p>
	{/if}
{/snippet}

<form
	bind:this={form}
	method="POST"
	action="?/apply&{query}"
	use:enhance={submit}
	class="flex flex-col {pinned ? 'min-h-0 flex-1' : ''}"
>
	<div class={pinned ? 'min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4 lg:px-5' : ''}>
		<input type="hidden" name="back" value={back} />
		{#each chosen as c (c.id)}
			<input type="hidden" name="id" value={c.id} />
			<input type="hidden" name="version.{c.id}" value={c.version} />
		{/each}

		{#if refused}
			<div
				role="alert"
				class="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-destructive"
			>
				<p class="min-w-0 flex-1 text-pretty">{refused.error}</p>
				{#if refused.conflict}
					<!-- A full load, so the table shows the entries as they are now. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the server -->
					<a href={back} data-sveltekit-reload class={link}>Reload</a>
				{/if}
			</div>
		{/if}

		<div class={line}>
			<Label for="bulk-project">Customer › project</Label>
			<ProjectPicker
				id="bulk-project"
				projects={choices.projects}
				bind:value={project}
				placeholder="Keep as it is"
				describedby={err('projectId')}
			/>
			{@render fieldError('projectId')}
		</div>

		{#each pickers as picker (picker.name)}
			{@const set = value(picker.name) || 'keep'}
			<div class={line}>
				<Label for="bulk-{picker.name}">{picker.label}</Label>
				<select
					id="bulk-{picker.name}"
					name={picker.name}
					class={selectClass}
					aria-invalid={fields[picker.field] ? 'true' : undefined}
					aria-describedby={err(picker.field)}
				>
					<option value="keep" selected={set === 'keep'}>Keep as it is</option>
					<option value="none" selected={set === 'none'}>None</option>
					{#each picker.options as o (o.id)}
						<option value={o.id} selected={set === o.id}>{o.name}</option>
					{/each}
				</select>
				{@render fieldError(picker.field)}
			</div>
		{/each}

		<div class={line}>
			<Label for="bulk-reference">Reference</Label>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
				<Input
					id="bulk-reference"
					name="reference"
					value={value('reference')}
					placeholder="Keep as it is"
					autocomplete="off"
					class="sm:flex-1"
					aria-invalid={fields.reference ? 'true' : undefined}
					aria-describedby={err('reference')}
				/>
				<div class="flex min-h-11 items-center gap-2.5 lg:min-h-0">
					<input
						id="bulk-clear-reference"
						name="clearReference"
						type="checkbox"
						checked={value('clearReference') !== ''}
						class="size-4.5 rounded-sm accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					/>
					<Label for="bulk-clear-reference" class="font-normal">Clear it</Label>
				</div>
			</div>
			{@render fieldError('reference')}
		</div>

		<div class="{line} border-b-0">
			<span class="text-sm leading-none font-semibold">Description</span>
			<div class="grid gap-2 sm:grid-cols-2 sm:gap-4">
				<div class="flex min-w-0 flex-col gap-1.5">
					<Label for="bulk-find" class="text-xs font-normal text-muted-foreground">Find</Label>
					<Input
						id="bulk-find"
						name="find"
						value={value('find')}
						autocomplete="off"
						aria-invalid={fields.description ? 'true' : undefined}
						aria-describedby={err('description')}
					/>
				</div>
				<div class="flex min-w-0 flex-col gap-1.5">
					<Label for="bulk-replace" class="text-xs font-normal text-muted-foreground"
						>Replace with</Label
					>
					<Input id="bulk-replace" name="replace" value={value('replace')} autocomplete="off" />
				</div>
			</div>
			{@render fieldError('description')}
			<p class="text-xs text-muted-foreground lg:col-start-2">
				Only what you set changes. {n === 1
					? 'One undo puts it back.'
					: `One undo puts all ${n} back.`}
			</p>
		</div>
	</div>

	<div
		class="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border {pinned
			? 'bg-card px-4 py-3 lg:px-5'
			: 'pt-4'}"
	>
		{#if onCancel}
			<Button variant="outline" class="flex-1 sm:flex-none" onclick={onCancel}>Cancel</Button>
		{:else}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the server -->
			<Button href={back} variant="outline" class="flex-1 sm:flex-none">Cancel</Button>
		{/if}
		<Button type="submit" class="flex-1 sm:flex-none"
			>Apply to {n} {n === 1 ? 'entry' : 'entries'}</Button
		>
	</div>
</form>
