<script lang="ts">
	import { applyAction, enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import { clearOf } from '#lib/components/focus-clear.js';
	import HistoryBar from '#lib/components/history/HistoryBar.svelte';
	import HistoryTable from '#lib/components/history/HistoryTable.svelte';
	import PhoneHistory from '#lib/components/history/PhoneHistory.svelte';
	import { barState } from '#lib/components/history/selection.js';
	import type { HistoryFailure } from '#lib/components/history/types.js';
	import { focusUndo } from '#lib/components/timesheet/live.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const FORM = 'history';
	/**
	 * Without the script both layouts render, CSS showing one, and a hidden box still
	 * posts. The phone's boxes and its bar are in a form of their own, so each layout's
	 * bar posts only the boxes it shows (a refusal's ticks come back ticked in both).
	 */
	const PHONE_FORM = 'history-phone';
	const failure = $derived(form && 'error' in form ? (form as HistoryFailure) : null);
	/** The page with the phone's tick boxes: Select without the script. */
	const withSelect = (path: string) => `${path}${path.includes('?') ? '&' : '?'}select=1`;
	// `data.back` is `/history` or `/history?before=<id>`. Posted from the phone's Select
	// without the script, the page returns to it with its tick boxes (`select=1`). The
	// actions carry its query so a refusal renders the page posted from.
	const back = $derived(data.select ? withSelect(data.back) : data.back);
	const query = $derived(back.includes('?') ? `&${back.split('?')[1]}` : '');

	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** From `lg` the PC's table; below it the phone's list. Without the script both render, CSS shows one. */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const pc = $derived(!enhanced || wide.current);
	const phone = $derived(!enhanced || !wide.current);
	/** The phone's Select: tick boxes on the open batches, the bar in the strip's place. */
	let picking = $state(untrack(() => data.select));
	const selecting = $derived(enhanced ? picking : data.select);

	const batches = $derived(data.days.flatMap((d) => d.batches));
	/** Each shown change: whether it is undone and its batch, for the bar. */
	const changes = $derived(
		new Map(
			batches.flatMap((b) =>
				b.changes.map((c) => [c.id, { id: c.id, undone: c.undone, batchId: b.id }] as const)
			)
		)
	);
	const labels = $derived(new Map(batches.map((b) => [b.id, b.label])));
	const batchOf = (changeId: string) => changes.get(changeId)?.batchId;

	// The ticks and the open batches; a refusal's ticks (no script) come back ticked and open.
	let picked = $state<string[]>(untrack(() => failure?.selected ?? []));
	let opened = $state<string[]>(
		untrack(() => [
			...new Set((failure?.selected ?? []).map(batchOf).filter((b) => b !== undefined))
		])
	);
	/** The tick box last toggled: where the focus goes when the ticks clear. */
	let last: string | null = null;

	const ticked = $derived(picked.filter((id) => changes.has(id)));
	const bar = $derived(
		barState(
			ticked.map((id) => changes.get(id)!),
			(b) => labels.get(b) ?? ''
		)
	);
	/** The bar takes the toolbar's place once a box is ticked (PC) or while selecting (phone). */
	const up = $derived(enhanced && (wide.current ? ticked.length > 0 : picking));

	const isTicked = (id: string) => picked.includes(id);
	function onTick(id: string, on: boolean) {
		picked = on ? [...picked.filter((c) => c !== id), id] : picked.filter((c) => c !== id);
		last = id;
	}
	const isOpen = (id: string) => opened.includes(id);
	const onToggle = (id: string) =>
		(opened = opened.includes(id) ? opened.filter((b) => b !== id) : [...opened, id]);

	// A page change clears the ticks and closes the batches.
	let shown = untrack(() => data.back);
	$effect.pre(() => {
		if (data.back === shown) return;
		shown = data.back;
		picked = [];
		opened = [];
		last = null;
	});

	/** Clear: the toolbar comes back, the focus on the tick box last toggled (or its row). */
	async function clear() {
		const at = last;
		picked = [];
		await tick();
		if (!at) return;
		const box = document.querySelector<HTMLInputElement>(
			`input[name="changeId"][value="${CSS.escape(at)}"]`
		);
		if (box?.checkVisibility()) return box.focus();
		const batch = batchOf(at);
		if (batch)
			document.querySelector<HTMLElement>(`[data-disclosure="${CSS.escape(batch)}"]`)?.focus();
	}

	/** The phone's Select: selecting begins. */
	const select = () => (picking = true);
	/** The phone's Done: selecting ends, the ticks clear, the focus goes back to Select. */
	async function leave() {
		picking = false;
		picked = [];
		last = null;
		await tick();
		document.querySelector<HTMLElement>('[data-select]')?.focus();
	}

	let alert = $state<HTMLDivElement | null>(null);

	/**
	 * Done: the ticks clear and the page reloads where it was, with the strip, whose Undo
	 * takes the focus. Refused: the alert says why and takes the focus; the ticks stay
	 * ticked and their batches open. Posted from the top, the page stays at the top: the
	 * browser's scroll anchoring would keep the rows still as the alert comes in above
	 * them and slide the toolbar under the header.
	 */
	const submit: SubmitFunction = () => {
		const fromTop = window.scrollY === 0;
		return async ({ result }) => {
			if (result.type === 'redirect') {
				picked = [];
				last = null;
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
				await goto(result.location, { refreshAll: true, reset: false });
				await focusUndo();
				return;
			}
			await applyAction(result);
			if (result.type !== 'failure') return;
			const holding = ticked.map(batchOf).filter((b) => b !== undefined);
			opened = [...new Set([...opened, ...holding])];
			await tick();
			if (fromTop) window.scrollTo(0, 0);
			alert?.focus();
		};
	};

	/** While the bar is up its band is pinned under the bars; focus on a row lands clear of it. */
	let band = $state<HTMLDivElement | null>(null);
	$effect(() => {
		const node = band;
		if (!node || !up) return;
		const clearBand = (e: FocusEvent) => clearOf(node, e.target);
		document.addEventListener('focusin', clearBand);
		return () => document.removeEventListener('focusin', clearBand);
	});

	const strip = $derived(failure ? null : data.flash);

	const link =
		'inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-sm font-medium text-foreground underline decoration-input underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 lg:min-w-0';
</script>

<svelte:head><title>History · Time Keep</title></svelte:head>

<!-- A refused action replaces the strip: the screen shows the refusal, not an older success.
     While the bulk bar is up the strip rides in its band instead, over the bar. -->
{#if !up}
	<UndoStrip flash={strip} back={data.back} />
{/if}

{#if data.days.length === 0}
	<p class="border-b border-border py-3 text-sm text-muted-foreground">Nothing recorded yet.</p>
{:else}
	<!-- While the bar is up the band is sticky under the bars, opaque, its padding taken
	     back by negative margins so nothing below it moves. On the phone the band is a
	     surface strip edge to edge on a bottom rule, flush under the timer strip unless
	     the undo strip is over it (in the band's place, so the list keeps its place when
	     the band takes it in); selecting there, the "+" gives way (the shell hides it). -->
	<div
		bind:this={band}
		class={[
			'flex flex-col gap-6 max-lg:-mx-4 max-lg:border-b max-lg:border-border max-lg:bg-card max-lg:px-4 max-lg:py-3',
			!strip && 'max-lg:-mt-6',
			up && 'sticky top-(--bars-height) z-10',
			up && 'lg:-mx-6 lg:-mt-2 lg:-mb-3 lg:bg-background lg:px-6 lg:pt-2 lg:pb-3'
		]}
		data-selecting={selecting ? '' : undefined}
	>
		{#if up}
			<UndoStrip flash={strip} back={data.back} pin={false} />
		{/if}
		<HistoryBar
			{enhanced}
			phone={enhanced && !wide.current}
			{up}
			selecting={!enhanced && data.select}
			{bar}
			range={data.range}
			newer={data.newer}
			older={data.older}
			{query}
			form={FORM}
			phoneForm={PHONE_FORM}
			selectHref={withSelect(data.back)}
			doneHref={data.back}
			onClear={clear}
			onSelect={select}
			onDone={leave}
		/>
	</div>

	{#if failure}
		<div
			bind:this={alert}
			role="alert"
			tabindex="-1"
			class="rounded-md border border-destructive/60 bg-card px-3.5 py-2 text-sm text-pretty text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{failure.error}
		</div>
	{/if}

	<form
		id={FORM}
		method="POST"
		action="?/undo{query}"
		use:enhance={submit}
		data-enhanced={enhanced ? '' : undefined}
	>
		<input type="hidden" name="back" value={back} />
		{#if pc}
			<div class="max-lg:hidden">
				<HistoryTable
					days={data.days}
					{enhanced}
					{isOpen}
					{onToggle}
					ticked={isTicked}
					{onTick}
					{query}
				/>
			</div>
		{/if}
		{#if phone}
			<!-- Flush under the strip; the alert, when there is one, keeps its gap. -->
			<div class={['lg:hidden', !failure && '-mt-6']}>
				<PhoneHistory
					days={data.days}
					{enhanced}
					{selecting}
					{isOpen}
					{onToggle}
					ticked={isTicked}
					{onTick}
					{query}
					form={enhanced ? undefined : PHONE_FORM}
				/>
			</div>
		{/if}
	</form>
	{#if !enhanced}
		<form id={PHONE_FORM} method="POST" action="?/undo{query}">
			<input type="hidden" name="back" value={back} />
		</form>
	{/if}

	{#if data.older || data.newer}
		<nav aria-label="More pages" class="flex flex-wrap gap-x-6 gap-y-2">
			{#if data.newer}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a /history path from historyPath() -->
				<a href={data.newer} class={link}>Newer</a>
			{/if}
			{#if data.older}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a /history path from historyPath() -->
				<a href={data.older} class={link}>Older</a>
			{/if}
		</nav>
	{/if}
{/if}
