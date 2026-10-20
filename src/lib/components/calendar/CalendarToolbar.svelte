<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { calendarHref, periodTitle, shift, type View } from '#lib/calendar/dates.js';
	import { spanText } from '#lib/calendar/grid.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ZoneSource } from '#lib/server/screens/zone.js';
	import DatePicker from './DatePicker.svelte';

	let {
		view,
		date,
		today,
		periodTotal,
		weekTotal,
		zoneSource
	}: {
		view: View;
		date: string;
		today: string;
		periodTotal: number;
		weekTotal: number;
		zoneSource: ZoneSource;
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
	const step = (n: number) => calendarHref(view, shift(view, date, n));
</script>

<!-- Each control is a snippet, placed in two arrangements: the phone's two rows (the views and
	Today, then the arrows around the title) and the PC's one row. One is `display: none`, so
	each layout has its own focus and reading order, and only one is in the accessibility tree. -->
{#snippet views(cls: string)}
	<div role="group" aria-label="View" class="flex {cls}">
		{#each VIEWS as v (v.view)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref builds a /calendar address -->
			<a
				href={calendarHref(v.view, date)}
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
	<Button href={calendarHref(view, today)} variant="outline" class={cls}>Today</Button>
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

<div class="flex flex-col gap-2">
	<!-- Phone -->
	<div
		role="group"
		aria-label="Calendar toolbar"
		class="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:hidden"
	>
		{@render views('col-span-2 col-start-1 row-start-1')}
		{@render today_('col-start-3 row-start-1')}
		{@render prev('col-start-1 row-start-2')}
		<div class="col-start-2 row-start-2 min-w-0 text-center">
			<DatePicker {view} {date} title={phone.title} sub={phoneSub} stack />
		</div>
		{@render next('col-start-3 row-start-2')}
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
		<DatePicker {view} {date} title={pc.title} sub={pc.sub} />
		<!-- Muted labels, the figures in the text colour: the number read at a glance. -->
		<p class="mr-2 ml-auto text-sm text-muted-foreground figures">
			{#each totals as [label, figure], n (label)}{n ? ' · ' : ''}{label}
				<span class="font-semibold text-foreground">{figure}</span>{/each}
		</p>
		{@render views('')}
	</div>

	{#if zoneSource === 'default'}
		<p class="text-sm text-muted-foreground">
			Times in the default zone until this device gives its zone.
		</p>
	{/if}
</div>
