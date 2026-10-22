<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import FormDialog from '#lib/components/admin/FormDialog.svelte';
	import PanelSection from '#lib/components/admin/PanelSection.svelte';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let enhanced = $state(false);
	onMount(() => (enhanced = true));

	const download = resolve('/(app)/admin/backup/download');
	const RESTORE_FORM = 'restore-form';
	const LINE = 'border-t border-border px-4 py-3 first:border-t-0 lg:px-3.5';
	/** The panel's foot: its button full width on the phone, at the right from `lg`. */
	const FOOT = `${LINE} lg:flex lg:justify-end`;

	/** The chosen file's name; null when none is chosen. */
	let fileName = $state<string | null>(null);
	/** Restore… pressed with no file: the server's words, said before any post. */
	let noFile = $state(false);
	/** The confirm is open. */
	let confirming = $state(false);

	const refusal = $derived(noFile ? 'Choose a backup file.' : (form?.error ?? null));

	function chose(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		fileName = file && file.size > 0 ? file.name : null;
		noFile = false;
	}

	/** With the script, Restore… asks first; with no file it says so and posts nothing. */
	function askRestore() {
		if (fileName === null) {
			noFile = true;
			return;
		}
		noFile = false;
		confirming = true;
	}
</script>

<svelte:head><title>Backup · Time Keep</title></svelte:head>

<div class="flex w-full max-w-3xl flex-col gap-8">
	<PanelSection title="Backup" id="backup-heading">
		<p class={`${LINE} text-sm text-pretty`}>
			A backup is the whole database: every user, their time data and history. Keep it somewhere
			safe; it holds password hashes.
		</p>
		<div class={FOOT}>
			<Button href={download} class="w-full lg:w-auto">Download backup</Button>
		</div>
	</PanelSection>

	<PanelSection title="Restore" id="restore-heading">
		<form
			id={RESTORE_FORM}
			method="POST"
			action="?/restore"
			enctype="multipart/form-data"
			use:enhance={() => {
				// Posted: the confirm closes (the focus goes back to Restore…) and a refusal
				// shows in the panel.
				confirming = false;
				noFile = false;
			}}
			class="flex flex-col"
		>
			<p class={`${LINE} text-sm text-pretty`}>
				Restoring replaces every user's data with the backup's and signs everyone out.
			</p>
			<div
				class={`${LINE} grid gap-1.5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-x-4`}
			>
				<label for="restore-file" class="text-sm font-semibold text-foreground">Backup file</label>
				<input
					id="restore-file"
					name="file"
					type="file"
					accept=".db"
					onchange={chose}
					aria-invalid={refusal ? 'true' : undefined}
					aria-describedby={refusal ? 'restore-error' : undefined}
					class="min-w-0 text-sm text-muted-foreground file:mr-3 file:h-11 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-card file:px-4 file:text-sm file:font-semibold file:text-foreground file:transition-colors hover:file:border-foreground/60 hover:file:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:file:h-9 lg:file:px-3"
				/>
			</div>
			<!-- Without the script there is no confirm: the box is round 1's. -->
			<div
				data-nojs
				class={`${LINE} flex min-h-14 items-center gap-2.5 lg:min-h-0 lg:pl-[13.875rem]`}
			>
				<input
					id="restore-confirm"
					name="confirm"
					type="checkbox"
					class="size-4.5 rounded-sm accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				/>
				<label for="restore-confirm" class="text-sm">Replace all data with this backup</label>
			</div>
			{#if refusal}
				<div class={LINE}>
					<Alert variant="destructive"
						><AlertDescription id="restore-error">{refusal}</AlertDescription></Alert
					>
				</div>
			{/if}
			<div class={FOOT}>
				{#if enhanced}
					<Button
						variant="destructive"
						aria-haspopup="dialog"
						class="w-full lg:w-auto"
						onclick={askRestore}>Restore…</Button
					>
				{:else}
					<Button type="submit" variant="destructive" class="w-full lg:w-auto">Restore…</Button>
				{/if}
			</div>
		</form>
	</PanelSection>

	{#if data.beforeRestore}
		<PanelSection title="Before the last restore" id="before-restore-heading">
			<p class={`${LINE} text-sm text-pretty`}>
				The data as it was just before the last restore, <span class="whitespace-nowrap figures"
					>{data.beforeRestore}</span
				>.
			</p>
			<div class={FOOT}>
				<Button href="{download}?before-restore=1" variant="outline" class="w-full lg:w-auto"
					>Download</Button
				>
			</div>
		</PanelSection>
	{/if}
</div>

{#if enhanced}
	{#snippet body()}
		<p class="text-sm text-pretty">
			Restoring <span class="font-mono font-semibold break-all">{fileName}</span> replaces every user's
			data with the backup's and signs everyone out, you included.
		</p>
		<p class="text-[0.8125rem] leading-snug text-pretty text-muted-foreground">
			The data as it is now is kept, and can be downloaded under Before the last restore.
		</p>
	{/snippet}

	{#snippet foot()}
		<Button variant="outline" onclick={() => (confirming = false)}>Cancel</Button>
		<!-- Posts the page's form, the file with it, and `confirm=on` as the box would. -->
		<Button
			type="submit"
			form={RESTORE_FORM}
			name="confirm"
			value="on"
			variant="destructive"
			autofocus>Restore</Button
		>
	{/snippet}

	<FormDialog
		open={confirming}
		title="Restore this backup?"
		titleId="restore-confirm-title"
		onclose={() => (confirming = false)}
		{body}
		{foot}
	/>
{/if}
