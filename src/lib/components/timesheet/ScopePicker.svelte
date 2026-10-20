<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { matchProjects } from '#lib/components/entry/match.js';
	import type { PickerProject } from '#lib/components/entry/types.js';
	import { selectClass } from '#lib/components/today/field.js';

	/**
	 * The filter's Customer › project: item 12's picker, typed into, whose list also offers
	 * each customer's heading ("Acme, all projects") and "Any" first. It holds the hidden
	 * `customer` and `project` fields. Without the script, a select of `scope` choices
	 * (`customer:<id>`, `project:<id>`) grouped by customer.
	 */
	let {
		projects,
		customer = $bindable(),
		project = $bindable(),
		id,
		onpick
	}: {
		projects: PickerProject[];
		customer: string;
		project: string;
		id: string;
		/** After a choice, once the hidden fields hold it. */
		onpick?: () => void;
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
	const dot = (colour: number) => DOTS[(colour - 1) % DOTS.length] ?? DOTS[0];
	const archived = ' (archived)';

	type Option =
		| { kind: 'any'; key: string; label: string }
		| { kind: 'customer'; key: string; id: string; label: string; archived: boolean }
		| { kind: 'project'; key: string; project: PickerProject; label: string };

	const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
	/** A customer is archived for the list when every project under it is. */
	const customerArchived = (customerId: string) =>
		projects.filter((p) => p.customerId === customerId).every((p) => p.archived);
	const customerLabel = (customerId: string, name: string) =>
		`${name}, all projects${customerArchived(customerId) ? archived : ''}`;
	const projectLabel = (p: PickerProject) =>
		`${p.customerName} › ${p.name}${p.archived ? archived : ''}`;

	const chosenProject = $derived(projects.find((p) => p.id === project) ?? null);
	const chosenCustomer = $derived(
		chosenProject ? null : (projects.find((p) => p.customerId === customer) ?? null)
	);
	const chosenLabel = $derived(
		chosenProject
			? projectLabel(chosenProject)
			: chosenCustomer
				? customerLabel(chosenCustomer.customerId, chosenCustomer.customerName)
				: ''
	);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	let query = $derived(chosenLabel);
	let filtering = $state(false);
	let open = $state(false);
	let activeKey = $state<string | null>(null);

	/** The list: Any, then per customer its heading (when its name matches) and its projects. */
	const groups = $derived.by(() => {
		const typed = filtering ? query : '';
		const words = fold(typed).split(/\s+/).filter(Boolean);
		const byName = (name: string) => words.every((w) => fold(name).includes(w));
		// Every customer whose own name matches shows, with all its projects.
		const all = matchProjects('', projects);
		const matched = matchProjects(typed, projects);
		return all
			.map((g) => {
				const own = byName(g.customerName);
				const found = own
					? g.projects
					: (matched.find((m) => m.customerId === g.customerId)?.projects ?? []);
				const heading: Option | null = own
					? {
							kind: 'customer',
							key: `customer:${g.customerId}`,
							id: g.customerId,
							label: customerLabel(g.customerId, g.customerName),
							archived: customerArchived(g.customerId)
						}
					: null;
				return {
					customerId: g.customerId,
					customerName: g.customerName,
					heading,
					projects: found.map((p): Option => ({
						kind: 'project',
						key: `project:${p.id}`,
						project: p,
						label: projectLabel(p)
					}))
				};
			})
			.filter((g) => g.heading !== null || g.projects.length > 0);
	});
	const any: Option = { kind: 'any', key: 'any', label: 'Any' };
	const flat = $derived([
		...(filtering && query.trim() !== '' ? [] : [any]),
		...groups.flatMap((g) => [...(g.heading ? [g.heading] : []), ...g.projects])
	]);
	const listId = $derived(`${id}-list`);
	const optionId = (key: string) => `${id}-option-${key.replace(':', '-')}`;
	const currentKey = $derived(
		project !== '' ? `project:${project}` : customer !== '' ? `customer:${customer}` : 'any'
	);

	function show(first?: string | null) {
		open = true;
		activeKey = first ?? flat[0]?.key ?? null;
	}
	function close() {
		open = false;
		filtering = false;
		query = chosenLabel;
	}
	function pick(o: Option) {
		customer = o.kind === 'customer' ? o.id : '';
		project = o.kind === 'project' ? o.project.id : '';
		filtering = false;
		open = false;
		query = o.kind === 'any' ? '' : o.label;
		onpick?.();
	}
	function move(by: number) {
		if (flat.length === 0) return;
		const at = flat.findIndex((o) => o.key === activeKey);
		const next = at === -1 ? (by > 0 ? 0 : flat.length - 1) : (at + by + flat.length) % flat.length;
		activeKey = flat[next].key;
		document.getElementById(optionId(flat[next].key))?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) show(currentKey);
			else move(e.key === 'ArrowDown' ? 1 : -1);
		} else if (e.key === 'Enter') {
			// Enter picks; it never submits the filter's form.
			e.preventDefault();
			if (!open) return;
			const o = flat.find((x) => x.key === activeKey);
			if (o) pick(o);
			else close();
		} else if (e.key === 'Escape' && open) {
			// Closes the list, not the popover around it.
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
		// An emptied field is Any; anything else returns to the choice.
		if (filtering && query.trim() === '' && currentKey !== 'any') pick(any);
		else close();
	}
