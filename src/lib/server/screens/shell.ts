import type { BarTemplate, BarTimer } from '#lib/components/shell/types.js';
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

/**
 * The templates in the bar's start list, by name: each with its project's colour and
 * customer › project, and whether a tap starts it at once (it has a project and a
 * description) or first asks for a description, or opens the form (no project).
 */
export function shellTemplates(core: Core): BarTemplate[] {
	const projects = rows(core.projects.list({ includeArchived: true }));
	const colours = colourOf(projects);
	const byId = new Map(projects.map((p) => [p.id, p]));
	return rows(core.templates.list()).map((t) => {
		const project = t.projectId === null ? undefined : byId.get(t.projectId);
		return {
			id: t.id,
			name: t.name,
			colour: project ? (colours.get(project.id) ?? null) : null,
			label: project ? `${project.customerName} › ${project.name}` : null,
			hasProject: t.projectId !== null,
			hasDescription: (t.description ?? '').trim() !== ''
		};
	});
}
