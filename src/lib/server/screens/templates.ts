import type { Core } from '../core/index';
import { given, groupProjects, rows, wholeNumber } from './actions';
import { withCurrent } from './edit';

/** The fields the template form shows; a core error on any other becomes the general message. */
export const TEMPLATE_FIELDS = [
	'name',
	'customerId',
	'projectId',
	'activityId',
	'locationId',
	'startTime',
	'endTime',
	'durationMinutes',
	'timeZone',
	'reference',
	'description'
] as const;

/**
 * The input of `templates.create` and, with `id` and `expectedVersion` added, of
 * `templates.update`, from the template form. The name goes as posted; every other
 * field is trimmed and a blank one is `null`, which clears it on an update. A project
 * with no customer takes the project's customer, as `templates.fromEntry` stores it;
 * the core still checks the pair. A duration that is not a whole number goes on as
 * typed for the core to refuse.
 */
export function templateInput(
	form: FormData,
	projectCustomer: (projectId: string) => string | undefined
): Record<string, unknown> {
	const field = (name: string) => given(form, name) ?? null;
	const name = form.get('name');
	const projectId = field('projectId');
	const duration = field('durationMinutes');
	let customerId = field('customerId');
	if (projectId !== null && customerId === null) customerId = projectCustomer(projectId) ?? null;
	return {
		name: typeof name === 'string' ? name : '',
		customerId,
		projectId,
		activityId: field('activityId'),
		locationId: field('locationId'),
		startTime: field('startTime'),
		endTime: field('endTime'),
		durationMinutes: duration === null ? null : wholeNumber(duration),
		timeZone: field('timeZone'),
		reference: field('reference'),
		description: field('description')
	};
}

type Option = { id: string; name: string };

/**
 * The form's pickers: active rows, plus the template's current archived ones, marked
 * "(archived)" so an edit never blanks them. Projects come grouped under their customers.
 */
export function templateChoices(
	core: Core,
	current: {
		customerId: string | null;
		projectId: string | null;
		activityId: string | null;
		locationId: string | null;
	} = { customerId: null, projectId: null, activityId: null, locationId: null }
) {
	const all = { includeArchived: true };
	const options = (active: Option[], everything: Option[], id: string | null): Option[] =>
		withCurrent(active, everything, id).map((o) => ({
			id: o.id,
			name: o.archived ? `${o.name} (archived)` : o.name
		}));
	return {
		customers: options(
			rows(core.customers.list()),
			rows(core.customers.list(all)),
			current.customerId
		),
		projects: groupProjects(
			withCurrent(rows(core.projects.list()), rows(core.projects.list(all)), current.projectId).map(
				(p) => ({ ...p, name: p.archived ? `${p.name} (archived)` : p.name })
			)
		),
		activities: options(
			rows(core.activities.list()),
			rows(core.activities.list(all)),
			current.activityId
		),
		locations: options(
			rows(core.locations.list()),
			rows(core.locations.list(all)),
			current.locationId
		)
	};
}

/** The customer of a project, for `templateInput`. */
export const customerOf = (core: Core) => (projectId: string) =>
	rows(core.projects.list({ includeArchived: true })).find((p) => p.id === projectId)?.customerId;
