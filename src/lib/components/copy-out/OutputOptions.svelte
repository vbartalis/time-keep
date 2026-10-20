<script lang="ts">
	import type { DurationFormat } from '#lib/output.js';

	let {
		options
	}: {
		options: { round: boolean; split: boolean; duration: DurationFormat };
	} = $props();

	const durations: { value: DurationFormat; label: string }[] = [
		{ value: 'hm', label: 'h:mm' },
		{ value: 'decimal', label: 'Decimal hours' }
	];

	const legend = 'mb-2 text-sm leading-none font-semibold';
	const row = 'flex flex-wrap gap-x-5 gap-y-0';
	const choice = 'flex h-11 items-center gap-2 text-sm lg:h-9';
	const box =
		'size-4.5 rounded-sm align-middle accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-lg:size-5';
</script>

<fieldset class="min-w-0">
	<legend class={legend}>Options</legend>
	<div class="{row} items-center">
		<label class={choice}>
			<input type="checkbox" name="round" value="1" checked={options.round} class={box} />
			Round to 5 minutes
		</label>
		<label class={choice}>
			<input type="checkbox" name="split" value="1" checked={options.split} class={box} />
			Split at midnight
		</label>
		<div
			role="radiogroup"
			aria-labelledby="copy-duration"
			class="flex flex-wrap items-center gap-x-5"
		>
			<span id="copy-duration" class="text-sm">Duration as</span>
			{#each durations as d (d.value)}
				<label class={choice}>
					<input
						type="radio"
						name="duration"
						value={d.value}
						checked={options.duration === d.value}
						class={box}
					/>
					{d.label}
				</label>
			{/each}
		</div>
	</div>
</fieldset>
