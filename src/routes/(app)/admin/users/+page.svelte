<script lang="ts">
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
</script>

<svelte:head><title>Users</title></svelte:head>

<h1 class="text-xl font-semibold tracking-[-0.01em]">Users</h1>

{#if form?.error}
	<Alert variant="destructive"><AlertDescription>{form.error}</AlertDescription></Alert>
{:else if form?.message}
	<Alert><AlertDescription>{form.message}</AlertDescription></Alert>
{/if}

<div class="flex flex-col gap-10">
	<form method="POST" action="?/create" use:enhance class="flex w-full max-w-2xl flex-col">
		<h2 class="border-b border-foreground pb-1.5 text-sm printed">Create user</h2>
		<div
			class="grid gap-2 border-b border-border py-3 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-x-4"
		>
			<Label for="create-username">Username</Label>
			<Input
				id="create-username"
				name="username"
				autocomplete="off"
				autocapitalize="none"
				required
			/>
		</div>
		<div
			class="grid gap-2 border-b border-border py-3 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-x-4"
		>
			<Label for="create-password">Password</Label>
			<Input
				id="create-password"
				name="password"
				type="password"
				autocomplete="new-password"
				required
			/>
		</div>
		<div
			class="flex min-h-14 items-center gap-2.5 border-b border-border py-2 lg:min-h-0 lg:py-3 lg:pl-[13rem]"
		>
			<input
				id="create-admin"
				name="isAdmin"
				type="checkbox"
				class="size-4.5 rounded-sm border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			/>
			<Label for="create-admin">Admin</Label>
		</div>
		<div class="pt-4 lg:pl-[13rem]">
			<Button type="submit" class="w-full sm:w-auto">Create user</Button>
		</div>
	</form>

	<section aria-labelledby="all-users-heading" class="min-w-0">
		<h2 id="all-users-heading" class="border-b border-foreground pb-1.5 text-sm printed">
			All users
		</h2>
		<!-- On the phone each row stacks: name and date, then its actions full width. -->
		<Table class="max-lg:block">
			<TableHeader class="max-lg:hidden">
				<TableRow>
					<TableHead>Username</TableHead>
					<TableHead>Created</TableHead>
					<TableHead>Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody class="max-lg:block">
				{#each data.users as u (u.id)}
					<TableRow
						class="max-lg:grid max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:gap-x-3 max-lg:py-2"
					>
						<TableCell class="max-lg:px-0 max-lg:py-1">
							<div class="flex flex-wrap items-center gap-2">
								<span
									class={u.disabled
										? 'font-semibold text-muted-foreground line-through decoration-1'
										: 'font-semibold'}>{u.username}</span
								>
								{#if u.isAdmin}<Badge>Admin</Badge>{/if}
								{#if u.disabled}<Badge variant="spent">Disabled</Badge>{/if}
							</div>
						</TableCell>
						<TableCell class="punch text-xs max-lg:px-0 max-lg:py-1 max-lg:text-right"
							>{u.createdAt}</TableCell
						>
						<TableCell class="max-lg:col-span-2 max-lg:px-0 max-lg:py-1 max-lg:whitespace-normal">
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
								<form
									method="POST"
									action="?/setPassword"
									use:enhance
									class="flex min-w-0 flex-1 gap-2 lg:flex-none"
								>
									<input type="hidden" name="userId" value={u.id} />
									<Input
										name="password"
										type="password"
										placeholder="New password"
										aria-label="New password for {u.username}"
										autocomplete="new-password"
										required
										class="min-w-0 flex-1 lg:w-48 lg:flex-none"
									/>
									<Button type="submit" variant="outline">Set password</Button>
								</form>
								{#if u.id !== data.actorId}
									<form method="POST" action={u.disabled ? '?/enable' : '?/disable'} use:enhance>
										<Button type="submit" variant="outline" class="w-full sm:w-auto"
											>{u.disabled ? 'Enable' : 'Disable'}</Button
										>
										<input type="hidden" name="userId" value={u.id} />
									</form>
								{/if}
							</div>
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</section>
</div>
