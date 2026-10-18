<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Time Keep</title></svelte:head>

<h1 class="text-xl font-semibold">Signed in as {data.user.username}</h1>

<nav class="flex flex-wrap gap-4">
	<a class="underline" href={resolve('/(app)/account')}>Account</a>
	{#if data.user.isAdmin}
		<a class="underline" href={resolve('/(app)/admin/users')}>Users</a>
	{/if}
</nav>

<form method="POST" action="/logout">
	<Button type="submit" variant="outline">Sign out</Button>
</form>
