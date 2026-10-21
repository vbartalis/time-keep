<script lang="ts">
	import { tick } from 'svelte';
	import { applyForm } from '#lib/components/timesheet/live.js';
	import type { OutputOptions } from '#lib/filter/output.js';
	import type { DurationFormat } from '#lib/output.js';

	/**
	 * Round to 5 minutes, Split at midnight and the segmented Duration (h:mm | Decimal), as
	 * fields of the form `form`: the same inputs with or without the script. Each switch
	 * sends its hidden 0 before its box's 1, so an unticked box reads as off. With the
	 * script a change shows at once, in the history entry's place, the focus kept. `size`:
	 * `pc` is one line from `lg` (36 px), its three parts wrapping as units when the line
	 * is short, and stacked 44 px rows below it; `phone` is always stacked at 44 px
	 * (Reports' Options sheet).
	 */
	let { options, form, size }: { options: OutputOptions; form: string; size: 'pc' | 'phone' } =
		$props();

	const DURATIONS: { value: DurationFormat; label: string }[] = [
		{ value: 'hm', label: 'h:mm' },
		{ value: 'decimal', label: 'Decimal' }
	];

	async function onchange(e: Event) {
		await tick();
		const field = e.target as HTMLInputElement;
		if (field.form) await applyForm(field.form, { replace: true });
	}

	const pc = $derived(size === 'pc');
	const height = $derived(pc ? 'h-11 lg:h-9' : 'h-11');
	const labelId = $derived(`${form}-duration`);
</script>

<div
	class="flex flex-col items-stretch gap-0 {pc
		? 'lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-2'
		: ''}"
>
	{#each [{ name: 'round', label: 'Round to 5 minutes', checked: options.round }, { name: 'split', label: 'Split at midnight', checked: options.split }] as s (s.name)}
		<input type="hidden" name={s.name} value="0" {form} />
		<label class="flex {height} cursor-pointer items-center gap-2.5 text-sm whitespace-nowrap">
			<input
				type="checkbox"
				name={s.name}
				value="1"
				checked={s.checked}
				{form}
				{onchange}
				class="size-4.5 shrink-0 rounded-sm accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			/>
			{s.label}
		</label>
	{/each}
	<div
		class="flex {height} shrink-0 items-center gap-3 whitespace-nowrap {pc
			? 'max-lg:justify-between'
			: 'justify-between'}"
	>
		<span id={labelId} class="text-sm">Duration</span>
		<div role="radiogroup" aria-labelledby={labelId} class="flex">
			{#each DURATIONS as d (d.value)}
				<label
					class="relative flex {height} cursor-pointer items-center justify-center border border-input bg-card px-3.5 text-sm font-semibold text-foreground transition-colors duration-150 ease-out not-first:-ml-px first:rounded-l-md last:rounded-r-md hover:bg-accent has-checked:bg-accent has-checked:shadow-[inset_0_-2px_0_var(--foreground)] has-focus-visible:z-10 has-focus-visible:ring-2 has-focus-visible:ring-ring"
				>
					<input
						type="radio"
						name="duration"
						value={d.value}
						checked={options.duration === d.value}
						{form}
						{onchange}
						class="absolute inset-0 cursor-pointer appearance-none opacity-0 outline-none"
					/>
					{d.label}
				</label>
			{/each}
		</div>
	</div>
</div>
