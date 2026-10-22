<script lang="ts">
	import type { Snippet } from 'svelte';
	import Panel from '#lib/components/admin/Panel.svelte';

	/**
	 * A section of Account, Users or Backup (Setup's section): the head, an h2 in `caps` on
	 * a 1 px text-colour rule, with `action` (the outline "+ New …") at its right on the
	 * PC and under the rule at the left on the phone; then `children` in a surface panel
	 * (4 px corners, `border` stroke) from `lg`, on the ground edge to edge below, ruled
	 * above and under. What is in the panel brings its own rules and padding. The panel
	 * does not clip (a row's ⋯ popover overflows it), so a filled head band rounds its own
	 * top corners. `notice` goes between the head and the panel: the section's Messages
	 * alerts ("Password changed.") and, without the script, a dialog's form as a panel.
	 */
	let {
		title,
		id,
		action,
		notice,
		children
	}: {
		title: string;
		/** The heading's id; the section is labelled by it. */
		id: string;
		action?: Snippet;
		notice?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section aria-labelledby={id} class="flex flex-col gap-3">
	<!-- The head's rule under both on the PC; on the phone the button under it, at the left. -->
	<div
		class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:border-b lg:border-foreground lg:pb-1.5"
	>
		<h2 {id} class="caps max-lg:border-b max-lg:border-foreground max-lg:pb-1.5">
			{title}
		</h2>
		{#if action}
			<div class="self-start">{@render action()}</div>
		{/if}
	</div>
	{@render notice?.()}
	<Panel>{@render children()}</Panel>
</section>
