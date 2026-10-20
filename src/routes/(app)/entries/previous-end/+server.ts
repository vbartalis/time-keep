import { json } from '@sveltejs/kit';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireUser } from '#lib/server/guards.js';
import { previousEndFor } from '#lib/server/screens/entry-form.js';
import type { RequestHandler } from './$types';

/** The form's "Start at previous end": `{ time: 'HH:mm' | null }` for `date`, `zone`, `before`. */
export const GET: RequestHandler = ({ locals, url }) => {
	const now = Date.now();
	const core = openCore(getDb(), requireUser(locals).id, 'ui', () => now);
	return json({ time: previousEndFor(core, url.searchParams, now) });
};
