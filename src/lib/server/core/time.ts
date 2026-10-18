const FORMAT_MESSAGE = 'Use a date and time like 2026-10-18T09:00.';

const PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/;

export type ParsedTime = { ok: true; at: number } | { ok: false; message: string };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
	let f = formatters.get(zone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric'
		});
		formatters.set(zone, f);
	}
	return f;
}

export function isTimeZone(name: string): boolean {
	if (!name) return false;
	try {
		formatterFor(name);
		return true;
	} catch {
		return false;
	}
}

/** The zone's wall-clock fields at an instant, read back as if they were UTC. */
function wallAsUtc(instant: number, zone: string): number {
	const p: Record<string, number> = {};
	for (const part of formatterFor(zone).formatToParts(new Date(instant))) {
		if (part.type !== 'literal') p[part.type] = Number(part.value);
	}
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

const DAY = 24 * 60 * 60 * 1000;

function localToInstant(wall: number, zone: string, millis: number): number | null {
	// Offsets a day either side bracket any single transition near the wall time.
	const offsets = new Set<number>();
	for (const probe of [wall - DAY, wall, wall + DAY]) {
		offsets.add(wallAsUtc(probe, zone) - probe);
	}
	const valid: number[] = [];
	for (const offset of offsets) {
		const candidate = wall - offset;
		if (wallAsUtc(candidate, zone) === wall) valid.push(candidate);
	}
	if (valid.length === 0) return null;
	return Math.min(...valid) + millis;
}

export function parseTime(text: string, zone: string): ParsedTime {
	const bad: ParsedTime = { ok: false, message: FORMAT_MESSAGE };
	const m = PATTERN.exec(text);
	if (!m) return bad;
	const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
	const second = m[6] === undefined ? 0 : Number(m[6]);
	const millis = m[7] === undefined ? 0 : Number(m[7].padEnd(3, '0'));
	if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return bad;
	const wall = Date.UTC(year, month - 1, day, hour, minute, second);
	if (new Date(wall).getUTCDate() !== day) return bad;

	const tz = m[8];
	if (tz === 'Z') return { ok: true, at: wall + millis };
	if (tz) {
		const sign = tz[0] === '-' ? -1 : 1;
		const oh = Number(tz.slice(1, 3));
		const om = Number(tz.slice(4, 6));
		if (oh > 23 || om > 59) return bad;
		return { ok: true, at: wall + millis - sign * (oh * 60 + om) * 60_000 };
	}

	const at = localToInstant(wall, zone, millis);
	if (at === null) return { ok: false, message: `That time does not exist in ${zone}.` };
	return { ok: true, at };
}
