<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { BarState } from './selection';
	import type { HistoryRange } from './types';

	/**
	 * The band above the table, 52 px tall: the toolbar (the page's place, Newer and
	 * Older) or, once a change is ticked, the bulk bar in its place ("2 selected", Undo
	 * selected, Redo selected, Clear), so nothing below moves. Without the script both
	 * show: the bar's two buttons post the ticked changes, whatever they are.
	 *
	 * Below `lg` (`phone`) the toolbar is a strip, "1–50 of 312" and Select clear of the
	 * "+"'s column; Select puts the bar in its place ("2 selected", Undo, Redo, Done).
	 * Without the script Select is a link (`select=1`) and the bar's Done a link back.
	 */
	let {
		enhanced,
		phone,
		up,
		selecting,
		bar,
		range,
		newer,
		older,
		query,
		form,
		phoneForm,
		selectHref,
		doneHref,
		onClear,
		onSelect,
		onDone
	}: {
		enhanced: boolean;
		/** Below `lg`, with the script: the phone's strip and bar only. */
		phone: boolean;
		/** The bulk bar takes the toolbar's place: a tick (PC) or Select (phone), with the script. */
		up: boolean;
		/** The phone's Select without the script (`select=1`): its bar in the strip's place. */
		selecting: boolean;
		bar: BarState;
		range: HistoryRange;
		newer: string | null;
		older: string | null;
		/** Appended to the actions, so a refusal renders the page posted from. */
		query: string;
		/** The id of the form the ticks are in. */
		form: string;
		/** The form of the phone's tick boxes without the script: its bar posts only them. */
		phoneForm: string;
		/** The page with its tick boxes, and without them: Select and Done without the script. */
		selectHref: string;
		doneHref: string;
		onClear: () => void;
		onSelect: () => void;
		/** The phone's Done: selecting ends and the ticks clear. */
		onDone: () => void;
	} = $props();

	const REASON = 'Tick only standing or only undone changes.';
	/** A disabled action stays in the tab order and says it is disabled (call 11). */
	const guard = (on: boolean) => (e: MouseEvent) => {
		if (!on) e.preventDefault();
	};
	const off = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';
	/** Without the script both widths render; CSS shows one. */
	const pcOnly = $derived(enhanced ? '' : 'max-lg:hidden');
	const phoneOnly = $derived(enhanced ? '' : 'lg:hidden');
</script>

{#snippet place(unit: string)}
	<span class="font-semibold text-foreground figures">{range.from}–{range.to}</span>
	of <span class="figures">{range.total}</span>{unit}
{/snippet}

{#if up && phone}
	<section aria-label="Selection" class="flex min-h-11 items-center gap-2">
		<p class="flex min-w-0 flex-1 flex-col text-sm leading-tight" aria-live="polite">
			<span class="font-semibold whitespace-nowrap figures">{bar.count} selected</span>
			{#if bar.mixed}
				<span class="text-xs text-pretty text-muted-foreground">{REASON}</span>
			{:else if bar.scope}
				<span class="truncate text-xs text-muted-foreground">{bar.scope}</span>
			{/if}
		</p>
		<Button
			type="submit"
			variant="outline"
			{form}
			formaction="?/undo{query}"
			aria-disabled={!bar.canUndo}
			onclick={guard(bar.canUndo)}
			class="px-3 {off}">Undo</Button
		>
		<Button
			type="submit"
			variant="outline"
			{form}
			formaction="?/redo{query}"
			aria-disabled={!bar.canRedo}
			onclick={guard(bar.canRedo)}
			class="px-3 {off}">Redo</Button
		>
		<Button variant="outline" class="px-3" onclick={onDone}>Done</Button>
	</section>
{:else if up}
	<section
		aria-label="Selection"
		class="flex h-13 items-center gap-2 rounded-md border border-foreground/80 bg-card px-2"
	>
		<p class="flex min-w-0 flex-1 items-baseline gap-3 px-2 text-sm" aria-live="polite">
			<span class="font-semibold whitespace-nowrap figures">{bar.count} selected</span>
			<span class="min-w-0 truncate text-muted-foreground">{bar.mixed ? REASON : bar.scope}</span>
		</p>
		<Button
			type="submit"
			variant="outline"
			{form}
			formaction="?/undo{query}"
			aria-disabled={!bar.canUndo}
			onclick={guard(bar.canUndo)}
			class={off}><Undo2 aria-hidden="true" />Undo selected</Button
		>
		<Button
			type="submit"
			variant="outline"
			{form}
			formaction="?/redo{query}"
			aria-disabled={!bar.canRedo}
			onclick={guard(bar.canRedo)}
			class={off}><Redo2 aria-hidden="true" />Redo selected</Button
		>
		<Button variant="ghost" onclick={onClear}>Clear</Button>
	</section>
{:else}
	{#if (phone || !enhanced) && !selecting}
		<!-- The phone's strip: Select stays out of the "+"'s column. -->
		<div class="flex min-h-11 items-center gap-3 pr-14 {phoneOnly}">
			<p class="text-sm text-muted-foreground">{@render place('')}</p>
			{#if enhanced}
				<Button variant="outline" class="ml-auto" onclick={onSelect} data-select>Select</Button>
			{:else}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a /history path from historyPath() -->
				<Button variant="outline" class="ml-auto" href={selectHref}>Select</Button>
			{/if}
		</div>
	{/if}
	{#if !phone}
		<div class="flex h-13 items-center gap-3 {pcOnly}">
			<p class="text-sm text-muted-foreground">
				{@render place(range.total === 1 ? ' batch' : ' batches')}
			</p>
			<nav aria-label="Pages" class="ml-auto flex gap-2">
				{#if newer}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a /history path from historyPath() -->
					<Button variant="outline" href={newer}><ChevronLeft aria-hidden="true" />Newer</Button>
				{:else}
					<Button variant="outline" disabled><ChevronLeft aria-hidden="true" />Newer</Button>
				{/if}
				{#if older}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a /history path from historyPath() -->
					<Button variant="outline" href={older}>Older<ChevronRight aria-hidden="true" /></Button>
				{:else}
					<Button variant="outline" disabled>Older<ChevronRight aria-hidden="true" /></Button>
				{/if}
			</nav>
		</div>
	{/if}
{/if}

{#if !enhanced}
	<!-- Without the script: always shown, posting the ticked changes (the core says when
	     none are ticked). Hidden from the first paint when the script will run. -->
	<div data-nojs class="flex flex-wrap items-center gap-2 max-lg:hidden">
		<Button type="submit" variant="outline" {form} formaction="?/undo{query}"
			><Undo2 aria-hidden="true" />Undo selected</Button
		>
		<Button type="submit" variant="outline" {form} formaction="?/redo{query}"
			><Redo2 aria-hidden="true" />Redo selected</Button
		>
	</div>
	{#if selecting}
		<!-- The phone's bar without the script, in the strip's place: no count (the core
		     says when none are ticked); Done reloads without the tick boxes. It posts the
		     phone's form, so the PC table's boxes, hidden but there, never post with it. -->
		<section aria-label="Selection" class="flex min-h-11 items-center gap-2 lg:hidden">
			<Button type="submit" variant="outline" form={phoneForm} formaction="?/undo{query}"
				>Undo</Button
			>
			<Button type="submit" variant="outline" form={phoneForm} formaction="?/redo{query}"
				>Redo</Button
			>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a /history path from historyPath() -->
			<Button variant="outline" class="ml-auto" href={doneHref}>Done</Button>
		</section>
	{/if}
{/if}
