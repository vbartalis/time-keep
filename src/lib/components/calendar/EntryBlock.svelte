<script lang="ts">
	import { resolve } from '$app/paths';
	import { dayName } from '#lib/calendar/dates.js';
	import { spanText, type Piece } from '#lib/calendar/grid.js';
	import { LINE, PAD, marksOf } from './block';
	import type { CalendarEntry } from './types';

	let {
		entry,
		piece,
		hour,
		detail,
		back,
		now,
		handles = false,
		look = 'rest',
		onneed
	}: {
		entry: CalendarEntry;
		/** The piece's own minutes, its lane, and the minutes it is drawn over (`drawnExtent`). */
		piece: Piece & { lane: number; lanes: number; drawn: { from: number; to: number } };
		/** One hour's height, px. */
		hour: number;
		/** The week's text, the day's fuller text, or colour only (the phone's week). */
		detail: 'week' | 'day' | 'none';
		back: string;
		now: number;
		/**
		 * The PC's stretch handles: on hover and focus, the top on the piece holding the
		 * entry's start, the bottom on the one holding its end (call 29).
		 */
		handles?: boolean;
		/**
		 * At rest; dragged away (a dashed outline where it was); or lifted where it would
		 * land (the popover-down shadow, no link of its own).
		 */
		look?: 'rest' | 'ghost' | 'lifted';
		/** Reports the lines this block's text needs (a block sharing its column). */
		onneed?: (lines: number) => void;
	} = $props();

	const running = $derived(entry.running ? spanText(now - entry.startAt) : '');
	const duration = $derived(entry.endAt === null ? running : spanText(entry.endAt - entry.startAt));
	const name = $derived(`${entry.customerName} › ${entry.projectName}`);

	/** The full text: the accessible name and (a part a line) the tooltip. */
	const parts = $derived(
		[
			name,
			entry.running
				? `${entry.startTime}–now, Running ${running}`
				: `${entry.startTime}–${entry.endTime}, ${duration}`,
			piece.first ? null : 'from the previous day',
			entry.activityName,
			entry.locationName,
			entry.reference,
			entry.description,
			entry.overlaps ? 'Overlaps another entry' : null
		].filter((p): p is string => !!p)
	);
	/**
	 * The accessible name: in the week the column's day first ("Tuesday 13 October, …"),
	 * which the screen shows only by the column's place; the day view's toolbar names it.
	 */
	const label = $derived((detail === 'week' ? [dayName(piece.date), ...parts] : parts).join(', '));

	/** The piece that ends at now: its foot is the running block's dashed one. */
	const live = $derived(entry.running && piece.to < 1440);
	const marks = $derived(marksOf(entry.overlaps, live));
	const top = $derived((piece.drawn.from / 60) * hour);
	const height = $derived(((piece.drawn.to - piece.drawn.from) / 60) * hour);
	// The text's room: the block less its gap, marks and padding, in whole lines.
	const lines = $derived(Math.max(1, Math.floor((height - 1 - marks - PAD) / LINE)));
	/**
	 * Under 45 minutes: one line, the project then the start. Alone in a day's column and
	 * drawn taller than its time (the phone's 44 px target), it has the times under the name.
	 */
	const short = $derived(
		piece.to - piece.from < 45 && !(detail === 'day' && piece.lanes === 1 && lines > 1)
	);
	/** The dashed foot marks now: drawn only where the block ends at now, not past it. */
	const footAtNow = $derived(live && piece.drawn.to <= piece.to);

	/** The running time where the end would be; "now" only on the piece that ends at now. */
	const runningWord = $derived(live ? 'now · Running' : 'Running');
	/** The times line before the running time: in the week the running time stands alone. */
	const lead = $derived(
		entry.running && live && detail === 'week'
			? ''
			: piece.first
				? `${entry.startTime}–`
				: entry.running
					? 'from the previous day · '
					: 'from the previous day'
	);
	const tail = $derived(
		[
			!entry.running && piece.first ? entry.endTime : '',
			detail === 'day' && !entry.running && piece.first ? ` · ${duration}` : '',
			detail === 'week' && !entry.running && entry.reference ? ` · ${entry.reference}` : ''
		].join('')
	);
	const meta = $derived(
		[entry.activityName, entry.locationName, entry.reference].filter(Boolean).join(' · ')
	);
	/** The lines under the name, in the order they give way as the block shortens. */
	const rest = $derived.by(() => {
		const out: ('times' | 'meta' | 'description')[] = ['times'];
		if (detail === 'day' && meta) out.push('meta');
		if (entry.description) out.push('description');
		return out.slice(0, lines - 1);
	});
	/**
	 * Sharing its column, a block with lines to spare gives its name a second one (taken
	 * from the description), so the name wraps rather than ending in an ellipsis.
	 */
	const nameRoom = $derived(piece.lanes > 1 && lines - rest.length >= 2 ? 2 : 1);
	/** The name and the other lines take theirs; the description has what is left. */
	const descriptionLines = $derived(lines - rest.length - (nameRoom - 1));
	/** A short block given more than a line (it shares its column): the name wraps over them. */
	const nameLines = $derived(short ? lines - (live ? 1 : 0) : lines);

	let nameEl = $state<HTMLElement>();
	// Sharing its column, the block measures the lines its wrapped name takes (with the
	// running time's under a short one), so the grid can draw it tall enough.
	$effect(() => {
		const el = nameEl;
		const report = onneed;
		const extra = short && live ? 1 : 0;
		if (!el || !report || piece.lanes < 2) return;
		const measure = () => {
			if (el.checkVisibility()) report(Math.ceil((el.scrollHeight - 1) / LINE) + extra);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});

	/** The ends this piece holds: a middle piece of a long entry has none (call 29). */
	const edges = $derived(
		(['start', 'end'] as const).filter((edge) => (edge === 'start' ? piece.first : piece.last))
	);

	const href = $derived(
		`${resolve('/(app)/entries/[id]', { id: entry.id })}?back=${encodeURIComponent(back)}`
	);
	const style = $derived(
		[
			`top:${top}px`,
			`height:${Math.max(height - 1, 0)}px`,
			`left:calc(${(piece.lane / piece.lanes) * 100}% + 1px)`,
			`width:calc(${100 / piece.lanes}% - 2px)`,
			`--edge:var(--project-${entry.colour})`,
			`--fill:var(--project-${entry.colour}-fill)`,
			`--ink:var(--project-${entry.colour}-ink)`
		].join(';')
	);
	const box = $derived(
		[
			'absolute z-[1] overflow-hidden rounded-sm border-l-3 border-(--edge) bg-(--fill) text-(--ink)',
			entry.overlaps ? 'border-t-2 border-t-destructive' : '',
			footAtNow ? 'border-b-2 border-b-primary [border-bottom-style:dashed]' : '',
			look === 'ghost'
				? 'after:pointer-events-none after:absolute after:inset-0 after:rounded-sm after:border after:border-dashed after:border-(--edge)'
				: '',
			look === 'lifted'
				? 'pointer-events-none z-[5] shadow-[0_8px_24px_rgb(0_0_0/0.12)] ring-1 ring-(--edge)'
				: ''
		].join(' ')
	);
	/** Wraps at word boundaries first, inside a word only when it is wider than the block. */
	const clamp =
		'overflow-hidden wrap-break-word [display:-webkit-box] [-webkit-box-orient:vertical]';
</script>

<!-- The running time, after what gives way to it in its line (`cls` its gap): kept whole,
	and narrower than that the word gives way; the elapsed time always reads. -->
{#snippet elapsed(word: string, cls: string)}
	<span data-running class="flex max-w-full shrink-0 font-semibold text-primary figures {cls}"
		><span class="min-w-0 truncate">{word}</span><span class="shrink-0 whitespace-pre"
			>{` ${running}`}</span
		></span
	>
{/snippet}

{#snippet projectName()}
	{#if detail === 'day'}<span class="@max-[14rem]:hidden">{`${entry.customerName} › `}</span
		>{/if}{entry.projectName}
{/snippet}

{#if detail === 'none'}
	<span
		data-entry-id={entry.id}
		data-first={piece.first}
		data-last={piece.last}
		aria-hidden="true"
		class={box}
		{style}
	></span>
{:else}
	{@const isLifted = look === 'lifted'}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- href is resolved above -->
	<svelte:element
		this={isLifted ? 'div' : 'a'}
		href={isLifted ? undefined : href}
		draggable={isLifted ? undefined : 'false'}
		data-entry-form={isLifted ? undefined : ''}
		data-entry-id={isLifted ? undefined : entry.id}
		data-first={piece.first}
		data-last={piece.last}
		data-ghost={look === 'ghost' ? '' : undefined}
		data-lifted={isLifted ? '' : undefined}
		aria-hidden={isLifted ? 'true' : undefined}
		aria-label={isLifted ? undefined : label}
		title={isLifted ? undefined : parts.join('\n')}
		class="{box} group @container pt-0.5 text-xs leading-[15px] outline-none hover:brightness-[0.97] focus-visible:z-[3] focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-110"
		{style}
	>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<span class="block px-1.5 @max-[5rem]:px-0.5">
			{#if short && lines === 1}
				<span class="flex min-w-0 whitespace-nowrap {live ? '' : 'gap-1.5'}">
					<span data-name class="min-w-0 truncate font-semibold">{entry.projectName}</span>
					{#if live}
						<!-- A timer just started: its running time where the start would be. -->
						{@render elapsed('Running', 'pl-1.5')}
					{:else}
						<span
							class="min-w-0 truncate figures @max-[7rem]:hidden {piece.first ? 'shrink-0' : ''}"
							>{piece.first ? entry.startTime : 'from the previous day'}</span
						>
					{/if}
				</span>
			{:else if short}
				<span
					bind:this={nameEl}
					data-name
					class="{clamp} font-semibold"
					style:-webkit-line-clamp={nameLines}>{@render projectName()}</span
				>
				{#if live}
					{@render elapsed('Running', '')}
				{/if}
			{:else}
				<!-- One line; every line once the block is too narrow for anything else. -->
				<span
					bind:this={nameEl}
					data-name
					class="{clamp} font-semibold [--name-lines:var(--room)] @max-[5rem]:[--name-lines:var(--lines)]"
					style:--lines={nameLines}
					style:--room={nameRoom}
					style:-webkit-line-clamp="var(--name-lines)">{@render projectName()}</span
				>
				{#each rest as line (line)}
					{#if line === 'times'}
						{#if entry.running}
							<span data-times class="flex figures @max-[5rem]:hidden"
								><span class="min-w-0 truncate">{lead}</span>{@render elapsed(
									runningWord,
									''
								)}</span
							>
						{:else}
							<span data-times class="block truncate figures @max-[5rem]:hidden">{lead}{tail}</span>
						{/if}
					{:else if line === 'meta'}
						<span class="block truncate @max-[6rem]:hidden">{meta}</span>
					{:else}
						<span class="block @max-[6rem]:hidden">
							<span class={clamp} style:-webkit-line-clamp={descriptionLines}
								>{entry.description}</span
							>
						</span>
					{/if}
				{/each}
			{/if}
		</span>
		{#if handles}
			<!-- The stretch handles: hit areas along the edges, a small grip drawn on hover,
				on focus and while lifted. Pointer only; the form changes the times by keyboard. -->
			{#each edges as edge (edge)}
				<span
					data-handle={edge}
					aria-hidden="true"
					class="absolute inset-x-0 flex h-2 max-h-[33%] cursor-ns-resize justify-center {edge ===
					'start'
						? 'top-0 items-start'
						: 'bottom-0 items-end'}"
				>
					<span
						class="mx-auto h-[3px] w-6 shrink-0 rounded-full bg-(--ink) opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60 {isLifted
							? 'opacity-60'
							: ''}"
					></span>
				</span>
			{/each}
		{/if}
	</svelte:element>
{/if}
