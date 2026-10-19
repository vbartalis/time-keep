<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import SectionHead from './SectionHead.svelte';
	import { clearOnDone, line, selectClass } from './field';
	import type { ActionFailure, ProjectGroup } from './types';

	let { projects, failure }: { projects: ProjectGroup[]; failure: ActionFailure | null } = $props();

	const mine = $derived(failure?.action === 'start' ? failure : null);
	const values = $derived(mine?.values ?? {});
	const fields = $derived(mine?.fields ?? {});
</script>

<section aria-labelledby="start-heading">
	<SectionHead id="start-heading" title="Start a timer" />
	{#if projects.length === 0}
		<p class="border-b border-border px-3 py-3 text-sm text-muted-foreground">
			Customers and projects are set up on the PC.
		</p>
	{:else}
		<form method="POST" action="?/start" use:enhance={clearOnDone} class="flex flex-col">
			<input type="hidden" name="timeZone" />
			{#if mine && Object.keys(fields).length === 0}
				<p role="alert" class="border-b border-border py-3 text-sm text-irregular">{mine.error}</p>
			{/if}
			<div class={line}>
				<Label for="start-project">Project</Label>
				<select
					id="start-project"
					name="projectId"
					required
					class={selectClass}
					aria-invalid={fields.projectId ? 'true' : undefined}
				>
					<option value="" selected={!values.projectId}>Pick a project</option>
					{#each projects as group (group.customerId)}
						<optgroup label={group.customerName}>
							{#each group.projects as p (p.id)}
								<option value={p.id} selected={values.projectId === p.id}>{p.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
				{#if fields.projectId}<p class="text-sm text-irregular lg:col-start-2">
						{fields.projectId}
					</p>{/if}
			</div>
			<div class={line}>
				<Label for="start-description">Description</Label>
				<Input
					id="start-description"
					name="description"
					value={values.description ?? ''}
					placeholder="Optional"
					autocomplete="off"
					aria-invalid={fields.description ? 'true' : undefined}
				/>
				{#if fields.description}<p class="text-sm text-irregular lg:col-start-2">
						{fields.description}
					</p>{/if}
			</div>
			<div class="pt-4 lg:pl-[11rem]">
				<Button type="submit" class="w-full sm:w-auto">Start timer</Button>
			</div>
		</form>
	{/if}
</section>
