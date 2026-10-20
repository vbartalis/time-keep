import { describe, expect, it } from 'vitest';
import type { EntryItem, TemplateItem } from '../core/index';
import { restartInput, startFromTemplateInput } from './timer-actions';

const template = (fields: Partial<TemplateItem> = {}): TemplateItem =>
	({
		id: 't1',
		userId: 'u1',
		name: 'Support',
		nameKey: 'support',
		customerId: 'c1',
		projectId: 'p1',
		activityId: 'a1',
		locationId: 'l1',
		startTime: '09:00',
		endTime: '17:00',
		durationMinutes: null,
		timeZone: 'America/New_York',
		reference: 'TK-1',
		description: 'Daily support',
		version: 1,
		createdAt: 1,
		updatedAt: 1,
		customerName: 'CompX',
		projectName: 'Support',
		activityName: 'Dev',
		locationName: 'Office',
		...fields
	}) as TemplateItem;

const entry = (fields: Partial<EntryItem> = {}): EntryItem =>
	({
		id: 'e1',
		userId: 'u1',
		projectId: 'p1',
		activityId: 'a1',
		locationId: 'l1',
		startAt: Date.parse('2026-10-19T07:00:00Z'),
		startZone: 'Asia/Tokyo',
		endAt: Date.parse('2026-10-19T09:00:00Z'),
		endZone: 'Europe/Budapest',
		reference: 'TK-2',
		description: 'Fixing',
		version: 3,
		createdAt: 1,
		updatedAt: 1,
		projectName: 'Support',
		customerId: 'c1',
		customerName: 'CompX',
		activityName: 'Dev',
		locationName: 'Office',
		...fields
	}) as EntryItem;

describe('startFromTemplateInput', () => {
	it("starts now on the template's fields, in the given zone, ignoring its times", () => {
		expect(
			startFromTemplateInput(template({ durationMinutes: 60 }), undefined, 'Europe/Budapest')
		).toEqual({
			projectId: 'p1',
			activityId: 'a1',
			locationId: 'l1',
			reference: 'TK-1',
			description: 'Daily support',
			timeZone: 'Europe/Budapest'
		});
	});

	it("takes a typed description over the template's", () => {
		expect(startFromTemplateInput(template(), '  Call with X ', 'UTC').description).toBe(
			'Call with X'
		);
	});

	it("keeps the template's description when the typed one is blank", () => {
		expect(startFromTemplateInput(template(), '   ', 'UTC').description).toBe('Daily support');
	});

	it('leaves out what the template does not hold', () => {
		const input = startFromTemplateInput(
			template({ activityId: null, locationId: null, reference: null, description: null }),
			undefined,
			'UTC'
		);
		expect(input).toEqual({ projectId: 'p1', timeZone: 'UTC' });
		expect(input).not.toHaveProperty('start');
	});
});

describe('restartInput', () => {
	it("copies the entry's fields in its start zone, with no start", () => {
		const input = restartInput(entry());
		expect(input).toEqual({
			projectId: 'p1',
			activityId: 'a1',
			locationId: 'l1',
			reference: 'TK-2',
			description: 'Fixing',
			timeZone: 'Asia/Tokyo'
		});
		expect(input).not.toHaveProperty('start');
	});

	it('leaves out what the entry does not hold', () => {
		expect(
			restartInput(
				entry({ activityId: null, locationId: null, reference: null, description: null })
			)
		).toEqual({ projectId: 'p1', timeZone: 'Asia/Tokyo' });
	});
});
