import type { Cookies } from '@sveltejs/kit';
import { z } from 'zod';
import type { Flash } from '#lib/components/today/types.js';
import type { Core, Warning } from '../core/index';

const FLASH_COOKIE = 'flash';
/** Caps that keep the cookie far under the browser's 4 KB limit. */
const MAX_WARNINGS = 5;
const MAX_TEXT = 200;

const flashSchema = z.object({
	label: z.string(),
	batchId: z.string().nullable(),
	warnings: z.array(
		z.object({ code: z.string(), message: z.string(), subject: z.string().optional() })
	),
	undone: z.boolean().optional(),
	error: z.string().optional(),
	restartId: z.string().optional()
}) satisfies z.ZodType<Flash>;

export type { Flash };

const cap = (text: string) => text.slice(0, MAX_TEXT);

export function setFlash(cookies: Cookies, flash: Flash): void {
	const capped: Flash = {
		...flash,
		label: cap(flash.label),
		batchId: flash.batchId === null ? null : cap(flash.batchId),
		...(flash.error === undefined ? {} : { error: cap(flash.error) }),
		...(flash.restartId === undefined ? {} : { restartId: cap(flash.restartId) }),
		warnings: flash.warnings.slice(0, MAX_WARNINGS).map((w) => ({
			code: cap(w.code),
			message: cap(w.message),
			...(w.subject === undefined ? {} : { subject: cap(w.subject) })
		}))
	};
	cookies.set(FLASH_COOKIE, JSON.stringify(capped), {
		httpOnly: true,
		path: '/',
		maxAge: 60
	});
}

/** Reads the flash and clears it; null when absent or malformed. */
export function takeFlash(cookies: Cookies): Flash | null {
	const raw = cookies.get(FLASH_COOKIE);
	if (raw === undefined) return null;
	cookies.delete(FLASH_COOKIE, { path: '/' });
	try {
		const parsed = flashSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** The flash for a successful action: the newest batch's label and id, and its warnings. */
export function flashAfter(core: Core, warnings: Warning[]): Flash {
	const r = core.history.list({ limit: 1 });
	const newest = r.ok ? r.value[0] : undefined;
	return {
		label: newest?.label ?? 'Done',
		batchId: newest?.id ?? null,
		warnings: warnings.map(({ code, message, subject }) =>
			subject === undefined ? { code, message } : { code, message, subject }
		)
	};
}
