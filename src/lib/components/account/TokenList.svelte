<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';

	type Token = { id: string; name: string; created: string; lastUsed: string | null };

	let { tokens, confirming }: { tokens: Token[]; confirming: string | null } = $props();

	let confirmButton = $state<HTMLButtonElement | null>(null);

	// The confirm step replaces the Revoke button; keep the focus on it.
	$effect(() => {
		if (confirming) confirmButton?.focus();
	});
</script>

{#if tokens.length === 0}
	<p class="border-b border-border py-3 text-sm text-muted-foreground">No tokens yet.</p>
{:else}
	<ul class="flex flex-col">
		{#each tokens as t (t.id)}
			<!-- Name in the label column on the PC; on the phone the times go under the name. -->
			<li
				class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border py-2 lg:grid-cols-[12rem_minmax(0,1fr)_auto] lg:gap-x-4"
			>
				<span class="min-w-0 font-semibold text-pretty break-words">{t.name}</span>
				<span
					class="col-start-1 row-start-2 flex flex-wrap gap-x-4 text-xs text-muted-foreground lg:col-start-2 lg:row-start-1"
				>
					<span class="figures"><span class="sr-only">Created&nbsp;</span>{t.created}</span>
					{#if t.lastUsed}
						<span class="figures"><span class="sr-only">Last used&nbsp;</span>{t.lastUsed}</span>
					{:else}
						<span>Never used</span>
					{/if}
				</span>
				{#if confirming !== t.id}
					<form
						method="POST"
						action="?/revokeToken"
						use:enhance
						class="col-start-2 row-span-2 row-start-1 lg:col-start-3 lg:row-span-1"
					>
						<input type="hidden" name="id" value={t.id} />
						<Button type="submit" variant="outline" aria-label="Revoke {t.name}">Revoke</Button>
					</form>
				{:else}
					<form
						method="POST"
						action="?/revokeToken"
						use:enhance
						class="col-span-full flex flex-col gap-3 pt-2 pb-1"
					>
						<input type="hidden" name="id" value={t.id} />
						<input type="hidden" name="confirm" value="yes" />
						<p class="text-sm text-pretty">Revoke "{t.name}"?</p>
						<div class="flex flex-wrap gap-3">
							<Button
								bind:ref={confirmButton}
								type="submit"
								variant="destructive"
								class="flex-1 sm:flex-none">Yes, revoke</Button
							>
							<Button href={resolve('/(app)/account')} variant="outline" class="flex-1 sm:flex-none"
								>Cancel</Button
							>
						</div>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
