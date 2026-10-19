<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { clearOnDone } from '#lib/components/today/field.js';
	import type { SetupFailure } from '#lib/server/screens/setup.js';

	let {
		customerId,
		customerName,
		failure,
		back,
		here,
		query
	}: {
		customerId: string;
		customerName: string;
		failure: SetupFailure | null;
		back: string;
		here: string;
		query: string;
	} = $props();

	const mine = $derived(
		failure !== null &&
			failure.action === 'create' &&
			failure.kind === 'project' &&
			failure.customerId === customerId
	);
	const fieldError = $derived(mine ? failure?.fields.name : undefined);
	const message = $derived(mine && !fieldError ? failure?.error : undefined);

	let panel = $state<HTMLDetailsElement | null>(null);
	$effect(() => {
		if (mine && fieldError) panel?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	});
	const close = (e: Event) => {
		e.preventDefault();
		panel?.removeAttribute('open');
	};
</script>

<!-- Open, it takes its own line under the customer; closed it is one button in the line. -->
<details
	bind:this={panel}
	name="setup"
	open={mine}
	class="group order-last basis-full open:pb-1 sm:order-none sm:basis-auto sm:open:order-last sm:open:basis-full"
	ontoggle={(e) => {
		if (e.currentTarget.open) e.currentTarget.querySelector<HTMLInputElement>('input')?.focus();
	}}
>
	<summary
		class="{buttonVariants({
			variant: 'outline'
		})} cursor-pointer list-none outline-none group-open:hidden [&::-webkit-details-marker]:hidden"
		aria-label="Add project to {customerName}">Add project</summary
	>
	<form
		method="POST"
		action="?/create{query}"
		use:enhance={clearOnDone}
		class="flex flex-wrap items-center gap-2 pl-6"
	>
		<input type="hidden" name="kind" value="project" />
		<input type="hidden" name="back" value={back} />
		<input type="hidden" name="customerId" value={customerId} />
		<Input
			name="name"
			value={mine ? (failure?.values.name ?? '') : ''}
			required
			autocomplete="off"
			placeholder="New project"
			aria-label="New project in {customerName}"
			aria-invalid={fieldError ? 'true' : undefined}
			class="min-w-0 flex-1 basis-40"
		/>
		<Button type="submit">Add</Button>
		<Button href={here} variant="outline" onclick={close}>Cancel</Button>
		{#if fieldError}<p class="basis-full text-sm text-irregular">{fieldError}</p>{/if}
		{#if message}<p role="alert" class="basis-full text-sm text-irregular">{message}</p>{/if}
	</form>
</details>
