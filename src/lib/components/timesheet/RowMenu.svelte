<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Play from '@lucide/svelte/icons/play';
	import Trash from '@lucide/svelte/icons/trash';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { inPlace, removedInPlace } from './live';
	import type { TableRow } from './types';

	/**
	 * A row's ⋯: Restart, Copy, Edit, a rule, Delete. A `<details>` of links and post
	 * buttons, so it works without the script; with it, the menu-button pattern (arrows,
	 * Home and End move, Escape closes it and returns to ⋯; a click outside closes it).
	 * As the phone's sheet (`sheet`, inside `Sheet`), the same items as 48 px rows under a
	 * head naming the row: customer › project, then its day, start–end and activity.
	 */
	let {
		row,
		back,
		surface,
		sheet = null
	}: {
		row: TableRow;
		back: string;
		surface: 'pc' | 'phone';
		/** The sheet's form: the row's day label ("Mon 2026-10-19") and how to close it. */
		sheet?: { day: string; titleId: string; onpick: () => void } | null;
	} = $props();

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	let details = $state<HTMLDetailsElement | null>(null);
	let summary = $state<HTMLElement | null>(null);
	let list = $state<HTMLElement | null>(null);
	let open = $state(false);

	const where = $derived(`${row.customer} › ${row.project}`);
	const backQuery = $derived(encodeURIComponent(back));
	const copyHref = $derived(`${resolve('/(app)/entries/new')}?copy=${row.id}&back=${backQuery}`);
	const editHref = $derived(`${resolve('/(app)/entries/[id]', { id: row.id })}?back=${backQuery}`);

	// An `aria-disabled` item (Restart on a running row) stays in the arrow order (APG menu).
	const items = () => [...(list?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [])];

	/**
	 * Restart on a running row: with the script it stays focusable, so "Already running"
	 * is met by keyboard, and its activation is ignored; without it, plainly disabled.
	 */
	const inert = $derived(row.running && hydrated);
	function onrestart(e: MouseEvent) {
		if (inert) e.preventDefault();
	}

	function close(focus: boolean) {
		if (details) details.open = false;
		if (focus) summary?.focus();
	}

	function outside(e: MouseEvent) {
		const target = e.target instanceof Node ? e.target : null;
		if (target && details && !details.contains(target)) close(false);
	}

	function ontoggle() {
		open = details?.open ?? false;
		if (open) {
			document.addEventListener('click', outside, true);
			items()[0]?.focus();
		} else {
			document.removeEventListener('click', outside, true);
		}
	}

	$effect(() => () => document.removeEventListener('click', outside, true));

	function onkeydown(e: KeyboardEvent) {
		const all = items();
		const at = all.indexOf(document.activeElement as HTMLElement);
		const to = (i: number) => {
			e.preventDefault();
			all[(i + all.length) % all.length]?.focus();
		};
		if (e.key === 'ArrowDown') to(at + 1);
		else if (e.key === 'ArrowUp') to(at === -1 ? -1 : at - 1);
		else if (e.key === 'Home') to(0);
		else if (e.key === 'End') to(-1);
		else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			close(true);
		} else if (e.key === 'Tab') close(false);
	}

	const item =
		'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 text-left text-sm outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent lg:h-9';
	const role = $derived(hydrated ? 'menuitem' : undefined);
	const sheetItem =
		'flex h-12 w-full cursor-pointer items-center gap-3 border-t border-border px-4 text-left text-base outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent';
	/** The row's times for the sheet's head: "13:30–15:00", "23:00–01:00 +1", "10:00, Running". */
	const span = $derived(
		row.end === null
			? `${row.start}, Running`
			: `${row.start}–${row.end}${row.plusDays > 0 ? ` +${row.plusDays}` : ''}`
	);
</script>

{#if sheet}
	<div class="flex shrink-0 flex-col gap-0.5 px-4 pt-4 pb-3">
		<h2 id={sheet.titleId} class="text-base font-semibold">{where}</h2>
		<p class="text-xs text-muted-foreground figures">
			{[sheet.day, span, row.activity].filter(Boolean).join(' · ')}
		</p>
	</div>
	<div class="flex min-h-0 flex-col overflow-y-auto">
		{@render entries(sheetItem, undefined, sheet.onpick)}
	</div>
{:else}
	<!-- Open, the screen's keys wait (`screenKey`). -->
	<details bind:this={details} {ontoggle} data-holds-keys data-surface={surface} class="relative">
		<summary
			bind:this={summary}
			aria-label="Actions for {row.start}, {where}"
			aria-haspopup={hydrated ? 'menu' : undefined}
			aria-expanded={hydrated ? open : undefined}
			class="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9 [&::-webkit-details-marker]:hidden"
		>
			<Ellipsis class="size-4" aria-hidden="true" />
		</summary>
		<div
			bind:this={list}
			role={hydrated ? 'menu' : undefined}
			aria-label={hydrated ? `Actions for ${row.start}, ${where}` : undefined}
			tabindex="-1"
			{onkeydown}
			class="absolute top-full {surface === 'phone'
				? 'left-0'
				: 'right-0'} z-20 mt-1 flex w-52 flex-col rounded-md border border-border bg-card p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
		>
			{@render entries(item, role, () => close(false))}
		</div>
	</details>
{/if}

{#snippet entries(itemClass: string, itemRole: string | undefined, onpick: () => void)}
	<form
		method="POST"
		action={resolve('/(app)/timers/restart')}
		use:enhance={inPlace}
		onsubmit={onpick}
		class="contents"
	>
		<input type="hidden" name="id" value={row.id} />
		<input type="hidden" name="back" value={back} />
		<button
			type="submit"
			role={itemRole}
			data-menu-item
			disabled={row.running && !hydrated}
			aria-disabled={inert ? 'true' : undefined}
			onclick={onrestart}
			class="{itemClass} text-foreground"
		>
			<Play class="size-3.5 fill-current" aria-hidden="true" />
			<span>Restart</span>
			{#if row.running}<span class="ml-auto text-xs text-muted-foreground">Already running</span
				>{/if}
		</button>
	</form>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- copyHref and editHref resolve them -->
	<a
		href={copyHref}
		data-entry-form
		role={itemRole}
		data-menu-item
		class="{itemClass} text-foreground"
		onclick={onpick}
	>
		<Copy class="size-3.5" aria-hidden="true" /><span>Copy</span>
	</a>
	<a
		href={editHref}
		data-entry-form
		role={itemRole}
		data-menu-item
		class="{itemClass} text-foreground"
		onclick={onpick}
	>
		<Pencil class="size-3.5" aria-hidden="true" /><span>Edit</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{#if !sheet}<div
			role={hydrated ? 'separator' : undefined}
			class="my-1 border-t border-border"
		></div>{/if}
	<form
		method="POST"
		action="{resolve('/(app)/entries/[id]', { id: row.id })}?/delete"
		use:enhance={removedInPlace}
		onsubmit={onpick}
		class="contents"
	>
		<input type="hidden" name="version" value={row.version} />
		<input type="hidden" name="back" value={back} />
		<button type="submit" role={itemRole} data-menu-item class="{itemClass} text-destructive">
			<Trash class="size-3.5" aria-hidden="true" /><span>Delete</span>
		</button>
	</form>
{/snippet}
