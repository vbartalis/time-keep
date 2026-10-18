import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	try {
		getDb().$client.prepare('select 1').get();
		return json({ status: 'ok' });
	} catch {
		return json({ status: 'error' }, { status: 503 });
	}
};
