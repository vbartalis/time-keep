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

/**
 * A navigation item's route, typed for `resolve`. No navigation route takes
 * parameters, so one literal stands for them all.
 */
export type NavRoute = '/(app)';
