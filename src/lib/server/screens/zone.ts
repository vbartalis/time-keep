import { isTimeZone, type Core } from '../core/index';

export const ZONE_COOKIE = 'tz';

export type ZoneSource = 'field' | 'cookie' | 'entry' | 'default';

/** The first valid IANA zone of the form field, the cookie and the latest entry, else UTC. */
export function resolveZone(input: {
	field?: string | null;
	cookie?: string | undefined;
	latestEntryZone?: string | null;
}): { zone: string; source: ZoneSource } {
	const candidates: [string | null | undefined, ZoneSource][] = [
		[input.field, 'field'],
		[input.cookie, 'cookie'],
		[input.latestEntryZone, 'entry']
	];
	for (const [zone, source] of candidates) {
		if (zone && isTimeZone(zone)) return { zone, source };
	}
	return { zone: 'UTC', source: 'default' };
}

const MONTH = 31 * 86_400_000;

/**
 * The zone for a request: the form field, then the `tz` cookie, then the zone of the
 * newest entry of the last month (read only when needed), else UTC.
 */
export function zoneFor(
	core: Core,
	input: { field?: string | null; cookie?: string | undefined },
	now: number
): { zone: string; source: ZoneSource } {
	const known = resolveZone(input);
	if (known.source !== 'default') return known;
	const recent = core.entries.list({ from: new Date(now - MONTH).toISOString() });
	return resolveZone({ latestEntryZone: recent.ok ? recent.value[0]?.startZone : null });
}
