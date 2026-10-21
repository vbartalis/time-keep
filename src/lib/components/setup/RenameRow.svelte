<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { SetupFailure, SetupRow, Show } from '#lib/server/screens/setup.js';
	import { act, actionOf, menuButtonOf, setupHref } from './act';

	/**
	 * A row renamed in place (`pc-setup-rename`): the name in a field, selected, with
	 * outline Cancel and the primary Save at its right (on the phone under the field).
	 * Enter saves, Escape cancels; either way out the focus goes back to the row's ⋯ (a
	 * done rename: to the strip's Undo). It posts `rename` with the version shown; a
	 * refusal (an empty or taken name) keeps the row in rename with the core's message
	 * beside the field, the typed name kept and the field focused.
	 */
	let {
		row,
		show,
		failure,
		oncancel,
		ondone
	}: {
		row: SetupRow;
		show: Show;
		/** This row's refused rename, or null. */
		failure: SetupFailure | null;
		/** With the script: back to the row and its ⋯. */
		oncancel: () => void;
		/** A done rename, before the lists come back. */
		ondone: () => void;
	} = $props();

	let field = $state<HTMLInputElement | null>(null);

	const fieldError = $derived(failure?.fields.name);
	const message = $derived(failure && !fieldError ? failure.error : null);
	const errorId = $derived(`rename-${row.id}-error`);

	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
		field?.focus();
		if (!failure) field?.select();
	});

	// A new refusal: back to the field it names, the typed name kept.
	$effect(() => {
		if (failure) field?.focus();
	});

	function cancel(e: Event) {
		e.preventDefault();
		oncancel();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		cancel(e);
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- setupHref resolves every address -->

<!-- Escape anywhere in the row cancels. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
	method="POST"
	action={actionOf('rename', show)}
	use:enhance={act({ before: ondone, fallback: () => menuButtonOf(row.id) })}
	{onkeydown}
	class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2 py-1.5 max-lg:pr-14 lg:py-0.5"
>
	<input type="hidden" name="kind" value={row.kind} />
	<input type="hidden" name="id" value={row.id} />
	<input type="hidden" name="expectedVersion" value={row.version} />
	<input type="hidden" name="show" value={show} />
	<Input
		bind:ref={field}
		name="name"
		value={failure ? failure.values.name : row.name}
		required
		autocomplete="off"
		aria-label="Name"
		aria-invalid={fieldError ? 'true' : undefined}
		aria-describedby={fieldError || message ? errorId : undefined}
		class="min-w-0 basis-full lg:flex-1 lg:basis-40"
	/>
	{#if hydrated}
		<Button variant="outline" onclick={cancel}>Cancel</Button>
	{:else}
		<Button href={setupHref(show)} variant="outline">Cancel</Button>
	{/if}
	<Button type="submit">Save</Button>
	{#if fieldError || message}
		<p id={errorId} role="alert" class="basis-full text-sm text-irregular">
			{fieldError ?? message}
			{#if failure?.conflict}
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
</form>
