import { templateTimes } from '#lib/format.js';
import type { TemplateCard } from './types';

/**
 * What a template fills, as its row's and its sheet's muted line: customer › project ·
 * activity · location · reference · times. "Any project" when it names neither.
 */
export function fills(t: TemplateCard): string {
	const where =
		t.customerName && t.projectName
			? `${t.customerName} › ${t.projectName}`
			: (t.customerName ?? t.projectName ?? 'Any project');
	return [where, t.activityName, t.locationName, t.reference, templateTimes(t)]
		.filter(Boolean)
		.join(' · ');
}
