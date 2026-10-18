# Core Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The core API in `src/lib/server/core/`: one recording write path with batches, undo (whole batches or chosen changes), history, and customers, projects, activities and locations as its first users.

**Architecture:** `openCore(db, userId, actor)` returns a per-user API of synchronous commands taking `input: unknown`, validated with zod, returning a uniform result. Every command runs inside a batch; all table writes go through `core/write.ts`, which records a change row (whole-row before/after JSON, shape version), bumps the row's `version`, and runs the entity's registered rules. Undo writes a new batch of reverting changes after per-row conflict checks.

**Tech Stack:** TypeScript, Drizzle ORM on better-sqlite3 (synchronous transactions), zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-core-write-path-design.md`

## Global Constraints

- SvelteKit 3.1 app; imports use `#lib/...` with explicit file paths (no directory imports). Vitest tests never import `$app/*`.
- Ids: `newId()` from `src/lib/server/id.ts` (26-char base32). Times: integer ms since epoch (`number`). Tests pass `now` explicitly where time matters.
- Commands are synchronous; never `await` inside `db.transaction`.
- Result shape: `{ ok: true; value: T; warnings: Warning[] } | { ok: false; error: CoreError }`; `CoreError = { code: 'invalid' | 'not_found' | 'conflict' | 'archived'; message: string; fields?: Record<string, string> }`; `Warning = { code: string; message: string }`.
- Another user's ids → `not_found`.
- Names: trimmed, 1–100 characters; `name_key = name.normalize('NFC').toLowerCase()`; unique per owner on `name_key`, archived rows included.
- Every mutable row has `version` (integer, starts at 1, +1 per write). Commands changing an existing row accept optional `expectedVersion`; mismatch → `conflict`.
- Shape versions start at 1 for every entity.
- Never run docker; never git push. Conventional Commits, no scope, no AI attribution.

## Review Focus

1. **Undo of a single change whose row a later batch touched** is refused with `conflict` naming the later batch, and writes nothing — Task 4.
2. **A command failing halfway through a batch** leaves no batch row, no change rows and no table writes — Task 2.
3. **Renaming to the same name, or archiving an archived row,** stores no batch at all — Task 2 (empty batch) and Task 3.
4. **Two names differing only by non-ASCII case** (`Ügyfél`/`ügyfél`) collide — Task 3.
5. **Redo of an undo** restores the state after the original change, and the original shows as not undone again — Task 4.

---

### Task 1: Tables, migration, results and names

**Files:**
- Modify: `src/lib/server/db/schema.ts` (add tables), `package.json` (add `zod`)
- Create: `src/lib/server/core/result.ts`, `src/lib/server/core/names.ts`, `src/lib/server/core/names.test.ts`, `src/lib/server/core/schema.test.ts`, a new migration under `drizzle/`

**Interfaces:**
- Produces (schema.ts):
  - `batch`: `id` pk, `userId` → user, `actor` text (`'ui' | 'agent' | 'system'`), `label` text, `createdAt` int; index `(user_id, created_at)`.
  - `change`: `id` pk, `batchId` → batch, `seq` int, `entity` text, `entityId` text, `op` text (`create|update|archive|unarchive|delete`), `before` text nullable (JSON), `after` text nullable (JSON), `shape` int, `reverts` text nullable → change.id; indexes `(batch_id, seq)`, `(entity, entity_id)`, `(reverts)`.
  - `customer`, `activity`, `location`: `id` pk, `userId` → user, `name`, `nameKey` → `name_key`, `archivedAt` nullable, `version` int not null, `createdAt`, `updatedAt`; unique `(user_id, name_key)`.
  - `project`: as above plus `customerId` → customer (not null); unique `(customer_id, name_key)`; index `user_id`.
  - Types `Batch`, `Change`, `Customer`, `Project`, `Activity`, `Location` (`$inferSelect`).
