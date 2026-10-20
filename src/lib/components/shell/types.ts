/** A running timer as the shell's bar shows it. */
export type BarTimer = {
	id: string;
	customerName: string;
	projectName: string;
	activityName: string | null;
	description: string | null;
	startAt: number;
	/** Local start time, in the entry's start zone. */
	start: string;
	/** The start date when it is not today, else null. */
	startDate: string | null;
	/** 1-based palette index of the project. */
	colour: number;
};

/** A template in the bar's start list. */
export type BarTemplate = {
	id: string;
	name: string;
	/** 1-based palette index of its project; null without a project. */
	colour: number | null;
	/** "customer › project"; null without a project. */
	label: string | null;
	/** Without a project, a tap opens the entry form in timer mode. */
	hasProject: boolean;
	/** Without a description, a tap first asks for one. */
	hasDescription: boolean;
};

/**
 * A navigation item's route, typed for `resolve`. No navigation route takes
 * parameters, so one literal stands for them all.
 */
export type NavRoute = '/(app)';
