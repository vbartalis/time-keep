<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import X from '@lucide/svelte/icons/x';
	import EntryForm from './EntryForm.svelte';
	import type { EntryFormFailure } from './types';

	/**
	 * The entry form over the current screen while `page.state.entryForm` holds it (see
	 * `#lib/entry-link.js`): a centred dialog from `lg`, a sheet from under the top bar
	 * below it, with Cancel and Save always on screen, above the keyboard too. A native
	 * modal `<dialog>`: it traps focus, closes on Escape and returns focus to its opener.
	 * Closing is the browser's Back, so the form's address leaves the history with it.
	 */
	const entry = $derived(page.state.entryForm ?? null);
	const editing = $derived(entry?.mode === 'edit');
	const isTemplate = $derived(entry?.kind === 'template');
	const action = $derived.by(() => {
		const id = entry?.values.id ?? '';
		if (isTemplate)
			return editing
				? `${resolve('/(app)/templates/[id]', { id })}?/save`
				: resolve('/(app)/templates/new');
		return editing
			? `${resolve('/(app)/entries/[id]', { id })}?/save`
			: resolve('/(app)/entries/new');
	});
	const title = $derived(
		isTemplate ? (editing ? 'Edit template' : 'New template') : editing ? 'Edit entry' : 'New entry'
	);

	let dialog = $state<HTMLDialogElement | null>(null);
	/** This form's refusal; a new form starts without one. */
	let failure = $state<EntryFormFailure | null>(null);
	/** Back was asked for and has not landed yet: a second close must not go back twice. */
	let leaving = false;

	$effect.pre(() => {
		void entry?.href;
		failure = null;
		leaving = false;
	});

	$effect(() => {
		if (!dialog) return;
		if (entry && !dialog.open) dialog.showModal();
		else if (!entry && dialog.open) dialog.close();
	});

	function leave() {
		if (leaving || !page.state.entryForm) return;
		leaving = true;
		history.back();
	}

	/** The screen under the form, as it was: refreshed, at the same scroll position. */
	function done(location: string) {
		// A saved entry's row is kept clear of the strip; a template's screen has no such row.
		const id = entry?.mode === 'edit' && !isTemplate ? entry.values.id : undefined;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
		void goto(location, { replace: true, refreshAll: true, reset: false }).then(
			() => {
				if (id) clearOfStrip(id);
			},
			// Superseded by another navigation (or failed into the error page): nothing to clear.
			() => {}
		);
	}

	/** The saved entry's row stays in view: out from under the pinned undo strip. */
	function clearOfStrip(id: string) {
		const path = resolve('/(app)/entries/[id]', { id });
		const link = [
			...document.querySelectorAll<HTMLElement>(
				`main a[data-entry-form]:is([href="${path}"], [href^="${path}?"])`
			)
		].find((el) => el.checkVisibility());
		const row = link?.closest('tr, li') ?? link;
		const strip = [...document.querySelectorAll<HTMLElement>('[data-undo-strip]')].find((el) =>
			el.checkVisibility()
		);
		if (!row || !strip) return;
		const pinnedTop = parseFloat(getComputedStyle(strip).top);
		if (Number.isNaN(pinnedTop)) return;
		const clear = pinnedTop + strip.offsetHeight + 8;
		const top = row.getBoundingClientRect().top;
		if (top < clear) window.scrollBy(0, top - clear);
	}

	// The sheet ends where the keyboard begins: the visual viewport's bottom (iOS Safari
	// keeps the layout viewport under its keyboard).
	$effect(() => {
		const viewport = window.visualViewport;
		if (!entry || !dialog || !viewport) return;
		const node = dialog;
		const fit = () =>
			node.style.setProperty('--keyboard-free', `${viewport.offsetTop + viewport.height}px`);
		fit();
		viewport.addEventListener('resize', fit);
		viewport.addEventListener('scroll', fit);
		return () => {
			viewport.removeEventListener('resize', fit);
			viewport.removeEventListener('scroll', fit);
		};
	});

	const wide = () => window.matchMedia('(min-width: 1024px)').matches;
</script>

<!-- A click on the dimmed screen lands on the dialog itself; it closes the PC's dialog. -->
<dialog
	bind:this={dialog}
	aria-labelledby="entry-overlay-title"
	class="entry-overlay fixed inset-x-0 top-14 bottom-auto m-0 h-[calc(var(--keyboard-free,100dvh)-3.5rem)] max-h-none w-full max-w-none flex-col overflow-hidden rounded-t-lg border-0 bg-card p-0 text-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] backdrop:bg-black/40 open:flex lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[calc(100dvh-4rem)] lg:w-[41.25rem] lg:rounded-lg lg:shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
	oncancel={(e) => {
		e.preventDefault();
		leave();
	}}
	onclose={leave}
	onclick={(e) => {
		if (e.target === dialog && wide()) leave();
	}}
>
	{#if entry}
		<div
			class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 lg:px-5"
		>
			<h2 id="entry-overlay-title" tabindex="-1" class="text-lg font-bold outline-none">
				{title}
			</h2>
			<!-- The phone has one way to close: Cancel, at the sheet's foot. -->
			<button
				type="button"
				aria-label="Close"
				class="hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
				onclick={leave}
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
		<!-- Focus does not heed scroll-padding in Chromium: a focused field is brought clear
		     of the pinned Cancel and Save here. -->
		<div
			class="entry-overlay-body min-h-0 flex-1 overflow-y-auto px-4 pt-4 lg:px-5 lg:pt-5"
			onfocusin={(e) => {
				if (e.target instanceof HTMLElement) e.target.scrollIntoView({ block: 'nearest' });
			}}
		>
			{#key entry.href}
				<EntryForm
					data={{ ...entry, failure }}
					{action}
					onDone={done}
					onFailure={(f) => (failure = f)}
					onCancel={leave}
				/>
			{/key}
		</div>
	{/if}
</dialog>

<style>
	/* Cancel and Save stay at the foot while the fields scroll above them (on the PC, the
	   whole footer row); a focused field scrolls clear of them. */
	.entry-overlay-body {
		scroll-padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
	}
	@media (max-width: 1023.98px) {
		.entry-overlay-body :global([data-entry-footer]) {
			position: sticky;
			bottom: 0;
			z-index: 1;
			background-color: var(--color-card);
			padding-bottom: calc(1rem + env(safe-area-inset-bottom));
		}
	}
	@media (min-width: 1024px) {
		.entry-overlay-body :global([data-entry-foot-row]) {
			position: sticky;
			bottom: 0;
			z-index: 1;
			background-color: var(--color-card);
		}
	}
</style>
