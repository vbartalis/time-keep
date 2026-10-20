<script lang="ts">
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import { readView } from '#lib/calendar/dates.js';
	import EntryOverlay from '#lib/components/entry/EntryOverlay.svelte';
	import BottomBar from '#lib/components/shell/BottomBar.svelte';
	import Sidebar from '#lib/components/shell/Sidebar.svelte';
	import TimerBar from '#lib/components/shell/TimerBar.svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { openForm, openInPlace } from '#lib/entry-link.js';
	import { screenKey } from '#lib/keys.js';
	import { currentItem, screenTitle } from '#lib/shell.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const title = $derived(screenTitle(page.route.id));
	const current = $derived(currentItem(page.route.id, page.url.searchParams.get('back')));
	// Where a stop or an undo returns to: this screen, its query included; while the entry
	// form is open over it (the address is the form's), the screen under the form.
	const back = $derived(page.state.entryForm?.back ?? page.url.pathname + page.url.search);
	/** The sticky bars' height (top bar and timer strip, or the header): the undo strip pins under them. */
	let barsHeight = $state(0);
	/** The phone's start sheet is open: the page behind it takes no focus or taps. */
	let sheetOpen = $state(false);
	/** On the Calendar, the date in view (the form over it keeps the screen's address in `back`). */
	const viewDate = $derived.by(() => {
		if (!back.startsWith('/calendar')) return null;
		const today = (page.data as { today?: string }).today;
		return today ? readView(new URL(back, 'http://x').searchParams, today).date : null;
	});
	const newEntry = $derived(
		`${resolve('/(app)/entries/new')}?back=${encodeURIComponent(back)}${viewDate ? `&date=${viewDate}` : ''}`
	);

	/**
	 * The device's zone: remembered in the `tz` cookie (read by the server when a form
	 * has none) and written into every hidden `timeZone` field (not the template form's own
	 * text field, nor one marked `data-zone-fixed`: an entry's or a template's own zone). When the cookie was
	 * missing or stale, the screen reloads (unless a flash is showing) so its times use the device's zone.
	 */
	function fillZone() {
		let zone: string | undefined;
		try {
			zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			return;
		}
		if (!zone) return;
		const value = encodeURIComponent(zone);
		const stale = !document.cookie.split('; ').includes(`tz=${value}`);
		document.cookie = `tz=${value}; path=/; max-age=31536000; samesite=lax`;
		for (const input of document.querySelectorAll<HTMLInputElement>(
			'input[type="hidden"][name="timeZone"]:not([data-zone-fixed])'
		)) {
			// The default value, so a form reset keeps it.
			input.defaultValue = zone;
		}
		// Reloading now would consume a showing flash; the cookie applies on the next load.
		if (stale && !page.data.flash) void invalidateAll();
	}

	afterNavigate(fillZone);
	// A form opened in place is no navigation: its zone field is filled when it opens.
	$effect(() => {
		if (page.state.entryForm?.href) void tick().then(fillZone);
	});

	/** Any link marked `data-entry-form` opens the form over the screen (before the router sees it). */
	$effect(() => {
		const onclick = (e: MouseEvent) => {
			const link =
				e.target instanceof Element ? e.target.closest('a[data-entry-form][href]') : null;
			const href = link?.getAttribute('href');
			if (href) void openInPlace(e, href);
		};
		document.addEventListener('click', onclick, true);
		return () => document.removeEventListener('click', onclick, true);
	});

	/** The Stop of the timer the bar shows in full, never one in the "+N" list. */
	function shownStop(): HTMLButtonElement | null {
		for (const bar of document.querySelectorAll<HTMLElement>('section[aria-label="Timer"]')) {
			if (!bar.checkVisibility()) continue;
			return bar.querySelector<HTMLButtonElement>('[data-shown-stop]');
		}
		return null;
	}

	/** `n` opens a new entry, `s` stops the shown timer: outside fields and dialogs, unmodified. */
	function onkeydown(e: KeyboardEvent) {
		if ((e.key !== 'n' && e.key !== 's') || !screenKey(e)) return;
		if (e.key === 'n') {
			e.preventDefault();
			void openForm(newEntry);
			return;
		}
		const stop = shownStop();
		if (!stop?.form) return;
		e.preventDefault();
		stop.form.requestSubmit(stop);
	}
</script>

<svelte:window {onkeydown} />

<div
	class="group/shell min-h-dvh lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)]"
	style:--bars-height={barsHeight ? `${barsHeight}px` : undefined}
>
	<Sidebar username={data.user.username} isAdmin={data.user.isAdmin} {current} />

	<div class="flex min-w-0 flex-col">
		<!-- The screen's title, its one h1: the phone's top bar, the PC's header. -->
		<!-- Raised over the bottom bar and the "+" while the start list's sheet is open. -->
		<div
			class="sticky top-0 z-20 has-[[data-start-list][open]]:z-40"
			bind:offsetHeight={barsHeight}
		>
			<header
				class="h-14 bg-sidebar text-sidebar-accent-foreground lg:h-15 lg:border-b lg:border-border lg:bg-card lg:text-foreground"
			>
				<!-- The same measure as main, so the timer bar ends where the content ends. -->
				<div class="flex h-full w-full max-w-6xl items-center gap-4 px-4 lg:px-6">
					<h1 class="min-w-0 truncate text-xl font-semibold tracking-[-0.01em]">
						{title}
					</h1>
					<!-- The timer bar on the PC; display:none on the phone, so it is out of the a11y tree. -->
					<div class="ml-auto hidden min-w-0 flex-1 items-center justify-end gap-3 lg:flex">
						<TimerBar
							timers={data.timers}
							templates={data.templates}
							now={data.now}
							{back}
							variant="header"
						/>
					</div>
					<Button
						href={newEntry}
						data-entry-form
						title="New entry (n)"
						class="hidden shrink-0 lg:inline-flex">+ New entry</Button
					>
				</div>
			</header>
			<!-- The timer strip on the phone, under the top bar. -->
			<div class="lg:hidden">
				<TimerBar
					timers={data.timers}
					templates={data.templates}
					now={data.now}
					{back}
					variant="strip"
					onsheet={(open) => (sheetOpen = open)}
				/>
			</div>
		</div>

		<main
			inert={sheetOpen}
			class="flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 pt-6 pb-[calc(9.75rem+env(safe-area-inset-bottom))] lg:px-6 lg:py-6"
		>
			<!-- The undo strip for screens without their own (a bar stop's Undo or refusal). -->
			<UndoStrip flash={data.flash} {back} />
			{@render children()}
		</main>
	</div>

	<div class="contents" inert={sheetOpen}>
		<BottomBar isAdmin={data.user.isAdmin} {current} />
	</div>

	<!-- The phone's "+", above the bottom bar; main's foot leaves it room. It gives way to the
		Calendar's create bar, whose New entry is then the one primary, and to Entries' Select. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -- newEntry resolves it -->
	<a
		href={newEntry}
		data-entry-form
		aria-label="New entry"
		inert={sheetOpen}
		class="fixed right-4 bottom-[calc(5.0625rem+env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 ease-out outline-none group-has-[[data-create-bar]]/shell:hidden group-has-[[data-selecting]]/shell:hidden hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
	>
		<Plus class="size-6" aria-hidden="true" />
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</div>

<EntryOverlay />