- Produces (result.ts): types `Warning`, `CoreError`, `Result<T>`; helpers `ok<T>(value: T, warnings?: Warning[]): Result<T>`, `fail(code, message, fields?): Result<never>`; `fromZod(error: ZodError): Result<never>` → `invalid` with `fields` keyed by the first path segment.
- Produces (names.ts): `nameSchema` (zod: string, trimmed, 1–100 chars, message `Name must be 1–100 characters.`); `nameKey(name: string): string`.

- [ ] **Step 1: Write failing tests** — `names.test.ts`: `nameKey('Ügyfél') === nameKey('ügyfél')`; a decomposed and a precomposed `é` give the same key (NFC); `nameSchema.parse('  A  ') === 'A'`; empty and 101 chars fail with the message. `schema.test.ts` (on `createTestDb()`): the six tables exist; inserting two customers with the same `name_key` for one user throws; the same key for two users is allowed; two projects with one key under one customer throws, under two customers is allowed; a project with an unknown `customer_id` throws.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/server/core`
- [ ] **Step 3: Implement**; `npm i zod`; `npx drizzle-kit generate --name core`. Expected: one new migration file; `drizzle-kit generate` again reports no changes.
- [ ] **Step 4: Run, expect PASS**; then `npm run check && npm run lint && npx vitest run`
- [ ] **Step 5: Commit** — `git commit -m "feat: add the core tables and result types"`

---

### Task 2: The write path and batches

**Files:**
- Create: `src/lib/server/core/write.ts`, `src/lib/server/core/batch.ts`, `src/lib/server/core/write.test.ts`, `src/lib/server/core/guard.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces (`write.ts`):
  - `type Entity = 'customer' | 'project' | 'activity' | 'location'` (2b/2c extend it).
  - `SHAPES: Record<Entity, number>`, all 1.
  - `type Tx` = the drizzle transaction type; functions accept `Tx | DB`.
  - `type Rule = (tx: Tx, row: Record<string, unknown>) => CoreError | null`; `registerRules(entity: Entity, rules: Rule[]): void`.
  - Read helpers so command modules never import the tables: `table(entity)` returning the drizzle table for queries, used only inside `core/` (or equivalent typed accessors).
  - `class Writer { constructor(tx: Tx, batchId: string, userId: string, now: number); insert(entity, row): Row; update(entity, id, patch, op?: 'update' | 'archive' | 'unarchive'): Row | null; restore(entity, id, before: Row | null, reverts: string): void; readonly tx: Tx; readonly now: number; readonly changeCount: number }` — `insert` sets `version: 1` and `createdAt`/`updatedAt: now`; `update` returns null and records nothing when the patch changes no column, otherwise bumps `version` and sets `updatedAt`; every write records a `change` with the next `seq`, whole-row `before`/`after` JSON and `shape: SHAPES[entity]`, then runs that entity's rules on the resulting row and throws `CoreFailure` on the first violation. `restore` writes `before` back (insert when the row is absent, update to exactly the stored columns, or delete when `before` is null) and records op `create`, `update` or `delete` with `reverts` set.
  - `class CoreFailure extends Error { constructor(public error: CoreError) }`.
- Produces (`batch.ts`): `type Actor = 'ui' | 'agent' | 'system'`; `runBatch<T>(db: DB, userId: string, actor: Actor, label: string, fn: (w: Writer) => Result<T>, now?: number): Result<T>` — one `db.transaction`; creates the batch row; runs `fn`; a returned failure or a thrown `CoreFailure` rolls back and returns the failure; SQLite `SQLITE_CONSTRAINT_FOREIGNKEY` → `conflict` `Other records depend on this.`; `SQLITE_CONSTRAINT_UNIQUE` → `conflict` with `fields.name` `That name is already taken.`; other errors rethrow; a batch with no changes is rolled back (no empty batches) and its result returned.

