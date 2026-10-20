/** The number of project colours in the palette (`bg-project-1` .. `bg-project-8`). */
export const PROJECT_COLOURS = 8;

/**
 * A project's colour: its 1-based palette index by position in creation order
 * (ties by id), wrapping after the palette.
 */
export function colourOf(projects: { id: string; createdAt: number }[]): Map<string, number> {
	const ordered = [...projects].sort(
		(a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
	);
	return new Map(ordered.map((p, i) => [p.id, (i % PROJECT_COLOURS) + 1]));
}
