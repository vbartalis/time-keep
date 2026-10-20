/** What the Today screen shows; built by its load from the core's rows. */

export type EntryRow = {
	id: string;
	projectName: string;
	customerName: string;
	description: string | null;
	/** `HH:mm` in the start zone. */
	in: string;
	/** `YYYY-MM-DD` in the start zone when that is not today; else null. */
	startDate: string | null;
	/** `HH:mm` in the end zone; null while running. */
	out: string | null;
	/** `h:mm`; for a running entry, up to the load. */
	hours: string;
};

export type ProjectOption = { id: string; name: string };
export type ProjectGroup = { customerId: string; customerName: string; projects: ProjectOption[] };

export type TemplateCard = {
	id: string;
	name: string;
	customerId: string | null;
	customerName: string | null;
	projectId: string | null;
	projectName: string | null;
	activityName: string | null;
	locationName: string | null;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number | null;
	timeZone: string | null;
	reference: string | null;
	description: string | null;
	/** Whether a tap with nothing changed starts a timer rather than logging. */
	runs: boolean;
};

export type FlashWarning = { code: string; message: string; subject?: string };

export type Flash = {
	label: string;
	batchId: string | null;
	warnings: FlashWarning[];
	undone?: boolean;
	/** A refused undo: shown in red beside the batch's Undo button. */
	error?: string;
};

/** A failed action, returned by `fail(400, …)`. */
export type ActionFailure = {
	action: 'start' | 'fromTemplate';
	error: string;
	fields: Record<string, string>;
	/** The template of a failed sheet. */
	subject?: string;
	values?: Record<string, string>;
};

/** A refused save or delete on the edit screen. */
export type EditFailure = {
	action: 'save' | 'delete' | 'saveAsTemplate';
	error: string;
	fields: Record<string, string>;
	/** The entry changed elsewhere since the form was filled: the screen offers a reload. */
	conflict: boolean;
	/** The entry no longer exists (deleted elsewhere): the screen offers a way back to Today. */
	gone?: boolean;
	/** The search the entry was opened from, kept across a refusal (no-JS reloads lose the query). */
	back?: string;
	values?: Record<string, string>;
};
