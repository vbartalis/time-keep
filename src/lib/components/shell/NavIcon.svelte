<script lang="ts">
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Clock from '@lucide/svelte/icons/clock';
	import DatabaseBackup from '@lucide/svelte/icons/database-backup';
	import History from '@lucide/svelte/icons/history';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import List from '@lucide/svelte/icons/list';
	import Settings from '@lucide/svelte/icons/settings';
	import Sheet from '@lucide/svelte/icons/sheet';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Users from '@lucide/svelte/icons/users';
	import type { NavItem } from '#lib/shell.js';

	let { icon, class: className }: { icon: NavItem['icon']; class?: string } = $props();

	const ICONS = {
		today: Clock,
		entries: List,
		'copy-out': Sheet,
		reports: ChartColumn,
		templates: LayoutTemplate,
		setup: Settings,
		history: History,
		account: UserRound,
		users: Users,
		backup: DatabaseBackup
	} satisfies Record<NavItem['icon'], unknown>;

	const Icon = $derived(ICONS[icon]);
</script>

<Icon class={className} aria-hidden="true" />
