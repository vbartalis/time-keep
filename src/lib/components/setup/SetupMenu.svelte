<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { SetupProject, SetupRow, Show } from '#lib/server/screens/setup.js';
	import { act, actionOf, menuButtonOf, setupHref } from './act';

	/**
	 * A Setup row's ⋯ (`pc-setup-menu`, `ph-setup-menu`). A customer: Rename, Add project,
	 * a rule, Archive; a project, activity or location: Rename, a rule, Archive; an
	 * archived row: Rename, a rule, Unarchive; a project under an archived customer:
	 * Rename alone (the core refuses its unarchive; archiving it changes nothing seen).
	 * Archive and Unarchive post at once, not in red (nothing is lost); the strip offers
	 * them back. A `<details>` of links and post buttons, so it works without the script
	 * (Rename and Add project then load `?rename=` and `?new=project`); with it, Entries'
	 * menu-button pattern (arrows, Home and End move, Escape closes it and returns to ⋯, a
	 * click outside closes it). As the phone's row sheet (`sheet`, inside `Sheet`), the
	 * same items as 48 px rows under a head naming the row and its kind.
	 */
	let {
		row,
		kindLine,
		show,
		onrename,
		onaddproject,
		sheet = null
	}: {
		row: SetupRow | SetupProject;
		/** The row sheet's second line: "CompX · project", "customer", "activity", "location". */
		kindLine: string;
		show: Show;
		/** With the script: the row turns into its rename field; the menu has closed. */
		onrename: () => void;
		/** With the script: the New project dialog opens for this customer. */
		onaddproject: () => void;
		/** The sheet's form: its heading's id and how to close it. */
		sheet?: { titleId: string; onpick: () => void } | null;
	} = $props();

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	let details = $state<HTMLDetailsElement | null>(null);
	let summary = $state<HTMLElement | null>(null);
	let list = $state<HTMLElement | null>(null);
	let open = $state(false);

	const label = $derived(`Actions for ${row.name}`);
	const underArchived = $derived('underArchived' in row && row.underArchived);
	const items = () => [...(list?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [])];

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

	/** Rename and Add project: the menu closes onto ⋯ first, then the field or dialog opens. */
	function pick(onpick: () => void, then: () => void) {
		onpick();
		then();
	}

	const item =
		'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 text-left text-sm text-foreground outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent lg:h-9';
	const sheetItem =
		'flex h-12 w-full cursor-pointer items-center gap-3 border-t border-border px-4 text-left text-base text-foreground outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent';
	const role = $derived(hydrated ? 'menuitem' : undefined);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- setupHref resolves every address -->

{#if sheet}
	<div class="flex shrink-0 flex-col gap-0.5 px-4 pt-4 pb-3">
		<h2 id={sheet.titleId} class="text-base font-semibold text-pretty">{row.name}</h2>
		<p class="text-xs text-muted-foreground">{kindLine}</p>
	</div>
	<div class="flex min-h-0 flex-col overflow-y-auto">
		{@render entries(sheetItem, undefined, sheet.onpick)}
	</div>
{:else}
	<details bind:this={details} {ontoggle} data-holds-keys class="relative">
		<summary
			bind:this={summary}
			data-menu-for={row.id}
			aria-label={label}
			aria-haspopup={hydrated ? 'menu' : undefined}
			aria-expanded={hydrated ? open : undefined}
			class="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9 [&::-webkit-details-marker]:hidden"
		>
			<Ellipsis class="size-4" aria-hidden="true" />
		</summary>
		<div
			bind:this={list}
			role={hydrated ? 'menu' : undefined}
			aria-label={hydrated ? label : undefined}
			tabindex="-1"
			{onkeydown}
			class="absolute top-full left-0 z-20 mt-1 flex w-52 flex-col rounded-md border border-border bg-card p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)] lg:right-0 lg:left-auto"
		>
			{@render entries(item, role, () => close(true))}
		</div>
	</details>
{/if}

{#snippet entries(itemClass: string, itemRole: string | undefined, onpick: () => void)}
	{#if hydrated}
		<button
			type="button"
			role={itemRole}
			data-menu-item
			class={itemClass}
			onclick={() => pick(onpick, onrename)}
		>
			<Pencil class="size-3.5" aria-hidden="true" /><span>Rename</span>
		</button>
	{:else}
		<a href={setupHref(show, { rename: row.id })} data-menu-item class={itemClass}>
			<Pencil class="size-3.5" aria-hidden="true" /><span>Rename</span>
		</a>
	{/if}
	{#if row.kind === 'customer' && !row.archived}
		{#if hydrated}
			<button
				type="button"
				role={itemRole}
				aria-haspopup="dialog"
				data-menu-item
				class={itemClass}
				onclick={() => pick(onpick, onaddproject)}
			>
				<Plus class="size-3.5" aria-hidden="true" /><span>Add project</span>
			</button>
		{:else}
			<a
				href={setupHref(show, { new: 'project', customer: row.id })}
				data-menu-item
				class={itemClass}
			>
				<Plus class="size-3.5" aria-hidden="true" /><span>Add project</span>
			</a>
		{/if}
	{/if}
	{#if !underArchived}
		{#if !sheet}<div
				role={hydrated ? 'separator' : undefined}
				class="my-1 border-t border-border"
			></div>{/if}
		<form
			method="POST"
			action={actionOf(row.archived ? 'unarchive' : 'archive', show)}
			use:enhance={act({ fallback: () => menuButtonOf(row.id) })}
			onsubmit={sheet ? onpick : () => close(false)}
			class="contents"
		>
			<input type="hidden" name="kind" value={row.kind} />
			<input type="hidden" name="id" value={row.id} />
			<input type="hidden" name="expectedVersion" value={row.version} />
			<input type="hidden" name="show" value={show} />
			<button type="submit" role={itemRole} data-menu-item class={itemClass}>
				{#if row.archived}
					<ArchiveRestore class="size-3.5" aria-hidden="true" /><span>Unarchive</span>
				{:else}
					<Archive class="size-3.5" aria-hidden="true" /><span>Archive</span>
				{/if}
			</button>
		</form>
	{/if}
{/snippet}
