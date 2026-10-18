import type { ZodError } from 'zod';

export type Warning = { code: string; message: string };

export type CoreError = {
	code: 'invalid' | 'not_found' | 'conflict' | 'archived';
	message: string;
	fields?: Record<string, string>;
};

export type Result<T> =
	{ ok: true; value: T; warnings: Warning[] } | { ok: false; error: CoreError };

export function ok<T>(value: T, warnings: Warning[] = []): Result<T> {
	return { ok: true, value, warnings };
}

export function fail(
	code: CoreError['code'],
	message: string,
	fields?: Record<string, string>
): Result<never> {
	return { ok: false, error: fields ? { code, message, fields } : { code, message } };
}

/** Maps a zod error to `invalid`, keyed by each issue's first path segment (first message wins). */
export function fromZod(error: ZodError): Result<never> {
	const fields: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.length > 0 ? String(issue.path[0]) : '_';
		fields[key] ??= issue.message;
	}
	return fail('invalid', 'The input is not valid.', fields);
}
