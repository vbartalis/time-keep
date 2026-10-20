<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { spanText } from '#lib/calendar/grid.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import type { FlashWarning } from '#lib/components/today/types.js';
	import { openForm } from '#lib/entry-link.js';
	import { warningText } from '#lib/format.js';
	import RowMenu from './RowMenu.svelte';
	import { inPlace } from './live';
	import { OVERLAP, editHref, nameOf, where } from './rows';
	import type { Selection } from './selection.svelte';
	import type { TableDay, TableRow } from './types';

	/**
	 * The PC's ruled table: a head row per day (its date and total), then its entries,
	 * newest first. A click on a row outside its controls opens its form in place; the
	 * Customer › project link is the keyboard's way in. Below `lg` the phone list shows
	 * instead (`PhoneList`).
	 * The tick boxes post with the bulk bar's form; with the script, the head's and each
	 * day's box tick many at once (mixed when some are) and shift-click ticks a run.
	 */
	let {
		days,
		back,
		now,
		loadedAt,
		warnings,
		selection,
		enhanced,
		versions
	}: {
		days: TableDay[];
		/** The table's own address: where the form, the menu and ▶ return to. */
		back: string;
		/** The ticking now: a running row counts to it. */
		now: number;
		/** The server's now, which the totals were counted to. */
		loadedAt: number;
		/** The strip's warnings: the rows they name stay marked. */
		warnings: FlashWarning[];
		selection: Selection;
		/** The script runs: the head's and the days' boxes work. */
		enhanced: boolean;
		/** Versions to post in place of the loaded ones: a refused selection's, as posted. */
		versions: Record<string, string>;
	} = $props();

	const every = $derived(days.flatMap((d) => d.rows.map((r) => r.id)));
	const all = $derived(selection.state(every));
	const dayIds = (d: TableDay) => d.rows.map((r) => r.id);

	/** A row's box: shift ticks the run from the last one toggled (call 31). */
	function ontick(e: MouseEvent, id: string) {
		if (e.shiftKey) getSelection()?.removeAllRanges();
		selection.toggle(id, e.shiftKey);
	}

	// Whole class names, so Tailwind sees them.
	const DOTS = [
		'bg-project-1',
		'bg-project-2',
		'bg-project-3',
		'bg-project-4',
		'bg-project-5',
		'bg-project-6',
		'bg-project-7',
		'bg-project-8'
	];
	const dot = (colour: number) => DOTS[(colour - 1) % DOTS.length] ?? DOTS[0];
	const edit = (r: TableRow) => editHref(r, back);
	const marksOf = (id: string) => warnings.filter((w) => w.subject === id);
	/** What has run since the load, for each running entry. */
	const since = $derived(Math.max(0, now - loadedAt));
	const hours = (r: TableRow) => spanText((r.endAt ?? now) - r.startAt);
	const dayTotal = (d: TableDay) =>
		spanText(d.totalMs + d.rows.filter((r) => r.running).length * since);

	/** The tooltip: what the row cuts or drops at this width. */
	function titleOf(r: TableRow): string {
		return [
			r.description,
			r.location ? `Location: ${r.location}` : null,
			r.reference ? `Reference: ${r.reference}` : null,
			r.overlaps ? OVERLAP : null
		]
			.filter(Boolean)
			.join('\n');
	}

	/** A click anywhere on the row but its controls opens the form, as its link does. */
	function onrowclick(e: MouseEvent, r: TableRow) {
		const target = e.target instanceof Element ? e.target : null;
		if (!target || target.closest('a, button, input, label, summary, details, form')) return;
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		void openForm(edit(r));
	}

	const head = 'h-9 px-3 text-left align-middle text-xs caps font-semibold text-muted-foreground';
	const cell = 'px-3 py-2 align-middle';
	const box =
		'size-4.5 rounded-sm align-middle accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

