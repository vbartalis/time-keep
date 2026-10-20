<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { spanText } from '#lib/calendar/grid.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import type { FlashWarning } from '#lib/components/today/types.js';
	import { warningText } from '#lib/format.js';
	import RowMenu from './RowMenu.svelte';
	import Sheet from './Sheet.svelte';
	import { OVERLAP, editHref, nameOf, where } from './rows';
	import type { Selection } from './selection.svelte';
	import type { TableDay, TableRow } from './types';

	/**
	 * The phone's table (`ph-table`): a section per day, its date in `caps` and its total
	 * on a text-colour rule, then its rows of at least 64 px: the project's 4 px bar, a
	 * leading ⋯, start over end, customer › project over the muted lines, the duration at
	 * the right, out of the "+"'s column. The rows run to the screen's edges (the day heads
	 * keep the page's margin); the activity · location · reference line and the
	 * description wrap, never cut, so the row says what the entry was. A tap on a row opens its form in place. ⋯ opens
	 * the row's sheet (without the script, the row menu's `<details>`). While `selecting`,
	 * tick boxes take the ⋯'s place and each day head gains one (with the script).
	 */
	let {
		days,
		back,
		now,
		loadedAt,
		warnings,
		selection,
		enhanced,
		selecting,
		versions
	}: {
		days: TableDay[];
		/** The table's own address: where the form and the menu return to. */
		back: string;
		/** The ticking now: a running row counts to it. */
		now: number;
		/** The server's now, which the totals were counted to. */
		loadedAt: number;
		/** The strip's warnings: the rows they name stay marked. */
		warnings: FlashWarning[];
		selection: Selection;
		enhanced: boolean;
		/** Tick boxes in place of ⋯ (Select, or `select=1` without the script). */
		selecting: boolean;
		/** Versions to post in place of the loaded ones: a refused selection's, as posted. */
		versions: Record<string, string>;
	} = $props();

	const dayIds = (d: TableDay) => d.rows.map((r) => r.id);
	const marksOf = (id: string) => warnings.filter((w) => w.subject === id);
	const since = $derived(Math.max(0, now - loadedAt));
	const hours = (r: TableRow) => spanText((r.endAt ?? now) - r.startAt);
	const dayTotal = (d: TableDay) =>
		spanText(d.totalMs + d.rows.filter((r) => r.running).length * since);
	const bar = (r: TableRow) => `var(--project-${((r.colour - 1) % 8) + 1})`;
	const meta = (r: TableRow) => [r.activity, r.location, r.reference].filter(Boolean).join(' · ');

	/** The row whose ⋯ was tapped, and its day; kept while the sheet closes. */
	let menu = $state<{ row: TableRow; day: string } | null>(null);
	let menuOpen = $state(false);
	const MENU_TITLE = 'row-sheet-title';

	function openMenu(row: TableRow, day: string) {
		menu = { row, day };
		menuOpen = true;
	}
</script>

<div data-phone-list class="-mx-4 flex flex-col">
	{#each days as d (d.date)}
		{@const ticks = selection.state(dayIds(d))}
		<section aria-labelledby="pday-{d.date}">
			<div class="mx-4 flex min-h-11 items-center gap-1 border-b border-foreground pt-3 pr-14 pl-1">
				{#if selecting && enhanced}
					<input
						type="checkbox"
						checked={ticks === 'all'}
						indeterminate={ticks === 'some'}
						onchange={() => selection.setMany(dayIds(d), ticks !== 'all')}
						aria-label="Select {d.label}"
					/>
				{/if}
				<h2 id="pday-{d.date}" class="min-w-0 flex-1 text-xs caps figures">{d.label}</h2>
				<span data-day-total class="text-sm font-semibold figures">{dayTotal(d)}</span>
			</div>
			<ul>
				{#each d.rows as r (r.id)}
					{@const marks = marksOf(r.id)}
					<li
						data-row={r.id}
						class="flex min-h-16 border-b border-l-4 border-border {r.overlaps
							? 'border-t-2 border-t-destructive'
							: ''} {marks.length > 0 || (selecting && selection.has(r.id)) ? 'bg-accent' : ''}"
						style:border-left-color={bar(r)}
					>
						<div class="flex w-11 shrink-0 justify-center pt-2.5">
							{#if selecting}
								<input
									type="checkbox"
									name="id"
									value={r.id}
									form="bulk"
									checked={selection.has(r.id)}
									onclick={() => selection.toggle(r.id, false)}
									aria-label="Select {d.date} {r.start}, {where(r)}"
								/>
								<input
									type="hidden"
									name="version.{r.id}"
									value={versions[r.id] ?? String(r.version)}
									form="bulk"
								/>
							{:else if enhanced}
								<button
									type="button"
									aria-label="Actions for {r.start}, {where(r)}"
									aria-haspopup="dialog"
									onclick={() => openMenu(r, d.label)}
									class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
								>
									<Ellipsis class="size-4" aria-hidden="true" />
								</button>
							{:else}
								<RowMenu row={r} {back} surface="phone" />
							{/if}
						</div>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- editHref resolves it -->
						<a
							href={editHref(r, back)}
							data-entry-form
							aria-label={nameOf(r)}
							class="mr-18 grid min-w-0 flex-1 grid-cols-[3.75rem_minmax(0,1fr)_auto] items-start gap-x-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
						>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<span class="flex flex-col figures">
								<span data-start class="text-base leading-tight">{r.start}</span>
								{#if r.end === null}
									<span class="text-xs caps text-live">Running</span>
								{:else}
									<span data-end class="text-xs text-muted-foreground"
										>{r.end}{#if r.plusDays > 0}+{r.plusDays}{/if}</span
									>
								{/if}
							</span>
							<span data-what class="flex min-w-0 flex-col">
								<!-- Two lines at most: the project after the › is what must read. -->
								<span class="line-clamp-2 text-sm leading-tight font-semibold"
									>{r.customer} › {r.project}</span
								>
								{#if meta(r)}
									<!-- Wrapped, never cut: the reference at its end finds the ticket. -->
									<span class="text-xs wrap-break-word text-muted-foreground">{meta(r)}</span>
								{/if}
								{#if r.description}
									<!-- Wrapped in full too: the row says what the entry was. -->
									<span class="text-xs wrap-break-word text-muted-foreground">{r.description}</span>
								{/if}
								{#if r.overlaps}
									<span class="text-xs text-destructive">{OVERLAP}</span>
								{/if}
								{#if marks.length > 0}
									<span class="flex flex-wrap gap-1 pt-0.5">
										{#each marks as mark, i (i)}
											<Badge variant="destructive">{warningText(mark)}</Badge>
										{/each}
									</span>
								{/if}
							</span>
							<span
								data-duration
								class="text-base leading-tight font-semibold figures {r.running ? 'text-live' : ''}"
								>{hours(r)}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<Sheet open={menuOpen} labelledby={MENU_TITLE} onclose={() => (menuOpen = false)}>
	{#if menu}
		<RowMenu
			row={menu.row}
			{back}
			surface="phone"
			sheet={{ day: menu.day, titleId: MENU_TITLE, onpick: () => (menuOpen = false) }}
		/>
	{/if}
</Sheet>
