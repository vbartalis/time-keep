<script lang="ts">
	import { calendarHref, dayName } from '#lib/calendar/dates.js';
	import type { Chip } from '#lib/calendar/grid.js';
	import { heightFor } from './block';

	let {
		chip,
		date,
		hour,
		scope,
		startTime
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
	} = $props();

	const label = $derived(
		`${chip.count} more ${chip.count === 1 ? 'entry' : 'entries'} from ${startTime}, ${dayName(date)}; open the day`
	);
</script>

<!-- A link to the day, which hides nothing: over the hidden run's time (a line at least), in
	the last lane that fits, "+n" at its top, so the time it holds never reads as free. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -- calendarHref builds a /calendar address -->
<a
	data-more-chip
	href={calendarHref('day', date, scope)}
	draggable="false"
	aria-label={label}
	title={label}
	class="absolute z-[1] block overflow-hidden rounded-sm border border-input bg-card px-1.5 text-xs leading-[15px] font-semibold whitespace-nowrap text-foreground figures outline-none hover:bg-accent focus-visible:z-[3] focus-visible:ring-2 focus-visible:ring-ring"
	style:top="{(chip.from / 60) * hour}px"
	style:height="{Math.max(heightFor(1, 0), ((chip.to - chip.from) / 60) * hour) - 1}px"
	style:left="calc({(chip.lane / chip.lanes) * 100}% + 1px)"
	style:width="calc({100 / chip.lanes}% - 2px)">+{chip.count}</a
>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
