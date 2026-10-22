<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { resolve } from '$app/paths';
	import { spanText } from '#lib/calendar/grid.js';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import type { CalendarEntry } from './types';

	/**
	 * The phone day's "+n" chip, opened (item 21): the bottom sheet of the entries it folds,
	 * in start order, as rows in the phone month's day-list look. A row opens its entry's form
	 * over the Calendar (the layout hears its `data-entry-form`) and closes the sheet.
	 */
	let {
		open,
		title,
		entries,
		back,
		now,
		onclose
	}: {
		open: boolean;
		/** "5 more entries from 06:12". */
		title: string;
		entries: CalendarEntry[];
		back: string;
		/** A running entry's time counts to it. */
		now: number;
		onclose: () => void;
	} = $props();

	const id = $props.id();
	const duration = (e: CalendarEntry) => spanText((e.endAt ?? now) - e.startAt);
	const href = (id: string) =>
		`${resolve('/(app)/entries/[id]', { id })}?back=${encodeURIComponent(back)}`;
</script>

<Sheet {open} labelledby={id} {onclose}>
	<div class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
		<h2 {id} class="min-w-0 text-lg font-bold text-pretty figures">{title}</h2>
		<button
			type="button"
			aria-label="Close"
			class="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
			onclick={onclose}
		>
			<X class="size-4" aria-hidden="true" />
		</button>
	</div>
	<ul class="min-h-0 flex-1 overflow-y-auto">
		{#each entries as e (e.id)}
			<li class="border-b border-border last:border-b-0">
				<!-- eslint-disable svelte/no-navigation-without-resolve -- href resolves it -->
				<a
					href={href(e.id)}
					data-entry-form
					data-entry-id={e.id}
					onclick={onclose}
					class="flex min-h-11 gap-3 border-l-4 py-2.5 pr-4 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
					<span class="shrink-0 font-semibold figures {e.running ? 'text-primary' : ''}"
						>{duration(e)}</span
					>
				</a>
			</li>
		{/each}
	</ul>
</Sheet>
