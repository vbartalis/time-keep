<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash';
	import { applyAction, enhance, type SubmitFunction } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';

	/**
	 * The ticked rows' bar, in the toolbar's place once a box is ticked (`pc-selected`):
	 * the count and total over the set it acts on, Edit…, Delete and Clear selection. It
	 * is the form the rows' boxes post with (`form="bulk"`). Without JavaScript it is
	 * always shown, beside the toolbar: Edit… opens the bulk form as a page, Delete posts.
	 * On the phone it shows while selecting (`ph-select`): "5 selected" over the total and
	 * the set, Edit…, Delete and Done, which leaves selecting (without the script, a link
	 * back to the table without its tick boxes).
	 */
	let {
		enhanced,
		count,
		total,
		set,
		back,
		query,
		onEdit,
		onDone,
		onClear,
		onLeave
	}: {
		/** The script runs: the count is known and Edit… opens the dialog. */
		enhanced: boolean;
		count: number;
		/** `h:mm`, running entries counted to now. */
		total: string;
		/** The range and any search: "This month · “printer”". */
		set: string;
		back: string;
		/** The table's query string, so a refusal renders the same table. */
		query: string;
		onEdit: () => void;
		/** A done Delete's redirect: the ticks clear, then the table reloads in place. */
		onDone: (location: string) => void;
		onClear: () => void;
		/** The phone's Done: selecting ends and the ticks clear. */
		onLeave: () => void;
	} = $props();

	/** Nothing ticked (the phone's bar shows from Select on): Edit… and Delete are off. */
	const idle = $derived(enhanced && count === 0);

	const remove: SubmitFunction =
		() =>
		async ({ result }) => {
			if (result.type === 'redirect') return onDone(result.location);
			await applyAction(result);
		};
</script>

<section
	aria-label="Selection"
	class="flex flex-wrap items-center gap-x-2 gap-y-2 lg:rounded-md lg:border lg:border-foreground/80 lg:bg-card lg:px-2 lg:py-1.5"
>
	<form id="bulk" method="POST" action="?/delete&{query}" use:enhance={remove} class="contents">
		<input type="hidden" name="back" value={back} />
		{#if enhanced}
			<p
				class="flex min-w-0 flex-col text-sm leading-tight max-lg:mr-auto max-lg:flex-1 lg:px-2"
				aria-live="polite"
			>
				<span class="font-semibold figures"
					>{count} selected<span class="max-lg:hidden">{` · ${total}`}</span></span
				>
				<!-- The set wraps, never cut: a custom range or a search must read whole. -->
				<span class="text-xs wrap-break-word text-muted-foreground"
					><span class="figures lg:hidden">{`${total} · `}</span>{set}</span
				>
			</p>
		{/if}
		<Button
			type="submit"
			variant="outline"
			formaction="?/edit&{query}"
			disabled={idle}
			onclick={(e) => {
				if (!enhanced) return;
				e.preventDefault();
				onEdit();
			}}><Pencil aria-hidden="true" class="max-lg:hidden" />Edit…</Button
		>
		<Button type="submit" variant="destructive" disabled={idle}
			><Trash aria-hidden="true" class="max-lg:hidden" />Delete</Button
		>
	</form>
	{#if enhanced}
		<Button variant="link" class="ml-auto max-lg:hidden" onclick={onClear}>Clear selection</Button>
		<Button variant="outline" class="lg:hidden" onclick={onLeave}>Done</Button>
	{:else}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- `back` is resolved -->
		<Button variant="outline" class="lg:hidden" href={back}>Done</Button>
	{/if}
</section>
