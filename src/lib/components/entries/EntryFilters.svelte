<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { selectClass } from '#lib/components/today/field.js';
	import { narrowing } from '#lib/components/narrowing.svelte.js';
	import type { ProjectGroup } from '#lib/components/today/types.js';
	import type { Option } from './types';

	type Search = {
		from: string;
		to: string;
		customerId: string;
		projectId: string;
		activity: string;
		location: string;
		text: string;
	};

	let {
		search,
		filters,
		error,
		dateError,
		clear = resolve('/(app)/entries'),
		submit = 'Search',
		primary = false,
		children,
		links
	}: {
		search: Search;
		filters: {
			customers: Option[];
			projects: ProjectGroup[];
			activities: Option[];
			locations: Option[];
		};
		error: string | null;
		dateError: boolean;
		/** Where Clear goes: the screen with no query. */
		clear?: string;
		/** The submit button's text. */
		submit?: string;
		/** Whether the submit is the screen's primary (else outline: another form owns it). */
		primary?: boolean;
		/** More fields of the same `GET` form, after the filters. */
		children?: Snippet;
		/** More links beside Clear. */
		links?: Snippet;
	} = $props();

	const pick = narrowing(
		() => filters.projects,
		() => ({ customerId: search.customerId, projectId: search.projectId })
	);

	const field = 'flex min-w-0 flex-col gap-2';
	const link =
		'rounded-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring';
</script>

<form method="GET" class="flex flex-col gap-4 border-b border-border pt-3 pb-4" role="search">
	<div class="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
		<div class={field}>
			<Label for="find-from">From</Label>
			<Input
				id="find-from"
				name="from"
				type="date"
				value={search.from}
				class="punch"
				aria-invalid={dateError ? 'true' : undefined}
				aria-describedby={dateError ? 'find-date-error' : undefined}
			/>
		</div>
		<div class={field}>
			<Label for="find-to">To</Label>
			<Input
				id="find-to"
				name="to"
				type="date"
				value={search.to}
				class="punch"
				aria-invalid={dateError ? 'true' : undefined}
				aria-describedby={dateError ? 'find-date-error' : undefined}
			/>
		</div>
		{#if dateError && error}
			<p id="find-date-error" role="alert" class="col-span-full text-sm text-irregular">
				{error}
			</p>
		{/if}
		<div class={field}>
			<Label for="find-customer">Customer</Label>
			<select
				id="find-customer"
				name="customerId"
				class={selectClass}
				bind:value={pick.customerId}
				onchange={pick.pickCustomer}
			>
				<option value="">Any</option>
				{#each filters.customers as o (o.id)}
					<option value={o.id}>{o.name}</option>
				{/each}
			</select>
		</div>
		<div class={field}>
			<Label for="find-project">Project</Label>
			<select
				id="find-project"
				name="projectId"
				class={selectClass}
				bind:value={pick.projectId}
				onchange={pick.pickProject}
			>
				<option value="">Any</option>
				{#each pick.projects as group (group.customerId)}
					<optgroup label={group.customerName}>
						{#each group.projects as p (p.id)}
							<option value={p.id}>{p.name}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>
		{#each [{ name: 'activity', label: 'Activity', options: filters.activities, value: search.activity }, { name: 'location', label: 'Location', options: filters.locations, value: search.location }] as picker (picker.name)}
			<div class={field}>
				<Label for="find-{picker.name}">{picker.label}</Label>
				<select id="find-{picker.name}" name={picker.name} class={selectClass}>
					<option value="any" selected={picker.value === 'any'}>Any</option>
					<option value="none" selected={picker.value === 'none'}>None</option>
					{#each picker.options as o (o.id)}
						<option value={o.id} selected={picker.value === o.id}>{o.name}</option>
					{/each}
				</select>
			</div>
		{/each}
		<div class="{field} sm:col-span-2">
			<Label for="find-text">Text</Label>
			<Input
				id="find-text"
				name="text"
				type="search"
				value={search.text}
				maxlength={200}
				placeholder="Reference, description, customer or project"
				autocomplete="off"
			/>
		</div>
	</div>
	{@render children?.()}
	<div class="flex flex-wrap items-center gap-x-4 gap-y-3">
		<Button type="submit" variant={primary ? 'default' : 'outline'} class="flex-1 sm:flex-none"
			>{submit}</Button
		>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the caller -->
		<a href={clear} class={link}>Clear</a>
		{@render links?.()}
	</div>
	{#if !dateError && error}
		<p role="alert" class="text-sm text-irregular">{error}</p>
	{/if}
</form>
