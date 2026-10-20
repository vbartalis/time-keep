<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { calendarHref, periodDays, shift, type View } from '#lib/calendar/dates.js';

	let {
		view,
		date,
		title,
		sub,
		stack = false,
		scope = ''
	}: {
		view: View;
		date: string;
		/** The period's title, the summary's first words. */
		title: string;
		/** Muted beside the title (the PC's week number) or under it (the phone's totals). */
		sub: string;
		/** The phone's: the sub-line under the title, the two inside one 44 px row. */
		stack?: boolean;
		/** The filter's query, carried by every link. */
		scope?: string;
	} = $props();

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
	const HEADS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	/** The month the panel shows: `pick=YYYY-MM` when valid, else the date's. Present, the panel is open. */
	const pick = $derived.by(() => {
		const p = page.url.searchParams.get('pick');
		return p !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(p) ? p : null;
	});
	const shown = $derived(pick ?? date.slice(0, 7));
	const first = $derived(`${shown}-01`);
	const days = $derived(periodDays('month', first));
	const heading = $derived(`${MONTHS[Number(shown.slice(5, 7)) - 1]} ${shown.slice(0, 4)}`);
	const selected = $derived(new Set(periodDays('week', date)));
	const today = $derived(page.data.today as string | undefined);

	const pickHref = (n: number) =>
		`${calendarHref(view, date, scope)}&pick=${shift('month', first, n).slice(0, 7)}`;

	// A <details>, so the panel opens without JavaScript; with it, choosing a day closes it,
	// and so do Escape (the focus back on the title) and a click outside it.
	let details = $state<HTMLDetailsElement | null>(null);
	let summary = $state<HTMLElement | null>(null);
	afterNavigate(() => {
		if (details && !page.url.searchParams.has('pick')) details.open = false;
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !details?.open) return;
		e.preventDefault();
		details.open = false;
		summary?.focus();
	}

	function onclick(e: MouseEvent) {
		if (!details?.open) return;
		const target = e.target instanceof Node ? e.target : null;
		if (!target || !details.contains(target)) details.open = false;
	}

	const nav =
		'inline-flex size-11 items-center justify-center rounded-md border border-input bg-card outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:size-9';
</script>

<!-- The period's title opens a month of days; its panel hangs under the toolbar (the group is its anchor). -->
<svelte:window {onkeydown} />
<svelte:document {onclick} />

<!-- Open, the screen's keys wait (`screenKey`). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref builds a /calendar address -->
<details bind:this={details} open={pick !== null} data-holds-keys class="min-w-0">
	<summary
		bind:this={summary}
		class="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-md px-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 [&::-webkit-details-marker]:hidden {stack
			? 'flex-col'
			: 'flex-wrap gap-x-2'}"
	>
		{#if stack}
			<span class="flex max-w-full items-center gap-1">
				<span class="truncate text-base leading-5 font-semibold figures">{title}</span>
				<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			</span>
			<span class="max-w-full truncate text-xs leading-4 text-muted-foreground figures">{sub}</span>
		{:else}
			<span class="text-base font-semibold figures">{title}</span>
			{#if sub}<span class="text-sm text-muted-foreground figures">{sub}</span>{/if}
			<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		{/if}
	</summary>
	<div
		role="group"
		aria-label="Choose a date"
		class="absolute top-full left-0 z-10 mt-2 w-[19.25rem] rounded-md border border-border bg-card p-2 shadow-[0_8px_24px_rgb(0_0_0/0.12)] lg:left-24 lg:w-[17.5rem]"
	>
		<div class="flex items-center justify-between">
			<a href={pickHref(-1)} aria-label="Previous month" class={nav}>
				<ChevronLeft class="size-4" aria-hidden="true" />
			</a>
			<p class="text-sm font-semibold figures">{heading}</p>
			<a href={pickHref(1)} aria-label="Next month" class={nav}>
				<ChevronRight class="size-4" aria-hidden="true" />
			</a>
		</div>
		<div class="mt-1 grid grid-cols-7">
			{#each HEADS as head (head)}
				<span class="flex h-8 items-center justify-center caps text-muted-foreground">{head}</span>
			{/each}
			{#each days as day (day)}
				<a
					href={calendarHref(view, day, scope)}
					aria-current={day === date ? 'date' : undefined}
					aria-label={day === today ? `${Number(day.slice(8))}, today` : undefined}
					class="flex size-11 items-center justify-center rounded-full text-sm figures outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-9 {day ===
					today
						? 'bg-foreground font-semibold text-background'
						: `hover:bg-accent ${day.startsWith(shown) ? 'text-foreground' : 'text-muted-foreground'} ${selected.has(day) ? 'bg-accent' : ''}`}"
				>
					{Number(day.slice(8))}
				</a>
			{/each}
		</div>
	</div>
</details>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
