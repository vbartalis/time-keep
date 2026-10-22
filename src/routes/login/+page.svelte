<script lang="ts">
	import { enhance } from '$app/forms';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import CardPage from '#lib/components/shell/CardPage.svelte';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let shown = $state(false);
	let password = $state<HTMLInputElement | null>(null);

	// A refused sign-in leaves the focus on the password (call 17).
	$effect(() => {
		if (form?.error) password?.focus();
	});
</script>

<svelte:head><title>Sign in</title></svelte:head>

<CardPage title="Sign in">
	<form method="POST" use:enhance class="flex flex-col gap-4">
		{#if form?.error}
			<Alert variant="destructive"><AlertDescription>{form.error}</AlertDescription></Alert>
		{:else if data.restored}
			<Alert
				><AlertDescription>Restored. Sign in with the backup's passwords.</AlertDescription></Alert
			>
		{/if}
		<div class="flex flex-col gap-2">
			<Label for="username">Username</Label>
			<Input
				id="username"
				name="username"
				value={form?.username ?? ''}
				autocomplete="username"
				autocapitalize="none"
				required
			/>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="password">Password</Label>
			<div class="relative">
				<Input
					bind:ref={password}
					id="password"
					name="password"
					type={shown ? 'text' : 'password'}
					autocomplete="current-password"
					class="pr-12 lg:pr-10"
					required
				/>
				<!-- Script-only; the mousedown keeps the focus in the field. -->
				<Button
					type="button"
					variant="ghost"
					size="icon"
					data-js
					aria-label={shown ? 'Hide password' : 'Show password'}
					aria-pressed={shown}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => (shown = !shown)}
					class="absolute top-0 right-0 text-muted-foreground"
				>
					{#if shown}<EyeOff aria-hidden="true" />{:else}<Eye aria-hidden="true" />{/if}
				</Button>
			</div>
		</div>
		<Button type="submit" class="w-full">Sign in</Button>
	</form>
</CardPage>
