import type { PickerOption, PickerProject } from './types';

export type ProjectMatches = {
	customerId: string;
	customerName: string;
	projects: PickerProject[];
}[];

/** Lower case with accents stripped, so `Café` and `cafe` compare equal. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * The projects whose `customer project` text holds every word of `query` (case- and
 * accent-insensitive), grouped under their customer in the order given. An empty query
 * matches every project.
 */
export function matchProjects(query: string, projects: PickerProject[]): ProjectMatches {
	const words = fold(query).split(/\s+/).filter(Boolean);
	const groups: ProjectMatches = [];
	const byCustomer = new Map<string, ProjectMatches[number]>();
	for (const p of projects) {
		const haystack = fold(`${p.customerName} ${p.name}`);
		if (!words.every((w) => haystack.includes(w))) continue;
		let group = byCustomer.get(p.customerId);
		if (!group) {
			group = { customerId: p.customerId, customerName: p.customerName, projects: [] };
			byCustomer.set(p.customerId, group);
			groups.push(group);
		}
		group.projects.push(p);
	}
	return groups;
}

export type ChoiceGroups = {
	customerId: string;
	customerName: string;
	/** The customer as a choice of its own (no project); null when its name does not match. */
	customer: PickerOption | null;
	projects: PickerProject[];
}[];

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * The template form's picker: `matchProjects`, plus each of `customers` as a choice of its
 * own when every word of `query` is in its name (one without projects too), in name order
 * (with no customers, the order given).
 */
export function matchChoices(
	query: string,
	projects: PickerProject[],
	customers: PickerOption[]
): ChoiceGroups {
	const words = fold(query).split(/\s+/).filter(Boolean);
	const named = (name: string) => words.every((w) => fold(name).includes(w));
	const byId = new Map(customers.map((c) => [c.id, c]));
	const groups: ChoiceGroups = matchProjects(query, projects).map((g) => {
		const c = byId.get(g.customerId);
		return { ...g, customer: c && named(c.name) ? c : null };
	});
	// No customers offered: the projects' own order, as `matchProjects` gives it.
	if (customers.length === 0) return groups;
	const listed = new Set(groups.map((g) => g.customerId));
	for (const c of customers) {
		if (listed.has(c.id) || !named(c.name)) continue;
		groups.push({ customerId: c.id, customerName: c.name, customer: c, projects: [] });
	}
	return groups.sort(
		(a, b) =>
			collator.compare(a.customerName, b.customerName) || a.customerId.localeCompare(b.customerId)
	);
}
