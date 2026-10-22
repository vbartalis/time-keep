<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import FormDialog from '#lib/components/admin/FormDialog.svelte';
	import { dialogSubmit } from '#lib/components/admin/dialogs.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	/**
	 * "New token" (`pc-account`, `pc-account-token-made`): Name with its hint, Cancel and
	 * Create token, in a `FormDialog` (a sheet on the phone). A refusal stays in it under
	 * Name, the name kept, and the focus goes back to Name so its message is read. Made, the
	 * same dialog becomes "Token made: <name>": the token in a read-only mono field that
	 * selects itself on focus, the line, and Copy (it takes the focus; "Copied" once the
	 * clipboard has it) and Done. The page forgets the token when it closes, by any means.
	 * `inline` is the page without the script (`?new=token`, or the post's answer): the
	 * same form or made token as a panel at the section's head, Cancel and Done links back
	 * to `/account`, no Copy.
	 */
	let {
		open,
		inline = false,
		made,
		failure,
		onclose
	}: {
		open: boolean;
		inline?: boolean;
		/** The token just made, shown once; null before. */
		made: { token: string; name: string } | null;
		/** A refused create: the message and the name typed. */
		failure: { error: string; name: string } | null;
		onclose: () => void;
	} = $props();

	const TITLE_ID = 'new-token-title';
	const FORM_ID = 'new-token-form';
	const account = resolve('/(app)/account');

	let nameField = $state<HTMLInputElement | null>(null);
	let tokenField = $state<HTMLInputElement | null>(null);
	let copyButton = $state<HTMLButtonElement | null>(null);
	/** The token last copied, so "Copied" is only ever about the one shown. */
	let copiedToken = $state<string | null>(null);
	const copied = $derived(made !== null && copiedToken === made.token);

	// Back from a refusal: Name again, so its message (its description) is read.
	$effect(() => {
		const field = nameField;
		if (failure && field && !inline) void tick().then(() => field.focus());
	});

	// Made: Copy takes the focus.
	$effect(() => {
		const button = copyButton;
		if (made && button) void tick().then(() => button.focus());
	});

	/** A refusal for a dialog closed meanwhile is not brought back. */
	const submit = dialogSubmit();

	async function copy() {
		if (!made) return;
		const shown = made.token;
		try {
			await navigator.clipboard.writeText(shown);
			copiedToken = shown;
		} catch {
			// No clipboard: the field selects itself, to be copied by hand.
			tokenField?.focus();
		}
	}

	const label = 'text-sm font-semibold text-foreground';
	const hint = 'text-[0.8125rem] leading-snug text-muted-foreground';
</script>

{#snippet body()}
	{#if made}
		<!-- 15 px at every width: at 14 px some monospace faces (DejaVu Sans Mono) lose the "_". -->
		<Input
			bind:ref={tokenField}
			id="made-token"
			value={made.token}
			readonly
			autocomplete="off"
			spellcheck="false"
			aria-labelledby={TITLE_ID}
			aria-describedby="made-token-note"
			class="bg-muted font-mono lg:text-base"
			onfocus={(e) => e.currentTarget.select()}
		/>
		<p id="made-token-note" class="text-sm text-pretty">Copy it now: it is not shown again.</p>
		<p class="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</p>
	{:else}
		<form id={FORM_ID} method="POST" action="?/createToken" use:enhance={submit} class="contents">
			<div class="flex flex-col gap-1.5">
				<label for="token-name" class={label}>Name</label>
				<Input
					bind:ref={nameField}
					id="token-name"
					name="name"
					value={failure?.name ?? ''}
					required
					autocomplete="off"
					spellcheck="false"
					aria-invalid={failure ? 'true' : undefined}
					aria-describedby={failure ? 'token-name-error token-name-hint' : 'token-name-hint'}
				/>
				{#if failure}
					<p id="token-name-error" class="text-sm text-pretty text-irregular">{failure.error}</p>
				{/if}
				<p id="token-name-hint" class={hint}>
					Name it after the agent or machine that will use it.
				</p>
			</div>
		</form>
	{/if}
{/snippet}

{#snippet foot()}
	{#if made}
		{#if inline}
			<Button href={account} variant="outline">Done</Button>
		{:else}
			<Button bind:ref={copyButton} autofocus onclick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
			<Button variant="outline" onclick={onclose}>Done</Button>
		{/if}
	{:else}
		{#if inline}
			<Button href={account} variant="outline">Cancel</Button>
		{:else}
			<Button variant="outline" onclick={onclose}>Cancel</Button>
		{/if}
		<Button type="submit" form={FORM_ID}>Create token</Button>
	{/if}
{/snippet}

<FormDialog
	{open}
	title={made ? `Token made: ${made.name}` : 'New token'}
	titleId={TITLE_ID}
	{onclose}
	{inline}
	{body}
	{foot}
/>
