/** Pure helpers for the History screen: a change in words, a batch's state, headings, forms. */
import { localParts, type Core, type HistoryBatch, type HistoryChange } from '../core/index';
import { formatDate, formatHours, formatTime } from './today';

export type Names = {
	customers: Map<string, string>;
	projects: Map<string, { name: string; customerName: string }>;
	activities: Map<string, string>;
	locations: Map<string, string>;
};

export type ChangeLine = {
	id: string;
	verb: 'Created' | 'Changed' | 'Archived' | 'Unarchived' | 'Deleted';
	subject: string;
	fields: string[];
	undone: boolean;
};

export type BatchState = { state: 'standing' | 'undone' | 'partly'; undone: number; total: number };

type Row = Record<string, unknown>;
type Kind = 'text' | 'customer' | 'project' | 'activity' | 'location' | 'duration';

const MAX_SIDE = 80;
const MAX_IDS = 1000;
const UNKNOWN = '(unknown)';
const HIDDEN = new Set(['id', 'userId', 'version', 'createdAt', 'updatedAt', 'nameKey']);

const FIELDS: Record<string, [label: string, key: string, kind: Kind][]> = {
	customer: [['Name', 'name', 'text']],
	activity: [['Name', 'name', 'text']],
	location: [['Name', 'name', 'text']],
	project: [
		['Name', 'name', 'text'],
		['Customer', 'customerId', 'customer']
	],
	template: [
		['Name', 'name', 'text'],
		['Customer', 'customerId', 'customer'],
		['Project', 'projectId', 'project'],
		['Activity', 'activityId', 'activity'],
		['Location', 'locationId', 'location'],
		['Start', 'startTime', 'text'],
		['End', 'endTime', 'text'],
		['Duration', 'durationMinutes', 'duration'],
		['Time zone', 'timeZone', 'text'],
		['Reference', 'reference', 'text'],
		['Description', 'description', 'text']
	]
};

const ENTRY_BEFORE_TIMES: [string, string, Kind][] = [
	['Project', 'projectId', 'project'],
	['Activity', 'activityId', 'activity'],
	['Location', 'locationId', 'location']
];
const ENTRY_AFTER_TIMES: [string, string, Kind][] = [
	['Reference', 'reference', 'text'],
	['Description', 'description', 'text']
];

const norm = (value: unknown): unknown => (value === undefined ? null : value);
const differs = (before: Row, after: Row, key: string): boolean =>
	JSON.stringify(norm(before[key])) !== JSON.stringify(norm(after[key]));
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** Names of every customer, project, activity and location, archived ones included. */
export function namesFrom(core: Core): Names {
	const all = { includeArchived: true };
	const customers = new Map<string, string>();
	const projects = new Map<string, { name: string; customerName: string }>();
	const activities = new Map<string, string>();
	const locations = new Map<string, string>();
	const c = core.customers.list(all);
	if (c.ok) for (const r of c.value) customers.set(r.id, r.name);
	const p = core.projects.list(all);
	if (p.ok)
		for (const r of p.value) projects.set(r.id, { name: r.name, customerName: r.customerName });
	const a = core.activities.list(all);
	if (a.ok) for (const r of a.value) activities.set(r.id, r.name);
	const l = core.locations.list(all);
	if (l.ok) for (const r of l.value) locations.set(r.id, r.name);
	return { customers, projects, activities, locations };
}

const projectLabel = (id: unknown, names: Names): string => {
	const project = typeof id === 'string' ? names.projects.get(id) : undefined;
	return project ? `${project.customerName} › ${project.name}` : `${UNKNOWN} › ${UNKNOWN}`;
};

const lookup = (map: Map<string, string>, id: unknown): string =>
	(typeof id === 'string' ? map.get(id) : undefined) ?? UNKNOWN;

function subjectOf(entity: string, row: Row, names: Names): string {
	switch (entity) {
		case 'entry': {
			const at = num(row.startAt);
			const zone = str(row.startZone);
			const when =
				at === null || zone === null ? UNKNOWN : `${formatDate(at, zone)} ${formatTime(at, zone)}`;
			const endAt = num(row.endAt);
			const end = endAt === null ? 'running' : formatTime(endAt, str(row.endZone) ?? zone ?? 'UTC');
			return `Entry ${when}–${end}, ${projectLabel(row.projectId, names)}`;
		}
		case 'customer':
			return `Customer ${str(row.name) ?? UNKNOWN}`;
		case 'project': {
			const customer = lookup(names.customers, row.customerId);
			return `Project ${customer} › ${str(row.name) ?? UNKNOWN}`;
		}
		case 'activity':
			return `Activity ${str(row.name) ?? UNKNOWN}`;
		case 'location':
			return `Location ${str(row.name) ?? UNKNOWN}`;
		case 'template':
			return `Template ${str(row.name) ?? UNKNOWN}`;
		default:
			return entity;
	}
}

