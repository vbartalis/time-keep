export type NavItem = {
	/** The SvelteKit route id, e.g. `/(app)/entries`. */
	route: string;
	label: string;
	/** Where a link goes when it is not the route itself (the bar's Calendar opens the day). */
	href?: string;
	icon:
		| 'today'
		| 'calendar'
		| 'entries'
		| 'copy-out'
		| 'reports'
		| 'templates'
		| 'setup'
		| 'history'
		| 'account'
		| 'users'
		| 'backup';
};

const TODAY: NavItem = { route: '/(app)', label: 'Today', icon: 'today' };
const CALENDAR: NavItem = { route: '/(app)/calendar', label: 'Calendar', icon: 'calendar' };
const ENTRIES: NavItem = { route: '/(app)/entries', label: 'Entries', icon: 'entries' };
const COPY_OUT: NavItem = { route: '/(app)/copy-out', label: 'Copy-out', icon: 'copy-out' };
const REPORTS: NavItem = { route: '/(app)/reports', label: 'Reports', icon: 'reports' };
const TEMPLATES: NavItem = { route: '/(app)/templates', label: 'Templates', icon: 'templates' };
const SETUP: NavItem = { route: '/(app)/setup', label: 'Setup', icon: 'setup' };
const HISTORY: NavItem = { route: '/(app)/history', label: 'History', icon: 'history' };
const ACCOUNT: NavItem = { route: '/(app)/account', label: 'Account', icon: 'account' };
const USERS: NavItem = { route: '/(app)/admin/users', label: 'Users', icon: 'users' };
const BACKUP: NavItem = { route: '/(app)/admin/backup', label: 'Backup', icon: 'backup' };

/** The sidebar's items; Users and Backup only for an admin. */
export function sidebarItems(isAdmin: boolean): NavItem[] {
	return [
		TODAY,
		CALENDAR,
		ENTRIES,
		COPY_OUT,
		REPORTS,
		TEMPLATES,
		SETUP,
		HISTORY,
		ACCOUNT,
		...(isAdmin ? [USERS, BACKUP] : [])
	];
}

/** The phone bottom bar's items. */
export function barItems(): NavItem[] {
	return [TODAY, { ...CALENDAR, href: '/calendar?view=day' }, ENTRIES];
}

/** The phone's More sheet (Sign out is a form, not an item). */
export function moreItems(isAdmin: boolean): NavItem[] {
	return [
		TEMPLATES,
		SETUP,
		COPY_OUT,
		REPORTS,
		HISTORY,
		ACCOUNT,
		...(isAdmin ? [USERS, BACKUP] : [])
	];
}

/** Whether a route is one of More's screens or a sub-screen of one (More's cell is then current). */
export function inMore(routeId: string | null, isAdmin: boolean): boolean {
	if (routeId === null) return false;
	return moreItems(isAdmin).some((i) => routeId === i.route || routeId.startsWith(`${i.route}/`));
}

const TITLES: Record<string, string> = {
	'/(app)': 'Today',
	'/(app)/calendar': 'Calendar',
	'/(app)/entries': 'Entries',
	'/(app)/entries/new': 'New entry',
	'/(app)/entries/[id]': 'Edit entry',
	'/(app)/copy-out': 'Copy-out',
	'/(app)/reports': 'Reports',
	'/(app)/templates': 'Templates',
	'/(app)/templates/new': 'New template',
	'/(app)/templates/[id]': 'Edit template',
	'/(app)/setup': 'Setup',
	'/(app)/history': 'History',
	'/(app)/account': 'Account',
	'/(app)/admin/users': 'Users',
	'/(app)/admin/backup': 'Backup'
};

/** The page title for a route id; `time-keep` for anything else. */
export function screenTitle(routeId: string | null): string {
	return (routeId !== null && TITLES[routeId]) || 'time-keep';
}

/**
 * The route of the nav item to mark current: the route itself or the item whose
 * sub-screen it is. The entry form (new or edit) belongs to Entries when opened from
 * its list (`back` starts with `/entries`), else to Today. Null outside the navigation.
 */
export function currentItem(routeId: string | null, back: string | null): string | null {
	if (routeId === null) return null;
	if (routeId === '/(app)/entries/[id]' || routeId === '/(app)/entries/new')
		return back?.startsWith('/entries') ? ENTRIES.route : TODAY.route;
	// Today's id prefixes every route, so only it matches exactly.
	const item = sidebarItems(true).find(
		(i) => i.route === routeId || (i.route !== TODAY.route && routeId.startsWith(`${i.route}/`))
	);
	return item?.route ?? null;
}

/** Whether the screen draws the timer strip itself. */
export function ownsStrip(routeId: string | null): boolean {
	return (
		routeId === '/(app)' ||
		routeId === '/(app)/calendar' ||
		routeId === '/(app)/entries' ||
		routeId === '/(app)/setup' ||
		routeId === '/(app)/templates' ||
		routeId === '/(app)/history'
	);
}

/** The title of an error page: "Not found" for a 404, else the error's own message ("Admins only"). */
export function errorTitle(status: number, message: string): string {
	return status === 404 ? 'Not found' : message;
}

/** The one sentence an error page gives under its title; admins only for the admin guard's 403. */
export function errorSentence(status: number, message: string): string {
	if (status === 404) return 'There is nothing at this address.';
	if (status === 403 && message === 'Admins only') return 'Only an admin can open this page.';
	if (status === 403) return 'The request was refused.';
	return 'Something went wrong on this page.';
}
