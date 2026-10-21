<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Timer from '@lucide/svelte/icons/timer';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import type { TemplateCard } from '#lib/components/today/types.js';
	import { templateTimes } from '#lib/format.js';
	import TemplateMenu from './TemplateMenu.svelte';
	import { dotOf, editHref, whereOf } from './rows';

	/**
	 * The phone's templates (`ph-templates`): ruled rows, edge to edge, by name. A leading
	 * ⋯, then the project's dot and the name (15 px semibold), customer › project (14 px),
	 * and activity · location · times · the mark (12 px muted; TIMER with a timer icon),
	 * each wrapping, never cut, all clear of the "+"'s column. A tap on a row opens the
	 * template form in place. ⋯ opens the row sheet (without the script, the menu's
	 * `<details>`).
	 */
	let {
		templates,
		back,
		enhanced,
		onuse
	}: {
		templates: TemplateCard[];
		back: string;
		enhanced: boolean;
		onuse: (t: TemplateCard) => void;
	} = $props();

	/** The template whose ⋯ was tapped; kept while the sheet closes. */
	let menu = $state<TemplateCard | null>(null);
	let menuOpen = $state(false);
	const MENU_TITLE = 'template-row-sheet-title';

	const details = (t: TemplateCard) =>
		[t.activityName, t.locationName, templateTimes(t)].filter(Boolean).join(' · ');
</script>

<ul data-phone-list class="-mx-4 flex flex-col border-t border-border">
	{#each templates as t (t.id)}
		{@const where = whereOf(t)}
		{@const line = details(t)}
		<li data-template={t.id} class="flex border-b border-border">
			<div class="flex w-11 shrink-0 justify-center pt-1.5">
				{#if enhanced}
					<button
						type="button"
						aria-label="Actions for {t.name}"
						aria-haspopup="dialog"
						onclick={() => {
							menu = t;
							menuOpen = true;
						}}
						class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						<Ellipsis class="size-4" aria-hidden="true" />
					</button>
				{:else}
					<TemplateMenu template={t} {back} surface="phone" />
				{/if}
			</div>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- editHref resolves it -->
			<a
				href={editHref(t, back)}
				data-entry-form
				class="mr-18 flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
			>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<span class="flex items-center gap-2">
					<span class="size-2 shrink-0 rounded-full {dotOf(t)}" aria-hidden="true"></span>
					<span class="min-w-0 text-base leading-tight font-semibold wrap-break-word">{t.name}</span
					>
				</span>
				{#if where}
					<span class="pl-4 text-sm leading-tight wrap-break-word">{where}</span>
				{/if}
				<span class="pl-4 text-xs wrap-break-word text-muted-foreground figures">
					{#if line}{line} ·{/if}
					<span class="inline-flex items-center gap-1 caps font-semibold">
						{#if t.runs}<Timer class="size-3.5" aria-hidden="true" />Timer{:else}Log{/if}
					</span>
				</span>
			</a>
		</li>
	{/each}
</ul>

<Sheet open={menuOpen} labelledby={MENU_TITLE} onclose={() => (menuOpen = false)}>
	{#if menu}
		{@const chosen = menu}
		<TemplateMenu
			template={chosen}
			{back}
			surface="phone"
			onuse={() => onuse(chosen)}
			sheet={{ titleId: MENU_TITLE, onpick: () => (menuOpen = false) }}
		/>
	{/if}
</Sheet>
