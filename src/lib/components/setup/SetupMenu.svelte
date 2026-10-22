<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import {
		MenuButton,
		menuItemClass,
		menuListClass,
		menuSummaryClass,
		sheetItemClass
	} from '#lib/components/menu-button.svelte.js';
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

	const menu = new MenuButton();

	const label = $derived(`Actions for ${row.name}`);
	const underArchived = $derived('underArchived' in row && row.underArchived);

	/** Rename and Add project: the menu closes onto ⋯ first, then the field or dialog opens. */
	function pick(onpick: () => void, then: () => void) {
		onpick();
		then();
	}

	const item = menuItemClass;
	const sheetItem = sheetItemClass;
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
	<details bind:this={menu.details} ontoggle={menu.ontoggle} data-holds-keys class="relative">
		<summary
			bind:this={menu.summary}
			data-menu-for={row.id}
			aria-label={label}
			aria-haspopup={hydrated ? 'menu' : undefined}
			aria-expanded={hydrated ? menu.open : undefined}
			class={menuSummaryClass}
		>
			<Ellipsis class="size-4" aria-hidden="true" />
		</summary>
		<div
			bind:this={menu.list}
			role={hydrated ? 'menu' : undefined}
			aria-label={hydrated ? label : undefined}
			tabindex="-1"
			onkeydown={menu.onkeydown}
			class={menuListClass}
		>
			{@render entries(item, role, () => menu.close(true))}
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
			onsubmit={sheet ? onpick : () => menu.close(false)}
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
