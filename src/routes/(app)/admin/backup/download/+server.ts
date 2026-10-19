import { error } from '@sveltejs/kit';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DATABASE_PATH } from '$app/env/private';
import { beforeRestoreInfo, writeBackup } from '#lib/server/backup.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireAdmin } from '#lib/server/guards.js';
import { newId } from '#lib/server/id.js';
import { formatDate, formatTime } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, cookies, url }) => {
	const actor = requireAdmin(locals);
	const now = Date.now();
	const core = openCore(getDb(), actor.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const stamp = (at: number) => {
		return `${formatDate(at, zone)}-${formatTime(at, zone).replace(':', '')}`;
	};
	const dir = dirname(DATABASE_PATH);

	let body: Buffer;
	let name: string;
	if (url.searchParams.get('before-restore') === '1') {
		const file = join(dir, 'time-keep.before-restore.db');
		const info = beforeRestoreInfo(file);
		if (!info) error(404, 'No backup from before a restore.');
		body = readFileSync(file);
		name = `time-keep-before-restore-${stamp(info.at)}.db`;
	} else {
		const temp = join(dir, `backup-${newId()}.db`);
		try {
			writeBackup(getDb(), temp);
			body = readFileSync(temp);
		} finally {
			rmSync(temp, { force: true });
		}
		name = `time-keep-${stamp(now)}.db`;
	}
	return new Response(new Uint8Array(body), {
		headers: {
			'Content-Type': 'application/vnd.sqlite3',
			'Content-Disposition': `attachment; filename="${name}"`,
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
