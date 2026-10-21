import { describe, expect, it } from 'vitest';
import { barState } from './selection';

const labels: Record<string, string> = { a: 'Reword 5 entries', b: 'Edit 3 entries' };
const labelOf = (id: string) => labels[id] ?? '';

describe('barState', () => {
	it('two standing changes of one batch: Undo selected, named for the batch', () => {
		expect(
			barState(
				[
					{ id: 'c1', undone: false, batchId: 'a' },
					{ id: 'c2', undone: false, batchId: 'a' }
				],
				labelOf
			)
		).toEqual({
			count: 2,
			scope: 'of “Reword 5 entries”',
			canUndo: true,
			canRedo: false,
			mixed: false
		});
	});

	it('changes of two batches read "across 2 batches"', () => {
		const s = barState(
			[
				{ id: 'c1', undone: false, batchId: 'a' },
				{ id: 'c2', undone: false, batchId: 'b' },
				{ id: 'c3', undone: false, batchId: 'a' }
			],
			labelOf
		);
		expect(s.scope).toBe('across 2 batches');
		expect(s.count).toBe(3);
		expect(s.canUndo).toBe(true);
	});

	it('two undone changes: Redo selected only', () => {
		const s = barState(
			[
				{ id: 'c1', undone: true, batchId: 'a' },
				{ id: 'c2', undone: true, batchId: 'a' }
			],
			labelOf
		);
		expect(s).toMatchObject({ canUndo: false, canRedo: true, mixed: false });
	});

	it('one standing and one undone: both off, mixed', () => {
		const s = barState(
			[
				{ id: 'c1', undone: false, batchId: 'a' },
				{ id: 'c2', undone: true, batchId: 'b' }
			],
			labelOf
		);
		expect(s).toMatchObject({ count: 2, canUndo: false, canRedo: false, mixed: true });
	});

	it('nothing ticked: nothing to do, no scope', () => {
		expect(barState([], labelOf)).toEqual({
			count: 0,
			scope: '',
			canUndo: false,
			canRedo: false,
			mixed: false
		});
	});
});
