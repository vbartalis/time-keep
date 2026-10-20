// Pure and import-free: shared by the entry form's browser script and the server actions.

export type Read<T> = { ok: true; value: T } | { ok: false; reason: string };

const pad = (n: number) => String(n).padStart(2, '0');
const good = <T>(value: T): Read<T> => ({ ok: true, value });
const bad = (reason: string): Read<never> => ({ ok: false, reason });

const NOT_A_TIME = 'Not a time. Type 9, 900, 9:00 or 1330.';
const NOT_A_TIME_OF_DAY = 'Not a time of day.';

function clock(hour: number, minute: number): Read<string> {
	if (hour > 23 || minute > 59) return bad(NOT_A_TIME_OF_DAY);
	return good(`${pad(hour)}:${pad(minute)}`);
}

export function readClock(text: string): Read<string> {
	const t = text.trim().toLowerCase();

	const meridiem = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(t);
	if (meridiem) {
		const hour = Number(meridiem[1]);
		const minute = Number(meridiem[2] ?? 0);
		if (hour < 1 || hour > 12 || minute > 59) return bad(NOT_A_TIME_OF_DAY);
		return clock((hour % 12) + (meridiem[3] === 'pm' ? 12 : 0), minute);
	}

	const hours = /^(\d{1,2})h?$/.exec(t);
	if (hours) return clock(Number(hours[1]), 0);

	const digits = /^(\d{1,2})(\d{2})$/.exec(t);
	if (digits) return clock(Number(digits[1]), Number(digits[2]));

	const split = /^(\d{1,2})([:.,])(\d{1,2})$/.exec(t);
	if (split) {
		const hour = Number(split[1]);
		if (split[3].length === 2) return clock(hour, Number(split[3]));
		if (split[2] === ':') return bad('Minutes take two digits, as in 9:05.');
		const d = split[3];
		return bad(`Type ${hour}:30 or ${hour}:0${d}.`);
	}

	return bad(NOT_A_TIME);
}

export function readDuration(text: string): Read<number> {
	const t = text.trim().toLowerCase();
	const notADuration = 'Not a duration. Type 5:30, 5.5, 5h30 or 90 (minutes).';
	let minutes: number;

	let m: RegExpExecArray | null;
	if ((m = /^(\d*):(\d+)$/.exec(t))) {
		minutes = Number(m[1] || 0) * 60 + Number(m[2]);
	} else if ((m = /^(\d+)[.,](\d+)$/.exec(t))) {
		minutes = Math.round(Number(`${m[1]}.${m[2]}`) * 60);
	} else if (t && (m = /^(?:(\d+)\s*h\s*)?(?:(\d+)\s*m?)?$/.exec(t))) {
		minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
	} else {
		return bad(notADuration);
	}

	if (minutes <= 0) return bad('A duration is more than zero.');
	return good(minutes);
}

export function readDate(text: string, today: string): Read<string> {
	const t = text.trim();
	const notADate = bad('Not a date. Type 2026-10-18, 20261018 or 10.18.');
	let year = Number(today.slice(0, 4));
	let month: number;
	let day: number;

	let m: RegExpExecArray | null;
	if (
		(m = /^(\d{4})[-./,](\d{1,2})[-./,](\d{1,2})$/.exec(t)) ||
		(m = /^(\d{4})(\d{2})(\d{2})$/.exec(t))
	) {
		year = Number(m[1]);
		month = Number(m[2]);
		day = Number(m[3]);
	} else if ((m = /^(\d{1,2})[-./,](\d{1,2})$/.exec(t)) || (m = /^(\d{2})(\d{2})$/.exec(t))) {
		month = Number(m[1]);
		day = Number(m[2]);
	} else {
		return notADate;
	}

	const real = new Date(Date.UTC(year, month - 1, day));
	if (
		real.getUTCFullYear() !== year ||
		real.getUTCMonth() !== month - 1 ||
		real.getUTCDate() !== day
	) {
		return notADate;
	}
	return good(`${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`);
}

export function durationText(minutes: number): string {
	return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

const toMinutes = (clockText: string) => {
	const [h, m] = clockText.split(':').map(Number);
	return h * 60 + m;
};

export function minutesBetween(start: string, end: string): number {
	const diff = toMinutes(end) - toMinutes(start);
	return diff <= 0 ? diff + 1440 : diff;
}

export function endAfter(start: string, minutes: number): { time: string; days: number } {
	const total = toMinutes(start) + minutes;
	const within = total % 1440;
	return {
		time: `${pad(Math.floor(within / 60))}:${pad(within % 60)}`,
		days: Math.floor(total / 1440)
	};
}
