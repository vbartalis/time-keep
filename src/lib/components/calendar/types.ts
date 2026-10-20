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
	now: number;
	flash: Flash | null;
	back: string;
};
