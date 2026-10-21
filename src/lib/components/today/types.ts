/** What the Today screen shows; built by its load from the core's rows. */

export type ProjectOption = { id: string; name: string };
export type ProjectGroup = { customerId: string; customerName: string; projects: ProjectOption[] };

export type TemplateCard = {
	id: string;
	/** The version shown: a Delete from the Templates screen's menu posts it. */
	version: number;
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
	/** The project's palette index (`bg-project-N`); null when the template has no project. */
	colour: number | null;
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
	/** After a Stop: the stopped entry, which the strip offers to restart. */
	restartId?: string;
};

/** A failed action, returned by `fail(400, …)`. */
export type ActionFailure = {
	action: 'fromTemplate';
	error: string;
	fields: Record<string, string>;
	/** The template of a failed sheet. */
	subject?: string;
	values?: Record<string, string>;
};