- [ ] **Step 1: Write failing tests** (`write.test.ts`, with a test user inserted): an insert via `runBatch` creates one batch and one change (`op create`, `before` null, `after` = row JSON, `shape` 1, `seq` 0); an update records `before`/`after` and bumps `version` to 2; an update with an unchanged patch records nothing and stores no batch (Review Focus 3); two writes in one batch get `seq` 0 and 1; a `fn` that writes then returns `fail('invalid', …)` leaves no batch, change or row (Review Focus 2); a registered rule returning an error aborts with that error and writes nothing; a unique violation maps to `conflict` with `fields.name`.
  `guard.test.ts`: reads every `.ts` file under `src/` except those under `src/lib/server/core/`, `src/lib/server/db/` and test files, and fails if any imports one of `customer|project|activity|location|batch|change` from the db schema module (regex over import statements from a path ending in `db/schema` or `db/schema.js`); and fails if any file under `src/lib/server/core/` other than `write.ts` calls `.insert(`, `.update(` or `.delete(` on a drizzle handle.
- [ ] **Step 2: Run, expect FAIL** — **Step 3: Implement** — **Step 4: Run, expect PASS**, then `npm run check && npm run lint && npx vitest run`
- [ ] **Step 5: Commit** — `git commit -m "feat: record every core write in a batch"`

---

### Task 3: Reference data commands

**Files:**
- Create: `src/lib/server/core/reference.ts`, `src/lib/server/core/reference.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: rules registered at module load (project: its customer exists, belongs to the same user, and is active, else `archived` `The customer is archived.`); command functions `(w: Writer, input: unknown) => Result<…>` (user from `w`) and list functions `(tx: Tx | DB, userId: string, input?: unknown) => Result<…>`:
  - `createCustomer({ name })`, `createActivity({ name })`, `createLocation({ name })` → the row.
  - `createProject({ customerId, name })` → the row; unknown or other user's customer → `not_found`; archived customer → `archived`.
  - `rename(kind, { id, name, expectedVersion? })`, `archive(kind, { id, expectedVersion? })`, `unarchive(kind, { id, expectedVersion? })`, `kind` ∈ the four; unknown or other user's id → `not_found`; version mismatch → `conflict` `This was changed elsewhere; reload and try again.`; archiving an archived row or unarchiving an active one → ok with the unchanged row and nothing recorded; unarchiving a project under an archived customer → `archived`.
  - `listCustomers|listActivities|listLocations({ includeArchived? })`, `listProjects({ customerId?, includeArchived? })` (each project with `customerName`); sorted by `name_key`; the default excludes archived rows and projects whose customer is archived.
  - Duplicate names → `conflict` with `fields.name` `A <kind> with this name already exists.`

- [ ] **Step 1: Write failing tests** for every bullet above, through `runBatch`, including: `Ügyfél` then `ügyfél` → conflict (Review Focus 4); renaming to the same name stores no batch (Review Focus 3); a duplicate after trimming; an archived name still blocks a new one; one project name under two customers; another user's customer id → `not_found`; a stale `expectedVersion` → conflict and nothing written.
- [ ] **Step 2: Run, expect FAIL** — **Step 3: Implement** — **Step 4: Run, expect PASS**, then the full checks
- [ ] **Step 5: Commit** — `git commit -m "feat: manage customers, projects, activities and locations"`

---

### Task 4: Undo and history

**Files:**
- Create: `src/lib/server/core/undo.ts`, `src/lib/server/core/history.ts`, `src/lib/server/core/undo.test.ts`, `src/lib/server/core/history.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `undo(w: Writer, input: unknown): Result<{ reverted: string[] }>` — input `{ batchId }` or `{ changeIds: string[] }` (1–1000); unknown or other user's → `not_found`; resolves to changes, newest first (batch `createdAt`, then batch id, then `seq` descending); for each: `conflict` if already undone (`That change is already undone.`), if `shape` ≠ `SHAPES[entity]` (`That change was made before an upgrade and cannot be undone.`), or if the row's current state ≠ the change's `after` (JSON of the current row, or null when absent), naming the later batches that touched that row since, newest first (`Later changes touch the same record: <labels>. Undo those first.`); else `w.restore(entity, entityId, before, change.id)`. Rules and foreign keys apply through the writer and `runBatch`. A change is undone when a change with `reverts` = its id exists and is not itself undone.
  - `undoLabel(input, originalLabel?)`: `Undo "<original label>"` for a whole batch, `Undo <n> changes` for chosen changes.
  - `listHistory(tx, userId, input?: { before?: string; limit?: number }): Result<HistoryBatch[]>` — `limit` default 50, max 200; newest first; `HistoryBatch = { id, actor, label, createdAt, undone, undoneBy: string | null, changes: { id, seq, entity, entityId, op, before, after, reverts, undone, undoneBy: string | null }[] }`, `before`/`after` parsed; a batch is undone when every change is.

