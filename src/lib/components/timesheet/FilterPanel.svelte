<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { PRESETS, type Filter, type Preset, type Scope } from '#lib/filter/filter.js';
	import { selectClass } from '#lib/components/today/field.js';
	import ScopePicker from './ScopePicker.svelte';
	import { applyForm } from './live';
	import type { FilterOptions } from './types';

	/**
	 * The filter's choices, one GET form (`id`) that works without the script (Show).
	 * With it every choice applies at once. `range` adds the time presets and Custom's From
	 * and To (the Calendar has its own period, so it passes false).
	 */
	let {
		id,
		action,
		filter,
		options,
		range,
		hints = {},
		error = null,
		clear,
		hidden,
		foot
	}: {
		id: string;
		action: string;
		filter: Scope & Partial<Pick<Filter, 'range' | 'from' | 'to'>>;
		options: FilterOptions;
		range: boolean;
		/** The presets' short ISO dates. */
		hints?: Partial<Record<Preset, string>>;
		/** The From and To fields' refusal. */
		error?: string | null;
		/** The address with every filter but the range (and the search) cleared. */
		clear: string;
		/** More hidden fields the address keeps (the Calendar's view and date). */
		hidden?: Snippet;
		/** The phone sheet's own foot in place of Clear filters and the note (or Show). */
		foot?: Snippet;
	} = $props();

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	let form = $state<HTMLFormElement | null>(null);
	// Writable: the picker sets them; a new load starts them again.
	let customer = $derived(filter.customer);
	let project = $derived(filter.project);

	const apply = async () => {
		await tick();
		if (form) await applyForm(form, { replace: false });
	};

	/** A choice applies at once: the presets, From and To, Activity and Location. */
	function onchange(e: Event) {
		const name =
			e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement
				? e.target.name
				: '';
		if (['range', 'from', 'to', 'activity', 'location'].includes(name)) void apply();
	}

	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		void apply();
	}

	const label = 'text-sm font-semibold';
	const errorId = $derived(`${id}-dates-error`);
	const optionName = (o: { name: string; archived: boolean }) =>
		`${o.name}${o.archived ? ' (archived)' : ''}`;
</script>

<form
	bind:this={form}
	{id}
	method="GET"
	{action}
	{onchange}
	{onsubmit}
	class="flex flex-col gap-4 lg:flex-row lg:gap-0"
>
	{@render hidden?.()}
	{#if range}
		<fieldset
			class="flex flex-col max-lg:grid max-lg:grid-cols-2 max-lg:gap-2 lg:w-60 lg:shrink-0 lg:border-r lg:border-border lg:p-2"
		>
			<legend class="px-2 pt-1 pb-1.5 text-xs caps text-muted-foreground max-lg:px-0"
				>Time range</legend
			>
			{#each PRESETS as p (p.preset)}
				{@render choice(p.preset, p.label, hints[p.preset] ?? '')}
			{/each}
			{@render choice('custom', 'Custom range', '')}
		</fieldset>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col gap-3 lg:p-4">
		{#if range}
			<div class="dates grid-cols-2 gap-3">
				<div class="flex flex-col gap-1.5">
					<label for="{id}-from" class={label}>From</label>
					<input
						id="{id}-from"
						type="date"
						name="from"
						value={filter.from ?? ''}
						aria-invalid={error ? 'true' : undefined}
						aria-describedby={error ? errorId : undefined}
						class="{selectClass} figures"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="{id}-to" class={label}>To</label>
					<input
						id="{id}-to"
						type="date"
						name="to"
						value={filter.to ?? ''}
						aria-invalid={error ? 'true' : undefined}
						aria-describedby={error ? errorId : undefined}
						class="{selectClass} figures"
					/>
				</div>
				{#if error}
					<p id={errorId} role="alert" class="col-span-2 text-sm text-destructive">{error}</p>
				{/if}
			</div>
		{/if}

		<div class="flex flex-col gap-1.5">
			<label for="{id}-scope" class={label}>Customer › project</label>
			<ScopePicker
				id="{id}-scope"
				projects={options.projects}
				bind:customer
				bind:project
				onpick={() => void apply()}
			/>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label for="{id}-activity" class={label}>Activity</label>
				<select id="{id}-activity" name="activity" class={selectClass}>
					<option value="" selected={filter.activity === ''}>Any</option>
					<option value="none" selected={filter.activity === 'none'}>None</option>
					{#each options.activities as a (a.id)}
						<option value={a.id} selected={filter.activity === a.id}>{optionName(a)}</option>
					{/each}
				</select>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="{id}-location" class={label}>Location</label>
				<select id="{id}-location" name="location" class={selectClass}>
					<option value="" selected={filter.location === ''}>Any</option>
					<option value="none" selected={filter.location === 'none'}>None</option>
					{#each options.locations as l (l.id)}
						<option value={l.id} selected={filter.location === l.id}>{optionName(l)}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if foot}
			{@render foot()}
		{:else}
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
				<!-- eslint-disable svelte/no-navigation-without-resolve -- an address the page resolved -->
				<a
					href={clear}
					data-sveltekit-reset="false"
					class="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
					>Clear filters</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{#if hydrated}
					<p class="ml-auto text-xs text-muted-foreground">Applied as you choose</p>
				{:else}
					<button
						type="submit"
						class="ml-auto inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-9 lg:px-3"
						>Show</button
					>
				{/if}
			</div>
		{/if}
	</div>
</form>

{#snippet choice(value: string, text: string, hint: string)}
	<label
		class="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm transition-colors duration-150 ease-out hover:bg-accent has-checked:bg-accent has-checked:font-semibold has-focus-visible:ring-2 has-focus-visible:ring-ring max-lg:flex-col max-lg:items-start max-lg:justify-center max-lg:gap-0 max-lg:rounded-md max-lg:border max-lg:border-input max-lg:bg-card max-lg:px-3 max-lg:py-1.5 max-lg:has-checked:border-foreground max-lg:has-checked:bg-accent lg:min-h-9 {value ===
		'custom'
			? 'max-lg:col-span-2'
			: ''}"
	>
		<!-- On the phone a grid of 44 px choices, two to a row, each date hint under its name:
			the box is the choice, the dot is not shown. -->
		<input
			type="radio"
			name="range"
			{value}
			checked={filter.range === value}
			class="size-4 shrink-0 accent-primary outline-none max-lg:sr-only"
		/>
		<span class="min-w-0 flex-1 max-lg:flex-none">{text}</span>
		{#if hint}<span class="shrink-0 text-xs font-normal text-muted-foreground figures">{hint}</span
			>{/if}
	</label>
{/snippet}

<style>
	/* From and To show only under Custom, with or without the script. */
	.dates {
		display: none;
	}
	form:has(input[name='range'][value='custom']:checked) .dates {
		display: grid;
	}
</style>
