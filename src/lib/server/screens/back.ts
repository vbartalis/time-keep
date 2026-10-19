/** A return path from a form: the value when it is a path on this site, else Today. */
export function safeBack(value: string | null | undefined): string {
	if (typeof value !== 'string' || !value.startsWith('/')) return '/';
	return value[1] === '/' || value[1] === '\\' || /[\t\r\n]/.test(value) ? '/' : value;
}