<table class="w-full border-separate border-spacing-0 text-sm lg:table-fixed">
	<thead>
		<tr class="bg-muted">
			<th class="{head} w-11 border-b border-input">
				{#if enhanced}
					<input
						type="checkbox"
						class={box}
						checked={all === 'all'}
						indeterminate={all === 'some'}
						onchange={() => selection.setMany(every, all !== 'all')}
						aria-label="Select all shown"
						data-select-all
					/>
				{:else}
					<!-- Without the script: every row ticked by the server (call 39). -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -- `back` is resolved -->
					<a
						href="{back}&all=1"
						data-nojs
						class="rounded-sm text-xs font-semibold text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>Select all</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</th>
			<th class="{head} w-[4.5rem] border-b border-input">Start</th>
			<th class="{head} w-20 border-b border-input">End</th>
			<th class="{head} w-16 border-b border-input text-right">Hours</th>
			<!-- Fixed and wide: the project is what a month-end scan reads (`pc-table`). -->
			<th class="{head} w-56 border-b border-input">Customer › project</th>
			<th class="{head} w-32 border-b border-input">Activity</th>
			<th class="{head} w-28 border-b border-input max-xl:hidden">Location</th>
			<th class="{head} w-24 border-b border-input max-xl:hidden">Reference</th>
			<th class="{head} border-b border-input">Description</th>
			<th class="{head} w-11 border-b border-input"><span class="sr-only">Restart</span></th>
			<th class="{head} w-11 border-b border-input"><span class="sr-only">Actions</span></th>
		</tr>
	</thead>
	{#each days as d (d.date)}
		{@const ticks = selection.state(dayIds(d))}
		<tbody aria-labelledby="day-{d.date}">
			<tr>
				<td class="border-b border-border pl-3 align-middle">
					{#if enhanced}
						<input
							type="checkbox"
							class={box}
							checked={ticks === 'all'}
							indeterminate={ticks === 'some'}
							onchange={() => selection.setMany(dayIds(d), ticks !== 'all')}
							aria-label="Select {d.label}"
						/>
					{/if}
				</td>
				<th
					id="day-{d.date}"
					scope="colgroup"
					colspan="2"
					class="{cell} border-b border-border text-left font-semibold whitespace-nowrap figures"
				>
					{d.label}
				</th>
				<td class="{cell} border-b border-border text-right font-semibold figures">{dayTotal(d)}</td
				>
				<td colspan="7" class="border-b border-border"></td>
			</tr>
			{#each d.rows as r (r.id)}
				{@const marks = marksOf(r.id)}
				{@const edge = r.overlaps ? 'lg:shadow-[inset_0_2px_0_var(--destructive)]' : ''}
				<tr
					data-row={r.id}
					title={titleOf(r)}
					onclick={(e) => onrowclick(e, r)}
					class="cursor-pointer transition-colors duration-150 ease-out {marks.length > 0 ||
					selection.has(r.id)
						? 'bg-accent'
						: 'hover:bg-accent/50'}"
				>
					<td class="border-b border-border pl-3 align-middle {edge}">
						<input
							type="checkbox"
							name="id"
							value={r.id}
							form="bulk"
							class={box}
							checked={selection.has(r.id)}
							onclick={(e) => ontick(e, r.id)}
							aria-label="Select {d.date} {r.start}, {where(r)}"
						/>
						<input
							type="hidden"
							name="version.{r.id}"
							value={versions[r.id] ?? String(r.version)}
							form="bulk"
						/>
					</td>
					<td class="{cell} border-b border-border figures {edge}">{r.start}</td>
					<td class="{cell} border-b border-border figures {edge}">
						{#if r.end === null}
							<span class="text-xs caps text-live">Running</span>
						{:else}
							{r.end}{#if r.plusDays > 0}<span class="text-xs text-muted-foreground"
									>+{r.plusDays}</span
								>{/if}
						{/if}
					</td>
					<td
						class="{cell} border-b border-border text-right figures {r.running
							? 'text-live'
							: ''} {edge}">{hours(r)}</td
					>
					<td class="{cell} border-b border-border {edge}">
						<!-- eslint-disable svelte/no-navigation-without-resolve -- edit() resolves it -->
						<a
							href={edit(r)}
							data-entry-form
							aria-label={nameOf(r)}
							class="inline-flex max-w-full min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<span class="size-2 shrink-0 rounded-full {dot(r.colour)}" aria-hidden="true"></span>
							<span class="min-w-0 truncate"
								><span class="text-muted-foreground">{r.customer} ›</span> {r.project}</span
							>
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{#if marks.length > 0}
							<span class="flex flex-wrap gap-1 pt-0.5">
								{#each marks as mark, i (i)}
									<Badge variant="destructive">{warningText(mark)}</Badge>
								{/each}
							</span>
						{/if}
					</td>
					<td class="{cell} truncate border-b border-border {edge}">{r.activity ?? ''}</td>
					<td class="{cell} truncate border-b border-border max-xl:hidden {edge}"
						>{r.location ?? ''}</td
					>
					<td class="{cell} truncate border-b border-border figures max-xl:hidden {edge}"
						>{r.reference ?? ''}</td
					>
					<td class="{cell} truncate border-b border-border {edge}">{r.description ?? ''}</td>
					<td class="border-b border-border py-0 align-middle {edge}">
						{#if !r.running}
							<form method="POST" action={resolve('/(app)/timers/restart')} use:enhance={inPlace}>
								<input type="hidden" name="id" value={r.id} />
								<input type="hidden" name="back" value={back} />
								<button
									type="submit"
									title="Restart"
									aria-label="Restart {d.date} {r.start}, {where(r)}"
									class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
									><Play class="size-3.5 fill-current" aria-hidden="true" /></button
								>
							</form>
						{/if}
					</td>
					<td class="border-b border-border py-0 pr-1 align-middle {edge}">
						<RowMenu row={r} {back} surface="pc" />
					</td>
				</tr>
			{/each}
		</tbody>
	{/each}
</table>