</script>

{#snippet optionRow(o: Option)}
	<div
		id={optionId(o.key)}
		role="option"
		tabindex="-1"
		aria-selected={o.key === activeKey}
		class="flex h-11 cursor-pointer items-center gap-2 px-3 text-base transition-colors duration-150 ease-out aria-selected:bg-accent lg:h-9 lg:px-2.5 lg:text-sm"
		onmousedown={(e) => e.preventDefault()}
		onclick={() => pick(o)}
		{onkeydown}
	>
		{#if o.kind === 'project'}
			<span class="size-2 shrink-0 rounded-full {dot(o.project.colour)}" aria-hidden="true"></span>
			<span class="min-w-0 truncate"
				>{o.project.name}{#if o.project.archived}<span class="text-muted-foreground">
						(archived)</span
					>{/if}</span
			>
		{:else}
			<span class="min-w-0 truncate font-semibold">{o.label}</span>
		{/if}
	</div>
{/snippet}

{#if hydrated}
	<div class="relative">
		<input type="hidden" name="customer" value={customer} />
		<input type="hidden" name="project" value={project} />
		{#if chosenProject && !filtering}
			<span
				class="pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full lg:left-2.5 {dot(
					chosenProject.colour
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
			placeholder="Any customer or project"
			aria-expanded={open}
			aria-controls={listId}
			aria-activedescendant={open && activeKey ? optionId(activeKey) : undefined}
			class="{selectClass} pr-9 {chosenProject && !filtering ? 'pl-7 lg:pl-6' : ''}"
			value={query}
			{oninput}
			{onkeydown}
			{onblur}
			onclick={() => (open ? close() : show(currentKey))}
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
				{#if flat[0]?.kind === 'any'}{@render optionRow(any)}{/if}
				{#each groups as g (g.customerId)}
					<div role="group" aria-labelledby="{id}-group-{g.customerId}">
						<div
							id="{id}-group-{g.customerId}"
							class="px-3 pt-2 pb-1 text-xs caps text-muted-foreground lg:px-2.5"
						>
							{g.customerName}
						</div>
						{#if g.heading}{@render optionRow(g.heading)}{/if}
						{#each g.projects as o (o.key)}{@render optionRow(o)}{/each}
					</div>
				{:else}
					<p class="px-3 py-2 text-sm text-muted-foreground lg:px-2.5">
						No customer or project matches.
					</p>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<select {id} name="scope" class={selectClass}>
		<option value="" selected={currentKey === 'any'}>Any</option>
		{#each matchProjects('', projects) as g (g.customerId)}
			<optgroup label={g.customerName}>
				<option value="customer:{g.customerId}" selected={currentKey === `customer:${g.customerId}`}
					>{customerLabel(g.customerId, g.customerName)}</option
				>
				{#each g.projects as p (p.id)}
					<option value="project:{p.id}" selected={currentKey === `project:${p.id}`}
						>{p.name}{p.archived ? archived : ''}</option
					>
				{/each}
			</optgroup>
		{/each}
	</select>
{/if}
