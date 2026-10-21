import { fail, redirect, type Cookies } from '@sveltejs/kit';
import type {
	BatchRow,
	HistoryDay,
	HistoryFailure,
	HistoryRange
} from '#lib/components/history/types.js';
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
	readChangeIds,
	touchedLine
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

	const cursor = before ?? undefined;
	const r = core.history.list({ before: cursor, limit: PAGE + 1 });
	const p = core.history.page({ before: cursor, limit: PAGE });
	// An unknown (or blank) `before` starts again from the newest.
	if ((!r.ok || !p.ok) && before !== null) redirect(303, '/history');
	const listed: HistoryBatch[] = r.ok ? r.value : [];
	const shown = listed.slice(0, PAGE);
	const place = p.ok ? p.value : { total: 0, position: 1, hasNewer: false, newerBefore: null };
	const range: HistoryRange =
		shown.length === 0
			? { from: 0, to: 0, total: place.total }
			: { from: place.position, to: place.position + shown.length - 1, total: place.total };

	const names = namesFrom(core);
	const days: HistoryDay[] = [];
	for (const b of shown) {
		const row: BatchRow = {
			id: b.id,
			time: formatTime(b.createdAt, zone),
			label: b.label,
			touched: touchedLine(b, names),
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
		else days.push({ day, batches: [row], continues: false });
	}
	const next = listed.at(PAGE);
	const lastDay = days.at(-1);
	if (next && lastDay && dayHeading(next.createdAt, zone) === lastDay.day) lastDay.continues = true;

	return {
		days,
		range,
		newer: place.hasNewer ? historyPath(place.newerBefore) : null,
		older: next ? historyPath(shown[PAGE - 1].id) : null,
		flash: takeFlash(cookies),
		back: historyPath(before),
		// The phone's Select without the script: the page reloaded with its tick boxes.
		select: url.searchParams.get('select') === '1'
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
