<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Account</title></svelte:head>

<a class="underline" href={resolve('/(app)')}>Home</a>
<h1 class="text-xl font-semibold">Account</h1>

<form method="POST" use:enhance class="flex flex-col gap-4">
	{#if form?.error}
		<Alert variant="destructive"><AlertDescription>{form.error}</AlertDescription></Alert>
	{:else if form?.message}
		<Alert><AlertDescription>{form.message}</AlertDescription></Alert>
	{/if}
	<div class="flex flex-col gap-2">
		<Label for="current">Current password</Label>
		<Input id="current" name="current" type="password" autocomplete="current-password" required />
	</div>
	<div class="flex flex-col gap-2">
		<Label for="next">New password</Label>
		<Input id="next" name="next" type="password" autocomplete="new-password" required />
	</div>
	<div class="flex flex-col gap-2">
		<Label for="confirm">Confirm new password</Label>
		<Input id="confirm" name="confirm" type="password" autocomplete="new-password" required />
	</div>
	<Button type="submit">Change password</Button>
</form>
