<script lang="ts">
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import BottomBar from '#lib/components/shell/BottomBar.svelte';
	import Sidebar from '#lib/components/shell/Sidebar.svelte';
	import TimerBar from '#lib/components/shell/TimerBar.svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import { currentItem, screenTitle } from '#lib/shell.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const title = $derived(screenTitle(page.route.id));
	const current = $derived(currentItem(page.route.id, page.url.searchParams.get('back')));
	// Where a stop or an undo returns to: this screen, its query included.
	const back = $derived(page.url.pathname + page.url.search);

	/**
	 * The device's zone: remembered in the `tz` cookie (read by the server when a form
	 * has none) and written into every hidden `timeZone` field (not the template form's own text field). When the cookie was
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
			'input[type="hidden"][name="timeZone"]'
		)) {
			// The default value, so a form reset keeps it.
			input.defaultValue = zone;
		}
		// Reloading now would consume a showing flash; the cookie applies on the next load.
		if (stale && !page.data.flash) void invalidateAll();
	}

	afterNavigate(fillZone);
</script>

<div class="min-h-dvh lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)]">
	<Sidebar username={data.user.username} isAdmin={data.user.isAdmin} {current} />

	<div class="flex min-w-0 flex-col">
		<!-- The screen's title, its one h1: the phone's top bar, the PC's header. -->
		<div class="sticky top-0 z-20">
			<header
				class="h-14 bg-sidebar text-sidebar-accent-foreground lg:h-15 lg:border-b lg:border-border lg:bg-card lg:text-foreground"
			>
				<!-- The same measure as main, so the timer bar ends where the content ends. -->
				<div class="flex h-full w-full max-w-6xl items-center gap-4 px-4 lg:px-6">
					<h1 class="min-w-0 truncate text-xl font-semibold tracking-[-0.01em]">
						{title}
					</h1>
					<!-- The timer bar on the PC; display:none on the phone, so it is out of the a11y tree. -->
					<div class="ml-auto hidden min-w-0 flex-1 justify-end lg:flex">
						<TimerBar timers={data.timers} now={data.now} {back} variant="header" />
					</div>
				</div>
			</header>
			<!-- The timer strip on the phone, under the top bar. -->
			<div class="lg:hidden">
				<TimerBar timers={data.timers} now={data.now} {back} variant="strip" />
			</div>
		</div>

		<main
			class="flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-6 lg:py-6"
		>
			<!-- The undo strip for screens without their own (a bar stop's Undo or refusal). -->
			<UndoStrip flash={data.flash} {back} />
			{@render children()}
		</main>
	</div>

	<BottomBar isAdmin={data.user.isAdmin} {current} />
</div>
