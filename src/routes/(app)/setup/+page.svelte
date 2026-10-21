<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { onMount, tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import CreateDialog from '#lib/components/setup/CreateDialog.svelte';
	import SetupList from '#lib/components/setup/SetupList.svelte';
	import SetupMenu from '#lib/components/setup/SetupMenu.svelte';
	import ShowFilter from '#lib/components/setup/ShowFilter.svelte';
	import { menuButtonOf, setupHref } from '#lib/components/setup/act.js';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import type { SetupFailure, SetupKind, SetupRow } from '#lib/server/screens/setup.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let enhanced = $state(false);
	onMount(() => (enhanced = true));
	/** Below `lg` with the script, a row's ⋯ opens the row sheet; else its popover. */
	const wide = new MediaQuery('(min-width: 1024px)', true);
	const sheetMenus = $derived(enhanced && !wide.current);

	/** The action's refusal, until the rename or dialog it belongs to is left. */
	let failure = $derived(form && 'kind' in form ? (form as SetupFailure) : null);
	/** The filter: the address's, or (a refusal without the script) the one posted under. */
	const show = $derived(failure?.show ?? data.show);

	/** The one row in rename: `?rename=<id>`, a refused rename, or one picked from a menu. */
	let renaming = $derived(
		failure?.action === 'rename' && failure.id ? failure.id : (data.rename ?? null)
	);
	/** The create dialog: `?new=<kind>`, a refused create, or one opened from a button or menu. */
	let creating = $derived<{ kind: SetupKind; customerId: string | null } | null>(
		failure?.action === 'create'
			? { kind: failure.kind, customerId: failure.customerId ?? null }
			: data.creating
	);

	/** Leaves `?rename=` or `?new=` in place of the history entry, the screen as it is. */
	async function clearAddress() {
		if (!data.rename && !data.creating) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- setupHref resolves it
		await goto(setupHref(data.show), { replace: true, reset: false });
	}

	/** After the menu (or the row sheet) has closed onto ⋯, the row turns into its field. */
	async function startRename(id: string) {
		await tick();
		failure = null;
		renaming = id;
	}

	async function cancelRename(id: string) {
		failure = null;
		renaming = null;
		await tick();
		menuButtonOf(id)?.focus();
		await clearAddress();
	}

	async function openCreate(kind: SetupKind, customerId: string | null = null) {
		await tick();
		failure = null;
		creating = { kind, customerId };
	}

	function closeCreate() {
		failure = null;
		creating = null;
		void clearAddress();
	}

	/** The phone's row sheet: the row whose ⋯ was tapped, kept while it closes. */
	let menu = $state<{ row: SetupRow; kindLine: string } | null>(null);
	let menuOpen = $state(false);
	const MENU_TITLE = 'setup-row-sheet-title';

	// `back` is posted as the return path, so a literal: `resolve()` may be relative while rendering.
	/** A refused action shows its own message; the strip would be an older success. */
	const strip = $derived(failure ? null : data.flash);

	const sections = $derived([
		{
			kind: 'customer' as const,
			id: 'customers',
			title: 'Customers and projects',
			add: 'New customer',
			rows: data.customers,
			empty: show === 'archived' ? 'No archived customers.' : 'No customers yet.'
		},
		{
			kind: 'activity' as const,
			id: 'activities',
			title: 'Activities',
			add: 'New activity',
			rows: data.activities,
			empty: show === 'archived' ? 'No archived activities.' : 'No activities yet.'
		},
		{
			kind: 'location' as const,
			id: 'locations',
			title: 'Locations',
			add: 'New location',
			rows: data.locations,
			empty: show === 'archived' ? 'No archived locations.' : 'No locations yet.'
		}
	]);
</script>

<svelte:head><title>Setup · Time Keep</title></svelte:head>

<div class="flex flex-col gap-6">
	<ShowFilter {show} />

	<UndoStrip flash={strip} back={show === 'active' ? '/setup' : `/setup?show=${show}`} />

	<div class="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-x-6">
		{#each [sections.slice(0, 1), sections.slice(1)] as column, i (i)}
			<div class="flex flex-col gap-8">
				{#each column as section (section.kind)}
					<section aria-labelledby="{section.id}-heading" class="flex flex-col gap-3">
						<!-- The head's rule under both on the PC; on the phone the button under it, at the left. -->
						<div
							class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:border-b lg:border-foreground lg:pb-1.5"
						>
							<h2
								id="{section.id}-heading"
								class="caps max-lg:border-b max-lg:border-foreground max-lg:pb-1.5"
							>
								{section.title}
							</h2>
							{#if enhanced}
								<Button
									variant="outline"
									aria-haspopup="dialog"
									class="self-start"
									onclick={() => openCreate(section.kind)}
								>
									<Plus class="size-4" aria-hidden="true" />{section.add}
								</Button>
							{:else}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- setupHref resolves it -->
								<Button
									href={setupHref(show, { new: section.kind })}
									variant="outline"
									class="self-start"
								>
									<Plus class="size-4" aria-hidden="true" />{section.add}
								</Button>
							{/if}
						</div>
						{#if !enhanced && creating && (creating.kind === section.kind || (creating.kind === 'project' && section.kind === 'customer'))}
							<CreateDialog
								inline
								{creating}
								customers={data.customerOptions}
								failure={failure?.action === 'create' ? failure : null}
								{show}
								onclose={closeCreate}
								ondone={() => (creating = null)}
							/>
						{/if}
						<SetupList
							rows={section.rows}
							empty={section.empty}
							{show}
							{failure}
							{renaming}
							{sheetMenus}
							onrename={startRename}
							oncancelrename={cancelRename}
							ondonerename={() => (renaming = null)}
							onaddproject={(id) => openCreate('project', id)}
							onmenu={(row, kindLine) => {
								menu = { row, kindLine };
								menuOpen = true;
							}}
						/>
					</section>
				{/each}
			</div>
		{/each}
	</div>
</div>

{#if enhanced}
	<CreateDialog
		{creating}
		customers={data.customerOptions}
		failure={failure?.action === 'create' ? failure : null}
		{show}
		onclose={closeCreate}
		ondone={() => (creating = null)}
	/>
{/if}

<Sheet open={menuOpen} labelledby={MENU_TITLE} onclose={() => (menuOpen = false)}>
	{#if menu}
		{@const chosen = menu}
		<SetupMenu
			row={chosen.row}
			kindLine={chosen.kindLine}
			{show}
			onrename={() => startRename(chosen.row.id)}
			onaddproject={() => openCreate('project', chosen.row.id)}
			sheet={{ titleId: MENU_TITLE, onpick: () => (menuOpen = false) }}
		/>
	{/if}
</Sheet>
