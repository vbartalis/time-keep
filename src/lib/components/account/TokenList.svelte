<script lang="ts">
	import ActionMenu from '#lib/components/admin/ActionMenu.svelte';
	import { tokenItems } from '#lib/components/admin/items.js';

	type Token = { id: string; name: string; created: string; lastUsed: string | null };

	/**
	 * Agent access's tokens (`pc-account`, `ph-account`), newest first. From `lg` the ruled
	 * table in the panel: the muted head band (Name, Made, Last used), 40 px rows, the name
	 * semibold, the dates in figures, "Never used" muted, ⋯ last. Below `lg` one row each
	 * of at least 48 px: the leading ⋯, the name in 15 px semibold, and under it the 13 px
	 * muted "Made <date> · Last used <date> <time>", clear of the "+"'s column. A long name
	 * wraps inside its cell; a date with its time never breaks. ⋯ holds Revoke…, which
	 * opens the confirm (`onrevoke`), or without the script links to `?revoke=<id>`.
	 */
	let { tokens, onrevoke }: { tokens: Token[]; onrevoke: (id: string) => void } = $props();

	const COLS = 'lg:grid-cols-[minmax(0,1fr)_7.5rem_10rem_2.25rem]';
	const lineOf = (t: Token) => [
		'Made ',
		{ date: t.created },
		' · ',
		...(t.lastUsed ? ['Last used ', { date: t.lastUsed }] : ['Never used'])
	];
</script>

{#if tokens.length === 0}
	<p class="px-4 py-3 text-sm text-muted-foreground lg:px-3">No tokens yet.</p>
{:else}
	<!-- The column heads are for the eye; each row's cells read in order, with their names. -->
	<div
		aria-hidden="true"
		class="hidden h-9 items-center gap-x-3 rounded-t-md border-b border-input bg-muted pr-1 pl-3 text-xs caps text-muted-foreground lg:grid {COLS}"
	>
		<span>Name</span>
		<span>Made</span>
		<span>Last used</span>
		<span></span>
	</div>
	<ul class="flex flex-col">
		{#each tokens as t (t.id)}
			<li
				class="grid min-h-12 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-1 border-t border-border py-1 first:border-t-0 max-lg:pr-14 lg:min-h-10 lg:gap-x-3 lg:py-0 lg:pr-1 lg:pl-3 {COLS}"
			>
				<span
					class="col-start-2 row-start-1 min-w-0 text-base font-semibold wrap-break-word lg:col-start-1 lg:py-2 lg:text-sm"
					>{t.name}</span
				>
				<!-- One muted line on the phone; its parts are the table's cells from `lg`. -->
				<span
					class="col-start-2 row-start-2 text-[0.8125rem] leading-snug text-muted-foreground lg:contents lg:text-sm"
				>
					<span class="lg:col-start-2 lg:row-start-1 lg:text-foreground"
						><span class="lg:sr-only">Made&nbsp;</span><span class="whitespace-nowrap figures"
							>{t.created}</span
						></span
					><span aria-hidden="true" class="lg:hidden">&nbsp;·</span>
					{#if t.lastUsed}
						<span class="lg:col-start-3 lg:row-start-1 lg:text-foreground"
							><span class="lg:sr-only">Last used&nbsp;</span><span
								class="whitespace-nowrap figures">{t.lastUsed}</span
							></span
						>
					{:else}
						<span class="lg:col-start-3 lg:row-start-1">Never used</span>
					{/if}
				</span>
				<div
					class="col-start-1 row-span-2 row-start-1 flex justify-center lg:col-start-4 lg:row-span-1 lg:justify-end"
				>
					<ActionMenu
						rowId={t.id}
						label="Actions for {t.name}"
						items={tokenItems(t)}
						onpick={() => onrevoke(t.id)}
						head={{ title: t.name, sub: lineOf(t) }}
					/>
				</div>
			</li>
		{/each}
	</ul>
{/if}
