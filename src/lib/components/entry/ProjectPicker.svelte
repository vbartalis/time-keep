<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { selectClass } from '#lib/components/today/field.js';
	import { matchProjects } from './match';
	import type { PickerProject } from './types';

	/**
	 * Customer › project, typed into: a WAI-ARIA combobox over the hidden `projectId`,
	 * listing matches grouped under their customer. Until the script runs (and without
	 * it) it is a plain select grouped by customer.
	 */
	let {
		projects,
		value = $bindable(),
		id,
		describedby,
		placeholder
	}: {
		projects: PickerProject[];
		value: string;
		id: string;
		/** The refusal's id, when the field is refused. */
		describedby?: string;
		/** What no project means here (the bulk form's "Keep as it is"); then none is allowed. */
		placeholder?: string;
	} = $props();

	// Whole class names, so Tailwind sees them.
	const DOTS = [
		'bg-project-1',
		'bg-project-2',
		'bg-project-3',
		'bg-project-4',
		'bg-project-5',
		'bg-project-6',
		'bg-project-7',
		'bg-project-8'
	];
	const dot = (p: PickerProject) => DOTS[(p.colour - 1) % DOTS.length] ?? DOTS[0];
	const label = (p: PickerProject) =>
		`${p.customerName} › ${p.name}${p.archived ? ' (archived)' : ''}`;

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	const chosen = $derived(projects.find((p) => p.id === value) ?? null);
	let query = $derived(chosen ? label(chosen) : '');
	/** Typed into since it was last picked: the list narrows to the query. */
	let filtering = $state(false);
	let open = $state(false);
	let activeId = $state<string | null>(null);

	const groups = $derived(matchProjects(filtering ? query : '', projects));
	const flat = $derived(groups.flatMap((g) => g.projects));
	const listId = $derived(`${id}-list`);
	const optionId = (p: PickerProject) => `${id}-option-${p.id}`;

	function show(first?: string | null) {
		open = true;
		activeId = first ?? flat[0]?.id ?? null;
	}
	function close() {
		open = false;
		filtering = false;
		query = chosen ? label(chosen) : '';
	}
	function pick(p: PickerProject) {
		value = p.id;
		filtering = false;
		open = false;
		query = label(p);
	}
	function move(by: number) {
		if (flat.length === 0) return;
		const at = flat.findIndex((p) => p.id === activeId);
		const next = at === -1 ? (by > 0 ? 0 : flat.length - 1) : (at + by + flat.length) % flat.length;
		activeId = flat[next].id;
		document.getElementById(optionId(flat[next]))?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) show(value || null);
			else move(e.key === 'ArrowDown' ? 1 : -1);
		} else if (e.key === 'Enter' && open && !e.ctrlKey && !e.metaKey) {
			// Enter picks; a closed list lets Enter save the form.
			e.preventDefault();
			const p = flat.find((x) => x.id === activeId);
			if (p) pick(p);
			else close();
		} else if (e.key === 'Escape' && open) {
			// Closes the list, not the form around it.
			e.preventDefault();
			e.stopPropagation();
			close();
		}
	}

	function oninput(e: Event & { currentTarget: HTMLInputElement }) {
		query = e.currentTarget.value;
		filtering = true;
		show();
	}

	function onblur() {
		// An emptied field clears the project; anything else returns to the one picked.
		if (filtering && query.trim() === '') value = '';
		close();
	}
</script>

{#if hydrated}
	<div class="relative">
		<input type="hidden" name="projectId" {value} />
		{#if chosen && !filtering}
			<span
				class="pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full lg:left-2.5 {dot(
					chosen
				)}"
				aria-hidden="true"
			></span>
		{/if}
		<input
			{id}
			type="text"
			role="combobox"
			autocomplete="off"
			aria-autocomplete="list"
			placeholder={placeholder ?? 'Type a customer or project'}
			aria-expanded={open}
			aria-controls={listId}
			aria-activedescendant={open && activeId ? `${id}-option-${activeId}` : undefined}
			aria-invalid={describedby ? 'true' : undefined}
			aria-describedby={describedby}
			class="{selectClass} pr-9 {chosen && !filtering ? 'pl-7 lg:pl-6' : ''}"
			value={query}
			{oninput}
			{onkeydown}
			{onblur}
			onclick={() => (open ? close() : show(value || null))}
			onfocus={(e) => e.currentTarget.select()}
		/>
		<ChevronDown
			class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		{#if open}
			<div
				id={listId}
				role="listbox"
				aria-label="Customer › project"
				class="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-card py-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
			>
				{#each groups as g (g.customerId)}
					<div role="group" aria-labelledby="{id}-group-{g.customerId}">
						<div
							id="{id}-group-{g.customerId}"
							class="px-3 pt-2 pb-1 text-xs caps text-muted-foreground lg:px-2.5"
						>
							{g.customerName}
						</div>
						{#each g.projects as p (p.id)}
							<div
								id={optionId(p)}
								role="option"
								tabindex="-1"
								aria-selected={p.id === activeId}
								class="flex h-11 cursor-pointer items-center gap-2 px-3 text-base transition-colors duration-150 ease-out aria-selected:bg-accent lg:h-9 lg:px-2.5 lg:text-sm"
								onmousedown={(e) => e.preventDefault()}
								onclick={() => pick(p)}
								{onkeydown}
							>
								<span class="size-2 shrink-0 rounded-full {dot(p)}" aria-hidden="true"></span>
								<span class="min-w-0 truncate"
									>{p.name}{#if p.archived}<span class="text-muted-foreground">
											(archived)</span
										>{/if}</span
								>
							</div>
						{/each}
					</div>
				{:else}
					<p class="px-3 py-2 text-sm text-muted-foreground lg:px-2.5">No project matches.</p>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<select
		{id}
		name="projectId"
		required={placeholder === undefined}
		class={selectClass}
		aria-invalid={describedby ? 'true' : undefined}
		aria-describedby={describedby}
	>
		<option value="" selected={value === ''}>{placeholder ?? 'Choose a project'}</option>
		{#each matchProjects('', projects) as g (g.customerId)}
			<optgroup label={g.customerName}>
				{#each g.projects as p (p.id)}
					<option value={p.id} selected={value === p.id}
						>{p.name}{p.archived ? ' (archived)' : ''}</option
					>
				{/each}
			</optgroup>
		{/each}
	</select>
{/if}
