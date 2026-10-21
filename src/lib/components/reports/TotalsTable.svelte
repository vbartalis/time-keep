<script lang="ts">
	import SectionHead from '#lib/components/today/SectionHead.svelte';

	/** A Projects row names its customer (muted) and project apart, with the project's palette number. */
	type Row = {
		key: string;
		label: string;
		duration: string;
		customer?: string;
		project?: string;
		colour?: number;
	};

	/**
	 * One list of Reports: a section head (`caps` on a text-colour rule) over a surface
	 * panel of ruled rows, the label at the left and the duration at the right in figures,
	 * and the Total at the foot on a text-colour rule. A row with a `colour` (Projects)
	 * leads with the project's 8 px dot. Below `lg` the panel runs edge to edge.
	 */
	let {
		id,
		title,
		rows,
		total,
		dateLabels = false
	}: {
		/** The title's id: the section is named by it. */
		id: string;
		title: string;
		rows: Row[];
		total: string;
		/** The labels are dates, so they set in figures. */
		dateLabels?: boolean;
	} = $props();

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
	const dot = (colour: number) => DOTS[(colour - 1) % DOTS.length] ?? DOTS[0];

	const cell = 'border-b border-border px-4 py-3 align-top lg:py-2.5';
	const foot = 'border-t border-foreground px-4 py-3 font-semibold lg:py-2.5';
</script>

<section aria-labelledby={id} class="flex flex-col gap-2">
	<SectionHead {id} {title} />
	<div
		class="-mx-4 border-y border-border bg-card lg:mx-0 lg:overflow-hidden lg:rounded-md lg:border-x"
	>
		<table class="w-full border-separate border-spacing-0 text-sm">
			<thead class="sr-only">
				<tr>
					<th scope="col">{title}</th>
					<th scope="col">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.key)}
					<!-- The last row's hairline gives way to the Total's rule. -->
					<tr class="[&:last-child>td]:border-b-0">
						<td class="{cell} {dateLabels ? 'figures' : ''}">
							{#if row.colour !== undefined}
								<span class="inline-flex items-baseline gap-2">
									<span
										class="size-2 shrink-0 translate-y-[-1px] self-center rounded-full {dot(
											row.colour
										)}"
										aria-hidden="true"
									></span>
									<span
										><span class="text-muted-foreground">{row.customer} ›</span>
										{row.project}</span
									>
								</span>
							{:else}
								{row.label}
							{/if}
						</td>
						<td class="{cell} text-right whitespace-nowrap figures">{row.duration}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td class={foot}>Total</td>
					<td class="{foot} text-right figures">{total}</td>
				</tr>
			</tfoot>
		</table>
	</div>
</section>
