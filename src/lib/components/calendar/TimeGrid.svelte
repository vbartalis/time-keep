<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { calendarHref } from '#lib/calendar/dates.js';
	import { STILL, clockOf, type Draft } from '#lib/calendar/gestures.svelte.js';
	import {
		dragRange,
		growChips,
		growShared,
		halfHourSlot,
		lanes,
		layoutDay,
		localDate,
		localMinutes,
		piecesOf,
		spanText,
		type Chip,
		type Piece
	} from '#lib/calendar/grid.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { openForm } from '#lib/entry-link.js';
	import { LANE_FLOOR, drawnExtent, growInto, heightFor, marksOf } from './block';
	import { BlockDrag } from './drag.svelte';
	import EntryBlock from './EntryBlock.svelte';
	import MoreChip from './MoreChip.svelte';
	import MoreSheet from './MoreSheet.svelte';
	import NewBlock from './NewBlock.svelte';
	import type { CalendarEntry } from './types';

	let {
		days,
		entries,
		totals,
		today,
		zone,
		now,
		hour,
		compact,
		back,
		scope = '',
		create,
		draft = $bindable(null),
		class: cls = ''
	}: {
		days: string[];
		entries: CalendarEntry[];
		/** Milliseconds by date, only days with some. */
		totals: Record<string, number>;
		today: string;
		zone: string;
		now: number;
		/** One hour's height, px. */
		hour: number;
		/** The phone's week: letter heads, colour-only blocks, each column a link to its day. */
		compact: boolean;
		back: string;
		/** The filter's query, carried by every link. */
		scope?: string;
		/**
		 * Creating on empty time: the PC's click or drag, the phone day's tap and handles,
		 * or none (the phone's week: call 25).
		 */
		create: 'drag' | 'tap' | 'none';
		/** The phone's new block, pending until New entry, Cancel or a tap elsewhere. */
		draft?: Draft | null;
		class?: string;
	} = $props();

	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	const HOURS = Array.from({ length: 24 }, (_, h) => h);
	/** The working day's shading: before 08:00 and from 20:00. */
	const SHADE = [
		{ from: 0, to: 8 },
		{ from: 20, to: 24 }
	];

	const day = $derived(days.length === 1);
	const label = $derived(day ? 'Day grid' : 'Week grid');
	const detail = $derived<'week' | 'day' | 'none'>(compact ? 'none' : day ? 'day' : 'week');
	const headHeight = $derived(compact ? 64 : 62);
	/** The compact gutter is wide enough for the time now's tag ("13:52"). */
	const gutter = $derived(compact ? 40 : day ? 52 : 56);
	const body = $derived(24 * hour);
	/** The phone's day, which folds a crowded run as the week does (item 21). */
	const phoneDay = $derived(create === 'tap' && !compact);

	type Drawn = { piece: Piece; entry: CalendarEntry; marks: number; from: number; to: number };
	type Placed = Piece & { lane: number; lanes: number; drawn: { from: number; to: number } };
	/**
	 * A "+n" chip, with the entries it folds in start order and `start`, its run's first
	 * start in minutes: the time it names (its drawn `from` is lifted near midnight).
	 */
	type Folded = Chip & { entries: CalendarEntry[]; start: number };
	type Day = { blocks: { entry: CalendarEntry; piece: Placed }[]; chips: Folded[] };

	/** A block of `lines` lines at least, by its drawn extent. */
	const draw = (d: Drawn, lines: number): Drawn => ({
		...d,
		...drawnExtent(d.piece.from, d.piece.to, compact ? 4 : heightFor(lines, d.marks), hour)
	});
	/**
	 * The phone's day: a block grows toward a 44 px target (PRODUCT.md) into the free time
	 * after it, never so far that it would share its column (a day block runs full width).
	 */
	const grown = (ds: Drawn[]) =>
		create === 'tap'
			? growInto(ds, Math.ceil((44 * 60) / hour)).map((g, i) =>
					// The running block runs to now, never past it: it keeps its one-line minimum.
					ds[i].entry.running && ds[i].piece.to < 1440 ? ds[i] : g
				)
			: ds;

	/**
	 * The lines a block sharing its column needs for its project's name, as the block
	 * measured them (by entry and date). Before it has (and without JavaScript): two, or
	 * three among three or more.
	 */
	const need = new SvelteMap<string, number>();
	const needOf = (entry: CalendarEntry, date: string) => need.get(`${entry.id}:${date}`) ?? 0;
	const measured = (entry: CalendarEntry, date: string) => (lines: number) => {
		const key = `${entry.id}:${date}`;
		// Only ever more: a block that grew never shrinks back into a loop.
		if (lines > (need.get(key) ?? 0)) need.set(key, lines);
	};

	/**
	 * The lanes a PC week column fits at the readable floor, measured on the rendered
	 * column; never fewer than two (narrower, a first word may end in an ellipsis), and two
	 * before it is measured and without JavaScript.
	 */
	let weekFit = $state(2);
	/**
	 * The lanes the phone's day column fits at the floor, measured as the week's are; four
	 * (a 390 px phone's) before it is measured and without JavaScript. The PC's day never
	 * hides a block (item 21).
	 */
	let dayFit = $state(4);

	/**
	 * Each day's pieces, side by side only where their drawn blocks meet, grouped once from
	 * their one-line boxes (spec, item 19). A group wider than the week's column, or the
	 * phone's day column (item 21), shows what fits and a "+n" chip per run of the rest; a
	 * chip keeps the folded boxes' indices. On the phone's day a chip grows toward 44 px into
	 * free time (under it, then above) first, so no block grows into its time. A block
	 * sharing its column then grows, only into free time, toward the lines its project's
	 * name needs; that never regroups.
	 */
	const placed = $derived.by(() => {
		const byDay = new Map<string, Drawn[]>(days.map((d) => [d, []]));
		for (const entry of entries) {
			for (const p of piecesOf(entry, days, zone, now)) {
				const live = entry.running && p.to < 1440;
				const base = { piece: p, entry, marks: marksOf(entry.overlaps, live), from: 0, to: 0 };
				byDay.get(p.date)?.push(draw(base, 1));
			}
		}
		const toPlaced = <D extends Drawn & { lane: number; lanes: number }>(d: D) => ({
			entry: d.entry,
			piece: { ...d.piece, lane: d.lane, lanes: d.lanes, drawn: { from: d.from, to: d.to } }
		});
		const minutesOf = (px: number) => Math.ceil((px * 60) / hour);
		const place = (date: string, ds: Drawn[]): Day => {
			// The phone's week: colour only, each column a link to its day; lanes as they were.
			if (compact) return { blocks: lanes(grown(ds)).map(toPlaced), chips: [] };
			const boxes = grown(ds).map((d) => ({ ...d, running: d.entry.running }));
			const fit = detail === 'week' ? weekFit : phoneDay ? dayFit : Infinity;
			const { shown, chips: folded } = layoutDay(boxes, fit);
			const chips = phoneDay ? growChips(folded, shown, Math.ceil((44 * 60) / hour)) : folded;
			// Two lines for the name, or three among three or more lanes, until it has measured.
			const want = (d: (typeof shown)[number]) =>
				minutesOf(heightFor(Math.max(d.lanes > 2 ? 3 : 2, needOf(d.entry, date)), d.marks));
			const blocks = growShared(shown, chips, want);
			return {
				blocks: blocks.map(toPlaced),
				chips: chips.map((c) => ({
					...c,
					entries: c.hidden.map((i) => boxes[i].entry),
					start: Math.min(...c.hidden.map((i) => boxes[i].piece.from))
				}))
			};
		};
		return new Map([...byDay].map(([date, ds]) => [date, place(date, ds)]));
	});

	/**
	 * The PC's day column holds its widest group at the floor (rule 12): the most lanes any
	 * group takes, each at least LANE_FLOOR wide, past the column's 1 px rule. Wider than
	 * the grid, the grid scrolls sideways. The week's columns never do, nor the phone's day,
	 * which folds what it cannot fit (item 21).
	 */
	const dayColumn = $derived.by(() => {
		if (detail !== 'day' || phoneDay) return null;
		let maxLanes = 1;
		for (const { blocks } of placed.values())
			for (const { piece } of blocks) maxLanes = Math.max(maxLanes, piece.lanes);
		return maxLanes * LANE_FLOOR + 1;
	});

	// The phone day's chip opens a sheet of the entries it folds (item 21).

	const chipKey = (chip: Chip) => `${chip.group}:${chip.from}`;
	/** The chip whose sheet is open, by key: its entries follow the layout as it changes. */
	let sheet = $state<{ key: string } | null>(null);
	const sheetChip = $derived.by(() => {
		if (!sheet) return null;
		for (const { chips } of placed.values())
			for (const chip of chips) if (chipKey(chip) === sheet.key) return chip;
		return null;
	});
	const sheetTitle = (chip: Folded) =>
		`${chip.count} more ${chip.count === 1 ? 'entry' : 'entries'} from ${clockOf(chip.start)}`;

	// A change that takes the chip away (its run thinned out) closes its sheet; the dialog's
	// focus, which would return to the chip, goes to the grid instead.
	$effect(() => {
		if (!sheet || sheetChip) return;
		sheet = null;
		void tick().then(() => scroller?.focus({ preventScroll: true }));
	});

	// Moving and resizing on the PC (spec, Moving and resizing).

	/** The PC's grid drags its blocks; the phone moves an entry through its form. */
	const drag = untrack(() => create === 'drag')
		? new BlockDrag({
				entries: () => entries,
				days: () => days,
				zone: () => zone,
				hour: () => hour
			})
		: null;
	const moving = $derived(drag?.moving ?? null);
	const clockAt = (at: number) => clockOf(localMinutes(at, zone));

	/** The dragged entry where it would land: its pieces, lifted, over the whole column. */
	const lifted = $derived.by(() => {
		const to = moving;
		const entry = to && entries.find((e) => e.id === to.id);
		if (!to || !entry) return new Map<string, { entry: CalendarEntry; piece: Placed }>();
		const shown: CalendarEntry = {
			...entry,
			startAt: to.startAt,
			endAt: to.endAt,
			date: localDate(to.startAt, zone),
			startTime: clockAt(to.startAt),
			endTime: clockAt(to.endAt),
			overlaps: false
		};
		return new Map(
			piecesOf(shown, days, zone, now).map((p) => [
				p.date,
				{
					entry: shown,
					piece: {
						...p,
						lane: 0,
						lanes: 1,
						drawn: drawnExtent(p.from, p.to, heightFor(1, 0), hour)
					}
				}
			])
		);
	});
	/** Where it will land, over its first piece in view: "Fri 14:15–15:30". */
	const landing = $derived.by(() => {
		const first = [...lifted.values()][0];
		if (!first) return null;
		const { entry, piece } = first;
		const weekday = parts(entry.date).weekday.slice(0, 3);
		return {
			date: piece.date,
			top: piece.drawn.from,
			text: `${weekday} ${entry.startTime}–${entry.endTime}`
		};
	});

	const nowMinutes = $derived(localMinutes(now, zone));
	const nowTime = $derived(
		`${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`
	);
	const showsToday = $derived(days.includes(today));

	const parts = (date: string) => {
		const d = new Date(`${date}T00:00:00Z`);
		return {
			weekday: WEEKDAYS[d.getUTCDay()],
			day: d.getUTCDate(),
			month: MONTHS[d.getUTCMonth()]
		};
	};
	const hourText = (h: number) => (compact ? String(h) : `${String(h).padStart(2, '0')}:00`);

	let section = $state<HTMLElement>();
	let scroller = $state<HTMLElement>();

	/** The grid fills the viewport below the toolbar, above the phone's bottom bar. */
	function fit() {
		if (!section || !section.checkVisibility()) return;
		const top = section.getBoundingClientRect().top + window.scrollY;
		// The phone's bottom bar (fixed, at the foot), or the PC's margin.
		const bar = [...document.querySelectorAll<HTMLElement>('nav[aria-label="Main"]')].find(
			(n) => n.checkVisibility() && getComputedStyle(n).position === 'fixed'
		);
		const below = bar ? bar.offsetHeight : 24;
		section.style.height = `${Math.max(320, window.innerHeight - top - below)}px`;
	}

	/**
	 * Opens on the working day: 07:00 at the top, earlier for an entry starting earlier in
	 * view (a piece continuing from the day before does not count), and now in view when
	 * the period holds it.
	 */
	function scrollToWorkingDay() {
		if (!scroller || !scroller.checkVisibility()) return;
		let start = 7 * 60;
		for (const { blocks } of placed.values())
			for (const { piece } of blocks) if (piece.first) start = Math.min(start, piece.from);
		if (showsToday) {
			const foot = scroller.scrollHeight - headHeight - body;
			const visible = ((scroller.clientHeight - headHeight - foot) / hour) * 60;
			if (nowMinutes < start) start = Math.max(0, nowMinutes - 60);
			else if (nowMinutes > start + visible - 30) start = nowMinutes - visible + 60;
		}
		scroller.scrollTop = Math.max(0, (start / 60) * hour);
	}

	$effect(() => {
		const main = section?.closest('main');
		if (!main) return;
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(main);
		window.addEventListener('resize', fit);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', fit);
		};
	});

	// Scrolled once per period shown, not again when its entries or now change: keyed on
	// the days by value (the props object is rebuilt on every tick).
	const period = $derived(days.join());
	$effect(() => {
		void period;
		untrack(() => {
			fit();
			scrollToWorkingDay();
		});
	});

	// The week's lanes that fit, or the phone day's: its first column's width over the floor,
	// two at least, kept up on resize.
	// A hidden grid (the other layout's) measures nothing and keeps what it had. Observed
	// afresh per period, whose columns are drawn anew.
	$effect(() => {
		void period;
		const week = detail === 'week';
		const body = week || phoneDay ? scroller?.querySelector<HTMLElement>('[data-body]') : null;
		if (!body) return;
		const measure = () => {
			const width = body.getBoundingClientRect().width;
			if (width <= 0) return;
			const fit = Math.max(2, Math.floor(width / LANE_FLOOR));
			if (week) weekFit = fit;
			else dayFit = fit;
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(body);
		return () => observer.disconnect();
	});

	// Creating from empty time (spec, Creating from the grid).

	/** The PC's drag, drawn as it grows. */
	let dragged = $state<Draft | null>(null);
	/** A press on empty time, until it is let go or taken over by a scroll. */
	let press: {
		id: number;
		x: number;
		y: number;
		date: string;
		body: HTMLElement;
		start: number;
		moved: boolean;
		/** A mouse or pen on the PC: the press may become a drag. */
		drag: boolean;
	} | null = null;

	const minutesAt = (body: HTMLElement, clientY: number) =>
		Math.min(1440, Math.max(0, ((clientY - body.getBoundingClientRect().top) / hour) * 60));

	const formHref = (d: Draft) =>
		`${resolve('/(app)/entries/new')}?date=${d.date}&start=${clockOf(d.from)}&end=${clockOf(d.to)}&back=${encodeURIComponent(back)}`;

	function onpointerdown(e: PointerEvent) {
		tapped = null;
		if (create === 'none' || !e.isPrimary || e.button !== 0) return;
		const target = e.target instanceof Element ? e.target : null;
		// A block is its own (its form, and on the PC its move); so are a "+n" chip (its day)
		// and the new block.
		if (
			!target ||
			target.closest('[data-entry-id], [data-more-chip], [data-new-block], [data-day-head]')
		)
			return;
		const body = target.closest<HTMLElement>('[data-body]');
		const date = body?.closest<HTMLElement>('[data-date]')?.dataset.date;
		if (!body || !date) return;
		const drag = create === 'drag' && e.pointerType !== 'touch';
		press = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			date,
			body,
			start: minutesAt(body, e.clientY),
			moved: false,
			drag
		};
		if (drag) {
			// No text selection, and the drag goes on outside the grid.
			e.preventDefault();
			scroller?.setPointerCapture(e.pointerId);
		}
	}

	function onpointermove(e: PointerEvent) {
		if (!press || e.pointerId !== press.id) return;
		if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < STILL) return;
		press.moved = true;
		if (!press.drag) return;
		// In its day, snapped to 5 minutes (the press to those under it), five at least.
		dragged = { date: press.date, ...dragRange(press.start, minutesAt(press.body, e.clientY)) };
	}

	function onpointerup(e: PointerEvent) {
		if (!press || e.pointerId !== press.id) return;
		const p = press;
		const range = dragged;
		press = null;
		dragged = null;
		if (p.moved) {
			if (range) void openForm(formHref(range));
			return;
		}
		// A click or tap: the half hour, rounded down, for an hour (calls 4, 17).
		const slot = { date: p.date, ...halfHourSlot(Math.min(p.start, 1439)) };
		if (create === 'drag') void openForm(formHref(slot));
		// The phone's waits for its click: drawn now, the block would take that click.
		else tapped = slot;
	}

	/** The phone's tap, still, waiting for its click. */
	let tapped: Draft | null = null;

	function onclick() {
		const slot = tapped;
		tapped = null;
		if (create !== 'tap' || !slot) return;
		// A tap elsewhere drops a pending block rather than making another.
		draft = draft ? null : slot;
	}

	function cancelPress() {
		press = null;
		dragged = null;
		tapped = null;
	}

	/** New entry, or a tap on the block: the form with its times. */
	function openDraft() {
		if (!draft) return;
		const href = formHref(draft);
		draft = null;
		void openForm(href);
	}

	// A new period drops the pending block.
	$effect(() => {
		void period;
		untrack(() => {
			draft = null;
		});
	});

	// While a block is pending, a tap anywhere but the block, its bar and empty time (the
	// grid's own click drops it there) drops it, and does what it otherwise does: a tap on
	// an entry still opens that entry.
	$effect(() => {
		if (!draft) return;
		const onclick = (e: MouseEvent) => {
			const target = e.target instanceof Element ? e.target : null;
			if (tapped || target?.closest('[data-create-bar], [data-new-block]')) return;
			draft = null;
			// A tap on a "+n" chip only drops the block: no sheet, no link followed.
			if (target?.closest('[data-more-chip]')) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		document.addEventListener('click', onclick, true);
		return () => document.removeEventListener('click', onclick, true);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		// Escape in the middle of a drag drops it.
		if (e.key === 'Escape' && dragged) cancelPress();
	}}
/>

{#snippet head(date: string)}
	{@const p = parts(date)}
	{@const total = totals[date]}
	{@const isToday = date === today}
	<div
		data-day-head
		class="sticky top-0 z-20 border-b border-input bg-card"
		style:height="{headHeight}px"
	>
		{#if compact}
			<div class="flex h-full flex-col items-center justify-center gap-0.5">
				<span class="caps text-muted-foreground">{p.weekday[0]}</span>
				<span
					class="inline-flex size-7 items-center justify-center rounded-full text-lg leading-none font-semibold figures {isToday
						? 'bg-foreground text-background'
						: ''}">{p.day}</span
				>
				<span class="text-xs font-semibold figures {total ? '' : 'text-muted-foreground'}"
					>{total ? spanText(total) : '–'}</span
				>
			</div>
		{:else}
			<div class="flex h-full flex-col justify-between px-1.5 pt-2 pb-1.5">
				<span class="caps text-muted-foreground">{p.weekday.slice(0, 3)}</span>
				<div class="flex items-end justify-between gap-1">
					<span
						aria-current={isToday ? 'date' : undefined}
						class="-ml-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-xl leading-none font-semibold figures {isToday
							? 'bg-foreground text-background'
							: ''}">{p.day}</span
					>
					<span class="pb-0.5 text-sm font-semibold figures {total ? '' : 'text-muted-foreground'}"
						>{spanText(total ?? 0)}</span
					>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet column(date: string)}
	{@const ps = placed.get(date) ?? { blocks: [], chips: [] }}
	{@const up = lifted.get(date)}
	<div data-body class="relative" style:height="{body}px">
		{#each ps.blocks as { entry, piece } (entry.id)}
			<EntryBlock
				{entry}
				{piece}
				{hour}
				{detail}
				{back}
				{now}
				handles={drag !== null && !entry.running}
				look={moving?.id === entry.id ? 'ghost' : 'rest'}
				onneed={measured(entry, date)}
			/>
		{/each}
		{#each ps.chips as chip (chipKey(chip))}
			<MoreChip
				{chip}
				{date}
				{hour}
				{scope}
				startTime={clockOf(chip.start)}
				onopen={phoneDay ? () => (sheet = { key: chipKey(chip) }) : undefined}
			/>
		{/each}
		{#if up}
			<EntryBlock
				entry={up.entry}
				piece={up.piece}
				{hour}
				{detail}
				{back}
				{now}
				handles
				look="lifted"
			/>
		{/if}
		{#if landing?.date === date}
			<span
				data-drag-tag
				aria-hidden="true"
				class="pointer-events-none absolute left-px z-[6] rounded-sm bg-foreground px-1 py-px text-xs leading-[15px] font-semibold whitespace-nowrap text-background figures {landing.top <
				30
					? ''
					: '-translate-y-[calc(100%+2px)]'}"
				style:top="{(landing.top / 60) * hour}px">{landing.text}</span
			>
		{/if}
		{#if dragged?.date === date}
			<NewBlock from={dragged.from} to={dragged.to} {hour} />
		{/if}
		{#if draft?.date === date}
			<NewBlock
				from={draft.from}
				to={draft.to}
				{hour}
				handles
				onchange={(from, to) => draft && (draft = { ...draft, from, to })}
				onopen={openDraft}
				onhold={(held) => draft && (draft = { ...draft, held })}
			/>
		{/if}
		{#if date === today}
			<!-- The line at now runs behind the blocks: a block drawn past now (a line tall at
				least, a timer just started) keeps its text whole, and the dot over them and the
				gutter's tag still mark now. -->
			<div
				data-now-line
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 z-0 h-0.5 -translate-y-1/2 bg-foreground"
				style:top="{(nowMinutes / 60) * hour}px"
			></div>
			<span
				data-now-dot
				aria-hidden="true"
				class="pointer-events-none absolute {dayColumn !== null
					? 'left-0'
					: '-left-1'} z-[2] size-2 -translate-y-1/2 rounded-full bg-foreground"
				style:top="{(nowMinutes / 60) * hour}px"
			></span>
		{/if}
	</div>
	<!-- Room at the foot: the last hours scroll clear of the phone's "+". -->
	<div class="h-20 lg:h-0"></div>
{/snippet}

<section
	bind:this={section}
	aria-label={label}
	data-view={day ? 'day' : 'week'}
	class="{cls} isolate h-[calc(100dvh-21rem)] min-h-80 flex-col overflow-hidden border-y border-border bg-card max-lg:-mx-4 lg:h-[calc(100dvh-10.5rem)] lg:rounded-md lg:border"
>
	<!-- Pressing empty time is a pointer shortcut; by keyboard, "+ New entry" and `n` make an
		entry, and every block is a link. -->
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		bind:this={scroller}
		data-grid-scroll
		data-swipe-scroll={dayColumn !== null ? '' : undefined}
		class="relative flex-1 overflow-y-auto overscroll-contain {dayColumn !== null
			? 'overflow-x-auto'
			: ''}"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={cancelPress}
		{onclick}
		{@attach drag?.attach}
	>
		<div
			class="relative grid {dayColumn !== null ? 'min-w-max' : ''}"
			style:grid-template-columns={dayColumn !== null
				? `${gutter}px minmax(${dayColumn}px, 1fr)`
				: `${gutter}px repeat(${days.length}, minmax(0, 1fr))`}
		>
			<!-- The rules and the shading, under the columns. -->
			<div
				aria-hidden="true"
				class="pointer-events-none absolute right-0"
				style:top="{headHeight}px"
				style:left="{gutter}px"
				style:height="{body}px"
			>
				{#each SHADE as s (s.from)}
					<div
						class="absolute inset-x-0 bg-shade"
						style:top="{s.from * hour}px"
						style:height="{(s.to - s.from) * hour}px"
					></div>
				{/each}
				{#each HOURS as h (h)}
					<div class="absolute inset-x-0 border-t border-border" style:top="{h * hour}px"></div>
					{#if !compact}
						<div
							class="absolute inset-x-0 border-t border-dotted border-border max-lg:hidden"
							style:top="{(h + 0.5) * hour}px"
						></div>
					{/if}
				{/each}
			</div>

			<!-- The gutter: the hours and the time now; the day's stays in view, over the blocks,
				as its grid scrolls sideways. -->
			<div class={dayColumn !== null ? 'sticky left-0 z-30 bg-card' : 'relative'}>
				<div
					class="sticky top-0 z-20 border-b border-input bg-card"
					style:height="{headHeight}px"
				></div>
				<div class="relative" style:height="{body}px" aria-hidden="true">
					{#each HOURS as h (h)}
						<!-- An hour the time now's tag would cover gives way to it. -->
						<span
							data-hour={h}
							class="absolute right-0 pr-1.5 text-xs leading-none text-muted-foreground figures {showsToday &&
							Math.abs(h * hour + 9 - (nowMinutes / 60) * hour) < 16
								? 'invisible'
								: ''}"
							style:top="{h * hour + 3}px">{hourText(h)}</span
						>
					{/each}
					{#if showsToday}
						<span
							data-now-tag
							class="absolute z-[3] -translate-y-1/2 rounded-sm bg-foreground py-px text-xs leading-none font-semibold text-background figures {compact
								? 'right-0 px-0.5'
								: 'right-0.5 px-1'}"
							style:top="{(nowMinutes / 60) * hour}px"
							>{compact ? nowTime.replace(/^0/, '') : nowTime}</span
						>
					{/if}
				</div>
			</div>

			{#each days as date (date)}
				{@const p = parts(date)}
				{#if compact}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref builds a /calendar address -->
					<a
						href={calendarHref('day', date, scope)}
						data-date={date}
						aria-current={date === today ? 'date' : undefined}
						aria-label="{p.weekday} {p.day} {p.month}, {totals[date]
							? spanText(totals[date])
							: 'nothing logged'}"
						class="relative flex flex-col border-l border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{@render head(date)}
						{@render column(date)}
					</a>
				{:else}
					<div data-date={date} class="relative flex flex-col border-l border-border">
						{@render head(date)}
						{@render column(date)}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</section>

{#if drag}
	<!-- A drop's one update; the drag fills its fields. -->
	<form
		bind:this={drag.form}
		method="POST"
		action="?/move"
		use:enhance={drag.submit}
		hidden
		data-move-form
	>
		<input type="hidden" name="back" value={back} />
	</form>
{/if}

{#if phoneDay}
	<MoreSheet
		open={sheetChip !== null}
		title={sheetChip ? sheetTitle(sheetChip) : ''}
		entries={sheetChip?.entries ?? []}
		{back}
		{now}
		onclose={() => (sheet = null)}
	/>
{/if}

<!-- The phone's create bar, over the bottom bar (outside the grid, whose isolation would keep
	it under the bar); the "+" gives way to it. -->
{#if draft}
	<div
		data-create-bar
		role="group"
		aria-label="New entry"
		class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-card px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden"
	>
		<div class="min-w-0 flex-1">
			<p class="text-lg font-semibold figures">{clockOf(draft.from)} – {clockOf(draft.to)}</p>
			<p class="text-xs text-balance text-muted-foreground">Drag the handles to change it</p>
		</div>
		<Button variant="outline" onclick={() => (draft = null)}>Cancel</Button>
		<Button onclick={openDraft}>New entry</Button>
	</div>
{/if}
