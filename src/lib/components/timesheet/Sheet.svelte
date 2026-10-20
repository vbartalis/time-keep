<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import type { Snippet } from 'svelte';

	/**
	 * A sheet from the bottom on a native modal `<dialog>`, as the entry form's: it traps
	 * focus and returns it to its opener. Escape, a tap on the scrim and the browser's Back
	 * close it; Back is held so the screen under it stays where it is. `dialog` makes it a
	 * centred dialog from `lg` (the bulk form's); otherwise it is a sheet at every width.
	 */
	let {
		open,
		labelledby,
		onclose,
		dialog = false,
		children
	}: {
		open: boolean;
		/** The id of the heading that names it. */
		labelledby: string;
		onclose: () => void;
		dialog?: boolean;
		children: Snippet;
	} = $props();

	let node = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (!node) return;
		if (open && !node.open) node.showModal();
		else if (!open && node.open) node.close();
	});

	// Back closes the sheet instead of leaving the screen under it.
	beforeNavigate((nav) => {
		if (!open || nav.type !== 'popstate') return;
		nav.cancel();
		onclose();
	});

	const frame = $derived(
		dialog
			? 'lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[calc(100dvh-4rem)] lg:w-[calc(100%-2rem)] lg:max-w-[38.75rem] lg:rounded-lg lg:border-0 lg:shadow-[0_8px_24px_rgb(0_0_0/0.12)]'
			: ''
	);
</script>

<!-- A tap on the scrim lands on the dialog itself; it closes it. -->
<dialog
	bind:this={node}
	aria-labelledby={labelledby}
	class="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none flex-col overflow-hidden rounded-t-lg border-0 border-t border-border bg-card p-0 pb-[env(safe-area-inset-bottom)] text-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] backdrop:bg-black/40 open:flex {frame}"
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
	onclose={() => {
		if (open) onclose();
	}}
	onclick={(e) => {
		if (e.target === node) onclose();
	}}
>
	{@render children()}
</dialog>
