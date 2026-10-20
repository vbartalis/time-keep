import { resolve } from '$app/paths';
import type { TableRow } from './types';

/** A row's words for an overlap, in its name, its tooltip and its phone line. */
export const OVERLAP = 'Overlaps another entry';

export const where = (r: TableRow) => `${r.customer} › ${r.project}`;

const plus = (n: number) => (n === 1 ? '+1 day' : `+${n} days`);

/** The entry form for a row, returning to the table at `back`. */
export const editHref = (r: TableRow, back: string) =>
	`${resolve('/(app)/entries/[id]', { id: r.id })}?back=${encodeURIComponent(back)}`;

/** The row's link name: its times, project, description and overlap. */
export function nameOf(r: TableRow): string {
	const times = r.end === null ? `${r.start}, Running` : `${r.start}–${r.end}`;
	return [
		r.plusDays > 0 ? `${times} ${plus(r.plusDays)}` : times,
		where(r),
		r.description,
		r.overlaps ? OVERLAP : null
	]
		.filter(Boolean)
		.join(', ');
}
