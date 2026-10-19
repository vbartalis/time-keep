<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { templateTimes } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { clearOnDone, line, selectClass } from './field';
	import type { ActionFailure, ProjectGroup, TemplateCard } from './types';

	let {
		template: t,
		projects,
		failure
	}: { template: TemplateCard; projects: ProjectGroup[]; failure: ActionFailure | null } = $props();

	const mine = $derived(failure?.action === 'fromTemplate' && failure.subject === t.id);
	const values = $derived(mine ? (failure?.values ?? {}) : {});
	const fields = $derived(mine ? (failure?.fields ?? {}) : {});
	const timesChanged = $derived(
		['date', 'start', 'end', 'durationMinutes'].some((k) => values[k] || fields[k])
	);

	// A template without a project picks one, from its customer's projects when it has one.
	const choices = $derived(
		t.projectId !== null
			? []
			: t.customerId !== null
				? projects.filter((g) => g.customerId === t.customerId)
				: projects
	);
	const canSubmit = $derived(t.projectId !== null || choices.length > 0);

	const where = $derived(
		t.customerName && t.projectName
			? `${t.customerName} › ${t.projectName}`
			: (t.customerName ?? t.projectName)
	);
	const times = $derived(templateTimes(t));
	const filled = $derived(
		[
			['Customer › project', where],
			['Activity', t.activityName],
			['Location', t.locationName],
			['Reference', t.reference]
		].filter((f): f is [string, string] => f[1] !== null)
	);

	const id = (field: string) => `${field}-${t.id}`;

	let description = $state<HTMLInputElement | null>(null);
	let sheet = $state<HTMLDetailsElement | null>(null);

	// After a refused submit, take the user to the first field the core refused.
	$effect(() => {
		if (mine && Object.keys(fields).length > 0) {
			sheet?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	});
</script>

<details
	bind:this={sheet}
	name="template"
	open={mine}
	class="group border-b border-border"
	ontoggle={(e) => {
		if (e.currentTarget.open) description?.focus();
	}}
>
	<summary
		class="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2 transition-colors duration-150 ease-out outline-none select-none group-open:bg-muted hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden"
	>
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="font-semibold text-pretty">{t.name}</span>
			<span class="text-sm text-pretty text-muted-foreground">
				{where ?? 'Any project'}
				{#if times}· <span class="punch">{times}</span>{/if}
			</span>
		</span>
		<span class="text-xs printed {t.runs ? 'text-live' : 'text-muted-foreground'}">
			{t.runs ? 'Timer' : 'Log'}
		</span>
		<ChevronDown
			class="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-180"
			aria-hidden="true"
		/>
	</summary>

	<form
		method="POST"
		action="?/fromTemplate"
		use:enhance={clearOnDone}
		class="flex flex-col border-t border-border px-3 pb-4"
	>
		<input type="hidden" name="templateId" value={t.id} />
		<input type="hidden" name="timeZone" />

		{#if filled.length > 0 || times || t.timeZone}
			<dl class="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 text-sm">
				{#each filled as [term, value] (term)}
					<dt class="text-muted-foreground">{term}</dt>
					<dd class="text-pretty">{value}</dd>
				{/each}
				{#if times}
					<dt class="text-muted-foreground">Times</dt>
					<dd class="punch">{times}</dd>
				{/if}
				{#if t.timeZone}
					<dt class="text-muted-foreground">Time zone</dt>
					<dd>{t.timeZone}</dd>
				{/if}
			</dl>
		{/if}

		{#if mine && failure?.error && Object.keys(fields).length === 0}
			<p role="alert" class="border-t border-border py-3 text-sm text-irregular">{failure.error}</p>
		{/if}

		{#if t.projectId === null}
			<div class={line}>
				<Label for={id('project')}>Project</Label>
				{#if choices.length > 0}
					<select
						id={id('project')}
						name="projectId"
						required
						class={selectClass}
						aria-invalid={fields.projectId ? 'true' : undefined}
					>
						<option value="" selected={!values.projectId}>Pick a project</option>
						{#each choices as group (group.customerId)}
							<optgroup label={group.customerName}>
								{#each group.projects as p (p.id)}
									<option value={p.id} selected={values.projectId === p.id}>{p.name}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				{:else}
					<p class="text-sm text-muted-foreground">Customers and projects are set up on the PC.</p>
				{/if}
				{#if fields.projectId}<p class="text-sm text-irregular lg:col-start-2">
						{fields.projectId}
					</p>{/if}
			</div>
		{/if}

		<div class={line}>
			<Label for={id('description')}>Description</Label>
			<Input
				bind:ref={description}
				id={id('description')}
				name="description"
				value={values.description ?? ''}
				placeholder={t.description ?? 'What you did'}
				autocomplete="off"
				enterkeyhint="done"
				aria-invalid={fields.description ? 'true' : undefined}
			/>
			{#if fields.description}<p class="text-sm text-irregular lg:col-start-2">
					{fields.description}
				</p>{/if}
		</div>

		{#if t.reference === null}
			<div class={line}>
				<Label for={id('reference')}>Reference</Label>
				<Input
					id={id('reference')}
					name="reference"
					value={values.reference ?? ''}
					placeholder="Ticket or order, optional"
					autocomplete="off"
					aria-invalid={fields.reference ? 'true' : undefined}
				/>
				{#if fields.reference}<p class="text-sm text-irregular lg:col-start-2">
						{fields.reference}
					</p>{/if}
			</div>
		{/if}

		<details open={timesChanged} class="group/times border-b border-border">
			<summary
				class="flex h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
			>
				<ChevronDown
					class="size-4 -rotate-90 transition-transform duration-150 ease-out group-open/times:rotate-0"
					aria-hidden="true"
				/>
				Change times
			</summary>
			<div class="grid grid-cols-2 gap-x-3 gap-y-3 pb-3">
				{#each [{ name: 'date', label: 'Date', type: 'date' }, { name: 'start', label: 'Start', type: 'time' }, { name: 'end', label: 'End', type: 'time' }, { name: 'durationMinutes', label: 'Or minutes', type: 'number' }] as f (f.name)}
					<div class="flex min-w-0 flex-col gap-2">
						<Label for={id(f.name)}>{f.label}</Label>
						<Input
							id={id(f.name)}
							name={f.name}
							type={f.type as 'date' | 'time' | 'number'}
							value={values[f.name] ?? ''}
							class="punch"
							min={f.type === 'number' ? 1 : undefined}
							step={f.type === 'number' ? 1 : undefined}
							inputmode={f.type === 'number' ? 'numeric' : undefined}
							aria-invalid={fields[f.name] ? 'true' : undefined}
						/>
						{#if fields[f.name]}<p class="text-sm text-irregular">{fields[f.name]}</p>{/if}
					</div>
				{/each}
			</div>
		</details>

		{#if mine && failure?.error && Object.keys(fields).length > 0}
			<p role="alert" class="pt-3 text-sm text-irregular">{failure.error}</p>
		{/if}

		{#if canSubmit}
			<div class="pt-4 lg:pl-[11rem]">
				<Button type="submit" class="w-full sm:w-auto">{t.runs ? 'Start timer' : 'Log'}</Button>
			</div>
		{/if}
	</form>
</details>
