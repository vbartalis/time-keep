import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import TemplateForm from './TemplateForm.svelte';

const choices = {
	customers: [
		{ id: 'c1', name: 'Acme' },
		{ id: 'c2', name: 'Northwind' }
	],
	projects: [
		{ customerId: 'c1', customerName: 'Acme', projects: [{ id: 'p1', name: 'Website' }] },
		{ customerId: 'c2', customerName: 'Northwind', projects: [{ id: 'p2', name: 'Support' }] }
	],
	activities: [],
	locations: []
};

describe('TemplateForm rendered on the server (no JavaScript)', () => {
	it("selects the template's customer and project", () => {
		const { body } = render(TemplateForm, {
			props: {
				choices,
				initial: { name: 'Standup', customerId: 'c1', projectId: 'p1' },
				version: '2',
				failure: null
			}
		});
		expect(body).toMatch(/<option value="c1"[^>]*selected/);
		expect(body).toMatch(/<option value="p1"[^>]*selected/);
		expect(body).not.toMatch(/<option value=""[^>]*selected[^>]*>Any (customer|project)/);
	});

	it('keeps the posted customer and project after a refusal', () => {
		const { body } = render(TemplateForm, {
			props: {
				choices,
				initial: { customerId: 'c1', projectId: 'p1' },
				failure: {
					action: 'save',
					conflict: false,
					error: 'x',
					fields: { name: 'Required.' },
					values: { customerId: 'c2', projectId: 'p2' }
				}
			}
		});
		expect(body).toMatch(/<option value="c2"[^>]*selected/);
		expect(body).toMatch(/<option value="p2"[^>]*selected/);
	});
});
