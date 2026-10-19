<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { clearOnDone } from '#lib/components/today/field.js';
	import type { SetupFailure, SetupKind, SetupRow } from '#lib/server/screens/setup.js';

	let {
		kind,
		row,
		failure,
		back,
		here,
		query,
		extra
	}: {
		kind: SetupKind;
		row: SetupRow;
		failure: SetupFailure | null;
		/** Where a successful action returns to: this screen, as posted. */
		back: string;
		/** This screen, for the Reload link. */
		here: string;
		/** Appended to action URLs so a refused form re-renders with archived rows shown. */
		query: string;
		/** More controls for the line (a customer's Add project). */
		extra?: Snippet;
	} = $props();

	const mine = $derived(failure !== null && failure.kind === kind && failure.id === row.id);
	const renaming = $derived(mine && failure?.action === 'rename');
	const fieldError = $derived(renaming ? failure?.fields.name : undefined);
	const message = $derived(
		mine && failure && !failure.conflict && !(renaming && failure.fields.name)
			? failure.error
			: null
	);
	const stale = $derived(mine && failure?.conflict === true);
	const name = $derived(renaming ? (failure?.values.name ?? row.name) : row.name);

	let line = $state<HTMLElement | null>(null);
	let rename = $state<HTMLDetailsElement | null>(null);

	// After a refused rename, take the user to the field the core refused.
	$effect(() => {
		if (renaming && fieldError) line?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	});

	const close = (e: Event) => {
		e.preventDefault();
		rename?.removeAttribute('open');
	};
	const hidden = $derived({ kind, id: row.id, expectedVersion: String(row.version), back });
</script>

{#snippet fields()}
	{#each Object.entries(hidden) as [key, value] (key)}
		<input type="hidden" name={key} {value} />
	{/each}
{/snippet}

<div bind:this={line} class="flex flex-wrap items-start gap-x-2 gap-y-2 py-1.5">
	<details
		bind:this={rename}
		name="setup"
		open={renaming}
		class="group min-w-0 flex-1 basis-48 open:basis-full"
		ontoggle={(e) => {
			if (e.currentTarget.open) e.currentTarget.querySelector<HTMLInputElement>('input')?.focus();
		}}
	>
		<summary
			aria-label="Rename {row.name}"
			class="flex min-h-11 cursor-pointer list-none items-center gap-3 outline-none select-none group-open:hidden focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 [&::-webkit-details-marker]:hidden"
		>
			<span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1"
				><span
					class={[
						'min-w-0 text-pretty break-words',
						kind === 'customer' ? 'font-semibold' : '',
						row.spent || row.archived ? 'text-muted-foreground line-through' : ''
					]}>{row.name}</span
				>
				{#if row.spent || row.archived}<Badge variant="spent">Archived</Badge>{/if}</span
			>
			<span class="{buttonVariants({ variant: 'outline' })} shrink-0">Rename</span>
		</summary>
		<form
			method="POST"
			action="?/rename{query}"
			use:enhance={clearOnDone}
			class="flex flex-wrap items-center gap-2"
		>
			{@render fields()}
			<Input
				name="name"
				value={name}
				required
				autocomplete="off"
				aria-label="Name"
				aria-invalid={fieldError ? 'true' : undefined}
				class="min-w-0 flex-1 basis-40"
			/>
			<Button type="submit">Save</Button>
			<Button href={here} variant="outline" onclick={close}>Cancel</Button>
			{#if fieldError}<p class="basis-full text-sm text-irregular">{fieldError}</p>{/if}
		</form>
	</details>

	{@render extra?.()}

	<form method="POST" action="?/{row.archived ? 'unarchive' : 'archive'}{query}" use:enhance>
		{@render fields()}
		<Button type="submit" variant="outline">{row.archived ? 'Unarchive' : 'Archive'}</Button>
	</form>

	{#if stale}
		<p role="alert" class="flex basis-full flex-wrap items-center gap-x-3 text-sm text-irregular">
			{failure?.error}
			<!-- A full load, so the row shows as it is now. `here` is a resolved path. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={here}
				data-sveltekit-reload
				class="rounded-sm font-medium text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>Reload</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</p>
	{:else if message}
		<p role="alert" class="basis-full text-sm text-irregular">{message}</p>
	{/if}
</div>
