import type { FilterOptions } from '#lib/components/timesheet/types.js';
import type { Scope } from '#lib/filter/filter.js';
import type { View } from '#lib/calendar/dates.js';
import type { ZoneSource } from '#lib/server/screens/zone.js';
import type { Flash } from '#lib/components/today/types.js';

/** One entry on the Calendar, its times `HH:mm` in the screen's zone. */
export type CalendarEntry = {
	id: string;
	version: number;
	projectName: string;
	customerName: string;
	colour: number;
	activityName: string | null;
	locationName: string | null;
	reference: string | null;
	description: string | null;
	startAt: number;
	endAt: number | null;
	/** `YYYY-MM-DD` of the start in the zone. */
	date: string;
	startTime: string;
	endTime: string | null;
	running: boolean;
	overlaps: boolean;
};

export type CalendarData = {
	view: View;
	date: string;
	today: string;
	zone: string;
	zoneSource: ZoneSource;
	days: string[];
	entries: CalendarEntry[];
	/** Milliseconds by start date, for the days in view (exact; `spanText` shows them). */
	totals: Record<string, number>;
	/** Milliseconds in the week, day or month in view. */
	periodTotal: number;
	/** Milliseconds in the week holding `date`. */
	weekTotal: number;
	/** The filter in the address: Customer › project, Activity, Location. */
	scope: Scope;
	/** The scope as a query string, carried by every link to the Calendar. */
	scopeQuery: string;
	/** A filter is on: the totals count only the entries shown. */
	filtered: boolean;
	/** The filter's choices. */
	options: FilterOptions;
	now: number;
	flash: Flash | null;
	back: string;
};
