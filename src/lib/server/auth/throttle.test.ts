import { beforeEach, describe, expect, it } from 'vitest';
import { SignInThrottle } from './throttle';

const MIN = 60_000;

let clock: number;
let throttle: SignInThrottle;

function fail(times: number, user = 'ada', address = '1.1.1.1') {
	for (let i = 0; i < times; i++) throttle.recordFailure(user, address);
}

beforeEach(() => {
	clock = 1_700_000_000_000;
	throttle = new SignInThrottle({ now: () => clock });
});

describe('SignInThrottle', () => {
	it('is not locked after 4 failures', () => {
		fail(4);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
	});

	it('locks on the 5th failure', () => {
		fail(5);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(true);
	});

	it('does not lock the same username from another address', () => {
		fail(5);
		expect(throttle.isLocked('ada', '2.2.2.2')).toBe(false);
	});

	it('does not lock another username from the same address', () => {
		fail(5);
		expect(throttle.isLocked('bob', '1.1.1.1')).toBe(false);
	});

	it('unlocks 15 minutes and 1 ms after the locking failure, then starts clean', () => {
		fail(5);
		clock += 15 * MIN;
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(true);
		clock += 1;
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
		fail(4);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
		fail(1);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(true);
	});

	it('does not extend the lock with failures recorded while locked', () => {
		fail(5);
		clock += 10 * MIN;
		fail(3);
		clock += 5 * MIN + 1;
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
	});

	it('never locks when no 5 failures fall within 15 minutes', () => {
		for (let i = 0; i < 20; i++) {
			throttle.recordFailure('ada', '1.1.1.1');
			expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
			clock += 4 * MIN;
		}
	});

	it('locks when 5 failures fit within a window after older ones aged out', () => {
		fail(4);
		clock += 15 * MIN + 1;
		fail(4);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
		fail(1);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(true);
	});

	it('reset unlocks and clears failures', () => {
		fail(5);
		throttle.reset('ada', '1.1.1.1');
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
		fail(4);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
	});

	it('honours custom options', () => {
		throttle = new SignInThrottle({
			maxFailures: 2,
			windowMs: 1000,
			lockMs: 500,
			now: () => clock
		});
		fail(2);
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(true);
		clock += 501;
		expect(throttle.isLocked('ada', '1.1.1.1')).toBe(false);
	});
});
