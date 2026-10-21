<script lang="ts">
	import { COLS, keepArrows } from './columns';
	import type { BatchRow } from './types';

	/**
	 * A batch's changes, opened under its row and indented to the What column: a tick box
	 * (Entries' style), the verb and the record, and a line per changed field, the old
	 * side muted. A batch of more than 100 lists its first 100 without tick boxes.
	 * On the phone (`phone`) the lines are indented to the row's text, the tick box in
	 * the time's column, and the boxes show only while selecting (`boxes`). A ticked line
	 * fills with accent, as Entries' ticked rows. `form` puts the boxes in another form
	 * than the one around them: the phone's, without the script.
	 */
	let {
		batch,
		ticked,
		onTick,
		phone = false,
		boxes = true,
		form
	}: {
		batch: BatchRow;
		ticked: (changeId: string) => boolean;
		onTick: (changeId: string, on: boolean) => void;
		phone?: boolean;
		boxes?: boolean;
		form?: string;
	} = $props();
	const tickable = $derived(batch.tickable && boxes);
	/** The phone's line: the time's column (the box), then the text's. */
	const LINE = 'grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2';

	/** On the PC the fill reaches 12 px past the line each side, to the panel's edge; the rules keep their width. */
	const WIDE = 'lg:shadow-[-0.75rem_0_0_var(--color-accent),0.75rem_0_0_var(--color-accent)]';

	const box =
		'mt-0.5 size-4.5 shrink-0 rounded-sm accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

{#snippet none()}<i class="text-muted-foreground">none</i>{/snippet}

<div class={phone ? 'pb-1 text-sm' : `${COLS} px-3 pb-2 max-lg:pl-15`}>
	<ul class={phone ? '' : 'lg:col-[3/-1]'}>
		{#each batch.changes as change (change.id)}
			<li
				data-ticked={tickable && ticked(change.id) ? '' : undefined}
				class={[
					'border-t border-border py-2 transition-[background-color,box-shadow] duration-150 ease-out first:border-t-0',
					phone && 'first:pt-1',
					tickable && ticked(change.id) && (phone ? 'bg-accent' : `bg-accent ${WIDE}`),
					change.undone && 'text-muted-foreground'
				]}
			>
				<svelte:element
					this={tickable ? 'label' : 'div'}
					class={[phone ? LINE : 'flex gap-2.5', tickable && 'cursor-pointer max-lg:min-h-11']}
				>
					{#if tickable}
						<!-- On the phone the box's 44 px target is raised to centre on the first line. -->
						<span class={phone ? '-mt-2 flex' : 'contents'}>
							<input
								type="checkbox"
								name="changeId"
								value={change.id}
								{form}
								checked={ticked(change.id)}
								onchange={(e) => onTick(change.id, e.currentTarget.checked)}
								class={box}
							/>
						</span>
					{/if}
					<span class={['flex min-w-0 flex-col gap-0.5', phone && 'col-start-2']}>
						<span class="text-pretty">
							<span class="font-semibold">{change.verb}</span>
							{keepArrows(change.subject)}
							{#if change.undone}<span class="ml-1 text-xs caps text-muted-foreground">Undone</span
								>{/if}
						</span>
						{#each change.fields as field, i (i)}
							<span class="break-words">
								{#if field.same && field.old === null && field.new === null}
									<!-- Both sides empty: one side, never "none → none" (call 8). -->
									<span class="text-muted-foreground">{field.name}:</span>
									{@render none()}
								{:else}
									<span class="text-muted-foreground"
										>{field.name}: {#if field.old === null}{@render none()}{:else}{field.old}{/if}</span
									>
									→ {#if field.new === null}{@render none()}{:else}{field.new}{/if}
								{/if}
								{#if field.same}<span class="text-muted-foreground">(same as shown)</span>{/if}
							</span>
						{/each}
					</span>
				</svelte:element>
			</li>
		{/each}
		{#if !batch.tickable}
			<li class={['border-t border-border py-2 text-muted-foreground', phone && LINE]}>
				<span class={phone ? 'col-start-2' : ''}
					>The first {batch.changes.length} of {batch.count} are listed. Too many to choose one by one:
					undo or redo the whole batch.</span
				>
			</li>
		{/if}
	</ul>
</div>
