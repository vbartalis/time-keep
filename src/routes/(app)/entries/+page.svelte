<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { spanText } from '#lib/calendar/grid.js';
	import { nowTicker } from '#lib/components/calendar/now.svelte.js';
	import BulkBar from '#lib/components/timesheet/BulkBar.svelte';
	import BulkDialog from '#lib/components/timesheet/BulkDialog.svelte';
	import BulkForm from '#lib/components/timesheet/BulkForm.svelte';
	import DayTable from '#lib/components/timesheet/DayTable.svelte';
	import FilterChips from '#lib/components/timesheet/FilterChips.svelte';
	import PhoneList from '#lib/components/timesheet/PhoneList.svelte';
	import Toolbar from '#lib/components/timesheet/Toolbar.svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import { clearOf } from '#lib/components/focus-clear.js';
	import { focusUndo } from '#lib/components/timesheet/live.js';
	import { rowRefusal } from '#lib/components/timesheet/refusal.svelte.js';
	import { createSelection } from '#lib/components/timesheet/selection.svelte.js';
	import type { BulkEdit, BulkFailure, Chosen } from '#lib/components/timesheet/types.js';
	import { afterNavigate, goto } from '$app/navigation';
	import { filterQuery, rangeLabel, scopeCount, type Scope } from '#lib/filter/filter.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The server's now until mounted; the device's clock from then on, never behind it.
	const clock = nowTicker(untrack(() => data.now));
	const now = $derived(Math.max(clock.now, data.now));

	const running = $derived(
		data.sheet.days.reduce((n, d) => n + d.rows.filter((r) => r.running).length, 0)
	);
	const total = $derived(spanText(data.sheet.totalMs + running * (now - data.now)));

	const entries = resolve('/(app)/entries');
	/** The table's address with another scope, the range and search kept. */
	const withScope = (scope: Scope) => `${entries}?${filterQuery({ ...data.filter, ...scope })}`;
	const clear = $derived(withScope({ customer: '', project: '', activity: '', location: '' }));
	const clearSearch = $derived(`${entries}?${filterQuery({ ...data.filter, q: '' })}`);
	const filtered = $derived(scopeCount(data.filter) > 0);

	// A row's refusal belongs to the table it was made on.
	afterNavigate(() => (rowRefusal.error = null));

	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** From `lg` the PC's table; below it the phone's list. Without the script both render, CSS shows one. */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const pc = $derived(!enhanced || wide.current);
	const phone = $derived(!enhanced || !wide.current);

	/** A refused bulk post, and Edit's chosen entries without the script (the form as a page). */
	const failure = $derived(form && 'error' in form ? (form as BulkFailure) : null);
	const edit = $derived(form && 'chosen' in form ? (form as BulkEdit) : null);
	// `back` is `/entries?<query>`; the actions carry the query so a refusal renders this table.
	const query = $derived(data.back.slice(data.back.indexOf('?') + 1));

	const rows = $derived(data.sheet.days.flatMap((d) => d.rows));
	const byId = $derived(new Map(rows.map((r) => [r.id, r])));
	const selection = createSelection(() => rows.map((r) => r.id));
	// Ticked from the start: a refused or edited selection as posted, or every row (`all=1`).
	untrack(() =>
		selection.setMany(
			failure?.selected ?? edit?.chosen.map((c) => c.id) ?? (data.all ? rows.map((r) => r.id) : []),
			true
		)
	);
	// A new shown set (a filter, the search, the range) clears the ticks (call 19).
	let shown = untrack(() => data.back);
	$effect.pre(() => {
		if (data.back === shown) return;
		shown = data.back;
		selection.clear();
	});

	const ticked = $derived(selection.ids);
	const tickedTotal = $derived(
		spanText(
			ticked.reduce((t, id) => {
				const r = byId.get(id);
				return r ? t + (r.endAt ?? now) - r.startAt : t;
			}, 0)
		)
	);
	const set = $derived(
		data.filter.q === ''
			? rangeLabel(data.filter)
			: `${rangeLabel(data.filter)} · “${data.filter.q}”`
	);
	/** The phone's Select: tick boxes in place of ⋯ and the bulk bar in the toolbar's place. */
	let picking = $state(untrack(() => data.select));
	const selectMode = $derived(enhanced ? picking : data.select);
	/** Where a cleared selection was made from: the head's box (PC) or Select (phone). */
	const origin = () =>
		[...document.querySelectorAll<HTMLElement>('[data-select-all], [data-select]')].find((el) =>
			el.checkVisibility()
		) ?? null;
	/** `el` is shown and on top at its centre, so focusing it scrolls nothing. */
	function inView(el: Element): boolean {
		const r = el.getBoundingClientRect();
		if (r.width === 0 || r.height === 0) return false;
		const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
		return at !== null && el.contains(at);
	}
	/** A row's control (its tick box, or once selecting is over its ⋯) and the day heads' boxes. */
	const ROW_CONTROL = 'input[type="checkbox"], button[aria-haspopup]';
	const CONTROLS =
		'[data-row] input[type="checkbox"], [data-row] button[aria-haspopup], tbody input[type="checkbox"], [data-phone-list] section input[type="checkbox"]';
	/**
	 * The ticks cleared (`last` the row last toggled): the focus back where the selecting
	 * began, the head's box or Select, when it is in view; else the last toggled row's
	 * control, else the control in view nearest it. The page never scrolls (the band may
	 * have been pinned a month down).
	 */
	async function cleared(last: string | null) {
		await tick();
		const from = origin();
		if (from && inView(from)) return from.focus();
		const row = last ? document.querySelector(`[data-row="${CSS.escape(last)}"]`) : null;
		const own = row?.querySelector<HTMLElement>(ROW_CONTROL);
		if (own && inView(own)) return own.focus({ preventScroll: true });
		const at = row?.getBoundingClientRect().top ?? innerHeight / 2;
		const distance = (el: Element) => Math.abs(el.getBoundingClientRect().top - at);
		const near = [...document.querySelectorAll<HTMLElement>(CONTROLS)]
			.filter(inView)
			.sort((a, b) => distance(a) - distance(b))[0];
		near?.focus({ preventScroll: true });
	}
	/** Clear selection (PC): the ticks clear. */
	function clearTicks() {
		const last = selection.last;
		selection.clear();
		void cleared(last);
	}
	/** Done: selecting ends and the ticks clear. */
	function leave() {
		const last = selection.last;
		picking = false;
		selection.clear();
		void cleared(last);
	}
	/**
	 * The bar takes the toolbar's place once a box is ticked (PC) or while selecting
	 * (phone). Without the script both show; the phone's bar only with `select=1`.
	 */
	const barUp = $derived(enhanced && (wide.current ? ticked.length > 0 : picking));

	/**
	 * While the bar is up its band (the bar and the chips under it) is pinned under the
	 * sticky bars, so the count and the actions stay in view however far down the ticks
	 * are; keyboard focus on a row lands clear of it.
	 */
	let band = $state<HTMLDivElement | null>(null);
	$effect(() => {
		const node = band;
		if (!node || !barUp) return;
		const clear = (e: FocusEvent) => clearOf(node, e.target);
		document.addEventListener('focusin', clear);
		return () => document.removeEventListener('focusin', clear);
	});

	/** The entries the dialog edits, with the versions shown; null while it is closed. */
	let editing = $state<Chosen[] | null>(null);
	const versionOf = (id: string) => failure?.versions[id] ?? String(byId.get(id)?.version ?? '');
	const openEdit = () => {
		if (ticked.length > 0) editing = ticked.map((id) => ({ id, version: versionOf(id) }));
	};

	/**
	 * A done bulk action: the ticks clear and the table reloads where it was, with the
	 * strip, whose Undo takes the focus.
	 */
	async function done(location: string) {
		editing = null;
		selection.clear();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
		await goto(location, { refreshAll: true, reset: false });
		await focusUndo(origin);
	}

	/** The bulk form as a page (no script): Edit's chosen entries, or a refused Apply's. */
	const onPage = $derived<Chosen[] | null>(
		edit?.chosen ??
			(failure?.action === 'apply'
				? failure.selected.map((id) => ({ id, version: failure.versions[id] ?? '' }))
				: null)
	);
	/** What the table says was refused: a row's post, or a bulk Edit or Delete. */
	const refusal = $derived(
		rowRefusal.error
			? { error: rowRefusal.error, reload: rowRefusal.reload }
			: failure && failure.action !== 'apply'
				? { error: failure.error, reload: failure.conflict }
				: null
	);
	/** The strip's flash: a refused action replaces it (the screen shows the refusal). */
	const strip = $derived(refusal || failure ? null : data.flash);
	const entryCount = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

	const link =
		'inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9';
