<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import ActionMenu from '#lib/components/admin/ActionMenu.svelte';
	import { dialogSubmit, leaveDialog, rowMenuOf } from '#lib/components/admin/dialogs.js';
	import FormDialog from '#lib/components/admin/FormDialog.svelte';
	import PanelSection from '#lib/components/admin/PanelSection.svelte';
	import { userItems } from '#lib/components/admin/items.js';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { PageProps } from './$types';

	/**
	 * Users (`pc-users`, `ph-users`, `-new`, `-set-password`): one section, its outline
	 * "+ New user" opening the New user dialog (a sheet on the phone), and the users by
	 * username, each with a ⋯ of Set password… (its dialog) and Disable or Enable (posted at
	 * once). A refusal stays in its dialog under the field it names, the username and Admin
	 * kept, a password never; done, the dialog closes onto its opener ("+ New user", or the
	 * row's ⋯) and the Messages alert at the section's head says so. Without the script,
	 * `?new=user` and `?password=<id>` show the same forms as panels at the section's head.
	 */
	let { data, form }: PageProps = $props();

	let enhanced = $state(false);
	onMount(() => (enhanced = true));

	const users = resolve('/(app)/admin/users');

	// ---- New user ----

	/** A refused create: the message, its field, and what was typed (no password). */
	const createFailure = $derived(
		form?.dialog === 'user' && form.error
			? {
					error: form.error,
					field: form.field === 'username' || form.field === 'password' ? form.field : null,
					username: form.values?.username ?? '',
					isAdmin: form.values?.isAdmin ?? false
				}
			: null
	);

	/** Opened from "+ New user" (held while a post's answer reloads the page). */
	let opened = $state(false);
	const creating = $derived(opened || data.dialog?.kind === 'user' || createFailure !== null);

	// ---- Set password ----

	/** A refused set: the message, whether it is New password's, and the user's id. */
	const passwordFailure = $derived(
		form?.dialog === 'password' && form.error
			? { error: form.error, field: form.field === 'password', userId: form.userId ?? '' }
			: null
	);

	/** The user picked from their ⋯. */
	let picked = $state<string | null>(null);
	/** Set password's user: picked, `?password=<id>`, or a refused set. */
	const passwordId = $derived(
		picked ??
			(data.dialog?.kind === 'password' ? data.dialog.userId : (passwordFailure?.userId ?? null))
	);
	const target = $derived(data.users.find((u) => u.id === passwordId) ?? null);

	// ---- Messages ----

	/**
	 * A refusal no dialog shows, at the section's head: one that is not a dialog's (an
	 * unknown user on Disable), or a Set password for a user not in the list.
	 */
	const alert = $derived(
		form?.error && (!form.dialog || (form.dialog === 'password' && !target)) ? form.error : null
	);

	let newUserButton = $state<HTMLElement | null>(null);
	let usernameField = $state<HTMLInputElement | null>(null);
	let passwordField = $state<HTMLInputElement | null>(null);
	let newPasswordField = $state<HTMLInputElement | null>(null);

	// Refused: the field it names, so its message (its description) is read.
	$effect(() => {
		if (!enhanced || !createFailure) return;
		const field = createFailure.field === 'password' ? passwordField : usernameField;
		if (field) void tick().then(() => field.focus());
	});
	$effect(() => {
		const field = newPasswordField;
		if (enhanced && passwordFailure && field) void tick().then(() => field.focus());
	});

	/** Leaves the dialog's address and forgets a refusal, so a reopened dialog starts empty. */
	const leave = () =>
		leaveDialog(users, {
			hasAddress: data.dialog !== null,
			hasAnswer: createFailure !== null || passwordFailure !== null
		});

	async function closeNew() {
		opened = false;
		await leave();
		newUserButton?.focus();
	}

	async function openPassword(id: string) {
		await tick();
		picked = id;
	}

	async function closePassword() {
		const id = passwordId;
		picked = null;
		await leave();
		if (id) rowMenuOf(id)?.focus();
	}

	/** Done: the dialog's address is left (a reload at it), and the focus goes to `focus()`. */
	const doneOnto = (focus: () => HTMLElement | null | undefined) => async () => {
		if (data.dialog) await goto(users, { replace: true, reset: false });
		await tick();
		focus()?.focus();
	};

	const createSubmit = dialogSubmit({
		close: () => (opened = false),
		done: doneOnto(() => newUserButton)
	});
	const passwordSubmit: SubmitFunction = (input) => {
		const id = passwordId;
		return dialogSubmit({
			close: () => (picked = null),
			done: doneOnto(() => (id ? rowMenuOf(id) : null))
		})(input);
	};

	const COLS = 'lg:grid-cols-[minmax(0,1fr)_8.5rem_10rem_2.25rem]';
	const label = 'text-sm font-semibold text-foreground';
	const hint = 'text-[0.8125rem] leading-snug text-muted-foreground';
	const error = 'text-sm text-pretty text-irregular';
