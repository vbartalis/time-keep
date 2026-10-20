import type { PickerOption, PickerProject } from '#lib/components/entry/types.js';

/** One entry as a table row; times are in the entry's own zones (call 26). */
export type TableRow = {
	id: string;
	version: number;
	startAt: number;
	endAt: number | null;
	/** `HH:mm` in the start zone. */
	start: string;
	/** `HH:mm` in the end zone; null while running. */
	end: string | null;
	/** Days between the start's date and the end's date, each in its own zone. */
	plusDays: number;
	running: boolean;
	customer: string;
	project: string;
	/** The 1-based palette index (`bg-project-N`). */
	colour: number;
	activity: string | null;
	location: string | null;
	reference: string | null;
	description: string | null;
	/** Intersects another finished entry, whether or not that one is shown. */
	overlaps: boolean;
};

/** A day's rows, newest start first; an entry counts whole in its start day. */
export type TableDay = {
	date: string;
	/** `Tue 2026-10-20` */
	label: string;
	totalMs: number;
	rows: TableRow[];
};

export type Timesheet = {
	days: TableDay[];
	count: number;
	totalMs: number;
	truncated: boolean;
	/** The core's refusal of the list read ("Use 1–200 characters."); the sheet is then empty. */
	error: string | null;
};

export type FilterOptions = {
	projects: PickerProject[];
	activities: PickerOption[];
	locations: PickerOption[];
};

/** A posted entry and the version it was posted with, as text. */
export type Chosen = { id: string; version: string };

/** A refused Edit (opening the form), Apply or Delete on the selection, returned by `fail(400, …)`. */
export type BulkFailure = {
	action: 'apply' | 'edit' | 'delete';
	error: string;
	/** Core messages for the change form's fields, by the core's field names. */
	fields: Record<string, string>;
	/** An entry changed elsewhere since the list was loaded: the screen offers a reload. */
	conflict: boolean;
	/** The change form as posted. */
	values: Record<string, string>;
	/** The ids that were selected, so the list keeps them ticked. */
	selected: string[];
	/** The versions they were posted with, kept so a stale selection keeps refusing until reloaded. */
	versions: Record<string, string>;
};

/** Edit with no JavaScript: the page opens the bulk form for these entries. */
export type BulkEdit = { action: 'edit'; chosen: Chosen[] };
