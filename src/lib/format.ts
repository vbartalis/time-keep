/** Formatting shared by the server and the browser (nothing here may import the server). */

/** An elapsed time as `h:mm:ss`; `0:00:00` for a negative or non-finite one. */
export function formatElapsed(ms: number): string {
	const seconds = Number.isFinite(ms) ? Math.floor(Math.max(0, ms) / 1000) : 0;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

const WARNING_TEXT: Record<string, string> = {
	overlap: 'Overlaps another entry',
	long: 'Longer than 24 hours'
};

/** A core warning in the screen's words; an unknown code keeps the core's message. */
export const warningText = (w: { code: string; message: string }): string =>
	WARNING_TEXT[w.code] ?? w.message;

/** Whole minutes as `h:mm`. */
const hm = (minutes: number) =>
	`${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/** A template's fixed times: `09:00–17:30`, `09:00 + 0:45`, `0:45`, `09:00 –`; null when none. */
export function templateTimes(t: {
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number | null;
}): string | null {
	if (t.startTime !== null && t.endTime !== null) return `${t.startTime}–${t.endTime}`;
	if (t.startTime !== null && t.durationMinutes !== null) {
		return `${t.startTime} + ${hm(t.durationMinutes)}`;
	}
	if (t.durationMinutes !== null) return hm(t.durationMinutes);
	if (t.startTime !== null) return `${t.startTime} –`;
	return null;
}
