<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';
	import { selectClass } from '#lib/components/today/field.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { SetupFailure, SetupKind, Show } from '#lib/server/screens/setup.js';
	import { act, actionOf, setupHref } from './act';

	/**
	 * "New customer", "New project", "New activity", "New location" (`pc-setup-create`): the
	 * name only, plus a project's customer (a select of the active customers, set to the
	 * one it came from). A 440 px dialog on the PC, a sheet on the phone (`Sheet`), so it
	 * traps focus, closes on Escape, the scrim or Back and returns focus to its opener.
	 * The name is focused; Enter creates. A refusal (an empty or taken name) shows beside
	 * the field and keeps it open, the typed name kept. `inline` is the page without the
	 * script (`?new=<kind>`): the same form as a panel in the screen.
	 */
	let {
		creating,
		customers,
		failure,
		show,
		inline = false,
		onclose,
		ondone
	}: {
		/** What is being created; null while closed. */
		creating: { kind: SetupKind; customerId: string | null } | null;
		customers: { id: string; name: string }[];
		/** The refused create, or null. */
		failure: SetupFailure | null;
		show: Show;
		inline?: boolean;
		onclose: () => void;
		/** A done create, before the lists come back. */
		ondone: () => void;
	} = $props();

	const TITLES: Record<SetupKind, string> = {
		customer: 'New customer',
		project: 'New project',
		activity: 'New activity',
		location: 'New location'
	};
	const TITLE_ID = 'setup-create-title';

	const fieldError = $derived(failure?.fields.name);
	const message = $derived(failure && !fieldError ? failure.error : null);
	const label = 'text-sm font-semibold text-foreground';

	let nameField = $state<HTMLInputElement | null>(null);
	// Opened, or back from a refusal: the name, once the dialog is up.
	$effect(() => {
		const field = nameField;
		void failure;
		if (field) void tick().then(() => field.focus());
	});
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- setupHref resolves every address -->

{#snippet body(c: { kind: SetupKind; customerId: string | null })}
	<form
		method="POST"
		action={actionOf('create', show)}
		use:enhance={act({ before: ondone })}
		class="flex min-h-0 flex-col"
	>
		<input type="hidden" name="kind" value={c.kind} />
		<input type="hidden" name="show" value={show} />
		<div
			class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 lg:px-5"
		>
			<h2 id={TITLE_ID} class="text-lg font-bold">{TITLES[c.kind]}</h2>
			{#if !inline}
				<button
					type="button"
					aria-label="Close"
					class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
					onclick={onclose}
				>
					<X class="size-4" aria-hidden="true" />
				</button>
			{/if}
		</div>
		<div class="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 py-4 lg:px-5">
			{#if c.kind === 'project'}
				<div class="flex flex-col gap-1.5">
					<label for="setup-create-customer" class={label}>Customer</label>
					<select id="setup-create-customer" name="customerId" class={selectClass}>
						{#each customers as customer (customer.id)}
							<option value={customer.id} selected={customer.id === c.customerId}
								>{customer.name}</option
							>
						{/each}
					</select>
				</div>
			{/if}
			<div class="flex flex-col gap-1.5">
				<label for="setup-create-name" class={label}>Name</label>
				<Input
					bind:ref={nameField}
					id="setup-create-name"
					name="name"
					value={failure?.values.name ?? ''}
					required
					autocomplete="off"
					autofocus
					aria-invalid={fieldError ? 'true' : undefined}
					aria-describedby={fieldError || message ? 'setup-create-error' : undefined}
				/>
				{#if fieldError || message}
					<p id="setup-create-error" role="alert" class="text-sm text-irregular">
						{fieldError ?? message}
					</p>
				{/if}
			</div>
		</div>
		<div
			class="grid shrink-0 grid-cols-2 gap-3 border-t border-border px-4 py-3 lg:flex lg:items-center lg:justify-end lg:gap-2 lg:px-5"
		>
			{#if inline}
				<Button href={setupHref(show)} variant="outline">Cancel</Button>
			{:else}
				<Button variant="outline" onclick={onclose}>Cancel</Button>
			{/if}
			<Button type="submit">Create</Button>
		</div>
	</form>
{/snippet}

{#if inline}
	{#if creating}
		<div class="rounded-md border border-border bg-card lg:max-w-[27.5rem]">
			{@render body(creating)}
		</div>
	{/if}
{:else}
	<Sheet open={creating !== null} labelledby={TITLE_ID} {onclose} dialog narrow>
		{#if creating}
			{#key creating}
				{@render body(creating)}
			{/key}
		{/if}
	</Sheet>
{/if}
