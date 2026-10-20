<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let { token, name }: { token: string; name: string } = $props();

	// The button needs JavaScript; without it the field is selected and copied by hand.
	let enhanced = $state(false);
	onMount(() => (enhanced = true));

	let field = $state<HTMLInputElement | null>(null);
	/** The token last copied, so "Copied" goes when another token is shown. */
	let copied = $state<string | null>(null);

	async function copy() {
		const shown = token;
		copied = null;
		try {
			await navigator.clipboard.writeText(shown);
			copied = shown;
		} catch {
			// No clipboard: select the token so it can be copied by hand.
			field?.select();
		}
	}
</script>

<div
	class="grid gap-2 border-b border-border py-3 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-x-4"
>
	<Label for="new-token" class="min-w-0 break-words">{name}</Label>
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex gap-2">
			<Input
				bind:ref={field}
				id="new-token"
				value={token}
				readonly
				autocomplete="off"
				spellcheck="false"
				aria-describedby="new-token-note"
				class="min-w-0 flex-1 figures"
				onfocus={(e) => e.currentTarget.select()}
			/>
			{#if enhanced}
				<Button variant="outline" onclick={copy}>Copy</Button>
			{/if}
		</div>
		<p id="new-token-note" class="text-sm font-medium text-pretty">
			Copy it now: it is not shown again.
		</p>
		<p class="text-sm" aria-live="polite">{copied === token ? 'Copied' : ''}</p>
	</div>
</div>
