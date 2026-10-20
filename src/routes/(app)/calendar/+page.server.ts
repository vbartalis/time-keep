import { redirect } from '@sveltejs/kit';
import { readView } from '#lib/calendar/dates.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { calendarFor, moveInput } from '#lib/server/screens/calendar.js';
import { setFlash, takeFlash } from '#lib/server/screens/flash.js';
import { formatDate } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { CalendarData } from '#lib/components/calendar/types.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies, url }): CalendarData => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone, source } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const today = formatDate(now, zone);
	const { view, date } = readView(url.searchParams, today);
	return {
		...calendarFor(core, { view, date, zone, now }),
		today,
		zoneSource: source,
		flash: takeFlash(cookies),
		// Where a stop or an undo returns to: this screen, its query included.
		back: url.pathname + url.search
	};
};

/** A move's refusal for an entry changed since the calendar drew it. */
const STALE = 'This entry changed elsewhere. The calendar shows it as it is now.';

export const actions: Actions = {
	/**
	 * A block dragged on the PC: one `entries.update` with the version it was drawn with.
	 * Done or refused, back to the calendar, which then shows the entry as it is.
	 */
	move: async ({ request, locals, cookies }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const back = safeBack(text(form, 'back'));
		const now = Date.now();
		const core = openCore(getDb(), user.id, 'ui', () => now);
		const read = moveInput(form);
		function refuse(error: string): never {
			setFlash(cookies, { label: '', batchId: null, warnings: [], error });
			redirect(303, back);
		}
		if (!read.ok) refuse('That move could not be read. Try again.');
		const { input } = read;
		const r = core.entries.update(input);
		if (r.ok) {
			// Nothing changed: no batch was stored, so there is nothing to show or undo.
			if (r.value.version === input.expectedVersion) redirect(303, back);
			done(core, cookies, r, back);
		}
		const current = core.entries.get({ id: input.id });
		if (!current.ok && current.error.code === 'not_found')
			refuse('This entry was deleted elsewhere.');
		if (current.ok && current.value.version !== input.expectedVersion) refuse(STALE);
		refuse(r.error.message);
	}
};
