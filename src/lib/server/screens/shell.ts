import type { BarTimer } from '#lib/components/shell/types.js';
import type { Core } from '../core/index';
import { colourOf } from '../../project-colour';
import { rows } from './actions';
import { earlierDate, formatTime } from './today';

/** The running timers for the bar, newest start first. */
export function shellTimers(core: Core, now: number): BarTimer[] {
	const colours = colourOf(rows(core.projects.list({ includeArchived: true })));
	return rows(core.entries.list({ running: true }))
		.sort((a, b) => b.startAt - a.startAt)
		.map((e) => ({
			id: e.id,
			customerName: e.customerName,
			projectName: e.projectName,
			activityName: e.activityName,
			description: e.description,
			startAt: e.startAt,
			start: formatTime(e.startAt, e.startZone),
			startDate: earlierDate(e.startAt, e.startZone, now),
			colour: colours.get(e.projectId) ?? 1
		}));
}
