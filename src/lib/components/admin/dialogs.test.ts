import { describe, expect, it, vi } from 'vitest';
import { dialogSubmit, focusLost } from './dialogs';

vi.mock('$app/forms', () => ({ applyAction: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const el = (isConnected: boolean) => ({ isConnected }) as unknown as Element;

describe('focusLost', () => {
	it('is lost with no focus, on the body, or on an element gone from the page', () => {
		const body = el(true);
		expect(focusLost(null, body)).toBe(true);
		expect(focusLost(body, body)).toBe(true);
		expect(focusLost(el(false), body)).toBe(true);
	});

	it('is kept on an element in the page', () => {
		expect(focusLost(el(true), el(true))).toBe(false);
	});
});

/** Runs the factory's handler for a result, from a form in or out of the page. */
async function post(
	submit: ReturnType<typeof dialogSubmit>,
	type: 'success' | 'failure',
	connected = true,
	order: string[] = []
) {
	const handler = (await submit({
		formElement: { isConnected: connected }
	} as unknown as Parameters<typeof submit>[0])) as (opts: unknown) => Promise<void>;
	await handler({
		result: { type, status: type === 'success' ? 200 : 400 },
		update: async () => void order.push('update')
	});
	return order;
}

describe('dialogSubmit', () => {
	it('done: closes, updates, then runs done', async () => {
		const order: string[] = [];
		const submit = dialogSubmit({
			close: () => void order.push('close'),
			done: () => void order.push('done')
		});
		await post(submit, 'success', true, order);
		expect(order).toEqual(['close', 'update', 'done']);
	});

	it('refused: updates without closing', async () => {
		const close = vi.fn();
		const done = vi.fn();
		expect(await post(dialogSubmit({ close, done }), 'failure')).toEqual(['update']);
		expect(close).not.toHaveBeenCalled();
		expect(done).not.toHaveBeenCalled();
	});

	it('refused for a dialog closed meanwhile: nothing is brought back', async () => {
		expect(await post(dialogSubmit(), 'failure', false)).toEqual([]);
	});
});
