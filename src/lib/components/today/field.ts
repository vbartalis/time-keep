import type { SubmitFunction } from '$app/forms';

/** A native select dressed like the Input control (card face, ink-stroke border). */
export const selectClass =
	'h-11 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-out outline-none hover:border-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 lg:h-9 lg:text-sm';

/** One ruled form line: label column and field column on the PC, stacked on the phone. */
export const line =
	'grid gap-2 border-b border-border py-3 lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-center lg:gap-x-4';

/**
 * `use:enhance` for the Today forms: a successful action redirects back to Today, and
 * the form it came from is cleared and its sheet closed, as a full reload would.
 */
export const clearOnDone: SubmitFunction =
	({ formElement }) =>
	async ({ result, update }) => {
		if (result.type === 'redirect') {
			formElement.reset();
			formElement.closest('details')?.removeAttribute('open');
		}
		await update();
	};
