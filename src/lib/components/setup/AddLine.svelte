<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { clearOnDone } from '#lib/components/today/field.js';
	import type { SetupFailure, SetupKind } from '#lib/server/screens/setup.js';

	let {
		kind,
		label,
		customerId,
		failure,
		back,
		query,
		inset = false
	}: {
		kind: SetupKind;
		/** The accessible name of the field, e.g. "New activity". */
		label: string;
		customerId?: string;
		failure: SetupFailure | null;
		back: string;
		query: string;
		inset?: boolean;
	} = $props();

	const mine = $derived(
		failure !== null &&
			failure.action === 'create' &&
			failure.kind === kind &&
			failure.customerId === customerId
	);
	const fieldError = $derived(mine ? failure?.fields.name : undefined);
	const message = $derived(mine && !fieldError ? failure?.error : undefined);

	let form = $state<HTMLFormElement | null>(null);
	$effect(() => {
		if (mine && fieldError) form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	});
</script>

<form
	bind:this={form}
	method="POST"
	action="?/create{query}"
	use:enhance={clearOnDone}
	class={['flex flex-wrap items-center gap-2 py-2', inset ? 'pl-6' : '']}
>
	<input type="hidden" name="kind" value={kind} />
	<input type="hidden" name="back" value={back} />
	{#if customerId}<input type="hidden" name="customerId" value={customerId} />{/if}
	<Input
		name="name"
		value={mine ? (failure?.values.name ?? '') : ''}
		required
		autocomplete="off"
		placeholder={label}
		aria-label={label}
		aria-invalid={fieldError ? 'true' : undefined}
		class="min-w-0 flex-1 basis-40"
	/>
	<Button type="submit" variant="outline">Add</Button>
	{#if fieldError}<p class="basis-full text-sm text-irregular">{fieldError}</p>{/if}
	{#if message}<p role="alert" class="basis-full text-sm text-irregular">{message}</p>{/if}
</form>
