<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { onMount, tick, type Component } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import {
		MenuButton,
		menuItemClass,
		menuListClass,
		menuSummaryClass,
		sheetItemClass
	} from '#lib/components/menu-button.svelte.js';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import { cn } from '#lib/utils.js';
	import { focusLost, rowMenuOf } from './dialogs';
	import type { MenuItem } from './items';

	/**
	 * A row's ⋯ on Account and Users, as Setup's (`SetupMenu`). With the script, from `lg`,
	 * the 208 px popover under it with the menu-button pattern; below `lg`, the row sheet
	 * (`Sheet`): `head` naming the row over a muted line, the items as 48 px rows. Without
	 * the script, a `<details>` of links (a `pick`'s `href`) and post buttons. A `pick`
	 * closes the menu onto ⋯, then `onpick(id)` opens its dialog (whose closing returns
	 * there); a `post` submits at once with `use:enhance`, the focus left on ⋯.
	 */
	let {
		rowId,
		label,
		items,
		onpick,
		head
	}: {
		/** The row's id, on ⋯ as `data-menu-for`. */
		rowId: string;
		/** ⋯'s accessible name, "Actions for <name>". */
		label: string;
		items: MenuItem[];
		onpick: (id: string) => void;
		/**
		 * The row sheet's head: the row's name and a muted line under it, text with its
		 * dates (`{ date }`) set in figures and kept whole.
		 */
		head: { title: string; sub: (string | { date: string })[] };
	} = $props();

	let hydrated = $state(false);
	onMount(() => (hydrated = true));
	const wide = new MediaQuery('(min-width: 1024px)', true);
	/** Below `lg` with the script: ⋯ opens the row sheet. */
	const sheetMode = $derived(hydrated && !wide.current);

	const menu = new MenuButton();
	let sheetOpen = $state(false);
	const titleId = $derived(`menu-${rowId}-title`);

	const role = $derived(hydrated ? 'menuitem' : undefined);
	const toneOf = (base: string, item: MenuItem) =>
		item.tone === 'destructive' ? cn(base, 'text-destructive') : base;
	/** An icon, given the class and `aria-hidden` every Lucide icon takes. */
	const iconOf = (item: MenuItem) =>
		item.icon as Component<{ class?: string; 'aria-hidden'?: 'true' }> | undefined;

	/** The menu closes onto ⋯ first, so the dialog `onpick` opens returns the focus there. */
	async function pick(id: string) {
		if (sheetMode) {
			sheetOpen = false;
			await tick();
		} else {
			menu.close(true);
		}
		onpick(id);
	}

	/**
	 * A post: the menu closes onto ⋯ (the popover's focused item would otherwise drop the
	 * focus to the page), and once the page is back the focus is on ⋯ again, unless it went
	 * somewhere on purpose meanwhile.
	 */
	function posted() {
		if (sheetMode) sheetOpen = false;
		else menu.close(true);
	}

	const restore: SubmitFunction =
		() =>
		async ({ update }) => {
			await update();
			await tick();
			if (focusLost(document.activeElement, document.body)) rowMenuOf(rowId)?.focus();
		};
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- a pick's href is the page's own query (`?password=<id>`) -->

{#if sheetMode}
	<button
		type="button"
		data-menu-for={rowId}
		aria-label={label}
		aria-haspopup="dialog"
		onclick={() => (sheetOpen = true)}
		class={menuSummaryClass}
	>
		<Ellipsis class="size-4" aria-hidden="true" />
	</button>
	<Sheet open={sheetOpen} labelledby={titleId} onclose={() => (sheetOpen = false)}>
		<div class="flex shrink-0 flex-col gap-0.5 px-4 pt-4 pb-3">
			<h2 id={titleId} class="text-base font-semibold text-pretty wrap-break-word">
				{head.title}
			</h2>
			<p class="text-xs text-muted-foreground">
				{#each head.sub as part, i (i)}{#if typeof part === 'string'}{part}{:else}<span
							class="whitespace-nowrap figures">{part.date}</span
						>{/if}{/each}
			</p>
		</div>
		<div class="flex min-h-0 flex-col overflow-y-auto">
			{@render entries(sheetItemClass, undefined, true)}
		</div>
	</Sheet>
{:else}
	<details bind:this={menu.details} ontoggle={menu.ontoggle} data-holds-keys class="relative">
		<summary
			bind:this={menu.summary}
			data-menu-for={rowId}
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
			{@render entries(menuItemClass, role, false)}
		</div>
	</details>
{/if}

{#snippet entries(itemClass: string, itemRole: string | undefined, sheet: boolean)}
	{#each items as item (item.id)}
		{@const Icon = iconOf(item)}
		{@const cls = toneOf(itemClass, item)}
		{#if item.ruleBefore && !sheet}
			<div role={hydrated ? 'separator' : undefined} class="my-1 border-t border-border"></div>
		{/if}
		{#if item.kind === 'pick'}
			{#if hydrated}
				<button
					type="button"
					role={itemRole}
					aria-haspopup="dialog"
					data-menu-item
					class={cls}
					onclick={() => pick(item.id)}
				>
					{#if Icon}<Icon class="size-3.5" aria-hidden="true" />{/if}<span>{item.label}</span>
				</button>
			{:else}
				<a href={item.href} data-menu-item class={cls}>
					{#if Icon}<Icon class="size-3.5" aria-hidden="true" />{/if}<span>{item.label}</span>
				</a>
			{/if}
		{:else}
			<form
				method="POST"
				action={item.action}
				use:enhance={restore}
				onsubmit={posted}
				class="contents"
			>
				{#each Object.entries(item.fields) as [name, value] (name)}
					<input type="hidden" {name} {value} />
				{/each}
				<button type="submit" role={itemRole} data-menu-item class={cls}>
					{#if Icon}<Icon class="size-3.5" aria-hidden="true" />{/if}<span>{item.label}</span>
				</button>
			</form>
		{/if}
	{/each}
{/snippet}
