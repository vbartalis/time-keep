export interface SignInThrottleOptions {
	maxFailures?: number;
	windowMs?: number;
	lockMs?: number;
	now?: () => number;
}

interface Entry {
	failures: number[];
	lockedAt: number | null;
}

/**
 * In-memory throttle keyed by (username, address). A pair is locked when
 * `maxFailures` failures fall within `windowMs`; the lock lasts `lockMs` from
 * the locking failure, after which the pair starts clean.
 */
export class SignInThrottle {
	private readonly maxFailures: number;
	private readonly windowMs: number;
	private readonly lockMs: number;
	private readonly now: () => number;
	private readonly entries = new Map<string, Entry>();
	private readonly pending = new Map<string, number>();

	constructor(opts: SignInThrottleOptions = {}) {
		this.maxFailures = opts.maxFailures ?? 5;
		this.windowMs = opts.windowMs ?? 15 * 60_000;
		this.lockMs = opts.lockMs ?? 15 * 60_000;
		this.now = opts.now ?? Date.now;
	}

	isLocked(username: string, address: string): boolean {
		return this.live(this.key(username, address))?.lockedAt != null;
	}

	/**
	 * Claims an attempt slot before the (slow) credential check, so parallel
	 * guesses count toward the limit. False when locked or when recorded failures
	 * plus in-flight attempts already reach the limit. Pair with `release`.
	 */
	acquire(username: string, address: string): boolean {
		const key = this.key(username, address);
		const entry = this.live(key);
		const inFlight = this.pending.get(key) ?? 0;
		if (entry?.lockedAt != null) return false;
		if ((entry?.failures.length ?? 0) + inFlight >= this.maxFailures) return false;
		this.pending.set(key, inFlight + 1);
		return true;
	}

	/** Frees a slot taken by `acquire`; call after recording the outcome. */
	release(username: string, address: string): void {
		const key = this.key(username, address);
		const n = (this.pending.get(key) ?? 0) - 1;
		if (n > 0) this.pending.set(key, n);
		else this.pending.delete(key);
	}

	recordFailure(username: string, address: string): void {
		const key = this.key(username, address);
		const entry = this.live(key) ?? { failures: [], lockedAt: null };
		if (entry.lockedAt != null) return;
		const now = this.now();
		entry.failures.push(now);
		if (entry.failures.length >= this.maxFailures) {
			entry.failures = [];
			entry.lockedAt = now;
		}
		this.entries.set(key, entry);
	}

	reset(username: string, address: string): void {
		this.entries.delete(this.key(username, address));
	}

	private key(username: string, address: string): string {
		return `${username}\0${address}`;
	}

	/** Returns the entry with expired data pruned; drops it when nothing is left. */
	private live(key: string): Entry | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		const now = this.now();
		if (entry.lockedAt != null && now - entry.lockedAt > this.lockMs) entry.lockedAt = null;
		entry.failures = entry.failures.filter((t) => now - t <= this.windowMs);
		if (entry.lockedAt == null && entry.failures.length === 0) {
			this.entries.delete(key);
			return undefined;
		}
		return entry;
	}
}

export const signInThrottle = new SignInThrottle();
