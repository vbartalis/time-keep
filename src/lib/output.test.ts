import { describe, expect, it } from 'vitest';
import { formatDuration, safeText, toCsv, toTsv, type OutputRow } from './output';

const row = (over: Partial<OutputRow> = {}): OutputRow => ({
	date: '2026-10-07',
	start: '09:00',
	end: '10:30',
	duration: '1:30',
	customer: 'Acme',
	project: 'Site',
	activity: 'Dev',
	location: '',
	reference: '',
	description: 'work',
	...over
});

describe('formatDuration', () => {
	it('writes h:mm', () => {
		expect(formatDuration(90, 'hm')).toBe('1:30');
		expect(formatDuration(0, 'hm')).toBe('0:00');
		expect(formatDuration(1500, 'hm')).toBe('25:00');
	});

	it('writes hundredths of an hour, rounded half up', () => {
		expect(formatDuration(90, 'decimal')).toBe('1.50');
		expect(formatDuration(5, 'decimal')).toBe('0.08');
		expect(formatDuration(20, 'decimal')).toBe('0.33');
		expect(formatDuration(0, 'decimal')).toBe('0.00');
	});
});

describe('safeText', () => {
	it.each(['=', '+', '-', '@', '\t', '\r'])('prefixes a value starting with %j', (c) => {
		expect(safeText(`${c}x`)).toBe(`'${c}x`);
	});

	it('leaves other values unchanged', () => {
		expect(safeText('5 - 3')).toBe('5 - 3');
		expect(safeText('')).toBe('');
	});
});

describe('toTsv', () => {
	it('flattens separators in a value and joins rows with CRLF, no header', () => {
		const out = toTsv([row({ description: 'a\tb\r\nc' })], ['date', 'description']);
		expect(out).toBe('2026-10-07\ta b  c');
	});

	it('has no trailing line break', () => {
		const out = toTsv([row(), row({ date: '2026-10-08' })], ['date', 'description']);
		expect(out).toBe('2026-10-07\twork\r\n2026-10-08\twork');
	});
});

describe('toTsv quotes', () => {
	const tsv = (description: string) => toTsv([row({ description })], ['date', 'description']);

	it('wraps a value that starts with a quote, doubling inner quotes', () => {
		expect(tsv('"ship it')).toBe('2026-10-07\t"""ship it"');
		expect(tsv('"Urgent" fix')).toBe('2026-10-07\t"""Urgent"" fix"');
	});

	it('leaves a mid-text quote alone', () => {
		expect(tsv('say "hi"')).toBe('2026-10-07\tsay "hi"');
	});
});

describe('toCsv', () => {
	const csv = (description: string) => toCsv([row({ description })], ['date', 'description']);

	it('starts with a byte-order mark and the header', () => {
		expect(csv('x').startsWith('\uFEFFDate,Description\r\n')).toBe(true);
	});

	it('quotes values holding a comma, a quote or a line break', () => {
		expect(csv('a,b')).toContain('"a,b"');
		expect(csv('say "hi"')).toContain('"say ""hi"""');
		expect(csv('line1\nline2')).toContain('"line1\nline2"');
	});

	it('ends every line with CRLF', () => {
		expect(csv('x')).toBe('\uFEFFDate,Description\r\n2026-10-07,x\r\n');
	});
});
