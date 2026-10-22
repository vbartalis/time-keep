<script lang="ts">
	import { calendarHref, dayName } from '#lib/calendar/dates.js';
	import type { Chip } from '#lib/calendar/grid.js';
	import { heightFor } from './block';

	let {
		chip,
		date,
		hour,
		scope,
		startTime,
		onopen
	}: {
		/** The run of blocks the week's column has no lane for: its span and its count. */
		chip: Chip;
		date: string;
		/** One hour's height, px. */
		hour: number;
		/** The filter's query, carried to the day. */
		scope: string;
		/** The run's first start, `HH:mm`. */
		startTime: string;
		/**
		 * The phone's day: a tap shows the folded entries (its sheet); without JavaScript it
		 * is a link to Entries on that day. Unset, it is the week's link to the day.
		 */
		onopen?: () => void;
	} = $props();

	/** Where its box begins: the run's start, or above it where it grew up (item 21). */
	const top = $derived(chip.top ?? chip.from);
	const more = $derived(`${chip.count} more ${chip.count === 1 ? 'entry' : 'entries'}`);
	const label = $derived(
		onopen
			? `${more} from ${startTime}; show them`
			: `${more} from ${startTime}, ${dayName(date)}; open the day`
	);
	const href = $derived(
		onopen
			? `/entries?range=custom&from=${date}&to=${date}${scope === '' ? '' : `&${scope}`}`
			: calendarHref('day', date, scope)
	);
</script>

<!-- A link to the day, which hides nothing (on the phone's day, to its sheet): over the
	hidden run's time (a line at least), in the last lane that fits, "+n" at its top, so the
	time it holds never reads as free. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -- an /entries or /calendar address -->
<a
	data-more-chip
	{href}
	draggable="false"
	onclick={onopen &&
		((e) => {
			e.preventDefault();
			onopen();
		})}
	aria-label={label}
	title={label}
	class="absolute z-[1] block overflow-hidden rounded-sm border border-input bg-card px-1.5 text-xs leading-[15px] font-semibold whitespace-nowrap text-foreground figures outline-none hover:bg-accent focus-visible:z-[3] focus-visible:ring-2 focus-visible:ring-ring"
	style:top="{(top / 60) * hour}px"
	style:height="{Math.max(heightFor(1, 0), ((chip.to - top) / 60) * hour) - 1}px"
	style:left="calc({(chip.lane / chip.lanes) * 100}% + 1px)"
	style:width="calc({100 / chip.lanes}% - 2px)">+{chip.count}</a
>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
