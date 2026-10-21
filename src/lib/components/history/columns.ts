/**
 * The History table's columns from `lg`: Time, the chevron, What, By, Changes, State and
 * the actions. The header, the rows and the opened changes share them, so they line up.
 * From `lg` to `xl` Changes and State share one column (the state under the count), so
 * What keeps room for the customer › project of what a batch touched.
 */
export const COLS =
	'lg:grid lg:grid-cols-[2.75rem_0.75rem_minmax(0,1fr)_4rem_8rem_10.25rem] lg:gap-x-2 xl:gap-x-3 xl:grid-cols-[3.5rem_1rem_minmax(0,1fr)_6rem_7rem_10rem_11rem]';

/**
 * A wrapped line never starts with "›": the space before it does not break, so the
 * customer and its "›" stay on one line and the project may start the next.
 */
export const keepArrows = (text: string) => text.replaceAll(' › ', '\u00a0› ');
