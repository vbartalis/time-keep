import { fail, redirect, type Cookies } from '@sveltejs/kit';
import type { BatchRow, HistoryDay, HistoryFailure } from '#lib/components/history/types.js';
import { openCore, type HistoryBatch } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { done, text } from '#lib/server/screens/actions.js';
import { safeBack } from '#lib/server/screens/back.js';
import { takeFlash } from '#lib/server/screens/flash.js';
import {
	batchState,
	dayHeading,
	describeChange,
	historyPath,
	namesFrom,
	readChangeIds
} from '#lib/server/screens/history.js';
import { formatTime } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

/** Batches to a page; the screen asks the core for one more to know there are older. */
const PAGE = 50;
/** The most changes shown in one batch; beyond it only the whole batch can be undone. */
const SHOWN = 100;

export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const before = url.searchParams.get('before');

	const r = core.history.list({ before: before ?? undefined, limit: PAGE + 1 });
	// An unknown (or blank) `before` starts again from the newest.
	if (!r.ok && before !== null) redirect(303, '/history');
	const listed: HistoryBatch[] = r.ok ? r.value : [];
	const older = listed.length > PAGE ? listed[PAGE - 1].id : null;

	const names = namesFrom(core);
	const days: HistoryDay[] = [];
	for (const b of listed.slice(0, PAGE)) {
		const row: BatchRow = {
			id: b.id,
			time: formatTime(b.createdAt, zone),
			label: b.label,
			actor: b.actor,
			count: b.changes.length,
			state: batchState(b),
			changes: b.changes.slice(0, SHOWN).map((c) => describeChange(c, names)),
			more: Math.max(0, b.changes.length - SHOWN),
			tickable: b.changes.length <= SHOWN
		};
		const day = dayHeading(b.createdAt, zone);
		const last = days.at(-1);
		if (last?.day === day) last.batches.push(row);
		else days.push({ day, batches: [row] });
	}

	return {
		days,
		older,
		newest: before !== null,
		flash: takeFlash(cookies),
		back: historyPath(before)
	};
};

/**
 * One undo or redo: a posted `batchId` wins and the ticks are ignored; else the
 * ticked changes. On success back to the page posted from, with the strip.
 */
async function run(kind: 'undo' | 'redo', request: Request, locals: App.Locals, cookies: Cookies) {
	const form = await request.formData();
	const now = Date.now();
	const core = openCore(getDb(), requireUser(locals).id, 'ui', () => now);
	const back = safeBack(text(form, 'back'));
	const { ids, error } = readChangeIds(form);
	const batchId = text(form, 'batchId');
	const refuse = (message: string) =>
		fail(400, { error: message, selected: ids } satisfies HistoryFailure);

	if (batchId === '' && error !== null) return refuse(error);
	const input = batchId !== '' ? { batchId } : { changeIds: ids };
	const result = kind === 'undo' ? core.undo(input) : core.redo(input);
	if (result.ok) done(core, cookies, result, back);
	return refuse(result.error.message);
}

export const actions: Actions = {
	undo: ({ request, locals, cookies }) => run('undo', request, locals, cookies),
	redo: ({ request, locals, cookies }) => run('redo', request, locals, cookies)
};
