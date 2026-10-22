<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { tick, type Snippet } from 'svelte';
	import Sheet from '#lib/components/timesheet/Sheet.svelte';

	/**
	 * A small form's dialog, Setup's create dialog generalised (`pc-users-new`,
	 * `ph-users-new`, the confirms): 440 px on the PC, a bottom sheet on the phone
	 * (`Sheet`), so it traps focus, closes on Escape, the scrim or Back and returns the
	 * focus to its opener. The head is the 17 px bold title (it wraps) and a ghost ×; the
	 * body holds the fields; the foot is pinned on a rule: outline Cancel and the action,
	 * equal parts of the width on the phone (a lone Done takes it all), at the right on the
	 * PC. Opened, the `[autofocus]` element takes the focus, else the body's first field.
	 *
	 * The `<form>` is in `body` with an id (`class="contents"`, so the body's 12 px gaps
	 * hold), and the foot's submit names it (`form=<id>`),
	 * so Enter in a field and the submit post it, and the form leaves the page with the
	 * dialog (a refusal for a dialog closed meanwhile is not brought back). `inline` is the
	 * page without the script: the same head, body and foot as a panel in the screen,
	 * without ×.
	 */
	let {
		open,
		title,
		titleId,
		onclose,
		inline = false,
		body,
		foot
	}: {
		open: boolean;
		title: string;
		/** The heading's id, naming the dialog. */
		titleId: string;
		onclose: () => void;
		inline?: boolean;
		body: Snippet;
		foot: Snippet;
	} = $props();

	let bodyNode = $state<HTMLElement | null>(null);

	// Opened: its first field, once the dialog is up.
	$effect(() => {
		const node = bodyNode;
		if (!open || inline || !node) return;
		void tick().then(() => {
			const first =
				node.querySelector<HTMLElement>('[autofocus]') ??
				node.querySelector<HTMLElement>(
					'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
				);
			first?.focus();
		});
	});
</script>

{#snippet content()}
	<div
		class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 lg:px-5"
	>
		<h2 id={titleId} class="min-w-0 text-lg font-bold text-pretty wrap-break-word">{title}</h2>
		{#if !inline}
			<button
				type="button"
				aria-label="Close"
				class="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
				onclick={onclose}
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		{/if}
	</div>
	<div bind:this={bodyNode} class="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 py-4 lg:px-5">
		{@render body()}
	</div>
	<div
		class="grid shrink-0 auto-cols-fr grid-flow-col gap-3 border-t border-border px-4 py-3 lg:flex lg:items-center lg:justify-end lg:gap-2 lg:px-5"
	>
		{@render foot()}
	</div>
{/snippet}

{#if inline}
	{#if open}
		<div class="flex flex-col rounded-md border border-border bg-card lg:max-w-[27.5rem]">
			{@render content()}
		</div>
	{/if}
{:else}
	<Sheet {open} labelledby={titleId} {onclose} dialog narrow>
		{#if open}
			{@render content()}
		{/if}
	</Sheet>
{/if}
