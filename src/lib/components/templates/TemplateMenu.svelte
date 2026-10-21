<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Play from '@lucide/svelte/icons/play';
	import SquareCheck from '@lucide/svelte/icons/square-check';
	import Trash from '@lucide/svelte/icons/trash';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { removedInPlace } from '#lib/components/timesheet/live.js';
	import type { TemplateCard } from '#lib/components/today/types.js';
	import { editHref, useLabel, whereOf } from './rows';

	/**
	 * A template's ⋯ (`pc-templates-menu`): Edit, Log… (Start timer… for a TIMER
	 * template), a rule, Delete in red. Edit opens the template form in place; Log… opens
	 * the template's sheet over the screen (`onuse`); Delete posts at once with the version
	 * shown, and the strip offers it back. A `<details>` of links and post buttons, so it
	 * works without the script (Log… then goes to Today, where the template's panel is);
	 * with it, Entries' menu-button pattern (arrows, Home and End move, Escape closes it
	 * and returns to ⋯; a click outside closes it). As the phone's row sheet (`sheet`,
	 * inside `Sheet`), the same items as 48 px rows under a head naming the template:
	 * its name over customer › project.
	 */
	let {
		template,
		back,
		surface,
		onuse,
		sheet = null
	}: {
		template: TemplateCard;
		back: string;
		surface: 'pc' | 'phone';
		/** Opens the template's sheet (with the script); the menu has closed. */
		onuse?: () => void;
		/** The sheet's form: its heading's id and how to close it. */
		sheet?: { titleId: string; onpick: () => void } | null;
	} = $props();

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	let details = $state<HTMLDetailsElement | null>(null);
	let summary = $state<HTMLElement | null>(null);
	let list = $state<HTMLElement | null>(null);
	let open = $state(false);

	const where = $derived(whereOf(template));
	const label = $derived(`Actions for ${template.name}`);
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

	/** Log…: the sheet opens over the screen; closed, it gives the focus back to ⋯. */
	function use(pick: () => void) {
		pick();
		onuse?.();
	}

	const item =
		'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 text-left text-sm outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent lg:h-9';
	const sheetItem =
		'flex h-12 w-full cursor-pointer items-center gap-3 border-t border-border px-4 text-left text-base outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent';
	const role = $derived(hydrated ? 'menuitem' : undefined);
</script>

{#if sheet}
	<div class="flex shrink-0 flex-col gap-0.5 px-4 pt-4 pb-3">
		<h2 id={sheet.titleId} class="text-base font-semibold text-pretty">{template.name}</h2>
		{#if where}
			<p class="text-xs text-muted-foreground">{where}</p>
		{/if}
	</div>
	<div class="flex min-h-0 flex-col overflow-y-auto">
		{@render entries(sheetItem, undefined, sheet.onpick)}
	</div>
{:else}
	<details bind:this={details} {ontoggle} data-holds-keys data-surface={surface} class="relative">
		<summary
			bind:this={summary}
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
			class="absolute top-full {surface === 'phone'
				? 'left-0'
				: 'right-0'} z-20 mt-1 flex w-52 flex-col rounded-md border border-border bg-card p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
		>
			{@render entries(item, role, () => close(true))}
		</div>
	</details>
{/if}

{#snippet entries(itemClass: string, itemRole: string | undefined, onpick: () => void)}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- editHref resolves it -->
	<a
		href={editHref(template, back)}
		data-entry-form
		role={itemRole}
		data-menu-item
		class="{itemClass} text-foreground"
		onclick={sheet ? onpick : () => close(false)}
	>
		<Pencil class="size-3.5" aria-hidden="true" /><span>Edit</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{#if hydrated && onuse}
		<button
			type="button"
			role={itemRole}
			aria-haspopup="dialog"
			data-menu-item
			class="{itemClass} text-foreground"
			onclick={() => use(onpick)}
		>
			{#if template.runs}
				<Play class="size-3.5 fill-current" aria-hidden="true" />
			{:else}
				<SquareCheck class="size-3.5" aria-hidden="true" />
			{/if}
			<span>{useLabel(template)}</span>
		</button>
	{:else}
		<!-- Without the script the template's sheet is its panel on Today. -->
		<a href={resolve('/(app)')} data-menu-item class="{itemClass} text-foreground">
			{#if template.runs}
				<Play class="size-3.5 fill-current" aria-hidden="true" />
			{:else}
				<SquareCheck class="size-3.5" aria-hidden="true" />
			{/if}
			<span>{useLabel(template)}</span>
		</a>
	{/if}
	{#if !sheet}<div
			role={hydrated ? 'separator' : undefined}
			class="my-1 border-t border-border"
		></div>{/if}
	<form
		method="POST"
		action="{resolve('/(app)/templates/[id]', { id: template.id })}?/delete"
		use:enhance={removedInPlace}
		onsubmit={sheet ? onpick : () => close(false)}
		class="contents"
	>
		<input type="hidden" name="version" value={template.version} />
		<input type="hidden" name="back" value={back} />
		<button type="submit" role={itemRole} data-menu-item class="{itemClass} text-destructive">
			<Trash class="size-3.5" aria-hidden="true" /><span>Delete</span>
		</button>
	</form>
{/snippet}
