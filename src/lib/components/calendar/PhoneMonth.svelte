<script lang="ts">
	import { resolve } from '$app/paths';
	import { calendarHref } from '#lib/calendar/dates.js';
	import { spanText } from '#lib/calendar/grid.js';
	import type { CalendarEntry } from './types';

	let {
		days,
		entries,
		totals,
		date,
		today,
		back,
		now,
		class: cls = ''
	}: {
		/** Every day of the weeks touching the month, Monday first. */
		days: string[];
		entries: CalendarEntry[];
		/** Milliseconds by date, only days with some. */
		totals: Record<string, number>;
		/** The chosen day. */
		date: string;
		today: string;
		back: string;
		/** A running entry's time counts to it. */
		now: number;
		class?: string;
	} = $props();

	const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
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

	const weeks = $derived(
		Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7))
	);
	/** One dot per project worked that day, in the order first worked. */
	const dots = $derived.by(() => {
		const out: Record<string, Record<string, number>> = {};
		for (const e of entries) {
			(out[e.date] ??= {})[`${e.customerName}›${e.projectName}`] = e.colour;
		}
		return out;
	});
	const list = $derived(entries.filter((e) => e.date === date));
	const inMonth = (day: string) => day.slice(0, 7) === date.slice(0, 7);
	const title = (day: string) => {
		const d = new Date(`${day}T00:00:00Z`);
		return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
	};
	const duration = (e: CalendarEntry) => spanText((e.endAt ?? now) - e.startAt);
	const href = (id: string) =>
		`${resolve('/(app)/entries/[id]', { id })}?back=${encodeURIComponent(back)}`;
</script>

<section aria-label="Month grid" data-view="month" class="{cls} flex-col">
	<div class="border-b border-border bg-card max-lg:-mx-4">
		<div class="grid grid-cols-7 text-xs caps text-muted-foreground" aria-hidden="true">
			{#each LETTERS as letter, n (n)}
				<span class="py-2 text-center">{letter}</span>
			{/each}
		</div>
		{#each weeks as week (week[0])}
			<div class="grid grid-cols-7">
				{#each week as day (day)}
					{@const total = totals[day]}
					{@const marks = Object.values(dots[day] ?? {})}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref is the app's own address -->
					<a
						href={calendarHref('month', day)}
						data-date={day}
						aria-current={day === date ? 'date' : undefined}
						aria-label="{title(day)}{day === today ? ', today' : ''}{total
							? `, ${spanText(total)}`
							: ''}"
						class="m-0.5 flex min-h-14 min-w-11 flex-col items-center justify-start gap-0.5 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring {day ===
						date
							? 'ring-2 ring-foreground'
							: ''} {inMonth(day) ? '' : 'bg-shade text-muted-foreground'}"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						<span
							class="inline-flex size-7 items-center justify-center rounded-full text-sm leading-none font-semibold figures {day ===
							today
								? 'bg-foreground text-background'
								: ''}">{Number(day.slice(8))}</span
						>
						<span class="h-4 text-xs leading-4 figures">{total ? spanText(total) : ''}</span>
						<span aria-hidden="true" class="flex h-2 gap-0.5">
							{#each marks as colour, n (n)}
								<span class="size-1.5 rounded-full" style:background="var(--project-{colour})"
								></span>
							{/each}
						</span>
					</a>
				{/each}
			</div>
		{/each}
	</div>

	<section aria-label="Day list" class="pt-4">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref is the app's own address -->
		<a
			href={calendarHref('day', date)}
			class="flex min-h-11 items-center justify-between gap-3 border-b border-foreground px-0 text-xs caps outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<span class="figures">{title(date)}</span>
			<span class="text-sm font-semibold figures">{spanText(totals[date] ?? 0)}</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{#if list.length === 0}
			<p class="py-3 text-sm text-muted-foreground">Nothing logged.</p>
		{:else}
			<ul>
				{#each list as e (e.id)}
					<li class="border-b border-border">
						<!-- eslint-disable svelte/no-navigation-without-resolve -- href resolves it -->
						<a
							href={href(e.id)}
							data-entry-form
							data-entry-id={e.id}
							class="flex min-h-11 gap-3 border-l-4 py-2.5 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
							style:border-left-color="var(--project-{e.colour})"
						>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<span class="flex w-11 shrink-0 flex-col figures">
								<span class="font-semibold">{e.startTime}</span>
								<span class={e.running ? 'font-semibold text-primary' : 'text-muted-foreground'}
									>{e.endTime ?? 'now'}</span
								>
							</span>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="font-semibold text-pretty">{e.customerName} › {e.projectName}</span>
								{#if e.activityName || e.description}
									<span class="text-pretty text-muted-foreground"
										>{[e.activityName, e.description].filter(Boolean).join(' · ')}</span
									>
								{/if}
								{#if e.overlaps}
									<span class="text-xs font-semibold text-destructive">Overlaps another entry</span>
								{/if}
							</span>
							<span class="shrink-0 pr-1 font-semibold figures {e.running ? 'text-primary' : ''}"
								>{duration(e)}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</section>
