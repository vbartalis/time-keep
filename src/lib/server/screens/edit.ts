/**
 * A picker's options: the active rows, plus the entry's current one when it is
 * archived (found in `all`), so an edit never blanks it.
 */
export function withCurrent<T extends { id: string; name: string }>(
	active: T[],
	all: T[],
	currentId: string | null
): (T & { archived: boolean })[] {
	const options = active.map((row) => ({ ...row, archived: false }));
	if (currentId === null || active.some((row) => row.id === currentId)) return options;
	const current = all.find((row) => row.id === currentId);
	return current ? [...options, { ...current, archived: true }] : options;
}

/**
 * What a refused form puts back: the named fields as posted, and the posted version.
 * Without JavaScript the page reloads after a refusal; echoing the version keeps the
 * form from taking the entry's newer one, so it keeps refusing until the user reloads.
 */
export function postedValues(form: FormData, names: readonly string[]): Record<string, string> {
	const text = (name: string) => {
		const value = form.get(name);
		return typeof value === 'string' ? value : '';
	};
	return Object.fromEntries(['version', ...names].map((name) => [name, text(name)]));
}
