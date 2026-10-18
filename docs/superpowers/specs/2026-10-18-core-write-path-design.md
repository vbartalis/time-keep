# Phase 2a, the write path and reference data — design

Date: 2026-10-18. Roadmap item 2a. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap or decisions 1–3 is marked **(call)**.

## Intent

The vision's second principle is that nothing is lost: every change is recorded, and
any change or batch of changes can be undone. Its third is that the UI and agents go
through the same API and validation. This part builds the thing both rest on: the core
API every later screen and the MCP server call, and the single write path inside it
that records every change into a batch that can be undone as one step. Customers,
projects, activities and locations are its first users, because they are simple and
everything after needs them. Entries, timers and templates (2b, 2c) then only add
rules, not machinery.

## Goals

- One core API, in process, that is the only code allowed to read or write the time
  tracking tables.
- Every write recorded with its old and new values, grouped into a batch: one API call
  is one batch, and several calls can share one batch on purpose.
- Undo of any batch as one step, refused with a clear reason when later changes stand
  in the way; an undo is itself a batch, so it can be undone (redo).
- History kept forever and readable: the user's batches, newest first, with their
  changes.
- Customers › projects, activities and locations: create, rename, archive, unarchive,
  list.
- Validation in the API, shared by every caller; errors and warnings in one shape.

## Non-goals

- Entries, timers, templates (2b, 2c). The machinery here must fit them; they are not
  built.
- Screens (phases 4, 5) and the MCP server (phase 7).
- History for accounts: users and sessions stay outside batches and undo **(call)**.
  The vision's history is about the time data; account changes are the admin's and
  are not undone.
- An HTTP API. The core is a TypeScript module; screens call it from server code and
  the MCP server will call it in the same process (decision 1) **(call)**.
- A batch that stays open across several calls. The vision's "one agent request" is
  one call: the MCP server (phase 7) will offer tools that take a list of operations
  and run them as one batch, and a bulk edit on the PC (phase 5) is one form post
  **(call)**.
- Moving a project to another customer. Entries will store only their project (2b),
  so a move would silently rewrite the customer of every past entry; a project belongs
  to its customer for life **(call)**.

## Anti-goals

- Any write to a time tracking table that does not go through the recorded path. A
  second way to write is how "nothing is lost" quietly stops being true.
- Undo that silently overwrites a later change.
- Deleting reference data. Archived, never deleted (vision); a mistaken create is
  undone, not deleted.

## Decided

### The core API

- Lives in `src/lib/server/core/`. Routes and, later, the MCP server import only its
  entry module; nothing outside `core/` imports the time tracking tables **(call)**.
- `openCore(db, userId, actor)` returns the API for one user; `actor` is `'ui'`,
  `'agent'` or `'system'` and is stored on each batch **(call)**.
- Every command takes `input: unknown` and validates it with zod, so a form, a test
  and an agent hit the same checks **(call: zod, which the MCP TypeScript SDK already
  uses)**.
- Commands are synchronous (better-sqlite3 transactions are synchronous; nothing in
  the core needs to await).
