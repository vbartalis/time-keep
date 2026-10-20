/**
 * A row's post refused by its action (an entry changed or deleted elsewhere): shown on
 * the table, which renders no action result of another route's. Cleared by the next
 * navigation.
 */
export const rowRefusal = $state<{ error: string | null; reload: boolean }>({
	error: null,
	reload: false
});
