/**
 * The time now, for the running block, the line at now and the totals: the server's
 * `initial` until mounted, then the device's clock, every 30 s while mounted. Call it
 * while a component initialises.
 */
export function nowTicker(initial: number): { readonly now: number } {
	let now = $state(initial);
	$effect(() => {
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});
	return {
		get now() {
			return now;
		}
	};
}
