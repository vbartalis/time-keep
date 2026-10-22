<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { selectClass } from '#lib/components/today/field.js';
	import { matchChoices } from './match';
	import type { PickerOption, PickerProject } from './types';

	/**
	 * Customer › project, typed into: a WAI-ARIA combobox over the hidden `projectId`,
	 * listing matches grouped under their customer. Until the script runs (and without
	 * it) it is a plain select grouped by customer. With `customers` (the template form)
	 * a customer heading is a choice too, posting `customerId` with an empty `projectId`;
	 * without the script that is a customer select above the project's.
	 */
	let {
		projects,
		value = $bindable(),
		customerId = $bindable(''),
		customers,
		id,
		describedby,
		placeholder
	}: {
		projects: PickerProject[];
		value: string;
		/** The customer chosen alone (with `customers`); a project's own when one is chosen. */
		customerId?: string;
		/** The customers that may be chosen alone, one without projects too. */
		customers?: PickerOption[];
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
	const customerLabel = (c: PickerOption) => `${c.name}${c.archived ? ' (archived)' : ''}`;

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	const chosen = $derived(projects.find((p) => p.id === value) ?? null);
	/** A customer chosen alone: no project, and a customer the form offers. */
	const chosenCustomer = $derived(
		chosen || !customers ? null : (customers.find((c) => c.id === customerId) ?? null)
	);
	const chosenText = () =>
		chosen ? label(chosen) : chosenCustomer ? customerLabel(chosenCustomer) : '';
	let query = $derived(chosenText());
	/** Typed into since it was last picked: the list narrows to the query. */
	let filtering = $state(false);
	let open = $state(false);
	/** The option the arrows are on: `p:<project id>` or `c:<customer id>`. */
	let activeId = $state<string | null>(null);

	type Choice = { key: string; project: PickerProject } | { key: string; customer: PickerOption };
	const groups = $derived(matchChoices(filtering ? query : '', projects, customers ?? []));
	const flat = $derived(
		groups.flatMap((g): Choice[] => [
			...(g.customer ? [{ key: `c:${g.customer.id}`, customer: g.customer }] : []),
			...g.projects.map((p) => ({ key: `p:${p.id}`, project: p }))
		])
	);
	const listId = $derived(`${id}-list`);
	const optionId = (key: string) => `${id}-option-${key.replace(':', '-')}`;
	/** The current choice's key, for the list to open on. */
	const currentKey = () =>
		value ? `p:${value}` : chosenCustomer ? `c:${chosenCustomer.id}` : null;

	function show(first?: string | null) {
		open = true;
		activeId = first ?? flat[0]?.key ?? null;
	}
	function close() {
		open = false;
		filtering = false;
		query = chosenText();
	}
	function pick(c: Choice) {
		if ('project' in c) {
			value = c.project.id;
			customerId = c.project.customerId;
		} else {
			value = '';
			customerId = c.customer.id;
		}
		filtering = false;
		open = false;
		query = 'project' in c ? label(c.project) : customerLabel(c.customer);
	}
	function move(by: number) {
		if (flat.length === 0) return;
		const at = flat.findIndex((c) => c.key === activeId);
		const next = at === -1 ? (by > 0 ? 0 : flat.length - 1) : (at + by + flat.length) % flat.length;
		activeId = flat[next].key;
		document.getElementById(optionId(flat[next].key))?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) show(currentKey());
			else move(e.key === 'ArrowDown' ? 1 : -1);
		} else if (e.key === 'Enter' && open && !e.ctrlKey && !e.metaKey) {
			// Enter picks; a closed list lets Enter save the form.
			e.preventDefault();
			const c = flat.find((x) => x.key === activeId);
			if (c) pick(c);
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
		// An emptied field clears the choice; anything else returns to the one picked.
		if (filtering && query.trim() === '') {
			value = '';
			customerId = '';
		}
		close();
	}
</script>

{#if hydrated}
	<div class="relative">
		<input type="hidden" name="projectId" {value} />
		{#if customers}
			<input type="hidden" name="customerId" value={chosen?.customerId ?? customerId} />
		{/if}
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
			aria-activedescendant={open && activeId ? optionId(activeId) : undefined}
			aria-invalid={describedby ? 'true' : undefined}
			aria-describedby={describedby}
			class="{selectClass} pr-9 {chosen && !filtering ? 'pl-7 lg:pl-6' : ''}"
			value={query}
			{oninput}
			{onkeydown}
			{onblur}
			onclick={() => (open ? close() : show(currentKey()))}
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
						{#if g.customer}
							{@const c = { key: `c:${g.customer.id}`, customer: g.customer }}
							<!-- The heading is the customer's own choice: the project is asked on use. -->
							<div
								id={optionId(c.key)}
								role="option"
								tabindex="-1"
								aria-selected={c.key === activeId}
								class="flex h-11 cursor-pointer items-center px-3 text-xs caps text-muted-foreground transition-colors duration-150 ease-out aria-selected:bg-accent aria-selected:text-foreground lg:h-9 lg:px-2.5"
								onmousedown={(e) => e.preventDefault()}
								onclick={() => pick(c)}
								{onkeydown}
							>
								<span id="{id}-group-{g.customerId}" class="min-w-0 truncate"
									>{g.customerName}{#if g.customer.archived}<span class="normal-case">
											(archived)</span
										>{/if}</span
								>
							</div>
						{:else}
							<div
								id="{id}-group-{g.customerId}"
								class="px-3 pt-2 pb-1 text-xs caps text-muted-foreground lg:px-2.5"
							>
								{g.customerName}
							</div>
						{/if}
						{#each g.projects as p (p.id)}
							{@const c = { key: `p:${p.id}`, project: p }}
							<div
								id={optionId(c.key)}
								role="option"
								tabindex="-1"
								aria-selected={c.key === activeId}
								class="flex h-11 cursor-pointer items-center gap-2 px-3 text-base transition-colors duration-150 ease-out aria-selected:bg-accent lg:h-9 lg:px-2.5 lg:text-sm"
								onmousedown={(e) => e.preventDefault()}
								onclick={() => pick(c)}
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
	<!-- One cell, so the form's label column keeps both selects in the field column. -->
	<div class="flex min-w-0 flex-col gap-2">
		{#if customers}
			<!-- A customer alone, without the script: its own select (left blank, a project's
		     customer is the project's). -->
			<select name="customerId" aria-label="Customer" class={selectClass}>
				<option value="" selected={customerId === ''}>No customer</option>
				{#each customers as c (c.id)}
					<option value={c.id} selected={!value && customerId === c.id}>{customerLabel(c)}</option>
				{/each}
			</select>
		{/if}
		<select
			{id}
			name="projectId"
			required={placeholder === undefined && !customers}
			class={selectClass}
			aria-invalid={describedby ? 'true' : undefined}
			aria-describedby={describedby}
		>
			<option value="" selected={value === ''}
				>{placeholder ?? (customers ? 'No project' : 'Choose a project')}</option
			>
			{#each matchChoices('', projects, []) as g (g.customerId)}
				<optgroup label={g.customerName}>
					{#each g.projects as p (p.id)}
						<option value={p.id} selected={value === p.id}
							>{p.name}{p.archived ? ' (archived)' : ''}</option
						>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
{/if}
