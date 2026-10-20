export type Selection = {
	/** The ticked rows still shown, in display order. */
	readonly ids: string[];
	/** The row last toggled (null after a clear): where the selecting happened. */
	readonly last: string | null;
	has(id: string): boolean;
	/** Ticks or unticks a row; with `shift`, the run from the last toggled row too (call 31). */
	toggle(id: string, shift: boolean): void;
	setMany(ids: string[], on: boolean): void;
	clear(): void;
	/** Whether none, some or all of `ids` are ticked: a day head's box. */
	state(ids: string[]): 'none' | 'some' | 'all';
};

/**
 * The table's ticks over `rows`, the shown rows' ids in display order. A tick whose row
 * is no longer shown drops out. The page clears it when the shown set changes and after
 * a done bulk action (call 19).
 */
export function createSelection(rows: () => string[]): Selection {
	let picked = $state<Record<string, true>>({});
	/** The row last toggled: a shift-click's run starts there. */
	let last: string | null = null;

	// A lookup rebuilt only when the rows change; never written to, so a plain Set.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const shown = $derived(new Set(rows()));
	const has = (id: string) => picked[id] === true && shown.has(id);

	function setMany(ids: string[], on: boolean) {
		const next = { ...picked };
		for (const id of ids) {
			if (on) next[id] = true;
			else delete next[id];
		}
		picked = next;
	}

	return {
		get ids() {
			return rows().filter((id) => picked[id] === true);
		},
		get last() {
			return last;
		},
		has,
		toggle(id, shift) {
			const on = !has(id);
			const order = rows();
			const from = shift && last !== null ? order.indexOf(last) : -1;
			const to = order.indexOf(id);
			if (from === -1 || to === -1) setMany([id], on);
			else setMany(order.slice(Math.min(from, to), Math.max(from, to) + 1), on);
			last = id;
		},
		setMany,
		clear() {
			picked = {};
			last = null;
		},
		state(ids) {
			const n = ids.filter(has).length;
			return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
		}
	};
}
