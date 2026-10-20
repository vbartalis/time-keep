<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Sign in</title></svelte:head>

<div class="flex min-h-dvh flex-col">
	<header class="flex h-14 items-center bg-sidebar px-4 text-sidebar-accent-foreground lg:px-6">
		<span class="text-lg font-bold">time-keep</span>
	</header>

	<main class="flex flex-1 flex-col items-center px-4 pt-10 pb-10 sm:justify-center sm:pt-6">
		<form method="POST" use:enhance class="flex w-full max-w-sm flex-col">
			<h1 class="border-b border-foreground pb-2 text-xl font-semibold tracking-[-0.01em]">
				Sign in
			</h1>
			{#if form?.error}
				<Alert variant="destructive" class="mt-3"
					><AlertDescription>{form.error}</AlertDescription></Alert
				>
			{:else if data.restored}
				<Alert class="mt-3"
					><AlertDescription>Restored. Sign in with the backup's passwords.</AlertDescription
					></Alert
				>
			{/if}
			<div class="flex flex-col gap-2 border-b border-border py-3">
				<Label for="username">Username</Label>
				<Input
					id="username"
					name="username"
					autocomplete="username"
					autocapitalize="none"
					required
				/>
			</div>
			<div class="flex flex-col gap-2 border-b border-border py-3">
				<Label for="password">Password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>
			<Button type="submit" class="mt-4">Sign in</Button>
		</form>
	</main>
</div>
