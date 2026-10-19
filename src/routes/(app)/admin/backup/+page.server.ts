import { fail, redirect } from '@sveltejs/kit';
import { dirname, join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import { DATABASE_PATH } from '$app/env/private';
import { beforeRestoreInfo, restoreBackup } from '#lib/server/backup.js';
import { openCore } from '#lib/server/core/index.js';
import { getDb } from '#lib/server/db/index.js';
import { requireAdmin } from '#lib/server/guards.js';
import { newId } from '#lib/server/id.js';
import { formatDate, formatTime } from '#lib/server/screens/today.js';
import { ZONE_COOKIE, zoneFor } from '#lib/server/screens/zone.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => {
	const actor = requireAdmin(locals);
	const now = Date.now();
	const core = openCore(getDb(), actor.id, 'ui', () => now);
	const { zone } = zoneFor(core, { cookie: cookies.get(ZONE_COOKIE) }, now);
	const info = beforeRestoreInfo(join(dirname(DATABASE_PATH), 'time-keep.before-restore.db'));
	return {
		beforeRestore: info ? `${formatDate(info.at, zone)} ${formatTime(info.at, zone)}` : null
	};
};

export const actions: Actions = {
	restore: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const file = data.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose a backup file.' });
		}
		if (data.get('confirm') !== 'on') {
			return fail(400, { error: 'Tick the box to confirm the restore.' });
		}
		const dir = dirname(DATABASE_PATH);
		// Not the before-restore path: the restore deletes that file before copying in.
		const upload = join(dir, `restore-${newId()}.db`);
		let result;
		try {
			try {
				writeFileSync(upload, Buffer.from(await file.arrayBuffer()));
			} catch (error) {
				console.error(error);
				return fail(400, { error: 'The restore failed; nothing was changed.' });
			}
			result = restoreBackup(getDb(), upload, {
				beforeRestoreFile: join(dir, 'time-keep.before-restore.db')
			});
		} finally {
			rmSync(upload, { force: true });
		}
		if (!result.ok) return fail(400, { error: result.message });
		redirect(303, '/login?restored=1');
	}
};
