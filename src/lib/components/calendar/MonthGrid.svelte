<script lang="ts">
	import { resolve } from '$app/paths';
	import { calendarHref, dayName, isoWeek } from '#lib/calendar/dates.js';
	import { spanText } from '#lib/calendar/grid.js';
	import type { CalendarEntry } from './types';

	let {
		days,
		entries,
		totals,
		date,
		today,
		back,
		scope = '',
		class: cls = ''
	}: {
		/** Every day of the weeks touching the month, Monday first. */
		days: string[];
		entries: CalendarEntry[];
		/** Milliseconds by date, only days with some. */
		totals: Record<string, number>;
		/** A day of the month in view. */
		date: string;
		today: string;
		back: string;
		/** The filter's query, carried by every link. */
		scope?: string;
		class?: string;
	} = $props();

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	/** Entry lines a cell draws before "+n more". */
	const LINES = 4;

	const weeks = $derived(
		Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => {
			const week = days.slice(w * 7, w * 7 + 7);
			return {
				start: week[0],
				number: isoWeek(week[0]),
				days: week,
				total: week.reduce((sum, d) => sum + (totals[d] ?? 0), 0)
			};
		})
	);
	const byDay = $derived(Object.groupBy(entries, (e) => e.date));

	const inMonth = (day: string) => day.slice(0, 7) === date.slice(0, 7);
	const href = (id: string) =>
		`${resolve('/(app)/entries/[id]', { id })}?back=${encodeURIComponent(back)}`;
	const label = (e: CalendarEntry) =>
		`${e.customerName} › ${e.projectName}, ${e.startTime}–${e.endTime ?? 'now'}${e.overlaps ? ', Overlaps another entry' : ''}`;
</script>

<section
	aria-label="Month grid"
	data-view="month"
	class="{cls} flex-col overflow-hidden rounded-md border border-border bg-card"
>
	<div
		class="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))_4.5rem] border-b border-input text-xs caps text-muted-foreground"
	>
		<span class="px-2 py-2.5">Wk</span>
		{#each WEEKDAYS as weekday (weekday)}
			<span class="px-2 py-2.5">{weekday}</span>
		{/each}
		<span class="px-2 py-2.5 text-right">Week</span>
	</div>
	{#each weeks as week (week.start)}
		<div
			data-week={week.start}
			class="grid min-h-[8.75rem] grid-cols-[2.5rem_repeat(7,minmax(0,1fr))_4.5rem] border-b border-border last:border-b-0"
		>
			<span class="px-2 pt-3 text-xs text-muted-foreground figures">{week.number}</span>
			{#each week.days as day (day)}
				{@const list = byDay[day] ?? []}
				{@const total = totals[day]}
				{@const d = Number(day.slice(8))}
				<!-- The cell's empty space is the link to the day; the links in it sit above it. -->
				<div
					data-date={day}
					class="relative flex min-w-0 flex-col gap-0.5 border-l border-border px-1.5 pt-2 pb-1.5 {inMonth(
						day
					)
						? ''
						: 'bg-shade'}"
				>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref is the app's own address -->
					<a
						href={calendarHref('day', day, scope)}
						tabindex="-1"
						aria-hidden="true"
						class="absolute inset-0 hover:bg-accent/40"
					></a>
					<div class="pointer-events-none relative flex items-center justify-between gap-1">
						<a
							href={calendarHref('day', day, scope)}
							aria-current={day === today ? 'date' : undefined}
							class="pointer-events-auto -ml-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm leading-none font-semibold figures outline-none focus-visible:ring-2 focus-visible:ring-ring {day ===
							today
								? 'bg-foreground text-background'
								: inMonth(day)
									? ''
									: 'text-muted-foreground'}">{d}</a
						>
						{#if total}
							<span class="text-xs font-semibold figures">{spanText(total)}</span>
						{/if}
					</div>
					{#each list.slice(0, LINES) as e (e.id)}
						<a
							href={href(e.id)}
							data-entry-form
							data-entry-id={e.id}
							aria-label="{dayName(day)}, {label(e)}"
							title={label(e)}
							class="relative flex min-w-0 items-center gap-1.5 rounded-sm border px-0.5 text-xs leading-[18px] whitespace-nowrap outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring {e.overlaps
								? 'border-destructive'
								: 'border-transparent'}"
						>
							<span
								aria-hidden="true"
								class="size-2 shrink-0 rounded-full"
								style:background="var(--project-{e.colour})"
							></span>
							<span class="shrink-0 figures {e.running ? 'font-semibold text-primary' : ''}"
								>{e.startTime}</span
							>
							<span class="min-w-0 truncate">{e.projectName}</span>
						</a>
					{/each}
					{#if list.length > LINES}
						<a
							href={calendarHref('day', day, scope)}
							class="relative w-fit rounded-sm text-xs leading-[18px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
							>+{list.length - LINES} more</a
						>
					{/if}
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
			{/each}
			<span
				data-week-total
				class="border-l border-border px-2 pt-3 text-right text-sm font-semibold figures {week.total
					? ''
					: 'text-muted-foreground'}">{week.total ? spanText(week.total) : ''}</span
			>
		</div>
	{/each}
</section>
