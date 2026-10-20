import { describe, expect, it } from 'vitest';
import { drawnExtent, growInto, heightFor } from './block';

describe('drawnExtent', () => {
	it('keeps a block long enough for its text as it is', () => {
		expect(drawnExtent(600, 720, heightFor(1, 0), 44)).toEqual({ from: 600, to: 720 });
	});

	it('draws a short block a line tall, in whole minutes', () => {
		// 18 px at 44 px an hour is 24.5 minutes: 25.
		expect(drawnExtent(570, 585, heightFor(1, 0), 44)).toEqual({ from: 570, to: 595 });
	});

	it('keeps a short block at the end of the day inside it', () => {
		expect(drawnExtent(1435, 1440, heightFor(1, 0), 44)).toEqual({ from: 1415, to: 1440 });
	});

	it('never draws a fall-back day’s backwards piece backwards', () => {
		const d = drawnExtent(120, 60, heightFor(1, 0), 52);
		expect(d.to).toBeGreaterThan(d.from);
	});
});

describe('growInto', () => {
	it('grows a short block to the least height when the time after it is free', () => {
		expect(growInto([{ from: 570, to: 590 }], 48)).toEqual([{ from: 570, to: 618 }]);
	});

	it('stops at the next block, so none is pushed aside', () => {
		// The standup (09:30, drawn to 09:50) and development at 10:00.
		expect(
			growInto(
				[
					{ from: 570, to: 590 },
					{ from: 600, to: 720 }
				],
				48
			)
		).toEqual([
			{ from: 570, to: 600 },
			{ from: 600, to: 720 }
		]);
	});

	it('leaves blocks already meeting as they are, and never shrinks one', () => {
		const same = [
			{ from: 600, to: 620 },
			{ from: 600, to: 660 }
		];
		expect(growInto(same, 48)).toEqual(same);
		expect(growInto([{ from: 600, to: 700 }], 48)).toEqual([{ from: 600, to: 700 }]);
	});

	it('keeps a block at the end of the day inside it', () => {
		expect(growInto([{ from: 1420, to: 1440 }], 48)).toEqual([{ from: 1420, to: 1440 }]);
	});
});
