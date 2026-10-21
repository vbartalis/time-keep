/** The History bulk bar's state from the ticked changes (calls 10, 11, 23). */

export type Ticked = { id: string; undone: boolean; batchId: string };

export type BarState = {
	count: number;
	/** `of “<label>”` when the ticks are in one batch, `across <n> batches` in several. */
	scope: string;
	/** Every ticked change stands. */
	canUndo: boolean;
	/** Every ticked change is undone. */
	canRedo: boolean;
	/** Standing and undone changes are ticked together: neither action applies. */
	mixed: boolean;
};

/**
 * What the bar says and offers for `ticked`. The enabled states are a hint from the
 * loaded state; the core decides (it refuses a chosen change that cannot take the action).
 */
export function barState(ticked: Ticked[], labelOf: (batchId: string) => string): BarState {
	const batches = [...new Set(ticked.map((t) => t.batchId))];
	const undone = ticked.filter((t) => t.undone).length;
	const count = ticked.length;
	const scope =
		batches.length === 0
			? ''
			: batches.length === 1
				? `of “${labelOf(batches[0])}”`
				: `across ${batches.length} batches`;
	return {
		count,
		scope,
		canUndo: count > 0 && undone === 0,
		canRedo: count > 0 && undone === count,
		mixed: undone > 0 && undone < count
	};
}
