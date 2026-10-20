<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import Play from '@lucide/svelte/icons/play';
	import { readDate } from '#lib/time-input.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { selectClass } from '#lib/components/today/field.js';
	import { fillValues } from './fill';
	import ProjectPicker from './ProjectPicker.svelte';
	import TimeRow from './TimeRow.svelte';
	import type { EntryFormData, EntryFormFailure, EntryFormValues, FillTemplate } from './types';

	/**
	 * The one form for a new entry and an existing one. A page form without JavaScript;
	 * with `onDone` a successful action's redirect is handed to it instead of followed,
	 * and with `onFailure` a refusal is handed to it instead of becoming the page's form.
	 */
	let {
		data,
		action,
		onDone,
		onFailure,
		onCancel
	}: {
		data: EntryFormData;
		/** Where Save posts: `?/save` (an edit) or the new-entry page's default action. */
		action: string;
		onDone?: (location: string) => void;
		onFailure?: (failure: EntryFormFailure) => void;
		onCancel?: () => void;
	} = $props();

	const v = $derived(data.values);
	const editing = $derived(data.mode === 'edit');
	const failure = $derived(data.failure);
	const saveFailure = $derived(failure?.action === 'save' ? failure : null);
	const templateFailure = $derived(failure?.action === 'saveAsTemplate' ? failure : null);
	const fields = $derived(saveFailure?.fields ?? {});
	// Only a refused save puts its values back; a delete's echo may be blank.
	const typed = $derived(saveFailure?.values);
	const shown = (name: keyof EntryFormValues & string) => typed?.[name] ?? String(v[name] ?? '');

	let date = $derived(shown('date'));
	let start = $derived(shown('start'));
	let end = $derived(shown('end'));
	let duration = $derived(shown('duration'));
	let endDays = $derived(
		typed && typed.end !== v.end
			? typed.end !== '' && typed.end <= typed.start
				? 1
				: 0
			: v.endDays
	);
	let projectId = $derived(shown('projectId'));
	let activityId = $derived(shown('activityId'));
	let locationId = $derived(shown('locationId'));
	let reference = $derived(shown('reference'));
	let description = $derived(shown('description'));
	let timeZone = $derived(typed?.timeZone || v.timeZone);
	const version = $derived(typed?.version ?? v.version);
	/** The zone is the entry's own (or a template's): the layout must not replace it. */
	let zoneFixed = $state(false);
	const keepZone = $derived(editing || data.zoneFixed || zoneFixed);

	// A refused page post has no `back` in its address: the refusal carries it.
	const back = $derived(failure?.back ?? data.back);
	// Actions other than Save live at the form's address: `?/save` → `?/delete`.
	const base = $derived(action.split('?')[0]);
	const entryPath = $derived(v.id ? resolve('/(app)/entries/[id]', { id: v.id }) : '');
	const reloadHref = $derived(
		back === '/' ? entryPath : `${entryPath}?back=${encodeURIComponent(back)}`
	);
	const copyHref = $derived(
		`${resolve('/(app)/entries/new')}?copy=${v.id}&back=${encodeURIComponent(back)}`
	);
	const fillHref = (t: FillTemplate) =>
		`${resolve('/(app)/entries/new')}?template=${t.id}&date=${v.date}&back=${encodeURIComponent(back)}`;
	const backLabel = $derived(back.startsWith('/entries') ? 'Back to Entries' : 'Back to Today');

	let hydrated = $state(false);
	let formEl = $state<HTMLFormElement | null>(null);
	let zoneEl = $state<HTMLInputElement | null>(null);
	let templateDetails = $state<HTMLDetailsElement | null>(null);
	let templateName = $state<HTMLInputElement | null>(null);
	let timeRow = $state<ReturnType<typeof TimeRow> | null>(null);

	/** Today in the form's zone, `YYYY-MM-DD`. */
	function today(): string {
		const zone = zoneEl?.value || timeZone;
		try {
			return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
		} catch {
			return new Intl.DateTimeFormat('en-CA').format(new Date());
		}
	}
	const dayBefore = (d: string) => new Date(Date.parse(d) - 86_400_000).toISOString().slice(0, 10);

	// The date: read on leaving it and on save, shown back as YYYY-MM-DD.
	let dateTyped = false;
	let dateError = $state<string | null>(null);
	$effect.pre(() => {
		void failure;
		dateError = null;
	});
	const dateMessage = $derived(dateError ?? fields.date ?? '');
	function settleDate(): boolean {
		if (!dateTyped) return !dateMessage;
		dateTyped = false;
		const r = readDate(date, today());
		if (!r.ok) {
			dateError = r.reason;
			return false;
		}
		dateError = '';
		date = r.value;
		return true;
	}
	function setDate(d: string) {
		date = d;
		dateTyped = false;
		dateError = '';
	}

	/** The form differs from what was loaded: the stored-entry actions wait. */
	const dirty = $derived(
		editing &&
			hydrated &&
			(date !== v.date ||
				start !== v.start ||
				end !== v.end ||
				duration !== v.duration ||
				projectId !== v.projectId ||
				activityId !== v.activityId ||
				locationId !== v.locationId ||
				reference !== v.reference ||
				description !== v.description)
	);
	$effect(() => {
		if (dirty && templateDetails) templateDetails.open = false;
	});

	/**
	 * The first refused field, else the first the user has not been given. An existing
	 * entry on the phone was opened to be read: its sheet's heading takes the focus, so no
	 * keyboard comes up.
	 */
	function focusFirst() {
		const refused = formEl?.querySelector<HTMLElement>('[aria-invalid="true"]');
		if (refused) return refused.focus();
		const heading = document.getElementById('entry-overlay-title');
		if (editing && heading && !window.matchMedia('(min-width: 1024px)').matches)
			return heading.focus();
		const target = start === '' ? 'entry-start' : 'entry-project';
		document.getElementById(target)?.focus();
	}

	onMount(() => {
		hydrated = true;
		void tick().then(() => {
			if (templateFailure) templateName?.focus();
			else focusFirst();
		});
	});

	// A refusal that arrives later (an enhanced save) takes the user to its field.
	let seen: unknown = null;
	$effect(() => {
		const f = failure;
		if (!hydrated || f === seen) return;
		seen = f;
		if (f === null) return;
		void tick().then(() => {
			if (f.action === 'saveAsTemplate') templateName?.focus();
			else formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		});
	});

	/** Fill from: every field the template holds; focus to the first needed one still empty. */
	function fill(t: FillTemplate, e: MouseEvent) {
		e.preventDefault();
		const current: EntryFormValues = {
			...v,
			date,
			start,
			end,
			duration,
			endDays,
			timeZone: zoneEl?.value || timeZone,
			projectId,
			activityId,
			locationId,
			reference,
			description
		};
		const next = fillValues(t, current);
		start = next.start;
		end = next.end;
		duration = next.duration;
		endDays = next.endDays;
		projectId = next.projectId;
		activityId = next.activityId;
		locationId = next.locationId;
		reference = next.reference;
		description = next.description;
		if (t.timeZone !== null) {
			timeZone = next.timeZone;
			zoneFixed = true;
		}
		timeRow?.filled(t.durationMinutes !== null ? 'duration' : t.endTime !== null ? 'end' : null);
		void tick().then(() => {
			const target =
				start === '' ? 'entry-start' : projectId === '' ? 'entry-project' : 'entry-description';
			document.getElementById(target)?.focus();
		});
	}

	/** After an action: a redirect to `onDone`, a refusal to `onFailure`, when given; else as usual. */
	const after: ReturnType<SubmitFunction> = async ({ result, update }) => {
		if (result.type === 'redirect' && onDone) return onDone(result.location);
		if (result.type === 'failure' && onFailure) return onFailure(result.data as EntryFormFailure);
		await update();
	};

	/** Save: reads what is still being typed; a field that does not read stops it. */
	const save: SubmitFunction = ({ formData, cancel }) => {
		const timesRead = timeRow?.commit() ?? true;
		const dateRead = settleDate();
		if (!timesRead || !dateRead) {
			cancel();
			void tick().then(() => formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
			return;
		}
		for (const [name, value] of Object.entries({ date, start, end, duration })) {
			formData.set(name, value);
		}
		return after;
	};

	/** Ctrl+Enter or Cmd+Enter anywhere in the form submits it (or the template's name). */
	const ctrlEnter = (node: HTMLElement) => {
		const onkeydown = (e: KeyboardEvent) => {
			if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
			e.preventDefault();
			const inTemplate = e.target instanceof Node && templateDetails?.contains(e.target);
			const target = inTemplate ? templateDetails?.querySelector('form') : formEl;
			target?.requestSubmit();
		};
		node.addEventListener('keydown', onkeydown);
		return () => node.removeEventListener('keydown', onkeydown);
	};

	const general = $derived(
		failure && !(failure.action === 'saveAsTemplate' && failure.fields.name) ? failure : null
	);
	const nameError = $derived(templateFailure?.fields.name ?? '');
	const describe = (name: string) => (fields[name] ? `${name}-error` : undefined);

	const row = 'grid gap-1.5 lg:grid-cols-[8.5rem_minmax(0,1fr)] lg:items-center lg:gap-x-4';
	const labelClass = 'text-xs text-muted-foreground lg:text-sm lg:font-semibold lg:text-foreground';
	const textareaClass =
		'min-h-20 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground hover:border-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 lg:px-2.5 lg:text-sm';
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
	const lockedBy = $derived(dirty ? 'entry-locked' : undefined);
</script>

{#snippet fieldError(name: string)}
	{#if fields[name]}
		<p id="{name}-error" class="text-sm text-irregular lg:col-start-2">{fields[name]}</p>
	{/if}
{/snippet}

<div class="flex flex-col gap-5" {@attach ctrlEnter}>
	{#if !editing && data.templates.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			<span class="mr-1 text-xs caps text-muted-foreground lg:w-[8.5rem] lg:shrink-0"
				>Fill from</span
			>
			{#each data.templates as t (t.id)}
				<Button
					href={fillHref(t)}
					variant="outline"
					onclick={(e: MouseEvent) => fill(t, e)}
					title={t.label ?? undefined}
				>
					{#if t.colour !== null}
						<span
							class="size-2 rounded-full {DOTS[(t.colour - 1) % DOTS.length]}"
							aria-hidden="true"
						></span>
					{/if}
					{t.name}
				</Button>
			{/each}
		</div>
	{/if}

	<form
		bind:this={formEl}
		id="entry-form"
		method="POST"
		{action}
		use:enhance={save}
		class="flex flex-col gap-4"
	>
		{#if editing}<input type="hidden" name="version" value={version} />{/if}
		<input type="hidden" name="back" value={back} />
		<input
			bind:this={zoneEl}
			id="entry-zone"
			type="hidden"
			name="timeZone"
			value={timeZone}
			data-zone-fixed={keepZone ? '' : undefined}
		/>

		<div class={row}>
			<label for="entry-date" class={labelClass}>Date</label>
			<div class="flex flex-col gap-1.5">
				<div class="flex flex-wrap items-center gap-2">
					<Input
						id="entry-date"
						name="date"
						type="text"
						inputmode="decimal"
						autocomplete="off"
						class="w-40 figures"
						value={date}
						oninput={(e) => {
							date = e.currentTarget.value;
							dateTyped = true;
						}}
						onblur={settleDate}
						aria-invalid={dateMessage ? 'true' : undefined}
						aria-describedby={dateMessage ? 'date-error' : undefined}
					/>
					{#if hydrated}
						<Button variant="outline" onclick={() => setDate(today())}>Today</Button>
						<Button variant="outline" onclick={() => setDate(dayBefore(today()))}>Yesterday</Button>
					{/if}
				</div>
				{#if dateMessage}
					<p id="date-error" class="text-sm text-irregular">{dateMessage}</p>
				{/if}
			</div>
		</div>

		<div class={row} role="group" aria-labelledby="entry-time-label">
			<span id="entry-time-label" class="hidden text-sm font-semibold lg:block">Time</span>
			<div>
				<TimeRow
					bind:this={timeRow}
					bind:start
					bind:end
					bind:duration
					bind:endDays
					endZone={v.endZone}
					running={v.running}
					{date}
					zone={() => zoneEl?.value || timeZone}
					errors={fields}
				/>
			</div>
		</div>

		<div class={row}>
			<label for="entry-project" class={labelClass}>Customer › project</label>
			<ProjectPicker
				projects={data.projects}
				bind:value={projectId}
				id="entry-project"
				describedby={describe('projectId')}
			/>
			{@render fieldError('projectId')}
		</div>

		<div class="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
			{#each [{ name: 'activityId', id: 'entry-activity', label: 'Activity', options: data.activities }, { name: 'locationId', id: 'entry-location', label: 'Location', options: data.locations }] as picker (picker.name)}
				<div class={row}>
					<label for={picker.id} class={labelClass}>{picker.label}</label>
					{#if picker.name === 'activityId'}
						<select
							id={picker.id}
							name={picker.name}
							class={selectClass}
							bind:value={activityId}
							aria-invalid={fields[picker.name] ? 'true' : undefined}
							aria-describedby={describe(picker.name)}
						>
							<option value="">None</option>
							{#each picker.options as o (o.id)}
								<option value={o.id}>{o.name}{o.archived ? ' (archived)' : ''}</option>
							{/each}
						</select>
					{:else}
						<select
							id={picker.id}
							name={picker.name}
							class={selectClass}
							bind:value={locationId}
							aria-invalid={fields[picker.name] ? 'true' : undefined}
							aria-describedby={describe(picker.name)}
						>
							<option value="">None</option>
							{#each picker.options as o (o.id)}
								<option value={o.id}>{o.name}{o.archived ? ' (archived)' : ''}</option>
							{/each}
						</select>
					{/if}
					{@render fieldError(picker.name)}
				</div>
			{/each}
		</div>

		<div class={row}>
			<label for="entry-reference" class={labelClass}>Reference</label>
			<Input
				id="entry-reference"
				name="reference"
				autocomplete="off"
				bind:value={reference}
				aria-invalid={fields.reference ? 'true' : undefined}
				aria-describedby={describe('reference')}
			/>
			{@render fieldError('reference')}
		</div>

		<div class={row}>
			<label for="entry-description" class="{labelClass} lg:self-start lg:pt-2">Description</label>
			<textarea
				id="entry-description"
				name="description"
				rows="3"
				class={textareaClass}
				bind:value={description}
				aria-invalid={fields.description ? 'true' : undefined}
				aria-describedby={describe('description')}></textarea>
			{@render fieldError('description')}
		</div>
	</form>

	{#if general}
		<div
			role="alert"
			class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card py-2 pr-2 pl-3.5 text-sm text-destructive"
		>
			<p class="min-w-0 flex-1 text-pretty">{general.error}</p>
			{#if general.gone}
				<Button href={back} variant="outline">{backLabel}</Button>
			{:else if general.conflict && entryPath}
				<!-- A full load, so the form takes the entry as it is now. -->
				<Button href={reloadHref} variant="outline" data-sveltekit-reload>Reload</Button>
			{/if}
		</div>
	{/if}

	<!-- One row on the PC (stored-entry actions left, Cancel and Save right); on the phone
	     the actions scroll with the fields and only Cancel and Save stay at the foot. -->
	<div
		data-entry-foot-row
		class="max-lg:contents lg:flex lg:items-start lg:gap-2 lg:border-t lg:border-border lg:pt-4 lg:pb-5"
	>
		{#if editing}
			<div data-entry-actions class="flex flex-wrap items-center gap-2 lg:flex-1">
				<form method="POST" action="{base}?/delete" use:enhance={() => after} class="mr-2">
					<input type="hidden" name="version" value={v.version} />
					<input type="hidden" name="back" value={back} />
					<Button type="submit" variant="destructive" disabled={dirty} aria-describedby={lockedBy}
						>Delete</Button
					>
				</form>
				<!-- Opened in place over the screen when this form is (it has `onDone`). -->
				<Button
					href={copyHref}
					variant="outline"
					disabled={dirty}
					aria-describedby={lockedBy}
					data-entry-form={onDone ? '' : undefined}>Copy</Button
				>
				<form method="POST" action={resolve('/(app)/timers/restart')} use:enhance={() => after}>
					<input type="hidden" name="id" value={v.id} />
					<input type="hidden" name="timeZone" value={v.timeZone} data-zone-fixed="" />
					<input type="hidden" name="back" value={back} />
					<Button
						type="submit"
						variant="outline"
						disabled={v.running || dirty}
						aria-describedby={v.running ? undefined : lockedBy}
						><Play class="size-3.5 fill-current" aria-hidden="true" />Restart{#if v.running}<span
								class="text-xs font-normal">· Already running</span
							>{/if}</Button
					>
				</form>
				<details bind:this={templateDetails} open={templateFailure !== null} class="group/tpl">
					<summary
						aria-disabled={dirty ? 'true' : undefined}
						aria-describedby={lockedBy}
						onclick={(e) => {
							if (dirty) e.preventDefault();
						}}
						class="inline-flex h-11 cursor-pointer list-none items-center rounded-md border border-input bg-card px-4 text-sm font-semibold transition-[color,background-color,border-color] duration-150 ease-out outline-none select-none group-open/tpl:bg-accent hover:border-foreground/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:pointer-events-none aria-disabled:opacity-50 lg:h-9 lg:px-3 [&::-webkit-details-marker]:hidden"
						>Save as template</summary
					>
					<form
						method="POST"
						action="{base}?/saveAsTemplate"
						use:enhance={() => after}
						class="flex flex-wrap items-end gap-2 pt-3"
					>
						<input type="hidden" name="back" value={back} />
						<div class="flex min-w-0 flex-col gap-1.5">
							<label for="entry-template-name" class="text-xs text-muted-foreground">Name</label>
							<Input
								bind:ref={templateName}
								id="entry-template-name"
								name="name"
								required
								autocomplete="off"
								value={templateFailure?.values?.name ?? ''}
								aria-invalid={nameError ? 'true' : undefined}
								aria-describedby={nameError ? 'name-error' : undefined}
							/>
						</div>
						<Button type="submit" variant="outline">Save template</Button>
						{#if nameError}
							<p id="name-error" class="w-full text-sm text-irregular">{nameError}</p>
						{/if}
					</form>
				</details>
				{#if dirty}
					<p id="entry-locked" class="w-full text-xs text-muted-foreground">
						Save or cancel your changes first
					</p>
				{/if}
			</div>
		{/if}
		<div
			data-entry-footer
			class="flex items-center gap-3 border-t border-border pt-4 sm:justify-end lg:ml-auto lg:shrink-0 lg:gap-2 lg:border-t-0 lg:pt-0"
		>
			<span class="hidden text-xs text-muted-foreground lg:inline">Ctrl+Enter</span>
			{#if onCancel}
				<Button variant="outline" class="flex-1 sm:flex-none" onclick={onCancel}>Cancel</Button>
			{:else}
				<Button href={back} variant="outline" class="flex-1 sm:flex-none">Cancel</Button>
			{/if}
			<Button type="submit" form="entry-form" class="flex-1 sm:flex-none">Save</Button>
		</div>
	</div>
</div>
