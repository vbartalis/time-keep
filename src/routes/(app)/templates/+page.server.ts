import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { rows } from '#lib/server/screens/actions.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => {
	const core = openCore(getDb(), requireUser(locals).id, 'ui');
	return {
		templates: rows(core.templates.list()).map((t) => ({
			id: t.id,
			name: t.name,
			customerName: t.customerName,
			projectName: t.projectName,
			activityName: t.activityName,
			locationName: t.locationName,
			startTime: t.startTime,
			endTime: t.endTime,
			durationMinutes: t.durationMinutes,
			runs: t.endTime === null && t.durationMinutes === null
		})),
		flash: takeFlash(cookies)
	};
};
