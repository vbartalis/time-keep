import { describe, expect, it } from 'vitest';
import { formFailure, fromTemplateInput, groupProjects, startInput } from './actions';

const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};

type T = { timeZone: string | null; startTime: string | null; endTime: string | null };
const zoned: T = { timeZone: 'Europe/Budapest', startTime: '09:00', endTime: null };
const unzoned: T = { timeZone: null, startTime: null, endTime: null };
const overnight: T = { timeZone: 'Europe/Budapest', startTime: '22:00', endTime: '06:00' };
const ctx = (template: T, nowTime = '12:00') => ({
	zone: 'Asia/Tokyo',
	today: '2026-10-18',
	nowTime,
	template
});

describe('fromTemplateInput', () => {
	it('sends only the template and the typed description', () => {
		expect(
			fromTemplateInput(form({ templateId: 't1', description: '  Fixed the build ' }), ctx(zoned))
		).toEqual({ templateId: 't1', description: 'Fixed the build' });
	});
	it('omits blank optional fields', () => {
		const f = form({
			templateId: 't1',
			description: ' ',
			reference: '',
			projectId: '',
			date: '',
			start: '',
			end: '',
			durationMinutes: ''
		});
		expect(fromTemplateInput(f, ctx(zoned))).toEqual({ templateId: 't1' });
	});
	it('adds the device zone only when the template has none', () => {
		expect(fromTemplateInput(form({ templateId: 't1' }), ctx(unzoned))).toEqual({
			templateId: 't1',
			timeZone: 'Asia/Tokyo'
		});
	});
	it('passes the picked project and the reference', () => {
		expect(
			fromTemplateInput(form({ templateId: 't1', projectId: 'p2', reference: 'T-1' }), ctx(zoned))
		).toEqual({ templateId: 't1', projectId: 'p2', reference: 'T-1' });
	});
	it('passes a date alone for the template start time to use', () => {
		expect(fromTemplateInput(form({ templateId: 't1', date: '2026-10-16' }), ctx(zoned))).toEqual({
			templateId: 't1',
			date: '2026-10-16'
		});
	});
	it('reads changed times as local times on the date, today by default', () => {
		expect(
			fromTemplateInput(form({ templateId: 't1', start: '08:15', end: '10:00' }), ctx(zoned))
		).toEqual({ templateId: 't1', start: '2026-10-18T08:15', end: '2026-10-18T10:00' });
		expect(
			fromTemplateInput(form({ templateId: 't1', date: '2026-10-16', start: '08:15' }), ctx(zoned))
		).toEqual({ templateId: 't1', start: '2026-10-16T08:15' });
	});
	it('puts an end not after the start on the next day', () => {
		expect(
			fromTemplateInput(form({ templateId: 't1', start: '22:00', end: '06:00' }), ctx(zoned))
		).toEqual({ templateId: 't1', start: '2026-10-18T22:00', end: '2026-10-19T06:00' });
		// The template's start time counts when none is typed, and is sent with the end.
		expect(fromTemplateInput(form({ templateId: 't1', end: '08:00' }), ctx(zoned))).toEqual({
			templateId: 't1',
			start: '2026-10-18T09:00',
			end: '2026-10-19T08:00'
		});
		expect(fromTemplateInput(form({ templateId: 't1', end: '08:00' }), ctx(unzoned))).toEqual({
			templateId: 't1',
			timeZone: 'Asia/Tokyo',
			end: '2026-10-18T08:00'
		});
	});
	it('sends the template start beside a typed end on a same-day template', () => {
		const sameDay: T = { timeZone: 'Europe/Budapest', startTime: '09:00', endTime: '17:00' };
		expect(fromTemplateInput(form({ templateId: 't1', end: '12:30' }), ctx(sameDay))).toEqual({
			templateId: 't1',
			start: '2026-10-18T09:00',
			end: '2026-10-18T12:30'
		});
		expect(
			fromTemplateInput(
				form({ templateId: 't1', date: '2026-10-16', end: '12:30' }),
				ctx(sameDay, '08:00')
			)
		).toEqual({ templateId: 't1', start: '2026-10-16T09:00', end: '2026-10-16T12:30' });
	});
	it('starts an overnight template last night when tapped before tonight’s start', () => {
		// 22:00–06:00 tapped at 05:00 with the end changed to 05:30: last night's shift.
		expect(
			fromTemplateInput(form({ templateId: 't1', end: '05:30' }), ctx(overnight, '05:00'))
		).toEqual({ templateId: 't1', start: '2026-10-17T22:00', end: '2026-10-18T05:30' });
		// At 23:00 tonight's shift has begun.
		expect(
			fromTemplateInput(form({ templateId: 't1', end: '05:30' }), ctx(overnight, '23:00'))
		).toEqual({ templateId: 't1', start: '2026-10-18T22:00', end: '2026-10-19T05:30' });
	});
	it('sends a duration as a number, and leaves a bad one for the core to refuse', () => {
		expect(
			fromTemplateInput(form({ templateId: 't1', durationMinutes: '45' }), ctx(zoned))
		).toEqual({ templateId: 't1', durationMinutes: 45 });
		expect(
			fromTemplateInput(form({ templateId: 't1', durationMinutes: 'abc' }), ctx(zoned))
		).toEqual({ templateId: 't1', durationMinutes: 'abc' });
	});
});

describe('startInput', () => {
	it('starts on the project in the zone with an optional description', () => {
		expect(startInput(form({ projectId: 'p1', description: ' Call ' }), 'UTC')).toEqual({
			projectId: 'p1',
			timeZone: 'UTC',
			description: 'Call'
		});
		expect(startInput(form({ projectId: '', description: '' }), 'UTC')).toEqual({
			projectId: '',
			timeZone: 'UTC'
		});
	});
});

describe('formFailure', () => {
	it('keeps errors on shown fields and folds the rest into the message', () => {
		expect(
			formFailure(
				{
					code: 'invalid',
					message: 'The input is not valid.',
					fields: { description: 'Too long.', start: 'That time does not exist.' }
				},
				['description']
			)
		).toEqual({ error: 'That time does not exist.', fields: { description: 'Too long.' } });
	});
	it('uses the core message when every field error is shown, or there are none', () => {
		expect(
			formFailure({ code: 'invalid', message: 'Bad.', fields: { projectId: 'Pick a project.' } }, [
				'projectId'
			])
		).toEqual({ error: 'Bad.', fields: { projectId: 'Pick a project.' } });
		expect(formFailure({ code: 'conflict', message: 'Stopped already.' }, [])).toEqual({
			error: 'Stopped already.',
			fields: {}
		});
	});
});

describe('groupProjects', () => {
	it('groups projects under their customers, customers by name', () => {
		const p = (id: string, name: string, customerId: string, customerName: string) =>
			({ id, name, customerId, customerName }) as never;
		expect(
			groupProjects([
				p('1', 'Alpha', 'c2', 'Zeta'),
				p('2', 'Beta', 'c1', 'acme'),
				p('3', 'Gamma', 'c2', 'Zeta')
			])
		).toEqual([
			{ customerId: 'c1', customerName: 'acme', projects: [{ id: '2', name: 'Beta' }] },
			{
				customerId: 'c2',
				customerName: 'Zeta',
				projects: [
					{ id: '1', name: 'Alpha' },
					{ id: '3', name: 'Gamma' }
				]
			}
		]);
	});
});
