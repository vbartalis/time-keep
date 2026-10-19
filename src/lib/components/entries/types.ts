/** What the Entries screen shows; built by its load from the core's rows. */

export type Option = { id: string; name: string };

export type ListRow = {
	id: string;
	version: number;
	/** `YYYY-MM-DD` of the start, in its zone. */
	date: string;
	/** `HH:mm` in the start zone. */
	in: string;
	/** `HH:mm` in the end zone; null while running. */
	out: string | null;
	/** `h:mm`; for a running entry, up to the load. */
	hours: string;
	customer: string;
	project: string;
	activity: string | null;
	location: string | null;
	reference: string | null;
	description: string | null;
	/** Checked on load: the search asked for every row (`all=1`). */
	checked: boolean;
};

/** A posted entry and the version it was posted with, as text. */
export type Chosen = { id: string; version: string };

/** A refused Change selected or Delete selected, returned by `fail(400, …)`. */
export type BulkFailure = {
	action: 'apply' | 'delete' | 'confirmDelete';
	error: string;
	/** Core messages for the change form's fields, by the core's field names. */
	fields: Record<string, string>;
	/** An entry changed elsewhere since the list was loaded: the screen offers a reload. */
	conflict: boolean;
	/** The change form as posted. */
	values: Record<string, string>;
	/** The ids that were selected, so the list keeps them checked. */
	selected: string[];
	/** The versions they were posted with, kept so a stale selection keeps refusing until reloaded. */
	versions: Record<string, string>;
};

/** The first press of Delete selected: the screen asks on the page. */
export type DeleteConfirm = { action: 'delete'; confirm: true; chosen: Chosen[] };
