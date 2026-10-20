<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { calendarHref, periodDays, shift, type View } from '#lib/calendar/dates.js';
	import { swipe, type Draft } from '#lib/calendar/gestures.svelte.js';
	import { scopeQuery } from '#lib/filter/filter.js';
	import { localDate } from '#lib/calendar/grid.js';
	import CalendarToolbar from '#lib/components/calendar/CalendarToolbar.svelte';
	import MonthGrid from '#lib/components/calendar/MonthGrid.svelte';
	import PhoneMonth from '#lib/components/calendar/PhoneMonth.svelte';
	import TimeGrid from '#lib/components/calendar/TimeGrid.svelte';
	import { nowTicker } from '#lib/components/calendar/now.svelte.js';
	import FilterChips from '#lib/components/timesheet/FilterChips.svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import { screenKey } from '#lib/keys.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The server's now until mounted; the device's clock from then on.
	const clock = nowTicker(untrack(() => data.now));
	/** Never behind the server's now: a slow device clock does not shrink a running time. */
	const now = $derived(Math.max(clock.now, data.now));

	/**
	 * Past midnight with the page open: the server's today is yesterday, so the line at
	 * now, today's circle and the totals are reloaded for the new day (once per date).
	 */
	let reloadedFor = '';
	$effect(() => {
		const date = localDate(clock.now, data.zone);
		if (date <= data.today || date === reloadedFor) return;
		reloadedFor = date;
		void invalidateAll();
	});

	/**
	 * The totals, a running entry's time following now: the server counted it to its own
	 * now, so each running entry in view adds what has passed since.
	 */
	const live = $derived.by(() => {
		const totals = { ...data.totals };
		let period = data.periodTotal;
		let week = data.weekTotal;
		const week_ = new Set(periodDays('week', data.date));
		const month = data.date.slice(0, 7);
		const shown = new Set(data.days);
		// In ms, exact as the server's are; truncated only to be shown.
		const ran = (to: number, from: number) => Math.max(0, to - from);
		for (const e of data.entries) {
			if (!e.running) continue;
			const more = ran(now, e.startAt) - ran(data.now, e.startAt);
			if (more <= 0) continue;
			if (shown.has(e.date)) {
				totals[e.date] = (totals[e.date] ?? 0) + more;
				// The month's grid shows the weeks around it; its total is the month's own days.
				if (data.view !== 'month' || e.date.startsWith(month)) period += more;
			}
			if (week_.has(e.date)) week += more;
		}
		return { totals, period, week };
	});

	/** The phone's new block, pending. */
	let draft = $state<Draft | null>(null);

	// eslint-disable-next-line svelte/no-navigation-without-resolve -- calendarHref builds a /calendar address
	const go = (view: View, date: string) => goto(calendarHref(view, date, data.scopeQuery));

	/** One period back (-1) or on (1). */
	const move = (n: -1 | 1) => go(data.view, shift(data.view, data.date, n));

	/**
	 * The PC's keys (Moving 4), as the layout's `n` and `s`: ←/k and →/j the previous and
	 * next period, `t` today, `d` `w` `m` the views.
	 */
	const KEYS: Record<string, () => unknown> = {
		ArrowLeft: () => move(-1),
		k: () => move(-1),
		ArrowRight: () => move(1),
		j: () => move(1),
		t: () => go(data.view, data.today),
		d: () => go('day', data.date),
		w: () => go('week', data.date),
		m: () => go('month', data.date)
	};

	function onkeydown(e: KeyboardEvent) {
		const act = KEYS[e.key];
		if (!act || !screenKey(e)) return;
		e.preventDefault();
		void act();
	}

	/**
	 * A swipe moves a period (right: back); with a new block pending it drops the block
	 * instead, and while a handle is held it is no swipe.
	 */
	const swiped = swipe({
		onSwipe: (dir) => {
			if (draft) draft = null;
			else void move(dir);
		},
		enabled: () => !draft?.held
	});
</script>

<svelte:window {onkeydown} />

<svelte:head><title>Calendar · Time Keep</title></svelte:head>

<CalendarToolbar
	view={data.view}
	date={data.date}
	today={data.today}
	periodTotal={live.period}
	weekTotal={live.week}
	zoneSource={data.zoneSource}
	scope={data.scope}
	scopeQuery={data.scopeQuery}
	filtered={data.filtered}
	options={data.options}
	shown={data.entries.length}
/>

<FilterChips
	scope={data.scope}
	options={data.options}
	href={(s) => calendarHref(data.view, data.date, scopeQuery(s))}
/>

<UndoStrip flash={data.flash} back={data.back} />

{#if data.view === 'month'}
	{@const month = {
		days: data.days,
		entries: data.entries,
		totals: live.totals,
		date: data.date,
		today: data.today,
		back: data.back,
		scope: data.scopeQuery
	}}
	<!-- `contents`: the views stay main's own flex items; the swipe hears them through it. -->
	<div class="contents" {@attach swiped}>
		<PhoneMonth {...month} {now} class="flex lg:hidden" />
		<MonthGrid {...month} class="hidden lg:flex" />
	</div>
{:else}
	{@const grid = {
		days: data.days,
		entries: data.entries,
		totals: live.totals,
		today: data.today,
		zone: data.zone,
		now,
		back: data.back,
		scope: data.scopeQuery
	}}
	<!-- The phone's grid and the PC's, drawn to their own measures; one is shown. The phone's
		cancels most of main's foot: the grid ends at the bottom bar and keeps its own room for
		the "+". -->
	<div class="contents" {@attach swiped}>
		<TimeGrid
			{...grid}
			hour={data.view === 'day' ? 56 : 34}
			compact={data.view === 'week'}
			create={data.view === 'day' ? 'tap' : 'none'}
			bind:draft
			class="-mb-[5.6875rem] flex lg:hidden"
		/>
		<TimeGrid
			{...grid}
			hour={data.view === 'day' ? 52 : 44}
			compact={false}
			create="drag"
			class="hidden lg:flex"
		/>
	</div>
{/if}
