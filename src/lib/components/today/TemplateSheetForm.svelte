<script lang="ts">
	import type { SubmitFunction } from '$app/forms';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import X from '@lucide/svelte/icons/x';
	import ProjectPicker from '#lib/components/entry/ProjectPicker.svelte';
	import type { PickerOption, PickerProject } from '#lib/components/entry/types.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { durationText, readClock, readDate, readDuration, type Read } from '#lib/time-input.js';
	import { selectClass } from './field';
	import { fills } from './fills';
	import type { ActionFailure, TemplateCard } from './types';

	/**
	 * A template's sheet as a form posting `/?/fromTemplate`: a field for every one the
	 * template leaves blank and only those (the picker only without a project, from its
	 * customer's active projects when it has one; Activity, Location and Reference only
	 * when blank), Description always, "Change times" as a disclosure, and the foot's
	 * Cancel and "Log" or "Start timer". In the sheet (`oncancel` given) it has a head
	 * with the name and ×, and its foot is pinned; without the script it is the body of
	 * the row's `<details>` panel, Cancel a link back.
	 */
	let {
		template: t,
		projects,
		activities,
		locations,
		back,
		failure,
		headingId,
		oncancel,
		submit
	}: {
		template: TemplateCard;
		projects: PickerProject[];
		activities: PickerOption[];
		locations: PickerOption[];
		back: string;
		/** A refusal of this template's post, its fields as posted. */
		failure: ActionFailure | null;
		headingId?: string;
		/** The sheet's Cancel and ×; without it, the `<details>` panel's form. */
		oncancel?: () => void;
		submit?: SubmitFunction;
	} = $props();

	const values = $derived(failure?.values ?? {});
	const fields = $derived(failure?.fields ?? {});
	const general = $derived(failure?.error ?? null);

	// A template without a project picks one, from its customer's projects when it has one.
	const choices = $derived(
		t.projectId !== null
			? []
			: t.customerId !== null
				? projects.filter((p) => p.customerId === t.customerId)
				: projects
	);
	const noProjects = $derived(t.projectId === null && choices.length === 0);
	// Started from a refusal's values; the fields keep what is typed from then on.
	let project = $state(untrack(() => values.projectId ?? ''));

	const pickers = $derived(
		[
			{
				field: 'activityId',
				label: 'Activity',
				options: activities,
				blank: t.activityName === null
			},
			{ field: 'locationId', label: 'Location', options: locations, blank: t.locationName === null }
		].filter((p) => p.blank)
	);

	// The device zone, so a template without its own is read where the device is.
	let deviceZone = $state('');
	onMount(() => {
		try {
			deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
		} catch {
			// The server falls back to the zone cookie.
		}
	});

	/** "Change times", read on leaving a field as the entry form reads them. */
	type Time = 'date' | 'start' | 'end' | 'duration';
	// Started from a refusal's values; the fields keep what is typed from then on.
	let times = $state<Record<Time, string>>(
		untrack(() => ({
			date: values.date ?? '',
			start: values.start ?? '',
			end: values.end ?? '',
			duration: values.duration ?? ''
		}))
	);
	let local = $state<Partial<Record<Time, string>>>({});
	// A new refusal from the server replaces what the browser said.
	$effect.pre(() => {
		void fields;
		local = {};
	});
	const timeError = (name: Time) => (name in local ? local[name] : fields[name]) || '';
	const timesOpen = $derived(
		(['date', 'start', 'end', 'duration'] as const).some((k) => values[k] || fields[k])
	);
	const today = () => new Intl.DateTimeFormat('en-CA').format(new Date());
	const readers: Record<Time, (text: string) => Read<string | number>> = {
		date: (text) => readDate(text, today()),
		start: readClock,
		end: readClock,
		duration: readDuration
	};
	function settle(name: Time) {
		const text = times[name].trim();
		if (text === '') {
			local[name] = '';
			times[name] = '';
			return;
		}
		const r = readers[name](text);
		if (!r.ok) {
			local[name] = r.reason;
			return;
		}
		local[name] = '';
		times[name] = typeof r.value === 'number' ? durationText(r.value) : r.value;
	}
	const timeFields = $derived([
		{ name: 'date' as const, label: 'Date', placeholder: 'Today' },
		{ name: 'start' as const, label: 'Start', placeholder: t.startTime ?? 'Now' },
		{ name: 'end' as const, label: 'End', placeholder: t.endTime ?? '' },
		{
			name: 'duration' as const,
			label: 'Duration',
			placeholder: t.durationMinutes === null ? '' : durationText(t.durationMinutes)
		}
	]);

	/** The post would leave a running timer: the template runs and no end is typed. */
	const runs = $derived(t.runs && times.end.trim() === '' && times.duration.trim() === '');

	const id = (field: string) => `sheet-${t.id}-${field}`;
	const err = (field: string) => (fields[field] ? id(`${field}-error`) : undefined);
	const action = `${resolve('/(app)')}?/fromTemplate`;

	let form = $state<HTMLFormElement | null>(null);
	// A refusal takes the user to the first field it names.
	$effect(() => {
		if (Object.keys(fields).length > 0) {
			form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	});

	const sheet = $derived(oncancel !== undefined);
	const row = 'grid gap-1.5 lg:grid-cols-[8.5rem_minmax(0,1fr)] lg:items-center lg:gap-x-4';
	const labelClass = 'text-xs text-muted-foreground lg:text-sm lg:font-semibold lg:text-foreground';
	const textareaClass =
		'min-h-20 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground hover:border-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 lg:px-2.5 lg:text-sm';
</script>

{#snippet fieldError(name: string)}
	{#if fields[name]}
		<p id={id(`${name}-error`)} class="text-sm text-irregular lg:col-start-2">{fields[name]}</p>
	{/if}
{/snippet}

<form
	bind:this={form}
	method="POST"
	{action}
	use:enhance={submit}
	data-template-sheet={t.id}
	class="flex flex-col {sheet ? 'min-h-0 flex-1' : ''}"
>
	{#if sheet}
		<div
			class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 lg:px-5"
		>
			<h2 id={headingId} class="min-w-0 text-lg font-bold text-pretty">{t.name}</h2>
			<button
				type="button"
				aria-label="Close"
				class="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
				onclick={oncancel}
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
	{/if}

	<div
		class="flex flex-col gap-4 {sheet
			? 'min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4 lg:px-5'
			: 'px-4 pt-1 pb-4 lg:px-3.5'}"
	>
		<input type="hidden" name="templateId" value={t.id} />
		<input type="hidden" name="timeZone" value={deviceZone} />
		<input type="hidden" name="back" value={back} />

		{#if sheet}
			<p class="text-xs text-pretty text-muted-foreground figures lg:pl-[9.5rem]">{fills(t)}</p>
		{/if}

		{#if general}
			<p
				role="alert"
				class="rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-pretty text-destructive"
			>
				{general}
			</p>
		{/if}

		{#if t.projectId === null}
			<div class={row}>
				{#if noProjects}
					<span class={labelClass}>Customer › project</span>
					<p class="text-sm text-muted-foreground">
						{t.customerName ? `No active projects for ${t.customerName}.` : 'No active projects.'}
					</p>
				{:else}
					<label for={id('project')} class={labelClass}>Customer › project</label>
					<ProjectPicker
						id={id('project')}
						projects={choices}
						bind:value={project}
						describedby={err('projectId')}
					/>
				{/if}
				{@render fieldError('projectId')}
			</div>
		{/if}

		{#each pickers as picker (picker.field)}
			{@const chosen = values[picker.field] ?? ''}
			<div class={row}>
				<label for={id(picker.field)} class={labelClass}>{picker.label}</label>
				<select
					id={id(picker.field)}
					name={picker.field}
					class={selectClass}
					aria-invalid={fields[picker.field] ? 'true' : undefined}
					aria-describedby={err(picker.field)}
				>
					<option value="" selected={chosen === ''}>None</option>
					{#each picker.options as o (o.id)}
						<option value={o.id} selected={chosen === o.id}>{o.name}</option>
					{/each}
				</select>
				{@render fieldError(picker.field)}
			</div>
		{/each}

		{#if t.reference === null}
			<div class={row}>
				<label for={id('reference')} class={labelClass}>Reference</label>
				<Input
					id={id('reference')}
					name="reference"
					value={values.reference ?? ''}
					autocomplete="off"
					aria-invalid={fields.reference ? 'true' : undefined}
					aria-describedby={err('reference')}
				/>
				{@render fieldError('reference')}
			</div>
		{/if}

		<div class={row}>
			<label for={id('description')} class="{labelClass} lg:self-start lg:pt-2">Description</label>
			<textarea
				id={id('description')}
				name="description"
				rows="2"
				class={textareaClass}
				placeholder={t.description ?? ''}
				aria-invalid={fields.description ? 'true' : undefined}
				aria-describedby={err('description')}>{values.description ?? ''}</textarea
			>
			{@render fieldError('description')}
		</div>

		<details open={timesOpen} class="group/times lg:pl-[9.5rem]">
			<summary
				class="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 [&::-webkit-details-marker]:hidden"
			>
				Change times
				<ChevronDown
					class="size-4 transition-transform duration-150 ease-out group-open/times:rotate-180"
					aria-hidden="true"
				/>
			</summary>
			<div class="grid grid-cols-2 gap-x-3 gap-y-3 pt-2 sm:grid-cols-4">
				{#each timeFields as f (f.name)}
					<div class="flex min-w-0 flex-col gap-1.5">
						<label for={id(f.name)} class="text-xs text-muted-foreground">{f.label}</label>
						<Input
							id={id(f.name)}
							name={f.name}
							type="text"
							autocomplete="off"
							class="figures"
							placeholder={f.placeholder}
							bind:value={times[f.name]}
							oninput={() => delete local[f.name]}
							onblur={() => settle(f.name)}
							aria-invalid={timeError(f.name) ? 'true' : undefined}
							aria-describedby={timeError(f.name) ? id(`${f.name}-error`) : id('times-hint')}
						/>
						{#if timeError(f.name)}
							<p id={id(`${f.name}-error`)} class="text-xs text-irregular">{timeError(f.name)}</p>
						{/if}
					</div>
				{/each}
			</div>
			<p id={id('times-hint')} class="pt-1.5 text-xs text-muted-foreground">
				Blank keeps the template's. Times: 9, 900, 9:00, 1330 · Duration: 5:30, 5.5, 90
			</p>
		</details>
	</div>

	<div
		class="flex shrink-0 items-center gap-3 border-t border-border {sheet
			? 'bg-card px-4 py-3 lg:justify-end lg:px-5'
			: 'px-4 py-3 lg:justify-end lg:px-3.5'}"
	>
		{#if oncancel}
			<Button variant="outline" class="flex-1 lg:flex-none" onclick={oncancel}>Cancel</Button>
		{:else}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the server -->
			<Button href={back} variant="outline" class="flex-1 lg:flex-none">Cancel</Button>
		{/if}
		<Button type="submit" class="flex-1 lg:flex-none" disabled={noProjects}
			>{runs ? 'Start timer' : 'Log'}</Button
		>
	</div>
</form>
