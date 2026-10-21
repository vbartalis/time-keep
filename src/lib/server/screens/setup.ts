import { colourOf } from '#lib/project-colour.js';
import type { Core, Named } from '../core/index';
import { rows } from './actions';

export type SetupKind = 'customer' | 'project' | 'activity' | 'location';
export type Show = 'active' | 'archived' | 'all';

/** The filter from the address; round 1's `archived=1` reads as All. */
export function readShow(params: URLSearchParams): Show {
	const show = params.get('show');
	if (show === 'archived' || show === 'all') return show;
	return params.get('archived') === '1' ? 'all' : 'active';
}

/** `archived` is effective: a project under an archived customer is archived. */
export type SetupRow = {
	id: string;
	name: string;
	version: number;
	archived: boolean;
	kind: SetupKind;
};
export type SetupProject = SetupRow & { colour: number; underArchived: boolean };
export type SetupCustomer = SetupRow & {
	projects: SetupProject[];
	/** An active customer named over its archived projects (Archived): no menu. */
	heading: boolean;
};
export type SetupTree = {
	customers: SetupCustomer[];
	activities: SetupRow[];
	locations: SetupRow[];
};

const row = (r: Named, kind: SetupKind, archived = r.archivedAt !== null): SetupRow => ({
	id: r.id,
	name: r.name,
	version: r.version,
	archived,
	kind
});

/** The Setup lists for the filter, each in the core's order. */
export function setupTree(core: Core, show: Show): SetupTree {
	const all = { includeArchived: true };
	const projects = rows(core.projects.list(all));
	const colours = colourOf(projects);
	const wanted = (archived: boolean) => show === 'all' || (show === 'archived') === archived;
	const plain = (list: Named[], kind: SetupKind) =>
		list.filter((r) => wanted(r.archivedAt !== null)).map((r) => row(r, kind));

	const customers: SetupCustomer[] = [];
	for (const c of rows(core.customers.list(all))) {
		const archived = c.archivedAt !== null;
		const mine = projects
			.filter((p) => p.customerId === c.id)
			.map((p): SetupProject => ({
				...row(p, 'project', archived || p.archivedAt !== null),
				colour: colours.get(p.id) ?? 1,
				underArchived: archived
			}));
		if (show === 'all') customers.push({ ...row(c, 'customer'), projects: mine, heading: false });
		else if (show === 'active') {
			if (!archived) {
				customers.push({
					...row(c, 'customer'),
					projects: mine.filter((p) => !p.archived),
					heading: false
				});
			}
		} else if (archived) {
			customers.push({ ...row(c, 'customer'), projects: mine, heading: false });
		} else {
			const gone = mine.filter((p) => p.archived);
			if (gone.length > 0) customers.push({ ...row(c, 'customer'), projects: gone, heading: true });
		}
	}
	return {
		customers,
		activities: plain(rows(core.activities.list(all)), 'activity'),
		locations: plain(rows(core.locations.list(all)), 'location')
	};
}

export type SetupAction = 'create' | 'rename' | 'archive' | 'unarchive';

/** What a refused Setup form returns, so the page re-renders that form. */
export type SetupFailure = {
	action: SetupAction;
	kind: SetupKind;
	id?: string;
	customerId?: string;
	error: string;
	fields: Record<string, string>;
	/** A stale version, not a duplicate name. */
	conflict: boolean;
	values: { name: string };
	/** The filter the form was posted under. */
	show?: Show;
};
