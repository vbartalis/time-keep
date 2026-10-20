export type View = 'day' | 'week' | 'month';

const DAY = 86_400_000;
const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const isDate = (text: string | null): text is string =>
	text !== null && /^\d{4}-\d{2}-\d{2}$/.test(text) && toDate(toMs(text)) === text;

export function readView(query: URLSearchParams, today: string): { view: View; date: string } {
	const v = query.get('view');
	const d = query.get('date');
	return {
		view: v === 'day' || v === 'week' || v === 'month' ? v : 'week',
		date: isDate(d) ? d : today
	};
}

export function addDays(date: string, n: number): string {
	return toDate(toMs(date) + n * DAY);
}

/** The Monday of the week containing `date`. */
export function weekStart(date: string): string {
	const dow = new Date(toMs(date)).getUTCDay();
	return addDays(date, -((dow + 6) % 7));
}

export function isoWeek(date: string): number {
	const thursday = addDays(weekStart(date), 3);
	const jan1 = `${thursday.slice(0, 4)}-01-01`;
	return Math.floor((toMs(thursday) - toMs(jan1)) / DAY / 7) + 1;
}

export function periodDays(view: View, date: string): string[] {
	if (view === 'day') return [date];
	if (view === 'week') {
		const start = weekStart(date);
		return Array.from({ length: 7 }, (_, i) => addDays(start, i));
	}
	const first = `${date.slice(0, 7)}-01`;
	const next = shift('month', first, 1);
	const start = weekStart(first);
	const end = addDays(weekStart(addDays(next, -1)), 6);
	const count = (toMs(end) - toMs(start)) / DAY + 1;
	return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function shift(view: View, date: string, n: number): string {
	if (view === 'day') return addDays(date, n);
	if (view === 'week') return addDays(date, n * 7);
	const [y, m, d] = date.split('-').map(Number);
	const index = y * 12 + (m - 1) + n;
	const year = Math.floor(index / 12);
	const month = index % 12;
	const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

const parts = (date: string) => {
	const [y, m, d] = date.split('-').map(Number);
	return { y, m: MONTHS[m - 1], d };
};

/**
 * The period's title and its sub-line. `long` is the PC's ("Wednesday 14 October 2026",
 * "Week 42"); `short` the phone's, one line at 390 px ("Wed 14 October", "12 – 18 Oct",
 * "October 2026"), its week number only on the week (the toolbar joins it to the total).
 */
export function periodTitle(
	view: View,
	date: string,
	form: 'long' | 'short' = 'long'
): { title: string; sub: string } {
	const short = form === 'short';
	const week = `Week ${isoWeek(date)}`;
	if (view === 'month') {
		const { y, m } = parts(date);
		return { title: `${m} ${y}`, sub: '' };
	}
	if (view === 'day') {
		const { y, m, d } = parts(date);
		const weekday = WEEKDAYS[new Date(toMs(date)).getUTCDay()];
		return short
			? { title: `${weekday.slice(0, 3)} ${d} ${m}`, sub: '' }
			: { title: `${weekday} ${d} ${m} ${y}`, sub: week };
	}
	const a = parts(weekStart(date));
	const b = parts(addDays(weekStart(date), 6));
	const mon = (m: string) => (short ? m.slice(0, 3) : m);
	let title: string;
	if (a.y !== b.y) title = `${a.d} ${mon(a.m)} ${a.y} – ${b.d} ${mon(b.m)} ${b.y}`;
	else if (a.m !== b.m) title = `${a.d} ${mon(a.m)} – ${b.d} ${mon(b.m)}${short ? '' : ` ${b.y}`}`;
	else title = `${a.d} – ${b.d} ${mon(b.m)}${short ? '' : ` ${b.y}`}`;
	return { title, sub: week };
}

/** A day as the week's and month's links name it: "Tuesday 13 October". */
export function dayName(date: string): string {
	const { m, d } = parts(date);
	return `${WEEKDAYS[new Date(toMs(date)).getUTCDay()]} ${d} ${m}`;
}

export function calendarHref(view: View, date: string): string {
	return `/calendar?view=${view}&date=${date}`;
}

/** Minutes as `h:mm`, exact: 1665 is `27:45`. */
export function hm(minutes: number): string {
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
