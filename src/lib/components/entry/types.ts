/** What the entry form shows; built on the server, safe in the browser. */

/** The form's fields as text, the way the form shows them. */
export type EntryFormValues = {
	/** Null on a new entry. */
	id: string | null;
	/** The entry's version as text; `''` on a new entry. */
	version: string;
	/** `YYYY-MM-DD` of the start, in the start zone. */
	date: string;
	/** `HH:mm` in the start zone, or `''`. */
	start: string;
	/** `HH:mm` in the end zone, or `''`. */
	end: string;
	/** `h:mm`, or `''`. */
	duration: string;
	/** Calendar days from the start's date to the end's ("next day", "+N days"). */
	endDays: number;
	/** The end zone, only when it differs from `timeZone`. */
	endZone: string | null;
	/**
	 * `${date}T${start}` when the form filled both with now (timer mode), else `''`: posted
	 * back, it tells an untouched Start, which means the moment of saving.
	 */
	startNow: string;
	/** The start zone. */
	timeZone: string;
	projectId: string;
	activityId: string;
	locationId: string;
	reference: string;
	description: string;
	/** An existing entry that has no end. */
	running: boolean;
	/** A template's name; `''` for an entry. */
	name: string;
	/** A template's customer (alone, or with its project); `''` for an entry. */
	customerId: string;
};

export type PickerProject = {
	id: string;
	name: string;
	customerId: string;
	customerName: string;
	/** The 1-based palette index (`bg-project-N`). */
	colour: number;
	archived: boolean;
};

export type PickerOption = { id: string; name: string; archived: boolean };

/** A template as the "Fill from" row applies it. */
export type FillTemplate = {
	id: string;
	name: string;
	/** Its project's colour; null without a project. */
	colour: number | null;
	/** `customer › project`; null without a project. */
	label: string | null;
	/** The zone its times are in; null for the device's. */
	timeZone: string | null;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number | null;
	projectId: string | null;
	activityId: string | null;
	locationId: string | null;
	reference: string | null;
	description: string | null;
};

/** A refused save, delete or save-as-template, returned by `fail(400, …)`. */
export type EntryFormFailure = {
	action: 'save' | 'delete' | 'saveAsTemplate';
	error: string;
	/** Messages beside the form's fields, by field name. */
	fields: Record<string, string>;
	/** Changed elsewhere since the form was loaded: the form offers a reload. */
	conflict: boolean;
	/** Deleted elsewhere. */
	gone: boolean;
	/** The form as posted. */
	values?: Record<string, string>;
	/** The posted `back`: a refused page post has no query to read it from. */
	back: string;
};

export type EntryFormData = {
	/** What the form edits: an entry, or a template (times of day, no date). */
	kind: 'entry' | 'template';
	mode: 'new' | 'edit';
	values: EntryFormValues;
	projects: PickerProject[];
	/** A template form's customers (a customer alone may be picked); absent for an entry. */
	customers?: PickerOption[];
	activities: PickerOption[];
	locations: PickerOption[];
	templates: FillTemplate[];
	/** Where Cancel and a save return to. */
	back: string;
	/**
	 * The zone is the entry's own (an edit, a copy) or a template's: the layout's device
	 * zone must not replace it.
	 */
	zoneFixed: boolean;
	failure: EntryFormFailure | null;
};
