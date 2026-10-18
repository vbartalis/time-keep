/**
 * Reference data commands: customers, projects, activities and locations. Commands take a
 * Writer (inside runBatch) and untrusted input; lists take any database handle.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db/index';
import { newId } from '../id';
import { nameKey, nameSchema } from './names';
import { fail, fromZod, ok, type CoreError, type Result } from './result';
import { registerRules, table, type Entity, type Row, type Tx, type Writer } from './write';

/** The reference data kinds. */
export type Kind = Exclude<Entity, 'entry'>;

/** A reference row as stored (camelCase columns). */
export type Named = {
	id: string;
	userId: string;
	name: string;
	nameKey: string;
	archivedAt: number | null;
	version: number;
	createdAt: number;
	updatedAt: number;
};
export type ProjectRow = Named & { customerId: string };
export type ProjectListItem = ProjectRow & { customerName: string };

const ARTICLE: Record<Kind, string> = {
	customer: 'A customer',
	project: 'A project',
	activity: 'An activity',
	location: 'A location'
};
const STALE = 'This was changed elsewhere; reload and try again.';
const CUSTOMER_ARCHIVED: CoreError = { code: 'archived', message: 'The customer is archived.' };

const customerOf = (tx: Tx, userId: string, id: string) => {
	const t = table('customer');
	return tx
		.select()
		.from(t)
		.where(and(eq(t.id, id), eq(t.userId, userId)))
		.get() as Named | undefined;
};

registerRules('project', [
	(tx, row) => {
		const customer = customerOf(tx, row.userId as string, row.customerId as string);
		if (!customer) return { code: 'not_found', message: 'The customer was not found.' };
		// An archived project may sit under an archived customer; an active one may not.
		if (customer.archivedAt !== null && row.archivedAt === null) return CUSTOMER_ARCHIVED;
		return null;
	}
]);

const createSchema = z.object({ name: nameSchema });
const projectSchema = z.object({ customerId: z.string().min(1), name: nameSchema });
const idSchema = z.object({ id: z.string().min(1), expectedVersion: z.number().int().optional() });
const renameSchema = idSchema.extend({ name: nameSchema });
const listSchema = z.object({ includeArchived: z.boolean().optional() });
const projectListSchema = listSchema.extend({ customerId: z.string().min(1).optional() });

function duplicate(kind: Kind): Result<never> {
	const message = `${ARTICLE[kind]} with this name already exists.`;
	return fail('conflict', message, { name: message });
}

/** The user's row of a kind by id, or undefined. */
function find(w: Writer, kind: Kind, id: string): Named | ProjectRow | undefined {
	const t = table(kind);
	return w.tx
		.select()
		.from(t)
		.where(and(eq(t.id, id), eq(t.userId, w.userId)))
		.get() as Named | ProjectRow | undefined;
}

/** Whether another row of the kind already has the key (per customer for projects). */
function taken(
	w: Writer,
	kind: Kind,
	key: string,
	customerId?: string,
	exceptId?: string
): boolean {
	const rows =
		kind === 'project'
			? w.tx
					.select()
					.from(table('project'))
					.where(
						and(eq(table('project').customerId, customerId!), eq(table('project').nameKey, key))
					)
					.all()
			: w.tx
					.select()
					.from(table(kind))
					.where(and(eq(table(kind).userId, w.userId), eq(table(kind).nameKey, key)))
					.all();
	return rows.some((r) => r.id !== exceptId);
}

function createNamed(w: Writer, kind: Exclude<Kind, 'project'>, input: unknown): Result<Named> {
	const parsed = createSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const { name } = parsed.data;
	const key = nameKey(name);
	if (taken(w, kind, key)) return duplicate(kind);
	return ok(
		w.insert(kind, { id: newId(), name, nameKey: key, archivedAt: null }) as unknown as Named
	);
}

export const createCustomer = (w: Writer, input: unknown) => createNamed(w, 'customer', input);
export const createActivity = (w: Writer, input: unknown) => createNamed(w, 'activity', input);
export const createLocation = (w: Writer, input: unknown) => createNamed(w, 'location', input);

export function createProject(w: Writer, input: unknown): Result<ProjectRow> {
	const parsed = projectSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const { customerId, name } = parsed.data;
	const customer = customerOf(w.tx, w.userId, customerId);
	if (!customer) return fail('not_found', 'The customer was not found.');
	if (customer.archivedAt !== null) return { ok: false, error: CUSTOMER_ARCHIVED };
	const key = nameKey(name);
	if (taken(w, 'project', key, customerId)) return duplicate('project');
	return ok(
		w.insert('project', {
			id: newId(),
			customerId,
			name,
			nameKey: key,
			archivedAt: null
		}) as unknown as ProjectRow
	);
}

