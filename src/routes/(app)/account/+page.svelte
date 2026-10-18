<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	// One ruled line per field: label column and field column on the PC.
	const line =
		'grid gap-2 border-b border-border py-3 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-x-4';
</script>

<svelte:head><title>Account</title></svelte:head>

<h1 class="text-xl font-semibold tracking-[-0.01em]">Account</h1>

<form method="POST" use:enhance class="flex w-full max-w-2xl flex-col">
	<h2 class="border-b border-foreground pb-1.5 text-sm printed">Change password</h2>
	{#if form?.error}
		<Alert variant="destructive" class="mt-3"
			><AlertDescription>{form.error}</AlertDescription></Alert
		>
	{:else if form?.message}
		<Alert class="mt-3"><AlertDescription>{form.message}</AlertDescription></Alert>
	{/if}
	<div class={line}>
		<Label for="current">Current password</Label>
		<Input id="current" name="current" type="password" autocomplete="current-password" required />
	</div>
	<div class={line}>
		<Label for="next">New password</Label>
		<Input id="next" name="next" type="password" autocomplete="new-password" required />
	</div>
	<div class={line}>
		<Label for="confirm">Confirm new password</Label>
		<Input id="confirm" name="confirm" type="password" autocomplete="new-password" required />
	</div>
	<div class="pt-4 lg:pl-[13rem]">
		<Button type="submit" class="w-full sm:w-auto">Change password</Button>
	</div>
</form>
