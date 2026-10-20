<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { BarTemplate } from './types.js';

	/**
	 * The bar's list of ways to start a timer: the templates by name, then "Start on a
	 * project…". Plain forms and links, so it works without JavaScript. `back` is the
	 * screen a start returns to.
	 */
	let { templates, back }: { templates: BarTemplate[]; back: string } = $props();

	// Whole class names, so Tailwind sees them.
	const DOTS = [
		'bg-project-1',
		'bg-project-2',
		'bg-project-3',
		'bg-project-4',
		'bg-project-5',
		'bg-project-6',
		'bg-project-7',
		'bg-project-8'
	];
	const dot = (t: BarTemplate) =>
		t.colour === null ? 'bg-muted-foreground/40' : (DOTS[(t.colour - 1) % DOTS.length] ?? DOTS[0]);

	const backQuery = $derived(encodeURIComponent(back));
	const newForm = (query: string) => `${resolve('/(app)/entries/new')}?${query}&back=${backQuery}`;
	const start = resolve('/(app)/timers/start');

	const row =
		'flex min-h-11 w-full cursor-pointer list-none items-center gap-3 rounded-sm px-3 text-left transition-colors duration-150 ease-out outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:min-h-10 [&::-webkit-details-marker]:hidden';

	/** A template's description line takes focus as it opens. */
	function focusLine(e: Event & { currentTarget: HTMLDetailsElement }) {
		if (e.currentTarget.open)
			e.currentTarget.querySelector<HTMLInputElement>('input[name="description"]')?.focus();
	}
</script>

{#snippet item(t: BarTemplate)}
	<span class="size-2 shrink-0 rounded-full {dot(t)}" aria-hidden="true"></span>
	<span class="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
	{#if t.label}<span class="max-w-[60%] shrink-0 truncate text-xs text-muted-foreground"
			>{t.label}</span
		>{/if}
{/snippet}

{#snippet fields(t: BarTemplate)}
	<input type="hidden" name="templateId" value={t.id} />
	<input type="hidden" name="timeZone" value="" />
	<input type="hidden" name="back" value={back} />
{/snippet}

<p class="px-3 pt-2 pb-1.5 caps text-muted-foreground">Start a timer</p>
<ul class="flex flex-col">
	{#each templates as t (t.id)}
		<li>
			{#if !t.hasProject}
				<!-- No project to start on: the form, in timer mode, filled from it. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -- newForm() resolves it -->
				<a
					href={newForm(`template=${encodeURIComponent(t.id)}&timer=1`)}
					data-entry-form
					class={row}>{@render item(t)}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else if t.hasDescription}
				<form method="POST" action={start} use:enhance>
					{@render fields(t)}
					<button type="submit" class={row}>{@render item(t)}</button>
				</form>
			{:else}
				<details ontoggle={focusLine} class="group/tpl">
					<summary class="{row} group-open/tpl:bg-accent">{@render item(t)}</summary>
					<form method="POST" action={start} use:enhance class="flex items-center gap-2 px-3 py-2">
						{@render fields(t)}
						<input
							type="text"
							name="description"
							aria-label="Description for {t.name}"
							placeholder="Description (optional)"
							autocomplete="off"
							class="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9 lg:text-sm"
						/>
						<button
							type="submit"
							class="inline-flex h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-150 ease-out outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-9 lg:px-3"
							>Start</button
						>
					</form>
				</details>
			{/if}
		</li>
	{/each}
	<li class="mt-1 border-t border-border pt-1">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- newForm() resolves it -->
		<a href={newForm('timer=1')} data-entry-form class={row}
			><span class="min-w-0 flex-1 truncate font-semibold">Start on a project…</span><span
				class="shrink-0 text-xs text-muted-foreground">opens the form</span
			></a
		>
	</li>
	{#if templates.length === 0}
		<li>
			<a
				href={resolve('/(app)/templates/new')}
				class="{row} text-foreground underline decoration-input underline-offset-4 hover:decoration-foreground"
				>Create a template</a
			>
		</li>
	{/if}
</ul>
