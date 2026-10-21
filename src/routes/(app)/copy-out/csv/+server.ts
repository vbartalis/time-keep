import { toCsv } from '#lib/output.js';
import { localParts, openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { csvName, sheetFor } from '#lib/server/screens/copy-out.js';
import {
	OUTPUT_CHOICE_COOKIE,
	OUTPUT_RANGE_COOKIE,
	readOutput
} from '#lib/server/screens/output.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { RequestHandler } from './$types';

/** A query the screen would refuse, answered with the screen's message. */
const refused = (message: string) =>
	new Response(message, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

/** The Copy-out screen's rows as a CSV file, for the same address; it keeps nothing. */
export const GET: RequestHandler = ({ locals, cookies, url }) => {
	const user = requireUser(locals);
	const now = Date.now();
	const core = openCore(getDb(), user.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const { view, error, columnsError } = readOutput(
		url.searchParams,
		{ range: cookies.get(OUTPUT_RANGE_COOKIE), choice: cookies.get(OUTPUT_CHOICE_COOKIE) },
		localParts(now, zone).date
	);
	if (error !== null) return refused(error);
	if (columnsError !== null) return refused(columnsError);

	const result = sheetFor(core, view, zone);
	if (!result.ok) return refused(result.message);
	return new Response(toCsv(result.sheet.rows, view.choice.columns), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${csvName(view.filter)}"`
		}
	});
};
