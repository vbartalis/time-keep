/** Writers for the copy-out screen: tab-separated text and CSV (nothing here may import the server). */

export const COLUMNS = [
	'date',
	'start',
	'end',
	'duration',
	'customer',
	'project',
	'activity',
	'location',
	'reference',
	'description'
] as const;

export type Column = (typeof COLUMNS)[number];

export const COLUMN_HEADS: Record<Column, string> = {
	date: 'Date',
	start: 'Start',
	end: 'End',
	duration: 'Duration',
	customer: 'Customer',
	project: 'Project',
	activity: 'Activity',
	location: 'Location',
	reference: 'Reference',
	description: 'Description'
};

export type DurationFormat = 'hm' | 'decimal';

/** Whole minutes as `h:mm`, or as hours to two decimals (hundredths rounded half up). */
export function formatDuration(minutes: number, format: DurationFormat): string {
	if (format === 'hm') {
		return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
	}
	const hundredths = Math.floor((minutes * 100 + 30) / 60);
	return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;
}

/** One row as written: every value text, already formula-safe. */
export type OutputRow = Record<Column, string>;

/** A value a spreadsheet would read as a formula gets a leading `'`. */
export function safeText(value: string): string {
	return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** A pasted value starting with `"` is read as a quoted field, so it is quoted whole. */
const tsvValue = (v: string) => {
	const flat = v.replace(/[\t\r\n]/g, ' ');
	return flat.startsWith('"') ? `"${flat.replace(/"/g, '""')}"` : flat;
};

/**
 * Rows as tab-separated lines (no header); tabs and line breaks inside a value become
 * spaces, and a value starting with a quote is wrapped in quotes (inner quotes doubled).
 */
export function toTsv(rows: OutputRow[], columns: Column[]): string {
	return rows.map((row) => columns.map((c) => tsvValue(row[c])).join('\t')).join('\r\n');
}

const csvValue = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Rows as CSV: a byte-order mark, a header line, then the rows, each line ending `\r\n`. */
export function toCsv(rows: OutputRow[], columns: Column[]): string {
	const lines = [
		columns.map((c) => csvValue(COLUMN_HEADS[c])),
		...rows.map((row) => columns.map((c) => csvValue(row[c])))
	];
	return '\uFEFF' + lines.map((l) => l.join(',') + '\r\n').join('');
}
