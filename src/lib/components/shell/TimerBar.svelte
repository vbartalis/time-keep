<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import { enhance } from '$app/forms';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Elapsed from '#lib/components/today/Elapsed.svelte';
	import StartList from './StartList.svelte';
	import type { BarTemplate, BarTimer } from './types.js';

	/**
	 * The running timers, on every signed-in screen: the PC header's pill or the phone's
	 * strip under the top bar, each with the start list. `back` is the screen (path and
	 * query) a stop or a start returns to.
	 */
	let {
		timers,
		templates,
		now,
		back,
		variant,
		onsheet
	}: {
		timers: BarTimer[];
		templates: BarTemplate[];
		now: number;
		back: string;
		variant: 'header' | 'strip';
		/** The phone's start sheet opened or closed: the page behind it is inert meanwhile. */
		onsheet?: (open: boolean) => void;
	} = $props();

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
	const dot = (t: BarTimer) => DOTS[(t.colour - 1) % DOTS.length] ?? DOTS[0];

	const first = $derived(timers[0] ?? null);
	const rest = $derived(timers.slice(1));

	const started = (t: BarTimer) => `${t.startDate ? `${t.startDate} ` : ''}${t.start}`;
	const stopLabel = (t: BarTimer) => `Stop ${t.projectName} started ${started(t)}`;
	const detail = (t: BarTimer) => [t.activityName, t.description].filter(Boolean).join(' · ');
	const since = (t: BarTimer) =>
		[t.activityName, `since ${started(t)}`].filter(Boolean).join(' · ');
	// The header's other rows: the detail, and the start whenever it was on an earlier day.
	const otherLine = (t: BarTimer) =>
		[detail(t), t.startDate || !detail(t) ? `since ${started(t)}` : null]
			.filter(Boolean)
			.join(' · ');

	// The running timer's form, opened in place over the screen.
	const formHref = (t: BarTimer) =>
		`${resolve('/(app)/entries/[id]', { id: t.id })}?back=${encodeURIComponent(back)}`;

	// <details>, so the others and the start list open without JavaScript; with it, a
	// stop or a start closes them, and so do Escape and a click outside the start list.
	let details = $state<HTMLDetailsElement | null>(null);
	let startList = $state<HTMLDetailsElement | null>(null);
	let startSummary = $state<HTMLElement | null>(null);
	afterNavigate(() => {
		if (details) details.open = false;
		if (startList) startList.open = false;
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !startList?.open) return;
		startList.open = false;
		startSummary?.focus();
	}

	/** A closed list reopens with every template's description line closed. */
	function closeLines(e: Event & { currentTarget: HTMLDetailsElement }) {
		if (e.currentTarget.open) return;
		for (const line of e.currentTarget.querySelectorAll<HTMLDetailsElement>('details[open]'))
			line.open = false;
	}

	function toggleSheet(e: Event & { currentTarget: HTMLDetailsElement }) {
		closeLines(e);
		onsheet?.(e.currentTarget.open);
	}

	function onclick(e: MouseEvent) {
		if (!startList?.open) return;
		const target = e.target instanceof Node ? e.target : null;
		// A click outside, on the scrim, or on a link in it (the form opens over the screen).
		if (!target || !startList.contains(target)) startList.open = false;
		else if (target instanceof Element && target.closest('a, [data-scrim]')) startList.open = false;
	}

	const header = $derived(variant === 'header');
</script>

