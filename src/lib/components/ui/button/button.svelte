<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	export const buttonVariants = tv({
		base: "focus-visible:ring-ring aria-invalid:ring-destructive/30 aria-invalid:border-destructive rounded-md border border-transparent bg-clip-padding text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-2 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 ease-out outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_18%)]',
				outline:
					'border-input bg-card text-foreground hover:border-foreground/60 hover:bg-accent aria-expanded:bg-accent',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)] aria-expanded:bg-secondary',
				ghost: 'hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent',
				destructive:
					'border-destructive/60 bg-card text-destructive hover:bg-destructive hover:text-primary-foreground focus-visible:ring-destructive',
				link: 'text-foreground underline decoration-input underline-offset-4 hover:decoration-foreground'
			},
			size: {
				default:
					'h-11 gap-1.5 px-4 lg:h-9 lg:px-3 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
				xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
				sm: 'h-9 gap-1 px-3 lg:h-8 lg:px-2.5',
				lg: 'h-12 gap-2 px-5 lg:h-10 lg:px-4',
				icon: 'size-11 lg:size-9',
				'icon-xs': "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
				'icon-sm': 'size-9 lg:size-8',
				'icon-lg': 'size-12 lg:size-10'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
