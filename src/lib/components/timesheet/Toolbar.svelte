<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { rangeLabel, scopeCount, type Filter, type Preset } from '#lib/filter/filter.js';
	import FilterButton from './FilterButton.svelte';
	import FilterPanel from './FilterPanel.svelte';
	import FilterSheet from './FilterSheet.svelte';
	import SearchField from './SearchField.svelte';
	import type { FilterOptions } from './types';

	/**
	 * Above the table: Filter, Search entries, and the shown set's count and total. On the
	 * phone, Filter (full width) and Select, the search under them and the count under
	 * that, out of the "+"'s column; with the script there the filter is a sheet, and
	 * Select a button, else a link that reloads with tick boxes (`select=1`). Select shows
	 * only on a screen that passes `selectHref` or `onSelect` (Entries).
	 */
	let {
		action,
		noun,
		hidden,
		filter,
		options,
		hints,
		error,
		clear,
		count,
		total,
		sheet,
		selectHref,
		onSelect
	}: {
		/** The screen the filter's form shows (`/entries`, `/copy-out`, `/reports`). */
		action: string;
		/** What the count counts, one and many: ['entry', 'entries'], ['row', 'rows']. */
		noun: [string, string];
		/** More hidden fields the filter's form keeps (Copy-out's columns and options). */
		hidden?: Snippet;
		filter: Filter;
		options: FilterOptions;
		hints: Record<Preset, string>;
		error: string | null;
		/** The address with the filters but the range and search cleared. */
		clear: string;
		count: number;
		/** `h:mm`, running entries counted to now. */
		total: string;
		/** The script runs on a phone: the filter opens as a sheet. */
		sheet: boolean;
		/** Select without the script: the table with its tick boxes. */
		selectHref?: string;
		/** Select with the script; absent without it. */
		onSelect?: () => void;
	} = $props();

	const FORM = 'filter';
</script>

<div class="flex flex-wrap items-center gap-x-2 gap-y-3 max-lg:pr-14">
	<div class="flex min-w-0 items-center gap-2 max-lg:basis-full">
		{#if sheet}
			<FilterSheet
				id={FORM}
				{action}
				label={rangeLabel(filter)}
				more={scopeCount(filter)}
				{filter}
				{options}
				{hints}
				{error}
				{clear}
				{count}
				{noun}
				{hidden}
			/>
		{:else}
			<FilterButton
				label={rangeLabel(filter)}
				count={scopeCount(filter)}
				open={error !== null}
				fill
			>
				<FilterPanel
					id={FORM}
					{action}
					{filter}
					{options}
					range={true}
					{hints}
					{error}
					{clear}
					{hidden}
				/>
			</FilterButton>
		{/if}
		{#if count === 0 || (selectHref === undefined && !onSelect)}
			<!-- Nothing to select, or no selecting on this screen. -->
		{:else if onSelect}
			<Button variant="outline" class="lg:hidden" onclick={onSelect} data-select>Select</Button>
		{:else}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page resolved it -->
			<Button variant="outline" class="self-start lg:hidden" href={selectHref}>Select</Button>
		{/if}
	</div>
	<SearchField q={filter.q} form={FORM} />
	{#if error === null}
		<p class="text-sm text-muted-foreground max-lg:basis-full lg:ml-auto">
			<span class="font-semibold text-foreground figures">{count}</span>
			{count === 1 ? noun[0] : noun[1]} ·
			<span class="font-semibold text-foreground figures">{total}</span>
		</p>
	{/if}
</div>
