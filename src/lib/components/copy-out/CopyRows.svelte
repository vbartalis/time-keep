<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import { toTsv, type Column, type OutputRow } from '#lib/output.js';

	/**
	 * Copy <n> rows, the screen's one primary (it needs the script: drawn by the server,
	 * hidden without it), and Download CSV, with the copy's status under them, cleared when
	 * the rows change. `off` (no column on, or no row to copy): both at half strength, still
	 * focusable, described by the message saying why (`reason`), and doing nothing; Copy
	 * never touches the clipboard then. `rows` are the range's, also with no column on, so
	 * the button still names their number. On the PC side by side (in a row under the
	 * options below `xl`); on the phone (below `lg`) full width and stacked.
	 */
	let {
		columns,
		rows,
		csvHref,
		off,
		reason
	}: {
		columns: Column[];
		rows: OutputRow[];
		csvHref: string;
		off: boolean;
		/** The id of what says why they are off. */
		reason: string;
	} = $props();

	/** The last copy's outcome, kept only while the same rows are shown. */
	let outcome = $state.raw<{ rows: OutputRow[]; text: string } | null>(null);
	const status = $derived(outcome?.rows === rows ? outcome.text : '');
	const n = $derived(rows.length);

	async function copy() {
		if (off) return;
		const shown = rows;
		outcome = null;
		try {
			await navigator.clipboard.writeText(toTsv(shown, columns));
			const k = shown.length;
			outcome = { rows: shown, text: k === 1 ? 'Copied 1 row.' : `Copied ${k} rows.` };
		} catch {
			outcome = { rows: shown, text: 'Copy failed; select the table and copy it.' };
		}
	}

	const button =
		'inline-flex h-11 items-center justify-center gap-1.5 rounded-md border px-4 text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:h-9 lg:px-3 [&_svg]:size-4 [&_svg]:shrink-0';
	const live = 'active:translate-y-px cursor-pointer';
	const dim = 'cursor-not-allowed opacity-50';
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-col gap-2 lg:flex-row xl:justify-end">
		<button
			type="button"
			data-js
			aria-disabled={off ? 'true' : undefined}
			aria-describedby={off ? reason : undefined}
			onclick={copy}
			class="{button} border-transparent bg-primary text-primary-foreground {off
				? dim
				: `${live} hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_18%)]`}"
		>
			<Copy aria-hidden="true" />
			{n === 1 ? 'Copy 1 row' : `Copy ${n} rows`}
		</button>
		{#if off}
			<!-- A link with nowhere to go: focusable, saying why. -->
			<a
				role="link"
				tabindex="0"
				aria-disabled="true"
				aria-describedby={reason}
				class="{button} {dim} border-input bg-card text-foreground"
			>
				<Download aria-hidden="true" />
				Download CSV
			</a>
		{:else}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- the load builds it -->
			<a
				href={csvHref}
				data-sveltekit-reload
				class="{button} {live} border-input bg-card text-foreground hover:border-foreground/60 hover:bg-accent"
			>
				<Download aria-hidden="true" />
				Download CSV
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	</div>
	<p class="text-sm xl:text-right" aria-live="polite">{status}</p>
</div>
