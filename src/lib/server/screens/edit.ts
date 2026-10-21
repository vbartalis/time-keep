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
