<script lang="ts">
	import type { SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { tick, untrack } from 'svelte';
	import type { PickerOption, PickerProject } from '#lib/components/entry/types.js';
	import { focusUndo } from '#lib/components/timesheet/live.js';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import TemplateSheetForm from './TemplateSheetForm.svelte';
	import type { ActionFailure, TemplateCard } from './types';

	/**
	 * A template's sheet over any screen (`ph-template-sheet`), a centred dialog from `lg`
	 * (`pc-template-sheet`): it posts `/?/fromTemplate` and returns to `back` with the
	 * strip, the focus on its Undo. A refusal stays in the sheet beside the fields; Escape,
	 * the scrim, × and Back close it, keeping nothing. Each opening starts afresh; the
	 * first field takes the focus.
	 */
	let {
		template,
		projects,
		activities,
		locations,
		back,
		open,
		onclose,
		failure
	}: {
		template: TemplateCard;
		projects: PickerProject[];
		activities: PickerOption[];
		locations: PickerOption[];
		back: string;
		open: boolean;
		onclose: () => void;
		/** A refusal the screen rendered (a post without the script); this template's is shown. */
		failure: ActionFailure | null;
	} = $props();

	const TITLE = 'template-sheet-title';

	/** A refusal of a post made from this opening. */
	let refused = $state<ActionFailure | null>(null);
	let opening = $state(0);
	let frame = $state<HTMLDivElement | null>(null);

	$effect.pre(() => {
		if (!open) return;
		untrack(() => {
			opening += 1;
			refused = null;
		});
	});

	const shown = $derived(
		refused ??
			(failure?.action === 'fromTemplate' && failure.subject === template.id ? failure : null)
	);

	// The first field takes the focus once the dialog is up (it would give it to ×).
	$effect(() => {
		if (!open) return;
		void tick().then(() =>
			requestAnimationFrame(() => {
				if (shown && Object.keys(shown.fields).length > 0) return;
				frame
					?.querySelector<HTMLElement>(
						'input:not([type="hidden"]):not([disabled]), select, textarea'
					)
					?.focus();
			})
		);
	});

	const submit: SubmitFunction =
		() =>
		async ({ result }) => {
			if (result.type === 'failure') {
				refused = result.data as ActionFailure;
				return;
			}
			if (result.type === 'redirect') {
				onclose();
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
				await goto(result.location, { refreshAll: true, reset: false });
				await focusUndo();
				return;
			}
			if (result.type === 'error') {
				refused = {
					action: 'fromTemplate',
					subject: template.id,
					error: 'This could not be done. Try again.',
					fields: {}
				};
			}
		};
</script>

<Sheet {open} labelledby={TITLE} {onclose} dialog>
	{#if open}
		{#key opening}
			<div bind:this={frame} class="flex min-h-0 flex-1 flex-col">
				<TemplateSheetForm
					{template}
					{projects}
					{activities}
					{locations}
					{back}
					failure={shown}
					headingId={TITLE}
					oncancel={onclose}
					{submit}
				/>
			</div>
		{/key}
	{/if}
</Sheet>
