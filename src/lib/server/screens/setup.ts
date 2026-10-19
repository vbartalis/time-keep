import type { Named, ProjectListItem } from '../core/index';

export type SetupRow = {
	id: string;
	name: string;
	version: number;
	archived: boolean;
	/** Shown struck through: archived itself, or (a project) under an archived customer. */
	spent?: boolean;
};
export type CustomerNode = SetupRow & { projects: SetupRow[] };

const row = (r: Named): SetupRow => ({
	id: r.id,
	name: r.name,
	version: r.version,
	archived: r.archivedAt !== null
});

/**
 * Customers with their projects for the Setup screen, in the core's order. Both lists
 * are read with archived rows included. Archived customers, and archived projects of
 * active customers, are hidden unless `showArchived`; an archived customer lists all
 * its projects.
 */
export function setupTree(
	customers: Named[],
	projects: ProjectListItem[],
	showArchived: boolean
): CustomerNode[] {
	return customers
		.filter((c) => showArchived || c.archivedAt === null)
		.map((c) => ({
			...row(c),
			projects: projects
				.filter((p) => p.customerId === c.id && (showArchived || p.archivedAt === null))
				.map((p) => ({ ...row(p), spent: p.archivedAt !== null || c.archivedAt !== null }))
		}));
}

export type SetupKind = 'customer' | 'project' | 'activity' | 'location';
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
};
