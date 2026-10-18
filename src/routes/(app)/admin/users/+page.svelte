<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '#lib/components/ui/table/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
</script>

<svelte:head><title>Users</title></svelte:head>

<a class="underline" href={resolve('/(app)')}>Home</a>
<h1 class="text-xl font-semibold">Users</h1>

{#if form?.error}
	<Alert variant="destructive"><AlertDescription>{form.error}</AlertDescription></Alert>
{:else if form?.message}
	<Alert><AlertDescription>{form.message}</AlertDescription></Alert>
{/if}

<form method="POST" action="?/create" use:enhance class="flex flex-col gap-4">
	<h2 class="font-medium">Create user</h2>
	<div class="flex flex-col gap-2">
		<Label for="create-username">Username</Label>
		<Input id="create-username" name="username" autocomplete="off" autocapitalize="none" required />
	</div>
	<div class="flex flex-col gap-2">
		<Label for="create-password">Password</Label>
		<Input
			id="create-password"
			name="password"
			type="password"
			autocomplete="new-password"
			required
		/>
	</div>
	<div class="flex items-center gap-2">
		<input id="create-admin" name="isAdmin" type="checkbox" />
		<Label for="create-admin">Admin</Label>
	</div>
	<Button type="submit">Create user</Button>
</form>

<div class="overflow-x-auto">
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead>Username</TableHead>
				<TableHead>Created</TableHead>
				<TableHead>Actions</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#each data.users as u (u.id)}
				<TableRow>
					<TableCell>
						<div class="flex flex-wrap items-center gap-2">
							<span>{u.username}</span>
							{#if u.isAdmin}<Badge>Admin</Badge>{/if}
							{#if u.disabled}<Badge variant="destructive">Disabled</Badge>{/if}
						</div>
					</TableCell>
					<TableCell>{day(u.createdAt)}</TableCell>
					<TableCell>
						<div class="flex flex-col gap-2">
							<form method="POST" action="?/setPassword" use:enhance class="flex gap-2">
								<input type="hidden" name="userId" value={u.id} />
								<Input
									name="password"
									type="password"
									aria-label="New password for {u.username}"
									autocomplete="new-password"
									required
								/>
								<Button type="submit" variant="outline">Set password</Button>
							</form>
							{#if u.id !== data.actorId}
								<form method="POST" action={u.disabled ? '?/enable' : '?/disable'} use:enhance>
									<input type="hidden" name="userId" value={u.id} />
									<Button type="submit" variant="outline"
										>{u.disabled ? 'Enable' : 'Disable'}</Button
									>
								</form>
							{/if}
						</div>
					</TableCell>
				</TableRow>
			{/each}
		</TableBody>
	</Table>
</div>
