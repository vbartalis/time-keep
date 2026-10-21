import { resolve } from '$app/paths';
import type { TemplateCard } from '#lib/components/today/types.js';

/** The template form for a template, opened over the screen at `back`. */
export const editHref = (t: TemplateCard, back: string) =>
	`${resolve('/(app)/templates/[id]', { id: t.id })}?back=${encodeURIComponent(back)}`;

/** Customer › project, the customer alone, the project alone, or null. */
export const whereOf = (t: TemplateCard): string | null =>
	t.customerName && t.projectName
		? `${t.customerName} › ${t.projectName}`
		: (t.customerName ?? t.projectName);

/** The menu's second item: what using the template does. */
export const useLabel = (t: TemplateCard) => (t.runs ? 'Start timer…' : 'Log…');

// Whole class names, so Tailwind sees them.
const DOTS = [
	'bg-project-1',
	'bg-project-2',
	'bg-project-3',
	'bg-project-4',
	'bg-project-5',
	'bg-project-6',
	'bg-project-7',
	'bg-project-8'
];

/** The project's dot colour class; none without a project. */
export const dotOf = (t: TemplateCard): string =>
	t.colour === null ? '' : (DOTS[(t.colour - 1) % DOTS.length] ?? DOTS[0]);