function show(value: unknown, kind: Kind, names: Names): string {
	if (value === null || value === undefined) return 'none';
	if (typeof value === 'string' && value.trim() === '') return 'none';
	let text: string;
	switch (kind) {
		case 'customer':
			text = lookup(names.customers, value);
			break;
		case 'project':
			text = projectLabel(value, names);
			break;
		case 'activity':
			text = lookup(names.activities, value);
			break;
		case 'location':
			text = lookup(names.locations, value);
			break;
		case 'duration':
			text = typeof value === 'number' ? formatHours(value * 60_000) : String(value);
			break;
		default:
			text = String(value);
	}
	return text.length > MAX_SIDE ? `${text.slice(0, MAX_SIDE)}…` : text;
}

/** One side of an entry's Start or End: the local date and time, with the zone when asked. */
function instant(at: number | null, zone: string | null, withZone: boolean): string {
	if (at === null || zone === null) return 'running';
	const text = `${formatDate(at, zone)} ${formatTime(at, zone)}`;
	return withZone ? `${text} ${zone}` : text;
}

function entryTimeField(label: string, atKey: string, zoneKey: string, before: Row, after: Row) {
	if (!differs(before, after, atKey) && !differs(before, after, zoneKey)) return null;
	const withZone =
		str(before[zoneKey]) !== null &&
		str(after[zoneKey]) !== null &&
		differs(before, after, zoneKey);
	const side = (row: Row) => instant(num(row[atKey]), str(row[zoneKey]), withZone);
	return `${label}: ${side(before)} → ${side(after)}`;
}

function fieldLines(entity: string, before: Row, after: Row, names: Names): string[] {
	const lines: string[] = [];
	const plain = ([label, key, kind]: [string, string, Kind]) => {
		if (differs(before, after, key))
			lines.push(`${label}: ${show(before[key], kind, names)} → ${show(after[key], kind, names)}`);
	};
	if (entity === 'entry') {
		ENTRY_BEFORE_TIMES.forEach(plain);
		for (const line of [
			entryTimeField('Start', 'startAt', 'startZone', before, after),
			entryTimeField('End', 'endAt', 'endZone', before, after)
		])
			if (line) lines.push(line);
		ENTRY_AFTER_TIMES.forEach(plain);
	} else {
		(FIELDS[entity] ?? []).forEach(plain);
	}
	if (
		differs(before, after, 'archivedAt') &&
		(before.archivedAt != null) !== (after.archivedAt != null)
	) {
		const was = before.archivedAt != null;
		lines.push(`Archived: ${was ? 'yes' : 'no'} → ${was ? 'no' : 'yes'}`);
	}
	return lines;
}

/** A change in words: a verb, a subject, and for an update the fields that differ. */
export function describeChange(change: HistoryChange, names: Names): ChangeLine {
	const named = change.after ?? change.before ?? {};
	const subject = subjectOf(change.entity, named, names);
	const base = { id: change.id, subject, undone: change.undone };
	switch (change.op) {
		case 'create':
			return { ...base, verb: 'Created', fields: [] };
		case 'delete':
			return { ...base, verb: 'Deleted', fields: [] };
		case 'archive':
			return { ...base, verb: 'Archived', fields: [] };
		case 'unarchive':
			return { ...base, verb: 'Unarchived', fields: [] };
	}
	const before = change.before ?? {};
	const after = change.after ?? {};
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	const differing = [...keys].filter((k) => !HIDDEN.has(k) && differs(before, after, k));
	if (differing.length === 1 && differing[0] === 'archivedAt') {
		const verb = before.archivedAt == null && after.archivedAt != null ? 'Archived' : 'Unarchived';
		return { ...base, verb, fields: [] };
	}
	return { ...base, verb: 'Changed', fields: fieldLines(change.entity, before, after, names) };
}

/** Whether a batch still stands, is wholly undone, or is partly undone. */
export function batchState(batch: HistoryBatch): BatchState {
	const total = batch.changes.length;
	const undone = batch.changes.filter((c) => c.undone).length;
	const state = undone === 0 ? 'standing' : undone === total ? 'undone' : 'partly';
	return { state, undone, total };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** `YYYY-MM-DD, Weekday` of an instant in a zone. */
export function dayHeading(at: number, zone: string): string {
	const { date } = localParts(at, zone);
	return `${date}, ${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}`;
}

/** Every posted `changeId`, deduped, within bounds. */
export function readChangeIds(form: FormData): { ids: string[]; error: string | null } {
	const ids = [
		...new Set(
			form.getAll('changeId').filter((v): v is string => typeof v === 'string' && v !== '')
		)
	];
	if (ids.length === 0) return { ids, error: 'Select at least one change.' };
	if (ids.length > MAX_IDS) return { ids, error: `Select at most ${MAX_IDS} changes.` };
	return { ids, error: null };
}

export const historyPath = (before: string | null): string =>
	before === null ? '/history' : `/history?before=${encodeURIComponent(before)}`;