{#snippet stop(t: BarTimer, shown: boolean)}
	<form method="POST" action="/timers/stop" use:enhance class="shrink-0">
		<input type="hidden" name="id" value={t.id} />
		<input type="hidden" name="back" value={back} />
		<button
			type="submit"
			aria-label={stopLabel(t)}
			title={shown ? 'Stop (s)' : undefined}
			data-shown-stop={shown ? '' : undefined}
			class={[
				'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors duration-150 ease-out outline-none focus-visible:ring-2',
				header
					? 'h-8 border-input bg-card px-3 text-sm text-foreground hover:border-foreground/60 hover:bg-accent focus-visible:ring-ring'
					: 'size-11 min-w-11 border-white/20 bg-sidebar-primary px-0 text-base text-sidebar-primary-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring'
			]}
		>
			<span class="size-2.5 rounded-[2px] bg-live" aria-hidden="true"></span>
			<!-- The strip's Stop is the live square alone, so the name keeps the room. -->
			{#if header}Stop{:else}<span class="sr-only">Stop</span>{/if}
		</button>
	</form>
{/snippet}

{#snippet projectDot(t: BarTimer)}
	<span data-project-dot class="size-2 shrink-0 rounded-full {dot(t)}" aria-hidden="true"></span>
{/snippet}

{#snippet others()}
	<details bind:this={details} class="shrink-0">
		<summary
			class={[
				'flex cursor-pointer list-none items-center justify-center rounded-md border font-semibold outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden',
				header
					? 'h-8 min-w-8 border-input bg-card px-2 text-sm hover:bg-accent focus-visible:ring-ring'
					: 'h-11 min-w-11 border-white/20 px-2 text-base focus-visible:ring-sidebar-ring'
			]}
		>
			+{rest.length}<span class="sr-only"> more running</span>
		</summary>
		<ul
			class={[
				'absolute z-30 flex flex-col',
				header
					? 'top-full right-0 mt-1.5 w-[28rem] max-w-[calc(100vw-17rem)] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-[0_8px_24px_rgb(0_0_0/0.12)]'
					: 'inset-x-0 top-full border-t border-sidebar-border bg-sidebar-strip px-4 pb-2 shadow-[0_8px_24px_rgb(0_0_0/0.25)]'
			]}
		>
			{#each rest as t (t.id)}
				<li
					class={[
						'flex min-w-0 items-center gap-3',
						header
							? 'rounded-sm px-2 py-1.5'
							: 'min-h-16 border-b border-sidebar-border/70 py-2 last:border-b-0'
					]}
				>
					{@render projectDot(t)}
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate font-semibold">
							{header ? `${t.customerName} › ${t.projectName}` : t.projectName}
						</span>
						<span
							class="truncate text-xs {header
								? 'text-muted-foreground'
								: 'text-sidebar-foreground'}">{header ? otherLine(t) : since(t)}</span
						>
					</span>
					<span class="shrink-0 font-bold"><Elapsed startAt={t.startAt} serverNow={now} /></span>
					{@render stop(t, false)}
				</li>
			{/each}
		</ul>
	</details>
{/snippet}

{#snippet startSheet()}
	<!-- The start list as a sheet from the bottom. The scrim sits under the strip, so the
	     ▶ closes it again without JavaScript. -->
	<details bind:this={startList} data-start-list ontoggle={toggleSheet} class="shrink-0">
		<summary
			bind:this={startSummary}
			aria-label="Start a timer"
			class="flex h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md border border-white/20 transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring [&::-webkit-details-marker]:hidden"
		>
			<Play class="size-4 fill-current" aria-hidden="true" />
		</summary>
		<div data-scrim class="fixed inset-0 -z-10 bg-black/40" aria-hidden="true"></div>
		<div
			class="fixed inset-x-0 bottom-0 z-10 max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-border bg-card px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-base text-card-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)]"
		>
			<div class="mx-auto max-w-md"><StartList {templates} {back} /></div>
		</div>
	</details>
{/snippet}

<svelte:window {onkeydown} />
<svelte:document {onclick} />

{#if header}
	<section
		aria-label="Timer"
		class="relative flex h-10 max-w-full min-w-0 items-center gap-3 rounded-md border border-primary/25 bg-primary/8 pr-1 pl-3 text-sm"
	>
		{#if first}
			<span
				class="size-2.5 shrink-0 rounded-full bg-live ring-[3px] ring-live/25"
				aria-hidden="true"
			></span>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- formHref() resolves it -->
			<a
				href={formHref(first)}
				data-entry-form
				class="flex min-w-0 flex-1 items-center gap-3 rounded-sm underline-offset-4 transition-colors duration-150 ease-out outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span class="shrink-0 text-base font-bold"
					><Elapsed startAt={first.startAt} serverNow={now} /></span
				>
				{@render projectDot(first)}
				<span class="min-w-0 flex-1 truncate">
					<span class="font-semibold">{first.customerName} › {first.projectName}</span>
					{#if detail(first)}<span class="ml-1.5 text-muted-foreground">{detail(first)}</span>{/if}
					{#if first.startDate}<span class="ml-1.5 text-muted-foreground"
							>since <span class="figures">{started(first)}</span></span
						>{/if}
				</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{#if rest.length > 0}{@render others()}{/if}
			{@render stop(first, true)}
		{:else}
			<p class="px-1 pr-2 text-muted-foreground">No timer running</p>
		{/if}
	</section>
	<!-- Outside the pill, so it does not read as acting on the shown timer. -->
	<details bind:this={startList} data-start-list ontoggle={closeLines} class="relative shrink-0">
		<summary
			bind:this={startSummary}
			class="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold transition-colors duration-150 ease-out outline-none select-none hover:border-foreground/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
		>
			<Play class="size-3.5 fill-current" aria-hidden="true" />Start
		</summary>
		<div
			class="absolute top-full right-0 z-30 mt-1.5 w-[24rem] max-w-[calc(100vw-17rem)] rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
		>
			<StartList {templates} {back} />
		</div>
	</details>
{:else}
	<section
		aria-label="Timer"
		class="relative flex h-16 items-center gap-2 border-t border-sidebar-border bg-sidebar-strip px-4 text-sidebar-accent-foreground"
	>
		{#if first}
			<span
				class="size-2.5 shrink-0 rounded-full bg-sidebar-ring ring-[3px] ring-sidebar-ring/30"
				aria-hidden="true"
			></span>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- formHref() resolves it -->
			<a
				href={formHref(first)}
				data-entry-form
				class="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
			>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="flex min-w-0 items-center gap-2 text-base font-semibold">
						{@render projectDot(first)}
						<span class="truncate">{first.customerName} › {first.projectName}</span>
					</span>
					<span class="truncate text-xs text-sidebar-foreground">{since(first)}</span>
				</span>
				<span class="shrink-0 text-lg font-bold"
					><Elapsed startAt={first.startAt} serverNow={now} /></span
				>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{#if rest.length > 0}{@render others()}{/if}
		{:else}
			<p class="min-w-0 flex-1 text-sm text-sidebar-foreground">No timer running</p>
		{/if}
		{@render startSheet()}
		{#if first}{@render stop(first, true)}{/if}
	</section>
{/if}