- Every command returns a result:
  `{ ok: true, value, warnings: Warning[] }` or
  `{ ok: false, error: { code, message, fields? } }`, where `code` is one of
  `invalid`, `not_found`, `conflict`, `archived`; `fields` maps an input field to its
  message; `Warning` is `{ code, message }` (2b's overlaps use it) **(call)**.
- Another user's ids are `not_found`, never `forbidden`: a user cannot learn what
  others have **(call)**.

### Batches

- A command called on its own runs in its own batch. `core.batch(label, (tx) => …)`
  runs several commands in one batch: one transaction, one batch row, every change in
  order; if any command fails, nothing is written and the result is that failure
  **(call)**.
- A batch row: `id`, `user_id`, `actor`, `label`, `created_at`. A command run alone
  gets a generated label, for example `Create customer "CompA"` **(call)**.
- A change row: `id`, `batch_id`, `seq` (order within the batch), `entity`
  (`customer`, `project`, `activity`, `location`; 2b and 2c add theirs), `entity_id`,
  `op` (`create`, `update`, `archive`, `unarchive`, `delete`), `before` and `after`
  (the whole row as JSON, null where it did not or no longer exists), `shape` (the
  entity's shape version when written), and `reverts` (the change it undoes, or null)
  **(call)**.
- **Shape versions**: each entity has a shape version in code, starting at 1. A
  migration that only adds a nullable column keeps it; one that renames, removes or
  retypes a column raises it, and changes written under an older shape can no longer
  be undone (refused with `conflict`, saying so) unless that migration also rewrites
  the stored JSON **(call)**. Restoring writes only the columns the stored JSON has.
- **Versions on rows**: every reference data row (and every later entity) has an
  integer `version`, raised by every write. Every command that changes an existing row
  accepts an optional `expectedVersion`; when given and different, the command is
  refused with `conflict`, so an agent or a second device cannot overwrite a change it
  never saw **(call)**.
- **Rules on every write**: each entity registers its rules (a project's customer must
  be active, names unique, and in 2b one running timer per project) with the write
  path, which runs them for every write, undo included; a write that breaks one is
  refused and its batch rolled back **(call)**.
- A batch with no changes (for example renaming to the same name) is not stored
  **(call)**.
- The write path is one internal module (`core/write.ts`) whose insert, update and
  delete record the change as they write; command code never writes a table directly.
  A test walks `core/` and fails if any module other than the write path calls
  drizzle's insert, update or delete on a time tracking table **(call)**.

### Undo

- `undo({ batchId })` undoes every change of a batch; `undo({ changeIds })` undoes
  chosen changes, from one or several batches (the vision: any change, or batch of
  changes) **(call)**. Either way it writes one new batch whose changes each carry
  `reverts`, applying the inverses newest first: a create is removed, an update,
  archive or unarchive restores `before`, a delete puts `before` back.
- A change is undone while a change reverting it stands (is not itself undone); a
  batch is undone when all its changes are.
- Refused with `conflict` when a chosen change is already undone; when the row it
  touched no longer matches that change's `after`, which means a later change touched
  the row (the check is per row, not per field; the message names the later batches,
  newest first, so the user can undo those, or just their change to that row, first)
  **(call)**; when the change was written under an older shape; when a restored row
  would break a rule (above); or when it would break a reference, for example removing
  a customer that a later batch gave a project (the foreign key fails inside the
  transaction, which is rolled back) **(call)**.
- Redo is undo of the undo's changes.
- Undo is per user: only the user's own changes.

### History

- `history.list({ before?, limit? })`: the user's batches newest first with their
  changes, `limit` default 50, max 200; `before` is a batch id to page from **(call)**.
- Each batch and each change in the list says whether it is undone, and by which
  batch.
- History rows are never updated or deleted, and the history has no delete command.

### Reference data

| Kind | Fields | Unique |
|---|---|---|
| Customer | `name` | per user |
| Project | `customer_id`, `name` | per customer |
| Activity | `name` | per user |
| Location | `name` | per user |

- Every row has `id`, `user_id`, `name`, `name_key`, `archived_at` (null when
  active), `version`, `created_at`, `updated_at`.
- Names are trimmed, 1–100 characters. Uniqueness is case-insensitive for any script
  (Hungarian names included): `name_key` is the name in Unicode NFC, lowercased in
  TypeScript, and the unique index is on it with the owning key; archived rows count
  too, so unarchiving never collides **(call)**. A duplicate is `conflict` with
  `fields.name`.
- Commands: `create`, `rename`, `archive`, `unarchive` for each kind **(call)**.
  Archiving an archived row, or unarchiving an active one, changes nothing and
  records nothing.
- Lists: `list({ includeArchived? })`, sorted by name case-insensitively; projects
  list per customer or for all, each with its customer's name. Default lists show
  active rows only, and a project whose customer is archived counts as inactive there
  **(call)**.
- A project cannot be created or unarchived under an archived customer: `archived`
  **(call)**. Archiving a customer does not change its projects'
  rows; they leave the default lists with it.

### Data

New tables `batch`, `change`, `customer`, `project`, `activity`, `location`, with a
migration. Ids and times as in phase 1 (26-character base32 ids, integer
milliseconds). Indexes on `user_id` everywhere, `(user_id, created_at)` on `batch`,
`(batch_id, seq)` on `change`, `(entity, entity_id)` on `change`, `reverts` on
`change`. Case-insensitive uniqueness by unique indexes on `name_key` with the owning
key.

### Tests

Real SQLite per test, as in phase 1. Covered: every command's success and each of its
errors; one batch per lone command; a multi-command batch writes all or nothing; every
change recorded with correct `before` and `after`; undo of each op, of a whole batch
and of chosen changes across batches; undo refused when already undone, when a later
batch touched the row, when a rule or a reference would break, and for an older
shape; redo; `expectedVersion` refusing a stale write; `Ügyfél` and `ügyfél`
colliding; history paging and the undone flags; another user's ids are `not_found`;
the write-path guard test.

### Documentation

- `docs/core.md`, the core's part doc: the API's shape, results, batches, undo rules,
  history, reference data rules.
- Decision 4: every write to the time data goes through the core's one recording write
  path; a call is a batch; undo is a new batch and refuses rather than overwrite.
- `docs/app.md` points at `docs/core.md`.

## Exit

The reference data rules above, batches, undo and history are enforced by the core
API and covered by tests; any change or batch can be undone as one step or is refused
with its reason; check, lint and all tests pass.

## Left to the builder

Module layout inside `core/`, zod schema organisation, exact error messages beyond the
codes, how changes are serialised, and test helpers.
