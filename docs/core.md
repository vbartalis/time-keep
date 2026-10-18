# The core

The core is the one way to read and write the time data: customers, projects,
activities and locations now; entries and timers later. It lives in
`src/lib/server/core/`. Routes and, later, the MCP server import only
`core/index.ts`; a test fails if any other module outside `core/` imports from it, or
imports the core tables, `table` or `Writer`. Decision 4 is the rule; this is how it
works.

## Opening

`openCore(db, userId, actor, clock?)` returns the API for one user. `actor` is `'ui'`,
`'agent'` or `'system'` and is stored on every batch. `clock` returns epoch
milliseconds and defaults to `Date.now`; tests inject it.

```
core.customers | projects | activities | locations
    .create / .rename / .archive / .unarchive / .list
core.history.list({ before?, limit? })
core.undo({ batchId } | { changeIds })
core.batch(label, (c) => result)
```

Everything is synchronous (better-sqlite3 transactions are). Every command takes
`input: unknown` and validates it with zod, so a form, a test and an agent hit the
same checks. Another user's ids are `not_found`, never `forbidden`.

## Results

Every command and read returns `{ ok: true, value, warnings }` or
`{ ok: false, error: { code, message, fields? } }`. `code` is `invalid`, `not_found`,
`conflict` or `archived`; `fields` maps an input field to its message. `Warning` is
`{ code, message }`. `Result`, `CoreError`, `Warning` and `Actor` are exported from
`core/index.ts`.

## Batches

A batch is the unit of history and undo: one transaction, one `batch` row (`id`,
`user_id`, `actor`, `label`, `created_at`), and one `change` row per write, in order.

- A command called on the core runs in its own batch with a generated label:
  `Create customer "X"`, `Rename project "Old" to "New"`, `Archive activity "X"`,
  `Unarchive location "X"`. Names are the stored names.
- `core.batch(label, fn)` runs `fn` in one batch with the caller's label (trimmed,
  1–200 characters, else `invalid` with `fields.label`). `fn`
  receives a `BatchCore` with the same commands, running in that batch (no nested
  `batch`), and returns a result. A failed command that `fn` returns, a rule
  violation, or any failed write rolls the whole batch back and the result is that
  failure. Calling the outer core inside `fn` throws (it would commit a second batch);
  use the `BatchCore` passed in.
- A batch that changed nothing (renaming to the same name, archiving an archived
  row) is rolled back and not stored.
- A user's batch times strictly increase, so history and undo order is exact.
- A change row has `entity`, `entity_id`, `op` (`create`, `update`, `archive`,
  `unarchive`, `delete`), `before` and `after` (the whole row as JSON, null where it
  did not or no longer exists), `shape` and `reverts`.

Only `core/write.ts` writes these tables. Its `Writer` records the change as it
writes and runs the entity's rules on the result. A test walks `core/` and fails if
any other module there calls drizzle's insert, update or delete.

## Versions and shapes

Every row has an integer `version`, raised by every write. A command that changes an
existing row accepts an optional `expectedVersion`; when given and different, it is
refused with `conflict`, so a second device or an agent cannot overwrite a change it
never saw.

Each entity has a shape version in `SHAPES` (starting at 1). A migration that only
adds a nullable column keeps it; one that renames, removes or retypes a column raises
it. The app never updates history rows. A migration that changes an entity's shape
either raises its shape version, after which older changes refuse undo (`conflict`,
saying so), or, as part of that same migration, rewrites the stored `before`/`after`
JSON and `shape` of the older changes so they stay undoable. That is the only
sanctioned rewrite of history. Restoring writes only the columns the stored JSON has.

## Rules

Each entity registers rules with `registerRules`; the write path runs them on every
write, undo included. A write that breaks one is refused and its batch rolled back.
Today: a project's customer must exist, and an active project's customer must be
active.

## Undo

`undo({ batchId })` undoes every change of a batch; `undo({ changeIds })` undoes 1 to
1000 chosen changes, from one or several batches. Either way it writes one new batch
whose changes each carry `reverts`, applying the inverses newest first: a create is
removed, an update, archive or unarchive restores `before`, a delete puts `before`
back. Its label is `Undo "<original label>"` for a batch, `Undo 1 change` or
`Undo <n> changes` for chosen changes.

A change is undone while a change reverting it stands; a batch is undone when all its
changes are. Redo is undo of the undo. `undo({ batchId })` skips changes of the batch
that are already undone and is refused only when all of them are.

Undo refuses with `conflict`, writing nothing, when:

- a chosen change (or a whole batch) is already undone;
- the row no longer matches the change's `after` on the recorded columns, meaning a
  later change touched it (the message names the later batches, newest first; undo
  those first);
- the change was written under an older shape;
- a restored row breaks a rule or a reference (for example removing a customer that
  a later batch gave a project).

Undo is per user. An unknown batch or change, or another user's, is `not_found`.

## History

`history.list({ before?, limit? })` returns the user's batches newest first, each
with its changes. `limit` defaults to 50, maximum 200; `before` is a batch id to page
from. Each batch and change says whether it is undone and by which batch. History rows
are never updated or deleted, and there is no command to delete them.

## Reference data

| Kind | Fields | Unique |
|------|--------|--------|
| Customer | `name` | per user |
| Project | `customer_id`, `name` | per customer |
| Activity | `name` | per user |
| Location | `name` | per user |

- Every row has `id`, `user_id`, `name`, `name_key`, `archived_at` (null when
  active), `version`, `created_at`, `updated_at`.
- Names are trimmed, 1 to 100 characters. Uniqueness is case-insensitive for any
  script: `name_key` is the name in Unicode NFC, lowercased, with a unique index on
  it. Archived rows count, so unarchiving never collides. A duplicate is `conflict`
  with `fields.name`.
- Lists take `{ includeArchived? }` and sort by name with `Intl.Collator('en')`
  (accents and case ignored, numbers in order); uniqueness stays on `name_key`. Project
  lists also take `{ customerId? }` and carry each project's `customerName`. Default
  lists show active rows only, and a project whose customer is archived counts as
  inactive. Lists and `history.list` read the database directly and write nothing.
- A project cannot be created or unarchived under an archived customer (`archived`).
  Archiving a customer leaves its projects' rows alone; they leave the default lists
  with it.

## Adding an entity

1. Add its table and migration, with `user_id`, `version` and timestamps.
2. Add it to `Entity`, `SHAPES` (at 1) and the table map in `core/write.ts`.
3. Register its rules with `registerRules`.
4. Write its commands as `(w: Writer, input)` functions that write only through `w`,
   and its reads as `(db, userId, input?)` functions.
5. Expose them from `openCore` and `BatchCore` in `core/index.ts`, with their labels.
6. Test each command, its errors, and its undo.

Core columns stay plain `integer` and `text`: no drizzle `mode: 'timestamp'` or
`'boolean'`. Restore writes the JSON-parsed stored values back as they are, so a
column that maps its value on the way in or out would not round-trip.
