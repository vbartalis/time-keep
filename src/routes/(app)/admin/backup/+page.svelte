<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Backup</title></svelte:head>

<div class="flex flex-col gap-10">
	<section class="flex w-full max-w-2xl flex-col">
		<h2 class="border-b border-foreground pb-1.5 caps">Backup</h2>
		<p class="border-b border-border py-3 text-sm">
			A backup is the whole database: every user, their time data and history. Keep it somewhere
			safe; it holds password hashes.
		</p>
		<div class="pt-4">
			<a
				href={resolve('/(app)/admin/backup/download')}
				class={buttonVariants({ class: 'w-full sm:w-auto' })}>Download backup</a
			>
		</div>
	</section>

	<form
		method="POST"
		action="?/restore"
		enctype="multipart/form-data"
		use:enhance
		class="flex w-full max-w-2xl flex-col"
	>
		<h2 class="border-b border-foreground pb-1.5 caps">Restore</h2>
		<p class="border-b border-border py-3 text-sm">
			Restoring replaces every user's data with the backup's and signs everyone out.
		</p>
		<div
			class="grid gap-2 border-b border-border py-3 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-x-4"
		>
			<Label for="restore-file">Backup file</Label>
			<input
				id="restore-file"
				name="file"
				type="file"
				accept=".db"
				class="min-w-0 text-sm file:mr-3 file:h-11 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:text-sm file:font-medium lg:file:h-9"
			/>
		</div>
		<div
			class="flex min-h-14 items-center gap-2.5 border-b border-border py-2 lg:min-h-0 lg:py-3 lg:pl-[13rem]"
		>
			<input
				id="restore-confirm"
				name="confirm"
				type="checkbox"
				class="size-4.5 rounded-sm border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			/>
			<Label for="restore-confirm">Replace all data with this backup</Label>
		</div>
		<div class="pt-4 lg:pl-[13rem]">
			<Button type="submit" variant="destructive" class="w-full sm:w-auto">Restore</Button>
		</div>
		{#if form?.error}
			<Alert variant="destructive" class="mt-4"
				><AlertDescription>{form.error}</AlertDescription></Alert
			>
		{/if}
	</form>

	{#if data.beforeRestore}
		<section class="flex w-full max-w-2xl flex-col">
			<h2 class="border-b border-foreground pb-1.5 caps">Before the last restore</h2>
			<p class="border-b border-border py-3 text-sm">
				The data as it was just before the last restore, <span class="figures"
					>{data.beforeRestore}</span
				>.
			</p>
			<div class="pt-4">
				<a
					href="{resolve('/(app)/admin/backup/download')}?before-restore=1"
					class={buttonVariants({ variant: 'outline', class: 'w-full sm:w-auto' })}>Download</a
				>
			</div>
		</section>
	{/if}
</div>
