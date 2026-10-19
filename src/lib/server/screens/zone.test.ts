import { describe, expect, it } from 'vitest';
import { resolveZone, zoneFor, ZONE_COOKIE } from './zone';

describe('resolveZone', () => {
	it('names the cookie', () => expect(ZONE_COOKIE).toBe('tz'));
	it('prefers the field, then the cookie, then the latest entry', () => {
		expect(
			resolveZone({ field: 'Asia/Tokyo', cookie: 'Europe/Budapest', latestEntryZone: 'UTC' })
		).toEqual({ zone: 'Asia/Tokyo', source: 'field' });
		expect(resolveZone({ cookie: 'Europe/Budapest', latestEntryZone: 'Asia/Tokyo' })).toEqual({
			zone: 'Europe/Budapest',
			source: 'cookie'
		});
		expect(resolveZone({ latestEntryZone: 'Asia/Tokyo' })).toEqual({
			zone: 'Asia/Tokyo',
			source: 'entry'
		});
	});
	it('skips invalid zones and falls back to UTC', () => {
		expect(resolveZone({ field: 'Nope/Zone', cookie: 'Europe/Budapest' }).source).toBe('cookie');
		expect(resolveZone({ field: '', cookie: 'x', latestEntryZone: null })).toEqual({
			zone: 'UTC',
			source: 'default'
		});
		expect(resolveZone({})).toEqual({ zone: 'UTC', source: 'default' });
	});
});

describe('zoneFor', () => {
	const DAY = 86_400_000;
	const core = (zones: string[]) => {
		const calls: unknown[] = [];
		return {
			calls,
			core: {
				entries: {
					list: (input: unknown) => {
						calls.push(input);
						return { ok: true, value: zones.map((startZone) => ({ startZone })) };
					}
				}
			} as never
		};
	};
	it('uses the field or the cookie without reading entries', () => {
		const c = core(['Asia/Tokyo']);
		expect(zoneFor(c.core, { field: 'UTC', cookie: 'Europe/Budapest' }, 0)).toEqual({
			zone: 'UTC',
			source: 'field'
		});
		expect(zoneFor(c.core, { cookie: 'Europe/Budapest' }, 0).source).toBe('cookie');
		expect(c.calls).toEqual([]);
	});
	it('falls back to the newest entry of the last month, then UTC', () => {
		const now = Date.parse('2026-10-18T12:00:00Z');
		const c = core(['Asia/Tokyo', 'UTC']);
		expect(zoneFor(c.core, {}, now)).toEqual({ zone: 'Asia/Tokyo', source: 'entry' });
		expect(c.calls).toEqual([{ from: new Date(now - 31 * DAY).toISOString() }]);
		expect(zoneFor(core([]).core, { cookie: 'bad' }, now)).toEqual({
			zone: 'UTC',
			source: 'default'
		});
	});
});