/** Finds the row and checks the caller's expected version; shared by rename/archive/unarchive. */
function load(
	w: Writer,
	kind: Kind,
	id: string,
	expectedVersion: number | undefined
): Result<Named | ProjectRow> {
	const row = find(w, kind, id);
	if (!row) return fail('not_found', 'Not found.');
	if (expectedVersion !== undefined && row.version !== expectedVersion) {
		return fail('conflict', STALE);
	}
	return ok(row);
}

export function rename(w: Writer, kind: Kind, input: unknown): Result<Named | ProjectRow> {
	const parsed = renameSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const { id, name, expectedVersion } = parsed.data;
	const loaded = load(w, kind, id, expectedVersion);
	if (!loaded.ok) return loaded;
	const row = loaded.value;
	const key = nameKey(name);
	const customerId = kind === 'project' ? (row as ProjectRow).customerId : undefined;
	if (taken(w, kind, key, customerId, id)) return duplicate(kind);
	const after = w.update(kind, id, { name, nameKey: key });
	return ok((after ?? row) as unknown as Named);
}

function setArchived(
	w: Writer,
	kind: Kind,
	input: unknown,
	archiving: boolean
): Result<Named | ProjectRow> {
	const parsed = idSchema.safeParse(input);
	if (!parsed.success) return fromZod(parsed.error);
	const { id, expectedVersion } = parsed.data;
	const loaded = load(w, kind, id, expectedVersion);
	if (!loaded.ok) return loaded;
	const row = loaded.value;
	if ((row.archivedAt !== null) === archiving) return ok(row);
	if (!archiving && kind === 'project') {
		const customer = customerOf(w.tx, w.userId, (row as ProjectRow).customerId);
		if (customer?.archivedAt != null) return { ok: false, error: CUSTOMER_ARCHIVED };
	}
	const patch: Row = { archivedAt: archiving ? w.now : null };
	const after = w.update(kind, id, patch, archiving ? 'archive' : 'unarchive');
	return ok((after ?? row) as unknown as Named);
}

export const archive = (w: Writer, kind: Kind, input: unknown) => setArchived(w, kind, input, true);
export const unarchive = (w: Writer, kind: Kind, input: unknown) =>
	setArchived(w, kind, input, false);

type Handle = Tx | DB;

function listNamed(
	kind: Exclude<Kind, 'project'>,
	db: Handle,
	userId: string,
	input: unknown
): Result<Named[]> {
	const parsed = listSchema.safeParse(input ?? {});
	if (!parsed.success) return fromZod(parsed.error);
	const t = table(kind);
	const rows = db
		.select()
		.from(t)
		.where(
			and(eq(t.userId, userId), parsed.data.includeArchived ? undefined : isNull(t.archivedAt))
		)
		.all() as Named[];
	return ok(sortByName(rows));
}

/** Sorts lists for people: accents and case ignored, numbers in order. */
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const sortByName = <T extends { name: string }>(rows: T[]): T[] =>
	rows.sort((a, b) => collator.compare(a.name, b.name));

export const listCustomers = (db: Handle, userId: string, input?: unknown) =>
	listNamed('customer', db, userId, input);
export const listActivities = (db: Handle, userId: string, input?: unknown) =>
	listNamed('activity', db, userId, input);
export const listLocations = (db: Handle, userId: string, input?: unknown) =>
	listNamed('location', db, userId, input);

export function listProjects(
	db: Handle,
	userId: string,
	input?: unknown
): Result<ProjectListItem[]> {
	const parsed = projectListSchema.safeParse(input ?? {});
	if (!parsed.success) return fromZod(parsed.error);
	const { includeArchived, customerId } = parsed.data;
	const p = table('project');
	const c = table('customer');
	const rows = db
		.select({ project: p, customerName: c.name, customerArchivedAt: c.archivedAt })
		.from(p)
		.innerJoin(c, eq(c.id, p.customerId))
		.where(and(eq(p.userId, userId), customerId ? eq(p.customerId, customerId) : undefined))
		.all()
		.filter(
			(r) => includeArchived || (r.project.archivedAt === null && r.customerArchivedAt === null)
		)
		.map((r) => ({ ...r.project, customerName: r.customerName }) as ProjectListItem);
	// Group by customer, then project, both by name.
	return ok(
		rows.sort(
			(a, b) => collator.compare(a.customerName, b.customerName) || collator.compare(a.name, b.name)
		)
	);
}
