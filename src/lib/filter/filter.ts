import { addDays, weekStart } from '#lib/calendar/dates.js';

export type Preset =
	'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month';

export const PRESETS: { preset: Preset; label: string }[] = [
	{ preset: 'today', label: 'Today' },
	{ preset: 'yesterday', label: 'Yesterday' },
	{ preset: 'this-week', label: 'This week' },
	{ preset: 'last-week', label: 'Last week' },
	{ preset: 'this-month', label: 'This month' },
	{ preset: 'last-month', label: 'Last month' }
];

/** `any` and a blank both mean "not set"; `none` is the rows without one; else an id. */
export type Pick = 'any' | 'none' | string;
export type Scope = { customer: string; project: string; activity: Pick; location: Pick };
export type Filter = Scope & { range: Preset | 'custom'; from: string; to: string; q: string };

const isPreset = (value: string | null | undefined): value is Preset =>
	PRESETS.some((p) => p.preset === value);

const isDate = (text: string) =>
	/^\d{4}-\d{2}-\d{2}$/.test(text) &&
	new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text;

const monthDays = (month: string) => {
	const [y, m] = month.split('-').map(Number);
	const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
	return { from: `${month}-01`, to: addDays(next, -1) };
};

const lastMonth = (today: string) => {
	const [y, m] = today.split('-').map(Number);
	const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
	return prev;
};

export function presetDays(preset: Preset, today: string): { from: string; to: string } {
	switch (preset) {
		case 'today':
			return { from: today, to: today };
		case 'yesterday': {
			const day = addDays(today, -1);
			return { from: day, to: day };
		}
		case 'this-week': {
			const from = weekStart(today);
			return { from, to: addDays(from, 6) };
		}
		case 'last-week': {
			const from = addDays(weekStart(today), -7);
			return { from, to: addDays(from, 6) };
		}
		case 'this-month':
			return monthDays(today.slice(0, 7));
		case 'last-month':
			return monthDays(lastMonth(today));
	}
}

/** The short ISO form shown beside a preset. */
export function presetHint(preset: Preset, today: string): string {
	const { from, to } = presetDays(preset, today);
	if (preset === 'this-month' || preset === 'last-month') return from.slice(0, 7);
	if (from === to) return from.slice(5);
	return `${from.slice(5)} – ${to.slice(5)}`;
}

const pick = (value: string | null): Pick => {
	const v = (value ?? '').trim();
	return v === 'any' ? '' : v;
};

/** The scope an address asks for, including the no-JS `scope=customer:<id>|project:<id>`. */
export function readScope(params: URLSearchParams): Scope {
	let customer = (params.get('customer') ?? '').trim();
	let project = (params.get('project') ?? '').trim();
	const combined = params.get('scope') ?? '';
	if (customer === '' && project === '') {
		if (combined.startsWith('customer:')) customer = combined.slice('customer:'.length).trim();
		else if (combined.startsWith('project:')) project = combined.slice('project:'.length).trim();
	}
	return {
		customer,
		project,
		activity: pick(params.get('activity')),
		location: pick(params.get('location'))
	};
}

/**
 * The filter an address asks for. `kept` is the cookie's preset; it is read only when
 * the address has no (known) `range`, and resolved against `today` every time.
 */
export function readFilter(
	params: URLSearchParams,
	kept: string | undefined,
	today: string
): { filter: Filter; error: string | null } {
	const asked = params.get('range');
	const scope = readScope(params);
	const q = (params.get('q') ?? '').trim();
	let error: string | null = null;
	if (asked === 'custom') {
		const from = (params.get('from') ?? '').trim();
		const to = (params.get('to') ?? '').trim();
		if ((from !== '' && !isDate(from)) || (to !== '' && !isDate(to))) {
			error = 'Use dates like 2026-10-01.';
		} else if (from !== '' && to !== '' && from > to) {
			error = 'From must not be after To.';
		}
		return { filter: { ...scope, range: 'custom', from, to, q }, error };
	}
	const range: Preset = isPreset(asked) ? asked : isPreset(kept) ? kept : 'this-month';
	return { filter: { ...scope, range, ...presetDays(range, today), q }, error };
}

/** The scope's set keys as a query string, in a fixed order. */
export function scopeQuery(scope: Scope): string {
	const out = new URLSearchParams();
	for (const key of ['customer', 'project', 'activity', 'location'] as const) {
		if (scope[key] !== '' && scope[key] !== 'any') out.set(key, scope[key]);
	}
	return out.toString().replace(/\+/g, '%20');
}

export function filterQuery(filter: Filter): string {
	const out = new URLSearchParams({ range: filter.range });
	if (filter.range === 'custom') {
		out.set('from', filter.from);
		out.set('to', filter.to);
	}
	const parts = [out.toString()];
	const scope = scopeQuery(filter);
	if (scope !== '') parts.push(scope);
	if (filter.q !== '') parts.push(new URLSearchParams({ q: filter.q }).toString());
	return parts.join('&');
}

/** The Filter button's "+n"; customer and project count once. */
export function scopeCount(scope: Scope): number {
	const set = (v: string) => v !== '' && v !== 'any';
	return (
		(set(scope.customer) || set(scope.project) ? 1 : 0) +
		(set(scope.activity) ? 1 : 0) +
		(set(scope.location) ? 1 : 0)
	);
}

export function rangeLabel(filter: Filter): string {
	if (filter.range !== 'custom') {
		return PRESETS.find((p) => p.preset === filter.range)?.label ?? 'This month';
	}
	if (filter.from !== '' && filter.to !== '') return `${filter.from} – ${filter.to}`;
	if (filter.from !== '') return `From ${filter.from}`;
	if (filter.to !== '') return `Until ${filter.to}`;
	return 'All time';
}

const matchesPick = (value: string | null, wanted: Pick) => {
	if (wanted === '' || wanted === 'any') return true;
	if (wanted === 'none') return value === null;
	return value === wanted;
};

export function matchesScope(
	e: {
		customerId: string;
		projectId: string;
		activityId: string | null;
		locationId: string | null;
	},
	scope: Scope
): boolean {
	return (
		(scope.customer === '' || e.customerId === scope.customer) &&
		(scope.project === '' || e.projectId === scope.project) &&
		matchesPick(e.activityId, scope.activity) &&
		matchesPick(e.locationId, scope.location)
	);
}
