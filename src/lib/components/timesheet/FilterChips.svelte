<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import type { Scope } from '#lib/filter/filter.js';
	import type { FilterOptions } from './types';

	/**
	 * The filters on besides the range, as removable chips, and Clear filters. `href` is
	 * the address of a scope, the rest of the screen's address kept.
	 */
	let {
		scope,
		options,
		href
	}: { scope: Scope; options: FilterOptions; href: (scope: Scope) => string } = $props();

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
	const dot = (colour: number) => DOTS[(colour - 1) % DOTS.length] ?? DOTS[0];
	const marked = (name: string, archived: boolean) => `${name}${archived ? ' (archived)' : ''}`;
	const set = (v: string) => v !== '' && v !== 'any';

	type Chip = { text: string; colour: number | null; without: Scope };

	const chips = $derived.by(() => {
		const out: Chip[] = [];
		const project = options.projects.find((p) => p.id === scope.project);
		if (set(scope.project)) {
			out.push({
				text: project
					? `${project.customerName} › ${marked(project.name, project.archived)}`
					: 'Project not found',
				colour: project?.colour ?? null,
				without: { ...scope, customer: '', project: '' }
			});
		} else if (set(scope.customer)) {
			const any = options.projects.find((p) => p.customerId === scope.customer);
			out.push({
				text: any ? `${any.customerName}, all projects` : 'Customer not found',
				colour: null,
				without: { ...scope, customer: '' }
			});
		}
		const pick = (
			label: string,
			value: string,
			list: { id: string; name: string; archived: boolean }[],
			without: Scope
		) => {
			if (!set(value)) return;
			const row = list.find((r) => r.id === value);
			const name = value === 'none' ? 'None' : row ? marked(row.name, row.archived) : 'not found';
			out.push({ text: `${label}: ${name}`, colour: null, without });
		};
		pick('Activity', scope.activity, options.activities, { ...scope, activity: '' });
		pick('Location', scope.location, options.locations, { ...scope, location: '' });
		return out;
	});

	const link = 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
</script>

{#if chips.length > 0}
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
		<ul aria-label="Filters" class="flex flex-wrap items-center gap-2">
			{#each chips as chip (chip.text)}
				<li
					class="inline-flex h-11 items-center gap-2 rounded-md border border-input bg-card pl-3 text-sm lg:h-9 lg:pl-2.5"
				>
					{#if chip.colour !== null}
						<span class="size-2 shrink-0 rounded-full {dot(chip.colour)}" aria-hidden="true"></span>
					{/if}
					<span>{chip.text}</span>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href() resolves it -->
					<a
						href={href(chip.without)}
						aria-label="Remove {chip.text}"
						data-sveltekit-reset="false"
						class="inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground lg:size-9 {link}"
						><X class="size-3.5" aria-hidden="true" /></a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- href() resolves it -->
		<a
			href={href({ customer: '', project: '', activity: '', location: '' })}
			data-sveltekit-reset="false"
			class="inline-flex min-h-11 items-center text-sm font-medium text-foreground underline decoration-input underline-offset-4 hover:decoration-foreground lg:min-h-9 {link}"
			>Clear filters</a
		>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
{/if}