</script>

<svelte:head><title>Entries · Time Keep</title></svelte:head>

<!-- A refused action replaces the strip: the screen shows the refusal, not an older success. -->
<!-- While the bulk bar is up the strip rides in its band instead, over the bar (below). -->
{#if !barUp}
	<UndoStrip flash={strip} back={data.back} />
{/if}
{#if refusal}
	<div
		role="alert"
		class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-destructive"
	>
		<p class="min-w-0 flex-1 text-pretty">{refusal.error}</p>
		{#if refusal.reload}
			<!-- A full load, so the table shows the entries as they are now. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the server -->
			<a href={data.back} data-sveltekit-reload class={link}>Reload</a>
		{/if}
	</div>
{/if}

<!-- Selecting on the phone, the "+" gives way (the shell hides it). While the bar is up the
     band is sticky under the bars: opaque, its padding taken back by negative margins so
     nothing below it moves; on the phone a surface band edge to edge on a bottom rule. -->
<div
	bind:this={band}
	class={[
		'flex flex-col gap-3',
		barUp &&
			'sticky top-(--bars-height) z-10 -mt-2 pt-2 max-lg:-mx-4 max-lg:-mb-[calc(0.5rem+1px)] max-lg:border-b max-lg:border-border max-lg:bg-card max-lg:px-4 max-lg:pb-2 lg:-mx-6 lg:-mb-3 lg:bg-background lg:px-6 lg:pb-3'
	]}
	data-selecting={selectMode ? '' : undefined}
	data-bulk-band={barUp ? '' : undefined}
>
	{#if barUp}
		<!-- Pinned with the band, so a row's Delete, Copy or Restart shows its Undo in view. -->
		<UndoStrip flash={strip} back={data.back} pin={false} />
	{/if}
	{#if !barUp}
		<Toolbar
			action={entries}
			noun={['entry', 'entries']}
			filter={data.filter}
			options={data.options}
			hints={data.hints}
			error={data.error}
			{clear}
			count={data.sheet.count}
			{total}
			sheet={enhanced && !wide.current}
			selectHref="{data.back}&select=1"
			onSelect={enhanced ? () => (picking = true) : undefined}
		/>
	{/if}
	{#if data.error === null && data.sheet.count > 0 && (barUp || !enhanced)}
		<!-- The no-JS bar is hidden from the first paint when the script will run (`data-nojs`). -->
		<div
			class={!enhanced && !data.select ? 'max-lg:hidden' : ''}
			data-nojs={enhanced ? undefined : ''}
		>
			<BulkBar
				{enhanced}
				count={ticked.length}
				total={tickedTotal}
				{set}
				back={data.back}
				{query}
				onEdit={openEdit}
				onDone={done}
				onClear={clearTicks}
				onLeave={leave}
			/>
		</div>
	{/if}
	<FilterChips scope={data.filter} options={data.options} href={withScope} />
</div>

{#if onPage && data.error === null}
	<section
		aria-labelledby="bulk-page-title"
		class="rounded-md border border-border bg-card px-4 lg:px-5"
	>
		<h2 id="bulk-page-title" class="pt-3 text-lg font-bold">Edit {entryCount(onPage.length)}</h2>
		<BulkForm
			choices={data.choices}
			chosen={onPage}
			failure={failure?.action === 'apply' ? failure : null}
			back={data.back}
			{query}
		/>
		<div class="h-4"></div>
	</section>
{/if}

{#if data.error === null}
	{#if data.sheet.count === 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
			{#if data.sheet.error !== null}
				<!-- The core refused the read (a search over 200 characters): say why, not "no match". -->
				<p role="alert" class="text-destructive">{data.sheet.error}</p>
				{#if data.filter.q !== ''}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
					<a href={clearSearch} class={link}>Clear the search</a>
				{/if}
			{:else if data.filter.q !== ''}
				<p class="text-muted-foreground">No entries match “{data.filter.q}”.</p>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
				<a href={clearSearch} class={link}>Clear the search</a>
			{:else}
				<p class="text-muted-foreground">No entries in this range.</p>
				{#if filtered}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
					<a href={clear} class={link}>Clear filters</a>
				{/if}
			{/if}
		</div>
	{:else}
		<div class="flex flex-col">
			{#if data.sheet.truncated}
				<p class="border-b border-border py-2 text-sm text-muted-foreground">
					Showing the newest 500 entries; narrow the filters.
				</p>
			{/if}
			{#if pc}
				<div class="rounded-md border border-border bg-card max-lg:hidden">
					<DayTable
						days={data.sheet.days}
						back={data.back}
						{now}
						loadedAt={data.now}
						warnings={data.flash?.warnings ?? []}
						{selection}
						{enhanced}
						versions={failure?.versions ?? {}}
					/>
				</div>
			{/if}
			{#if phone}
				<div class="lg:hidden">
					<PhoneList
						days={data.sheet.days}
						back={data.back}
						{now}
						loadedAt={data.now}
						warnings={data.flash?.warnings ?? []}
						{selection}
						{enhanced}
						selecting={selectMode}
						versions={failure?.versions ?? {}}
					/>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<BulkDialog
	chosen={editing}
	choices={data.choices}
	back={data.back}
	{query}
	onDone={done}
	onClose={() => (editing = null)}
/>
