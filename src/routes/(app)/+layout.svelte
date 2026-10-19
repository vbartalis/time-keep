<script lang="ts">
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Clock from '@lucide/svelte/icons/clock';
	import History from '@lucide/svelte/icons/history';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import List from '@lucide/svelte/icons/list';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Settings from '@lucide/svelte/icons/settings';
	import Sheet from '@lucide/svelte/icons/sheet';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Users from '@lucide/svelte/icons/users';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const today = { route: '/(app)', href: resolve('/(app)'), label: 'Today', icon: Clock };
	const entries = {
		route: '/(app)/entries',
		href: resolve('/(app)/entries'),
		label: 'Entries',
		icon: List
	};
	const copyOut = {
		route: '/(app)/copy-out',
		href: resolve('/(app)/copy-out'),
		label: 'Copy-out',
		icon: Sheet
	};
	const reports = {
		route: '/(app)/reports',
		href: resolve('/(app)/reports'),
		label: 'Reports',
		icon: ChartColumn
	};
	const templates = {
		route: '/(app)/templates',
		href: resolve('/(app)/templates'),
		label: 'Templates',
		icon: LayoutTemplate
	};
	const setup = {
		route: '/(app)/setup',
		href: resolve('/(app)/setup'),
		label: 'Setup',
		icon: Settings
	};
	const history = {
		route: '/(app)/history',
		href: resolve('/(app)/history'),
		label: 'History',
		icon: History
	};
	const account = {
		route: '/(app)/account',
		href: resolve('/(app)/account'),
		label: 'Account',
		icon: UserRound
	};
	const users = {
		route: '/(app)/admin/users',
		href: resolve('/(app)/admin/users'),
		label: 'Users',
		icon: Users
	};

	// Entries, Copy-out, Reports, Templates and History are PC screens: the rail lists them, the phone bar does not.
	const rail = $derived([
		today,
		entries,
		copyOut,
		reports,
		templates,
		setup,
		history,
		account,
		...(data.user.isAdmin ? [users] : [])
	]);
	const bar = $derived([today, setup, account, ...(data.user.isAdmin ? [users] : [])]);

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

	// Compared by route id: resolve() gives relative paths while rendering on the server.
	// A screen's own sub-routes keep it current, except Today, whose id prefixes them all.
	// The entry edit screen belongs to Entries when opened from its list, else to Today.
	const fromList = $derived(
		page.route.id === '/(app)/entries/[id]' &&
			!!page.url.searchParams.get('back')?.startsWith('/entries')
	);
	const current = (route: string) => {
		if (page.route.id === '/(app)/entries/[id]') {
			return route === (fromList ? '/(app)/entries' : '/(app)');
		}
		return (
			page.route.id === route || (route !== '/(app)' && !!page.route.id?.startsWith(`${route}/`))
		);
	};
</script>

<div class="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
	<!-- The rack: a top bar on the phone, the left rail on the PC. -->
	<header
		class="sticky top-0 z-20 flex h-14 items-center gap-3 bg-sidebar pr-2 pl-4 text-sidebar-foreground lg:h-dvh lg:flex-col lg:items-stretch lg:gap-8 lg:py-6 lg:pr-0 lg:pl-3"
	>
		<a
			href={resolve('/(app)')}
			class="rounded-sm text-base printed tracking-[0.08em] text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:px-3"
		>
			time-keep
		</a>

		<nav aria-label="Main" class="hidden lg:block">
			<ul class="flex flex-col gap-1">
				{#each rail as link (link.href)}
					<li>
						<a
							href={link.href}
							aria-current={current(link.route) ? 'page' : undefined}
							class="flex h-10 items-center gap-3 rounded-l-md px-3 text-sm font-medium transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset aria-[current=page]:bg-sidebar-primary aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary-foreground"
						>
							<link.icon class="size-4" aria-hidden="true" />
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div
			class="ml-auto flex items-center gap-1 lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch lg:gap-2 lg:pr-3"
		>
			<p class="hidden items-center gap-2 px-3 text-sm lg:flex">
				<UserRound class="size-4 shrink-0" aria-hidden="true" />
				<span class="truncate">{data.user.username}</span>
			</p>
			<form method="POST" action="/logout">
				<button
					type="submit"
					class="inline-flex h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:h-9"
				>
					<LogOut class="size-4" aria-hidden="true" />
					Sign out
				</button>
			</form>
		</div>
	</header>

	<main
		class="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-10 lg:py-8"
	>
		{@render children()}
	</main>

	<!-- The phone's navigation, inside thumb reach. Phase 4's capture action docks above it. -->
	<nav
		aria-label="Main"
		class="fixed inset-x-0 bottom-0 z-20 bg-sidebar px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] text-sidebar-foreground lg:hidden"
	>
		<ul class="mx-auto grid max-w-md auto-cols-fr grid-flow-col gap-1">
			{#each bar as link (link.href)}
				<li>
					<a
						href={link.href}
						aria-current={current(link.route) ? 'page' : undefined}
						class="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-[current=page]:bg-sidebar-primary aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary-foreground"
					>
						<link.icon class="size-5" aria-hidden="true" />
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
