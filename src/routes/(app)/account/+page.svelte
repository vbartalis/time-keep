<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { applyAction, enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import NewToken from '#lib/components/account/NewToken.svelte';
	import RevokeToken from '#lib/components/account/RevokeToken.svelte';
	import TokenList from '#lib/components/account/TokenList.svelte';
	import PanelSection from '#lib/components/admin/PanelSection.svelte';
	import { leaveDialog } from '#lib/components/admin/dialogs.js';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let enhanced = $state(false);
	onMount(() => (enhanced = true));

	const account = resolve('/(app)/account');

	// ---- Change password ----

	type PasswordField = 'current' | 'next' | 'confirm';
	const PASSWORD_FIELDS: {
		id: PasswordField;
		label: string;
		autocomplete: 'current-password' | 'new-password';
	}[] = [
		{ id: 'current', label: 'Current password', autocomplete: 'current-password' },
		{ id: 'next', label: 'New password', autocomplete: 'new-password' },
		{ id: 'confirm', label: 'Confirm new password', autocomplete: 'new-password' }
	];

	/** The password form's refusal, by the field the server places it on. */
	const passwordRefusal = $derived.by(() => {
		if (!form?.error) return null;
		const field: PasswordField | null =
			form.field === 'current' || form.field === 'next' || form.field === 'confirm'
				? form.field
				: null;
		return { error: form.error, field };
	});

	const passwordInputs: Record<PasswordField, HTMLInputElement | null> = $state({
		current: null,
		next: null,
		confirm: null
	});

	// Refused: the field it is about, so its message (its description) is read.
	$effect(() => {
		const field = passwordRefusal?.field;
		const input = field ? passwordInputs[field] : null;
		if (input) void tick().then(() => input.focus());
	});

	// ---- Agent access ----

	/** The token just made, shown once until its dialog closes. */
	const made = $derived(form?.token ? { token: form.token, name: form.tokenName ?? '' } : null);
	/** A refused create, for the dialog. */
	const tokenFailure = $derived(
		form?.dialog === 'token' && form.tokenError
			? { error: form.tokenError, name: form.values?.name ?? '' }
			: null
	);
	/** A refusal that is not the dialog's (an unknown token on revoke), at the section's head. */
	const tokenAlert = $derived(form?.tokenError && form.dialog !== 'token' ? form.tokenError : null);

	/** Opened from "+ New token" (held while a post's answer reloads the page). */
	let opened = $state(false);
	/** The New token dialog: opened, `?new=token`, or a refused or done create. */
	const creating = $derived(
		opened || data.dialog?.kind === 'token' || made !== null || tokenFailure !== null
	);

	/** The token picked from its ⋯. */
	let picked = $state<string | null>(null);
	/** The revoke confirm's token: picked, `?revoke=<id>`, or round 1's first press. */
	const revokeId = $derived(
		picked ?? (data.dialog?.kind === 'revoke' ? data.dialog.tokenId : (form?.confirmRevoke ?? null))
	);
	const revoking = $derived(data.tokens.find((t) => t.id === revokeId) ?? null);

	let newTokenButton = $state<HTMLElement | null>(null);

	/**
	 * Leaves the dialog's address (`?new=`, `?revoke=`) and forgets the post's answer, so the
	 * made token is gone from the page's state for good: not on Back, a reopen or a reload.
	 * The focus stays where the closing put it (applying an action would reset it).
	 */
	const leave = () =>
		leaveDialog(account, {
			hasAddress: data.dialog !== null,
			hasAnswer: made !== null || tokenFailure !== null || Boolean(form?.confirmRevoke)
		});

	function openNew() {
		opened = true;
	}

	/**
	 * Leaving the document (a Back or a link to another page, which the dialog cannot hold)
	 * forgets the made token first, so the back/forward cache never keeps it; a page that
	 * comes back from that cache with it anyway forgets it then.
	 */
	function forgetOnHide() {
		if (!made && !opened) return;
		opened = false;
		void applyAction({ type: 'success', status: 200, location: account });
	}

	function forgetOnShow(e: PageTransitionEvent) {
		if (e.persisted && (made || opened)) void closeNew();
	}

	async function closeNew() {
		opened = false;
		await leave();
		newTokenButton?.focus();
	}

	async function openRevoke(id: string) {
		await tick();
		picked = id;
	}

	async function closeRevoke() {
		picked = null;
		await leave();
	}
</script>

<svelte:window onpagehide={forgetOnHide} onpageshow={forgetOnShow} />

<svelte:head><title>Account · Time Keep</title></svelte:head>

<!-- eslint-disable svelte/no-navigation-without-resolve -- `account` is resolved; `?new=token` is its query -->

<div class="flex w-full max-w-3xl flex-col gap-8">
	<PanelSection title="Change password" id="change-password-heading">
		{#snippet notice()}
			{#if form?.message}
				<Alert><AlertDescription>{form.message}</AlertDescription></Alert>
			{:else if passwordRefusal && !passwordRefusal.field}
				<Alert variant="destructive"
					><AlertDescription>{passwordRefusal.error}</AlertDescription></Alert
				>
			{/if}
		{/snippet}
		<form method="POST" action="?/password" use:enhance class="flex flex-col">
			{#each PASSWORD_FIELDS as f (f.id)}
				{@const error = passwordRefusal?.field === f.id ? passwordRefusal.error : null}
				<div
					class="grid gap-1.5 border-t border-border px-4 py-3 first:border-t-0 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-x-4 lg:px-3.5"
				>
					<label for={f.id} class="text-sm font-semibold text-foreground">{f.label}</label>
					<div class="flex min-w-0 flex-col gap-1.5">
						<Input
							bind:ref={passwordInputs[f.id]}
							id={f.id}
							name={f.id}
							type="password"
							autocomplete={f.autocomplete}
							required
							aria-invalid={error ? 'true' : undefined}
							aria-describedby={error ? `${f.id}-error` : undefined}
						/>
						{#if error}
							<p id="{f.id}-error" class="text-sm text-pretty text-irregular">{error}</p>
						{/if}
					</div>
				</div>
			{/each}
			<div class="border-t border-border px-4 py-3 lg:flex lg:justify-end lg:px-3.5">
				<Button type="submit" class="w-full lg:w-auto">Change password</Button>
			</div>
		</form>
	</PanelSection>

	<div class="flex flex-col gap-2">
		<PanelSection title="Agent access" id="agent-access-heading">
			{#snippet action()}
				{#if enhanced}
					<Button
						bind:ref={newTokenButton}
						variant="outline"
						aria-haspopup="dialog"
						onclick={openNew}
					>
						<Plus class="size-4" aria-hidden="true" />New token
					</Button>
				{:else}
					<Button href="{account}?new=token" variant="outline">
						<Plus class="size-4" aria-hidden="true" />New token
					</Button>
				{/if}
			{/snippet}
			{#snippet notice()}
				{#if form?.tokenMessage}
					<Alert><AlertDescription>{form.tokenMessage}</AlertDescription></Alert>
				{:else if tokenAlert}
					<Alert variant="destructive"><AlertDescription>{tokenAlert}</AlertDescription></Alert>
				{/if}
				{#if !enhanced}
					<NewToken inline open={creating} {made} failure={tokenFailure} onclose={closeNew} />
					<RevokeToken inline token={revoking} onclose={closeRevoke} />
				{/if}
			{/snippet}
			<TokenList tokens={data.tokens} onrevoke={openRevoke} />
		</PanelSection>
		<p class="text-[0.8125rem] leading-snug text-pretty text-muted-foreground">
			Agents use a token to reach time-keep through the MCP server. A token is shown once, when it
			is made.
		</p>
	</div>
</div>

{#if enhanced}
	<NewToken open={creating} {made} failure={tokenFailure} onclose={closeNew} />
	<RevokeToken
		token={revoking}
		onclose={closeRevoke}
		onposted={() => (picked = null)}
		ondone={() => newTokenButton?.focus()}
	/>
{/if}
