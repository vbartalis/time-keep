<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import FormDialog from '#lib/components/admin/FormDialog.svelte';
	import { selectClass } from '#lib/components/today/field.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { SetupFailure, SetupKind, Show } from '#lib/server/screens/setup.js';
	import { act, actionOf, setupHref } from './act';

	/**
	 * "New customer", "New project", "New activity", "New location" (`pc-setup-create`): the
	 * name only, plus a project's customer (a select of the active customers, set to the
	 * one it came from). A `FormDialog`: 440 px on the PC, a sheet on the phone, so it
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
	const FORM_ID = 'setup-create-form';

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

{#snippet body()}
	{#if creating}
		{#key creating}
			<form
				id={FORM_ID}
				method="POST"
				action={actionOf('create', show)}
				use:enhance={act({ before: ondone })}
				class="contents"
			>
				<input type="hidden" name="kind" value={creating.kind} />
				<input type="hidden" name="show" value={show} />
				{#if creating.kind === 'project'}
					<div class="flex flex-col gap-1.5">
						<label for="setup-create-customer" class={label}>Customer</label>
						<select id="setup-create-customer" name="customerId" class={selectClass}>
							{#each customers as customer (customer.id)}
								<option value={customer.id} selected={customer.id === creating.customerId}
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
			</form>
		{/key}
	{/if}
{/snippet}

{#snippet foot()}
	{#if inline}
		<Button href={setupHref(show)} variant="outline">Cancel</Button>
	{:else}
		<Button variant="outline" onclick={onclose}>Cancel</Button>
	{/if}
	<Button type="submit" form={FORM_ID}>Create</Button>
{/snippet}

<FormDialog
	open={creating !== null}
	title={creating ? TITLES[creating.kind] : ''}
	titleId={TITLE_ID}
	{onclose}
	{inline}
	{body}
	{foot}
/>