- [ ] **Step 1: Write failing tests**: undo of create (row gone), rename, archive, unarchive; undo of a whole batch with several changes restores all; undo of chosen changes across two batches; already undone → conflict; a later batch renamed the row → undo of the earlier change refused naming it, nothing written (Review Focus 1); undoing the later change first, then the earlier one, works; undo of a customer create after a later batch added a project → conflict, nothing written; undoing an archive of a project whose customer was archived since → `archived`; a change whose `shape` is set to 0 in the DB → refused; redo restores the post-change state and the history shows the original not undone (Review Focus 5); history paging with `before` and `limit`; another user's batch → `not_found`.
- [ ] **Step 2: Run, expect FAIL** — **Step 3: Implement** — **Step 4: Run, expect PASS**, then the full checks
- [ ] **Step 5: Commit** — `git commit -m "feat: undo changes and read the history"`

---

### Task 5: The core entry point and documentation

**Files:**
- Create: `src/lib/server/core/index.ts`, `src/lib/server/core/core.test.ts`, `docs/core.md`, `docs/decisions/004-every-write-goes-through-one-recording-path.md`
- Modify: `docs/app.md` (layout points at `docs/core.md`), `src/lib/server/core/guard.test.ts` (outside `core/`, only `core/index.ts` may be imported)

**Interfaces:**
- Produces: `openCore(db: DB, userId: string, actor: Actor, clock?: () => number): Core` with `customers`, `projects`, `activities`, `locations` (each `create`, `rename`, `archive`, `unarchive`, `list`), `history.list`, `undo`, and `batch<T>(label: string, fn: (c: BatchCore) => Result<T>): Result<T>`, where `BatchCore` has the same commands running in the enclosing batch (no nested `batch`). A command called on `Core` runs `runBatch` with a generated label: `Create customer "X"`, `Rename project "Old" to "New"`, `Archive activity "X"`, `Unarchive location "X"`, the undo labels from Task 4. Re-exports `Result`, `CoreError`, `Warning`, `Actor`.
- [ ] **Step 1: Write failing tests** (`core.test.ts`): a lone `customers.create` makes one batch with the generated label and actor; `core.batch('Set up', c => …)` creating a customer and two projects makes one batch with three changes; a failure in its third command writes nothing; `undo({ batchId })` of that batch removes all three in one new batch; a second user's core cannot see or undo the first user's data.
- [ ] **Step 2: Run, expect FAIL** — **Step 3: Implement** — **Step 4: Run, expect PASS**, then the full checks
- [ ] **Step 5: Docs** — `docs/core.md` (the API's shape, results, batches, versions, rules, undo rules, shape versions, history, reference data rules, and how a later entity plugs in: add it to `Entity`, `SHAPES` and the write path's table map, and register its rules); decision 4 in the `docs/decisions/README.md` format (Rule: every write to the time data goes through the core's one recording write path; one call or one `batch` is one batch; undo writes a new batch of reverting changes and refuses rather than overwrite a later change; accounts are outside it. Why: nothing is lost and one set of rules, vision principles 2 and 3); the `docs/app.md` pointer.
- [ ] **Step 6: Commit** — `git commit -m "feat: open the core api"` (docs may be a separate `docs:` commit)