</script>

<svelte:head><title>Users · Time Keep</title></svelte:head>

<!-- eslint-disable svelte/no-navigation-without-resolve -- `users` is resolved; `?new=user` is its query -->

{#snippet newUser(inline: boolean)}
	{@const failure = createFailure}
	{#snippet body()}
		<!-- Keyed by the refusal, so a password typed before it comes back empty. -->
		{#key failure}
			<form
				id="new-user-form"
				method="POST"
				action="?/create"
				use:enhance={createSubmit}
				class="contents"
			>
				{#if failure && !failure.field}
					<p class={error}>{failure.error}</p>
				{/if}
				<div class="flex flex-col gap-1.5">
					<label for="new-username" class={label}>Username</label>
					<Input
						bind:ref={usernameField}
						id="new-username"
						name="username"
						value={failure?.username ?? ''}
						required
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						aria-invalid={failure?.field === 'username' ? 'true' : undefined}
						aria-describedby={failure?.field === 'username'
							? 'new-username-error new-username-hint'
							: 'new-username-hint'}
					/>
					{#if failure?.field === 'username'}
						<p id="new-username-error" class={error}>{failure.error}</p>
					{/if}
					<p id="new-username-hint" class={hint}>
						3 to 32 characters: a–z, 0–9, dot, underscore, hyphen.
					</p>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="new-password" class={label}>Password</label>
					<Input
						bind:ref={passwordField}
						id="new-password"
						name="password"
						type="password"
						required
						autocomplete="new-password"
						aria-invalid={failure?.field === 'password' ? 'true' : undefined}
						aria-describedby={failure?.field === 'password'
							? 'new-password-error new-password-hint'
							: 'new-password-hint'}
					/>
					{#if failure?.field === 'password'}
						<p id="new-password-error" class={error}>{failure.error}</p>
					{/if}
					<p id="new-password-hint" class={hint}>10 to 256 characters.</p>
				</div>
				<div class="flex min-h-11 items-center gap-2.5 lg:min-h-9">
					<input
						id="new-admin"
						name="isAdmin"
						type="checkbox"
						checked={failure?.isAdmin ?? false}
						class="size-4.5 rounded-sm accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					/>
					<label for="new-admin" class="text-sm text-foreground">Admin</label>
				</div>
			</form>
		{/key}
	{/snippet}
	{#snippet foot()}
		{#if inline}
			<Button href={users} variant="outline">Cancel</Button>
		{:else}
			<Button variant="outline" onclick={closeNew}>Cancel</Button>
		{/if}
		<Button type="submit" form="new-user-form">Create user</Button>
	{/snippet}
	<FormDialog
		open={creating}
		title="New user"
		titleId="new-user-title"
		onclose={closeNew}
		{inline}
		{body}
		{foot}
	/>
{/snippet}

{#snippet setPassword(inline: boolean)}
	{@const user = target}
	{@const failure = user && passwordFailure?.userId === user.id ? passwordFailure : null}
	{@const own = user?.id === data.actorId}
	{#snippet body()}
		{#if user}
			{#key failure}
				<form
					id="set-password-form"
					method="POST"
					action="?/setPassword"
					use:enhance={passwordSubmit}
					class="contents"
				>
					<input type="hidden" name="userId" value={user.id} />
					{#if failure && !failure.field}
						<p class={error}>{failure.error}</p>
					{/if}
					<div class="flex flex-col gap-1.5">
						<label for="set-password" class={label}>New password</label>
						<Input
							bind:ref={newPasswordField}
							id="set-password"
							name="password"
							type="password"
							required
							autocomplete="new-password"
							aria-invalid={failure?.field ? 'true' : undefined}
							aria-describedby={failure?.field
								? 'set-password-error set-password-hint'
								: 'set-password-hint'}
						/>
						{#if failure?.field}
							<p id="set-password-error" class={error}>{failure.error}</p>
						{/if}
						<p id="set-password-hint" class={hint}>
							{own
								? '10 to 256 characters. Signs you out everywhere else; your agent tokens keep working.'
								: `10 to 256 characters. Signs ${user.username} out everywhere; their agent tokens keep working.`}
						</p>
					</div>
				</form>
			{/key}
		{/if}
	{/snippet}
	{#snippet foot()}
		{#if inline}
			<Button href={users} variant="outline">Cancel</Button>
		{:else}
			<Button variant="outline" onclick={closePassword}>Cancel</Button>
		{/if}
		<Button type="submit" form="set-password-form">Set password</Button>
	{/snippet}
	<FormDialog
		open={user !== null}
		title={user ? `Set password for ${user.username}` : ''}
		titleId="set-password-title"
		onclose={closePassword}
		{inline}
		{body}
		{foot}
	/>
{/snippet}

<div class="flex w-full max-w-3xl flex-col gap-8">
	<PanelSection title="Users" id="users-heading">
		{#snippet action()}
			{#if enhanced}
				<Button
					bind:ref={newUserButton}
					variant="outline"
					aria-haspopup="dialog"
					onclick={() => (opened = true)}
				>
					<Plus class="size-4" aria-hidden="true" />New user
				</Button>
			{:else}
				<Button href="{users}?new=user" variant="outline">
					<Plus class="size-4" aria-hidden="true" />New user
				</Button>
			{/if}
		{/snippet}
		{#snippet notice()}
			{#if form?.message}
				<Alert><AlertDescription>{form.message}</AlertDescription></Alert>
			{:else if alert}
				<Alert variant="destructive"><AlertDescription>{alert}</AlertDescription></Alert>
			{/if}
			{#if !enhanced}
				{@render newUser(true)}
				{@render setPassword(true)}
			{/if}
		{/snippet}

		<!-- The column heads are for the eye; each row's cells read in order, with their names. -->
		<div
			aria-hidden="true"
			class="hidden h-9 items-center gap-x-3 rounded-t-md border-b border-input bg-muted pr-1 pl-3 text-xs caps text-muted-foreground lg:grid {COLS}"
		>
			<span>Username</span>
			<span>Role</span>
			<span>Created</span>
			<span></span>
		</div>
		<ul class="flex flex-col">
			{#each data.users as u (u.id)}
				{@const you = u.id === data.actorId}
				{@const role = u.isAdmin ? 'Admin' : 'User'}
				<li
					class="grid min-h-12 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-1 border-t border-border py-1 first:border-t-0 max-lg:pr-14 lg:min-h-10 lg:gap-x-3 lg:py-0 lg:pr-1 lg:pl-3 {COLS}"
				>
					<span
						class="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 lg:col-start-1 lg:py-2"
					>
						<span
							class={[
								'min-w-0 text-base font-semibold wrap-break-word lg:text-sm',
								u.disabled && 'text-muted-foreground line-through decoration-1'
							]}>{u.username}</span
						>
						{#if you}
							<span class="text-sm text-muted-foreground max-lg:hidden">(you)</span>
						{/if}
						{#if u.isAdmin}
							<Badge class="lg:hidden">Admin</Badge>
						{/if}
						{#if u.disabled}
							<Badge variant="spent">Disabled</Badge>
						{/if}
					</span>
					<span class="text-sm max-lg:sr-only lg:col-start-2 lg:row-start-1">{role}</span>
					<!-- One muted line on the phone; the Created cell from `lg`. -->
					<span
						class="col-start-2 row-start-2 text-[0.8125rem] leading-snug text-muted-foreground lg:col-start-3 lg:row-start-1 lg:text-sm lg:text-foreground"
					>
						<span class="lg:sr-only">Created&nbsp;</span><span class="whitespace-nowrap figures"
							>{u.createdAt}</span
						>{#if you}<span class="lg:hidden">&nbsp;· you</span>{/if}
					</span>
					<div
						class="col-start-1 row-span-2 row-start-1 flex justify-center lg:col-start-4 lg:row-span-1 lg:justify-end"
					>
						<ActionMenu
							rowId={u.id}
							label="Actions for {u.username}"
							items={userItems(u, data.actorId)}
							onpick={() => openPassword(u.id)}
							head={{ title: u.username, sub: [`${role} · created `, { date: u.createdAt }] }}
						/>
					</div>
				</li>
			{/each}
		</ul>
	</PanelSection>
</div>

{#if enhanced}
	{@render newUser(false)}
	{@render setPassword(false)}
{/if}
