import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import { shellTemplates, shellTimers } from '#lib/server/screens/shell.js';
import { ownsStrip } from '#lib/shell.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies, route, url }) => {
	const user = requireUser(locals);
	// Re-run on every navigation, query included, so the bar is current on every screen.
	void url.pathname;
	void url.search;
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	return {
		user: { username: user.username, isAdmin: user.isAdmin },
		timers: shellTimers(core, now),
		templates: shellTemplates(core),
		now,
		// A screen with its own undo strip takes the flash itself; the shell takes it for the rest.
		flash: ownsStrip(route.id) ? null : takeFlash(cookies)
	};
};
