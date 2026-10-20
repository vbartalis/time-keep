<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const badgeVariants = tv({
		base: 'caps min-h-5 max-w-full gap-1 rounded-sm border px-1.5 py-px text-xs leading-4 transition-colors has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:size-3! group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive [&>svg]:pointer-events-none',
		variants: {
			variant: {
				default: 'border-foreground/70 text-foreground [a]:hover:bg-accent',
				live: 'border-primary/70 text-primary [a]:hover:bg-primary/10',
				spent: 'border-input text-muted-foreground line-through decoration-1',
				secondary:
					'border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
				destructive: 'border-destructive/70 text-destructive [a]:hover:bg-destructive/10',
				outline: 'border-input text-foreground [a]:hover:bg-accent',
				ghost: 'border-transparent hover:bg-accent',
				link: 'border-transparent text-foreground underline-offset-4 hover:underline'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = 'default',
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
