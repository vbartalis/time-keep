<script lang="ts">
	import StartTimer from '#lib/components/today/StartTimer.svelte';
	import Templates from '#lib/components/today/Templates.svelte';
	import Timers from '#lib/components/today/Timers.svelte';
	import TodayEntries from '#lib/components/today/TodayEntries.svelte';
	import UndoStrip from '#lib/components/UndoStrip.svelte';
	import type { ActionFailure } from '#lib/components/today/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failure = $derived((form as ActionFailure | null) ?? null);
</script>

<svelte:head><title>Time Keep</title></svelte:head>

<div class="flex flex-col gap-1">
	<div class="flex items-baseline gap-3">
		<h1 class="text-xl font-semibold tracking-[-0.01em]">Today</h1>
		<span class="punch text-sm text-muted-foreground">{data.today}</span>
	</div>
	<p class="text-sm text-muted-foreground">Signed in as {data.user.username}</p>
	<p class="text-sm text-muted-foreground">
		Times in {data.zone}{data.zoneSource === 'default' ? ' until this device gives its zone' : ''}.
	</p>
</div>

<!-- A refused action replaces the strip: the screen shows the failure, not an older success. -->
<UndoStrip flash={failure ? null : data.flash} back="/" />

<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_19rem]">
	<div class="flex flex-col gap-10">
		<Timers timers={data.timers} now={data.now} {failure} />
		<Templates templates={data.templates} projects={data.projects} {failure} />
		<StartTimer projects={data.projects} {failure} />
		<TodayEntries entries={data.entries} warnings={data.flash?.warnings ?? []} />
	</div>
</div>
