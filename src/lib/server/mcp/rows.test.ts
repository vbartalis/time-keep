import { describe, expect, it } from 'vitest';
import type { HistoryBatch } from '#lib/server/core/index.js';
import { agentRow, batchDetail, batchSummary, isoAt } from './rows';

describe('isoAt', () => {
	it('writes the instant with its zone’s offset, seconds always', () => {
		expect(isoAt(Date.parse('2026-10-19T07:00:00Z'), 'Europe/Budapest')).toBe(
			'2026-10-19T09:00:00+02:00'
		);
		expect(isoAt(0, 'UTC')).toBe('1970-01-01T00:00:00+00:00');
		expect(isoAt(Date.parse('2026-10-19T12:00:00Z'), 'Asia/Kolkata')).toMatch(/\+05:30$/);
	});

	it('follows daylight saving on either side of the change', () => {
		expect(isoAt(Date.parse('2026-10-25T00:30:00Z'), 'Europe/Budapest')).toBe(
			'2026-10-25T02:30:00+02:00'
		);
		expect(isoAt(Date.parse('2026-10-25T01:30:00Z'), 'Europe/Budapest')).toBe(
			'2026-10-25T02:30:00+01:00'
		);
	});
});

describe('agentRow', () => {
	it('drops the owner and name key and writes instants as ISO', () => {
		const row = agentRow({
			id: 'c1',
			userId: 'u1',
			name: 'Acme',
			nameKey: 'acme',
			archivedAt: null,
			version: 1,
			createdAt: 0,
			updatedAt: 1000
		});
		expect(row).toEqual({
			id: 'c1',
			name: 'Acme',
			archivedAt: null,
			version: 1,
			createdAt: '1970-01-01T00:00:00.000Z',
			updatedAt: '1970-01-01T00:00:01.000Z'
		});
	});

	it('writes an entry’s times in their own zones and keeps a running end null', () => {
		const start = Date.parse('2026-10-19T07:00:00Z');
		const running = agentRow({
			id: 'e1',
			startAt: start,
			startZone: 'Europe/Budapest',
			endAt: null,
			endZone: null
		});
		expect(running).toMatchObject({ startAt: '2026-10-19T09:00:00+02:00', endAt: null });
		const done = agentRow({
			id: 'e2',
			startAt: start,
			startZone: 'Europe/Budapest',
			endAt: start + 3_600_000,
			endZone: 'UTC'
		});
		expect(done).toMatchObject({ endAt: '2026-10-19T08:00:00+00:00' });
	});
});

const history: HistoryBatch = {
	id: 'b1',
	actor: 'agent',
	label: 'Create customer "Acme"',
	createdAt: 0,
	undone: false,
	undoneBy: null,
	changes: [
		{
			id: 'ch1',
			seq: 0,
			entity: 'customer',
			entityId: 'c1',
			op: 'create',
			before: null,
			after: { id: 'c1', userId: 'u1', name: 'Acme', nameKey: 'acme', createdAt: 0 },
			reverts: null,
			undone: true,
			undoneBy: 'b2'
		},
		{
			id: 'ch2',
			seq: 1,
			entity: 'customer',
			entityId: 'c2',
			op: 'create',
			before: null,
			after: { id: 'c2', userId: 'u1', name: 'Beta', nameKey: 'beta', createdAt: 0 },
			reverts: null,
			undone: false,
			undoneBy: null
		}
	]
};

describe('batchSummary and batchDetail', () => {
	it('summarises a batch without its changes', () => {
		expect(batchSummary(history)).toEqual({
			id: 'b1',
			label: 'Create customer "Acme"',
			actor: 'agent',
			createdAt: '1970-01-01T00:00:00.000Z',
			changeCount: 2,
			undoneChanges: 1,
			undone: false,
			undoneBy: null
		});
	});

	it('details the changes, their rows less the owner and name key', () => {
		const detail = batchDetail(history);
		expect(detail).toMatchObject(batchSummary(history));
		expect(detail.changes[0]).toEqual({
			id: 'ch1',
			entity: 'customer',
			entityId: 'c1',
			op: 'create',
			before: null,
			after: { id: 'c1', name: 'Acme', createdAt: 0 },
			undone: true,
			undoneBy: 'b2'
		});
	});
});
