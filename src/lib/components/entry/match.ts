import type { PickerProject } from './types';

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
