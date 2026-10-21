/** What the History screen shows; built by its load from the core's batches. */
import type { BatchState, ChangeLine } from '#lib/server/screens/history.js';

export type BatchRow = {
	id: string;
	/** `HH:mm` of the batch in the request's zone. */
	time: string;
	label: string;
	/** What it touched, in one line, from all its changes. */
	touched: string;
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

/** The batches of one day in the request's zone, under its heading ("Wed 2026-10-21"). */
export type HistoryDay = {
	day: string;
	batches: BatchRow[];
	/** Whether the day runs on to the older page: only ever the page's last day. */
	continues: boolean;
};

/** The page's place among all the batches: "1–50 of 312"; `0–0` when the page is empty. */
export type HistoryRange = { from: number; to: number; total: number };

/** A refused undo or redo, returned by `fail(400, …)`: the message and the ticks as posted. */
export type HistoryFailure = { error: string; selected: string[] };
