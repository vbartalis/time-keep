import { onMount } from 'svelte';
import type { ProjectGroup } from './today/types';

/**
 * A customer and a project picker that follow each other once the script runs:
 * choosing a customer lists only its projects (and drops a project of another),
 * choosing a project sets its customer. Without JavaScript both are sent as chosen.
 * Call it while a component initialises; `chosen` is read again whenever it changes.
 */
export function narrowing(
	groups: () => ProjectGroup[],
	chosen: () => { customerId: string; projectId: string }
) {
	let enhanced = $state(false);
	// Started with the values, not in an effect: without JavaScript nothing else sets them.
	let customerId = $state(chosen().customerId);
	let projectId = $state(chosen().projectId);
	$effect.pre(() => {
		const c = chosen();
		customerId = c.customerId;
		projectId = c.projectId;
	});
	onMount(() => (enhanced = true));

	const projects = $derived(
		enhanced && customerId !== '' ? groups().filter((g) => g.customerId === customerId) : groups()
	);
	const groupOf = () => groups().find((g) => g.projects.some((p) => p.id === projectId));

	return {
		get customerId() {
			return customerId;
		},
		set customerId(value: string) {
			customerId = value;
		},
		get projectId() {
			return projectId;
		},
		set projectId(value: string) {
			projectId = value;
		},
		/** The project groups to list. */
		get projects() {
			return projects;
		},
		pickProject() {
			const group = groupOf();
			if (group) customerId = group.customerId;
		},
		pickCustomer() {
			const group = groupOf();
			if (customerId !== '' && group && group.customerId !== customerId) projectId = '';
		}
	};
}
