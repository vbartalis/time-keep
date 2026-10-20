<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { calendarHref, periodTitle, shift, type View } from '#lib/calendar/dates.js';
	import { spanText } from '#lib/calendar/grid.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import FilterButton from '#lib/components/timesheet/FilterButton.svelte';
	import FilterPanel from '#lib/components/timesheet/FilterPanel.svelte';
	import FilterSheet from '#lib/components/timesheet/FilterSheet.svelte';
	import type { FilterOptions } from '#lib/components/timesheet/types.js';
	import { scopeCount, type Scope } from '#lib/filter/filter.js';
	import type { ZoneSource } from '#lib/server/screens/zone.js';
	import DatePicker from './DatePicker.svelte';

	let {
		view,
		date,
		today,
		periodTotal,
		weekTotal,
		zoneSource,
		scope,
		scopeQuery,
		filtered,
		options,
		shown
	}: {
		view: View;
		date: string;
		today: string;
		periodTotal: number;
		weekTotal: number;
		zoneSource: ZoneSource;
		scope: Scope;
		/** The scope as a query string, carried by every link. */
		scopeQuery: string;
		/** A filter is on: the totals count only the entries shown. */
		filtered: boolean;
		options: FilterOptions;
		/** The entries drawn, for the phone sheet's "Show n entries". */
		shown: number;
	} = $props();

	const VIEWS: { view: View; label: string }[] = [
		{ view: 'day', label: 'Day' },
		{ view: 'week', label: 'Week' },
		{ view: 'month', label: 'Month' }
	];

	/** The total's parts, label then figure: "Day 5:45 · Week 27:45". */
	const totals = $derived<[string, string][]>(
		view === 'day'
			? [
					['Day', spanText(periodTotal)],
					['Week', spanText(weekTotal)]
				]
			: [[view === 'week' ? 'Week' : 'Month', spanText(periodTotal)]]
	);
	const mark = $derived(filtered ? ' (filtered)' : '');
	const pc = $derived(periodTitle(view, date));
	const phone = $derived(periodTitle(view, date, 'short'));
	/**
	 * The phone's one sub-line: its totals, the week's after its number ("Week 42 · 27:45",
	 * as `ph-week` has it), so "Week 42" never stands over "Week 27:45".
	 */
	const phoneSub = $derived(
		view === 'week'
			? `${phone.sub} · ${spanText(periodTotal)}`
			: totals.map(([label, figure]) => `${label} ${figure}`).join(' · ')
	);
	const phoneLine = $derived(`${phoneSub}${mark}`);
	const step = (n: number) => calendarHref(view, shift(view, date, n), scopeQuery);

	const action = resolve('/(app)/calendar');
	const clear = $derived(calendarHref(view, date));
	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** With the script on a phone the filter is a sheet; else the PC's popover (a `<details>`). */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const sheet = $derived(enhanced && !wide.current);
</script>

<!-- Each control is a snippet, placed in two arrangements: the phone's two rows (the views,
	Filter and Today, then the arrows around the title) and the PC's one row. One is `display: none`, so
	each layout has its own focus and reading order, and only one is in the accessibility tree. -->
{#snippet views(cls: string)}
	<div role="group" aria-label="View" class="flex {cls}">
		{#each VIEWS as v (v.view)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref builds a /calendar address -->
			<a
				href={calendarHref(v.view, date, scopeQuery)}
				aria-current={v.view === view ? 'page' : undefined}
				class="flex h-11 flex-1 items-center justify-center border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-150 ease-out outline-none not-first:-ml-px first:rounded-l-md last:rounded-r-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:bg-accent aria-[current=page]:shadow-[inset_0_-2px_0_var(--foreground)] lg:h-9 lg:flex-none"
			>
				{v.label}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</div>
{/snippet}

{#snippet today_(cls: string)}
	<Button href={calendarHref(view, today, scopeQuery)} variant="outline" class={cls}>Today</Button>
{/snippet}

{#snippet prev(cls: string)}
	<Button href={step(-1)} variant="outline" size="icon" aria-label="Previous {view}" class={cls}>
		<ChevronLeft />
	</Button>
{/snippet}

{#snippet next(cls: string)}
	<Button href={step(1)} variant="outline" size="icon" aria-label="Next {view}" class={cls}>
		<ChevronRight />
	</Button>
{/snippet}

{#snippet keep()}
	<input type="hidden" name="view" value={view} />
	<input type="hidden" name="date" value={date} />
{/snippet}

{#snippet filter(id: string, icon: boolean)}
	<FilterButton label="" count={scopeCount(scope)} {icon}>
		<FilterPanel {id} {action} filter={scope} {options} range={false} {clear} hidden={keep} />
	</FilterButton>
{/snippet}

<div class="flex flex-col gap-2">
	<!-- Phone: row 1 the views, Filter (an icon, its count on it) and Today; row 2 the arrows
		round the title, which takes the row's whole middle. The group anchors the panels (the
		date picker's, and the Filter's without the script), so they hang under the toolbar. -->
	<div role="group" aria-label="Calendar toolbar" class="relative flex flex-col gap-2 lg:hidden">
		<div class="flex items-center gap-2">
			{@render views('min-w-0 flex-1')}
			{#if sheet}
				<FilterSheet
					id="filter-phone"
					{action}
					label=""
					more={scopeCount(scope)}
					filter={scope}
					{options}
					{clear}
					count={shown}
					range={false}
					hidden={keep}
					icon
				/>
			{:else}
				{@render filter('filter-phone', true)}
			{/if}
			{@render today_('shrink-0')}
		</div>
		<div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
			{@render prev('')}
			<div class="min-w-0 text-center">
				<DatePicker {view} {date} title={phone.title} sub={phoneLine} stack scope={scopeQuery} />
			</div>
			{@render next('')}
		</div>
	</div>

	<!-- PC -->
	<div
		role="group"
		aria-label="Calendar toolbar"
		class="relative hidden items-center gap-2 lg:flex"
	>
		{@render prev('')}
		{@render today_('')}
		{@render next('')}
		<DatePicker {view} {date} title={pc.title} sub={pc.sub} scope={scopeQuery} />
		{@render filter('filter-pc', false)}
		<!-- Muted labels, the figures in the text colour: the number read at a glance. -->
		<p class="mr-2 ml-auto text-sm text-muted-foreground figures">
			{#each totals as [label, figure], n (label)}{n ? ' · ' : ''}{label}
				<span class="font-semibold text-foreground">{figure}</span>{/each}{mark}
		</p>
		{@render views('')}
	</div>

	{#if zoneSource === 'default'}
		<p class="text-sm text-muted-foreground">
			Times in the default zone until this device gives its zone.
		</p>
	{/if}
</div>
