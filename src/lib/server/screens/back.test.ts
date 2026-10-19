import { describe, expect, it } from 'vitest';
import { safeBack } from './back';

describe('safeBack', () => {
	it.each(['/setup', '/templates/abc?x=1', '/'])('keeps %s', (value) => {
		expect(safeBack(value)).toBe(value);
	});
	it.each([
		'',
		null,
		undefined,
		'//evil.example',
		'/\\evil',
		'https://evil.example',
		'setup',
		'/\t/evil.example',
		'/a\r\nb',
		'/a\nb'
	])('falls back to / for %j', (value) => {
		expect(safeBack(value)).toBe('/');
	});
});
