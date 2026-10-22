<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import FormDialog from '#lib/components/admin/FormDialog.svelte';
	import { Button } from '#lib/components/ui/button/index.js';

	/**
	 * Revoke…'s confirm: "Revoke "<name>"?", the line, Cancel and a destructive Revoke that
	 * posts `?/revokeToken` with the id and `confirm=yes`. Revoke takes the focus (there is
	 * no field). Posted, it closes (`onposted`), the page comes back without the line, and
	 * `ondone` places the focus. `inline` is the page without the script (`?revoke=<id>`, or
	 * round 1's first press): the same confirm as a panel at the section's head, Cancel a
	 * link back to `/account`.
	 */
	let {
		token,
		inline = false,
		onclose,
		onposted = () => {},
		ondone = () => {}
	}: {
		/** The token asked about; null while closed. */
		token: { id: string; name: string } | null;
		inline?: boolean;
		onclose: () => void;
		onposted?: () => void;
		ondone?: () => void;
	} = $props();

	const TITLE_ID = 'revoke-token-title';
	const FORM_ID = 'revoke-token-form';

	const submit: SubmitFunction =
		() =>
		async ({ update }) => {
			onposted();
			await update();
			await tick();
			ondone();
		};
</script>

{#snippet body()}
	{#if token}
		<form id={FORM_ID} method="POST" action="?/revokeToken" use:enhance={submit} class="contents">
			<input type="hidden" name="id" value={token.id} />
			<input type="hidden" name="confirm" value="yes" />
			<p class="text-sm text-pretty">Agents using it lose access at once. This cannot be undone.</p>
		</form>
	{/if}
{/snippet}

{#snippet foot()}
	{#if inline}
		<Button href={resolve('/(app)/account')} variant="outline">Cancel</Button>
	{:else}
		<Button variant="outline" onclick={onclose}>Cancel</Button>
	{/if}
	<Button type="submit" form={FORM_ID} variant="destructive" autofocus={!inline}>Revoke</Button>
{/snippet}

<FormDialog
	open={token !== null}
	title={token ? `Revoke "${token.name}"?` : ''}
	titleId={TITLE_ID}
	{onclose}
	{inline}
	{body}
	{foot}
/>
