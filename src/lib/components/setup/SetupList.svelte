<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import type {
		SetupCustomer,
		SetupFailure,
		SetupProject,
		SetupRow,
		Show
	} from '#lib/server/screens/setup.js';
	import { setupHref } from './act';
	import RenameRow from './RenameRow.svelte';
	import SetupMenu from './SetupMenu.svelte';

	/**
	 * One of Setup's lists (`pc-setup`, `ph-setup`): ruled rows by name, a surface panel on
	 * the PC, edge to edge on the phone. A customer is a 15 px semibold line, its projects
	 * indented beneath with their colour dots; an archived row is muted with the
	 * "Archived" chip; an active customer named over its archived projects (Archived) is
	 * muted with no ⋯. Every other row has its ⋯ at the right on the PC and leading it on
	 * the phone, where (with the script) it opens the row sheet. The row being renamed is
	 * its rename field; a refusal of the row's Archive or Unarchive is said under it.
	 */
	let {
		rows,
		empty,
		show,
		failure,
		renaming,
		sheetMenus,
		onrename,
		oncancelrename,
		ondonerename,
		onaddproject,
		onmenu
	}: {
		rows: (SetupRow | SetupCustomer)[];
		/** What the list says with no rows. */
		empty: string;
		show: Show;
		failure: SetupFailure | null;
		/** The row in rename, or null. */
		renaming: string | null;
		/** The phone with the script: ⋯ opens the row sheet. */
		sheetMenus: boolean;
		onrename: (id: string) => void;
		oncancelrename: (id: string) => void;
		ondonerename: () => void;
		onaddproject: (customerId: string) => void;
		onmenu: (row: SetupRow, kindLine: string) => void;
	} = $props();

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
	const dotOf = (p: SetupProject) => DOTS[(p.colour - 1) % DOTS.length] ?? DOTS[0];

	const kindLineOf = (row: SetupRow, customer?: string) =>
		row.kind === 'project' ? `${customer} · project` : row.kind;
	const projectsOf = (row: SetupRow | SetupCustomer): SetupProject[] =>
		'projects' in row ? row.projects : [];
	const headingOf = (row: SetupRow | SetupCustomer) => 'heading' in row && row.heading;
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- setupHref resolves every address -->

{#snippet line(row: SetupRow | SetupProject, customer?: string, heading = false)}
	{@const project = row.kind === 'project' ? (row as SetupProject) : null}
	{@const mine = failure !== null && failure.id === row.id && failure.kind === row.kind}
	<li data-setup-row={row.id} class="border-t border-border first:border-t-0">
		<div class="flex min-h-12 items-center lg:min-h-10 lg:pr-1">
			<div
				class={[
					'flex min-w-0 flex-1 items-center gap-2',
					project ? 'pl-9 lg:pl-10' : 'pl-2 lg:pl-3.5',
					renaming === row.id ? 'max-lg:pr-0' : 'max-lg:pr-14'
				]}
			>
				{#if project}
					<span
						class="size-2 shrink-0 rounded-full {dotOf(project)} {project.archived
							? 'opacity-50'
							: ''}"
						aria-hidden="true"
					></span>
				{/if}
				{#if renaming === row.id}
					<RenameRow
						{row}
						{show}
						failure={mine && failure?.action === 'rename' ? failure : null}
						oncancel={() => oncancelrename(row.id)}
						ondone={ondonerename}
					/>
				{:else}
					<span
						class={[
							'min-w-0 py-2 wrap-break-word',
							row.kind === 'customer' ? 'text-base font-semibold' : 'text-sm',
							row.archived || heading ? 'text-muted-foreground' : 'text-foreground'
						]}>{row.name}</span
					>
					{#if row.archived && !heading}
						<Badge variant="outline" class="text-muted-foreground">Archived</Badge>
					{/if}
				{/if}
			</div>
			<!-- The phone's leading ⋯ column; kept empty on a heading and in rename, for the indent. -->
			<div class="flex w-11 shrink-0 justify-center max-lg:order-first lg:w-auto">
				{#if !heading && renaming !== row.id}
					{#if sheetMenus}
						<button
							type="button"
							data-menu-for={row.id}
							aria-label="Actions for {row.name}"
							aria-haspopup="dialog"
							onclick={() => onmenu(row, kindLineOf(row, customer))}
							class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							<Ellipsis class="size-4" aria-hidden="true" />
						</button>
					{:else}
						<SetupMenu
							{row}
							kindLine={kindLineOf(row, customer)}
							{show}
							onrename={() => onrename(row.id)}
							onaddproject={() => onaddproject(row.id)}
						/>
					{/if}
				{/if}
			</div>
		</div>
		{#if mine && failure && failure.action !== 'rename' && renaming !== row.id}
			<p
				role="alert"
				class="pb-2 text-sm text-irregular max-lg:pr-14 {project
					? 'pl-20 lg:pl-10'
					: 'pl-13 lg:pl-3.5'}"
			>
				{failure.error}
				{#if failure.conflict}
					<!-- A full load, so the row shows as it is now. -->
					<a
						href={setupHref(show)}
						data-sveltekit-reload
						class="ml-2 rounded-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>Reload</a
					>
				{/if}
			</p>
		{/if}
	</li>
{/snippet}

<ul class="-mx-4 flex flex-col border-y border-border lg:mx-0 lg:rounded-md lg:border lg:bg-card">
	{#each rows as row (row.id)}
		{@render line(row, undefined, headingOf(row))}
		{#each projectsOf(row) as project (project.id)}
			{@render line(project, row.name)}
		{/each}
	{:else}
		<li class="px-4 py-3 text-sm text-muted-foreground lg:px-3.5">{empty}</li>
	{/each}
</ul>
