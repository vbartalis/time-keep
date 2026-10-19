<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import Elapsed from './Elapsed.svelte';
	import SectionHead from './SectionHead.svelte';
	import { clearOnDone } from './field';
	import type { ActionFailure, TimerRow } from './types';

	let { timers, now, failure }: { timers: TimerRow[]; now: number; failure: ActionFailure | null } =
		$props();

	const columns =
		'grid-cols-[3.5rem_4.75rem_minmax(0,1fr)_auto] lg:grid-cols-[4.5rem_5.5rem_minmax(0,1fr)_auto]';
</script>

<section aria-labelledby="timers-heading">
	<SectionHead id="timers-heading" title="Timers" />
	{#if timers.length === 0}
		<p class="border-b border-border px-3 py-3 text-sm text-muted-foreground">No timer running.</p>
	{:else}
		<div
			class="grid h-9 divide-x divide-border border-b border-input bg-muted text-xs printed text-muted-foreground {columns}"
			aria-hidden="true"
		>
			<span class="flex items-center px-3">In</span>
			<span class="flex items-center px-3">Running</span>
			<span class="col-span-2 flex items-center px-3">Customer › project</span>
		</div>
		<ul>
			{#each timers as timer (timer.id)}
				<li class="border-b border-border">
					<div class="grid min-h-14 items-center divide-x divide-border {columns}">
						<span class="self-stretch px-3 py-3 punch text-sm">{timer.start}</span>
						<span class="self-stretch px-3 py-3 text-sm">
							<Elapsed startAt={timer.startAt} serverNow={now} />
						</span>
						<div class="flex min-w-0 flex-col self-stretch px-3 py-2.5 text-sm">
							<span class="font-semibold text-pretty">
								{timer.customerName} › {timer.projectName}
							</span>
							{#if timer.startDate}
								<span class="text-muted-foreground"
									>Since <span class="punch">{timer.startDate}</span></span
								>
							{/if}
							{#if timer.description}
								<span class="text-pretty text-muted-foreground">{timer.description}</span>
							{/if}
						</div>
						<form
							method="POST"
							action="?/stop"
							use:enhance={clearOnDone}
							class="flex items-center self-stretch pl-1"
						>
							<input type="hidden" name="id" value={timer.id} />
							<input type="hidden" name="timeZone" />
							<Button
								type="submit"
								variant="outline"
								aria-label="Stop {timer.projectName} started {timer.startDate
									? `${timer.startDate} `
									: ''}{timer.start}">Stop</Button
							>
						</form>
					</div>
					{#if failure?.action === 'stop' && failure.subject === timer.id}
						<p role="alert" class="px-3 pb-2.5 text-sm text-irregular">{failure.error}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
