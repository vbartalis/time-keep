<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Sign in</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-4">
	<Card>
		<CardHeader><CardTitle>Sign in</CardTitle></CardHeader>
		<CardContent>
			<form method="POST" use:enhance class="flex flex-col gap-4">
				{#if form?.error}
					<Alert variant="destructive"><AlertDescription>{form.error}</AlertDescription></Alert>
				{/if}
				<div class="flex flex-col gap-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						name="username"
						autocomplete="username"
						autocapitalize="none"
						required
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
					/>
				</div>
				<Button type="submit">Sign in</Button>
			</form>
		</CardContent>
	</Card>
</main>
