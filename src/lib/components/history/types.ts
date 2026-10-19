/** What the History screen shows; built by its load from the core's batches. */
import type { BatchState, ChangeLine } from '#lib/server/screens/history.js';

export type BatchRow = {
	id: string;
	/** `HH:mm` of the batch in the request's zone. */
	time: string;
	label: string;
	actor: 'ui' | 'agent' | 'system';
	/** Every change in the batch, shown or not. */
	count: number;
	state: BatchState;
	/** The first 100 changes, in words. */
	changes: ChangeLine[];
	/** How many changes are not shown; 0 when all are. */
	more: number;
	/** Whether its changes can be chosen one by one: only when all are shown. */
	tickable: boolean;
};

/** The batches of one day in the request's zone, under its heading. */
export type HistoryDay = { day: string; batches: BatchRow[] };

/** A refused undo or redo, returned by `fail(400, …)`: the message and the ticks as posted. */
export type HistoryFailure = { error: string; selected: string[] };
