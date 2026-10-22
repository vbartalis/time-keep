/** One line of a block's text, px (12 px type on a 15 px line). */
export const LINE = 15;

/** A block's top padding, px. */
export const PAD = 2;

/** A block's marks, px: the overlap's red top edge and the running block's dashed foot. */
export const marksOf = (overlaps: boolean, live: boolean): number =>
	(overlaps ? 2 : 0) + (live ? 2 : 0);

/** The height that holds `lines` of text, px: the 1 px gap under it, its marks and padding. */
export const heightFor = (lines: number, marks: number): number => 1 + marks + PAD + lines * LINE;

/**
 * Where a block is drawn, in minutes: at least `lines` of text tall (kept inside the day),
 * and never backwards (a fall-back day's wall minutes can be). Lanes use this extent, so
 * a block drawn taller than its time sits beside the next, not over it.
 */
export function drawnExtent(
	from: number,
	to: number,
	minPx: number,
	hour: number
): { from: number; to: number } {
	const least = Math.ceil((minPx * 60) / hour);
	const start = Math.min(from, 1440 - least);
	return { from: start, to: Math.max(to, start + least) };
}

/**
 * The phone day's taller targets: each drawn extent grows to `least` minutes where the
 * time after it is free, stopping at the next block that starts at or after it, so a
 * block never comes to share its column for it. Never shrinks one.
 */
export function growInto<T extends { from: number; to: number }>(extents: T[], least: number): T[] {
	return extents.map((e, i) => {
		const next = extents.reduce(
			(at, o, j) => (j !== i && o.from >= e.from ? Math.min(at, o.from) : at),
			1440
		);
		return { ...e, to: Math.max(e.to, Math.min(e.from + least, next)) };
	});
}

/**
 * The readable floor: the narrowest lane a block is drawn in, px, so the seeded names'
 * first words ("ClientY", "CompY", "time-keep", "Myself", "CompZ") show whole. Measured
 * once in Chromium (2026-10-22), Public Sans semibold 12 px: the widest, "time-keep", is
 * 59 px (ClientY 42, CompZ 41, CompY 40, Myself 40). A lane this narrow holds a block
 * under 5rem, which draws 2 px of padding a side (`@max-[5rem]:px-0.5`), not a wider
 * block's 6 px: 59 + 3 (edge) + 4 (padding) + 2 (the gap between lanes) = 68. The PC
 * week's column at 1440 px (148 px) holds two lanes; a longer real first word ends in
 * an ellipsis rather than widening it.
 */
export const LANE_FLOOR = 68;
