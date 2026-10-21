import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { formPickers } from '#lib/server/screens/entry-form.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import { templateCards } from '#lib/server/screens/today.js';
import type { PageServerLoad } from './$types';

/**
 * The Templates screen: the templates as Today shapes them (by name, with their colour,
 * mark and version), the pickers their sheet asks with, and the strip, which the screen
 * draws itself (`ownsStrip`).
 */
export const load: PageServerLoad = ({ locals, cookies }) => {
	const core = openCore(getDb(), requireUser(locals).id, 'ui');
	const { projects, activities, locations } = formPickers(core);
	return {
		templates: templateCards(core),
		projects,
		activities,
		locations,
		flash: takeFlash(cookies)
	};
};
