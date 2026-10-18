import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(import.meta.dirname, '../../..');
const CORE = path.join(SRC, 'lib/server/core');
const DB = path.join(SRC, 'lib/server/db');

function tsFiles(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.filter((f) => f.endsWith('.ts') && !/\.test\.ts$|\.spec\.ts$/.test(f))
		.map((f) => path.join(dir, f));
}

const inside = (dir: string, file: string) => file.startsWith(dir + path.sep);
const rel = (file: string) => path.relative(SRC, file);

/** `import { a, b as c } from '…/db/schema'` and `import type …` alike. */
const SCHEMA_IMPORT =
	/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]*db\/schema(?:\.js)?['"]/g;
const WRITE_IMPORT =
	/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]*core\/write(?:\.js)?['"]/g;

/** The original names of `{ a, type b, c as d }`. */
function importedNames(list: string): string[] {
	return list.split(',').map(
		(s) =>
			s
				.trim()
				.replace(/^type\s+/, '')
				.split(/\s+as\s+/)[0]
	);
}

/** Any import or export-from whose path goes into core/; captures what follows `core/`. */
const CORE_IMPORT = /(?:from|import)\s*\(?\s*['"][^'"]*\bcore(?:\/([^'"]*))?['"]/g;

const CORE_TABLES = new Set(['customer', 'project', 'activity', 'location', 'batch', 'change']);

/** A drizzle insert/update/delete on a handle named like a database or transaction, or raw SQL writes. */
const DRIZZLE_WRITE = /\b\w*(?:tx|db|Tx|Db|DB)\s*\.\s*(?:insert|update|delete)\s*\(/;
const RAW_WRITE = /\$client|sql`\s*(?:insert|update|delete|replace)\b/i;

describe('the write path guard', () => {
	it('keeps the core tables out of every module outside core/ and db/', () => {
		const offenders: string[] = [];
		for (const file of tsFiles(SRC)) {
			if (inside(CORE, file) || inside(DB, file)) continue;
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(SCHEMA_IMPORT)) {
				for (const n of importedNames(m[1]))
					if (CORE_TABLES.has(n)) offenders.push(`${rel(file)}: ${n}`);
			}
			if (/import\s+\*\s+as\s+\w+\s+from\s*['"][^'"]*db\/schema(?:\.js)?['"]/.test(text)) {
				offenders.push(`${rel(file)}: namespace import`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('keeps table and Writer from core/write out of every module outside core/', () => {
		const offenders: string[] = [];
		for (const file of tsFiles(SRC)) {
			if (inside(CORE, file)) continue;
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(WRITE_IMPORT)) {
				for (const n of importedNames(m[1])) {
					if (n === 'table' || n === 'Writer') offenders.push(`${rel(file)}: ${n}`);
				}
			}
			if (/import\s+\*\s+as\s+\w+\s+from\s*['"][^'"]*core\/write(?:\.js)?['"]/.test(text)) {
				offenders.push(`${rel(file)}: namespace import of core/write`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('lets modules outside core/ import only core/index', () => {
		const offenders: string[] = [];
		for (const file of tsFiles(SRC)) {
			if (inside(CORE, file)) continue;
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(CORE_IMPORT)) {
				if (!/^(?:index)?(?:\.js)?$/.test(m[1] ?? ''))
					offenders.push(`${rel(file)}: ${m[1] ?? ''}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('allows only write.ts in core/ to write tables', () => {
		const offenders = tsFiles(CORE)
			.filter((f) => path.basename(f) !== 'write.ts')
			.filter((f) => {
				const text = readFileSync(f, 'utf8');
				return DRIZZLE_WRITE.test(text) || RAW_WRITE.test(text);
			})
			.map(rel);
		expect(offenders).toEqual([]);
	});

	it('detects the patterns it guards against', () => {
		expect(DRIZZLE_WRITE.test('w.tx.insert(customer)')).toBe(true);
		expect(DRIZZLE_WRITE.test('db.delete(project)')).toBe(true);
		expect(DRIZZLE_WRITE.test("w.insert('customer', row)")).toBe(false);
		const imp = "import { user, customer as c } from '../db/schema';";
		expect([...imp.matchAll(SCHEMA_IMPORT)].length).toBe(1);
		const w = "import { table as t, type Row } from '$lib/server/core/write.js';";
		const sub = [
			"import { a } from '#lib/server/core/reference';",
			"import { a } from '$lib/server/core';",
			"import { a } from '../core/index.js';"
		].map((t) => [...t.matchAll(CORE_IMPORT)].map((m) => m[1] ?? ''));
		expect(sub).toEqual([['reference'], [''], ['index.js']]);
		expect([...w.matchAll(WRITE_IMPORT)].flatMap((m) => importedNames(m[1]))).toEqual([
			'table',
			'Row'
		]);
	});
});
