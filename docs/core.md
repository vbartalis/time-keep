# The core

The core is the one way to read and write the time data: customers, projects,
activities, locations, entries and timers. It lives in
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
core.entries.create / .update / .delete / .list / .get
core.timers.start / .stop
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
`{ code, message, subject?, details? }` (see Warnings). `Result`, `CoreError`, `Warning` and `Actor` are exported from
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
- A refusal thrown inside a command (`Writer.refuse`, as for a timer that started
  later or a start in the future) is recorded like a failed write, so the batch rolls
  back even if `fn` catches it and returns ok. Inside `core.batch` the commands of the
  `BatchCore` signal such refusals by throwing (`runBatch` turns the throw into the
  returned failure), so callers should let them propagate rather than catch them.
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
active; an entry's references must exist and be the user's, its end and end zone are
both set or both null, and its end is after its start.

Batch checks (`registerBatchCheck`) run once per entity, after the batch's last write
and before it commits, on the rows the batch touched (deleted ones included), seeing
the final state. A check returns an error, which refuses and rolls back the batch, and
warnings. Undo and redo are batches, so they run the checks too. Entries register
two: one running entry per project (`conflict`), and the warnings below.

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

## Entries

| Field | Rule |
|-------|------|
| `project_id` | required, the user's project |
| `activity_id`, `location_id` | optional, the user's |
| `start_at` | instant, epoch milliseconds |
| `start_zone` | IANA zone name |
| `end_at`, `end_zone` | both null while running; otherwise `end_at` is after `start_at` |
| `reference` | optional, trimmed, at most 200 characters |
| `description` | optional, trimmed, at most 2000 characters |

Plus the usual `id`, `user_id`, `version`, `created_at`, `updated_at`. The customer is
the project's; an entry's day is the date of `start_at` in `start_zone`, and nothing
day-like is stored. Stored data is exact: nothing is rounded.

Archived projects, activities and locations are allowed on new and edited entries (the
pickers hide them, not the core); a missing or foreign reference is `not_found`.

**Input.** `start` and `end` are ISO 8601 date-times. With `Z` or an offset
(`2026-10-18T09:00:00+02:00`) they are an instant; without one (`2026-10-18T09:00`)
they are a local time read in `timeZone` (an `end` in `endTimeZone`, else `timeZone`).
A local time that does not exist (a daylight-saving gap) is `invalid`; one that exists
twice takes the earlier instant, so a local time in the second occurrence of a
repeated hour cannot be entered as one; give an instant with an offset. Seconds are kept. `timeZone` is stored as `start_zone`
and as `end_zone` unless `endTimeZone` is given. Give `end` or `durationMinutes` (a
positive whole number of minutes, at most 5 years), not both; neither means running.

**Commands.** `entries.create` takes `projectId`, `activityId?`, `locationId?`,
`start`, `timeZone`, `end?` or `durationMinutes?`, `endTimeZone?`, `reference?` and
`description?`. `entries.update` takes `id`, `expectedVersion?` and any of those
fields; `end: null` makes a finished entry running, and `durationMinutes` sets the end
from the (possibly new) start. Whenever the end is (re)computed (a new `end` or a
`durationMinutes`) its zone is `endTimeZone`, else `timeZone`, else the kept end zone,
else the start zone, and a local `end` is read in that zone. Changing only `timeZone`
keeps the instants and relabels the start zone only; `endTimeZone` without a new end
on a running entry is `invalid` (`fields.endTimeZone`). Resend `start` as a local time to keep the wall time. `entries.delete`
is recorded with op `delete` and is undoable. Labels: `Create entry on "<project>"`,
`Edit entry on "<project>"`, `Delete entry on "<project>"`, with the entry's project
before the command (the input's project for a create; the new project for an edit
that moves the entry).

**Reads.** `entries.get({ id })` and `entries.list({ from?, to?, projectId?,
customerId?, running? })` return entries with `projectName`, `customerId`,
`customerName`, `activityName` and `locationName`, newest start first. `from` and `to`
are instants with an offset; the list holds entries whose interval touches
`[from, to)`, a running one reaching the core's clock. Lists are an instant
primitive: grouping by local day (`start_zone`) is the reports' job.

## Timers

- `timers.start({ projectId, activityId?, locationId?, timeZone, start?, reference?,
  description? })` starts a running entry; `start` defaults to now. Label
  `Start timer on "<project>"`.
- `timers.stop({ id, expectedVersion?, end?, endTimeZone? })` ends a running entry;
  `end` defaults to now and is read in `endTimeZone`, else the start zone. Stopping a
  stopped entry is `conflict`. Label `Stop timer on "<project>"`.
- Several timers may run, at most one per project. Anything that makes an entry running
  on a project (a start, a create or edit without an end, moving a running entry to
  the project) first stops that project's timer at the new start, in its start zone,
  in the same batch. If that timer started at or after the new start the command is
  refused with `conflict`. The end-of-batch check is the backstop (`conflict`).
- A running entry cannot start more than a minute after now, and a timer cannot stop
  more than a minute after now (`invalid`, `fields.end`), nor at or before its start
  (`invalid`, `fields.end`, `A timer cannot stop before it started.`). The limit applies to every running entry,
  created, edited or started. A finished entry may end in the future.

## Warnings

`Warning` is `{ code, message, subject?, details? }`; `subject` is the id of the entry
it is about, and a batch's warnings are unique by `code` and `subject`. They are
returned on the result, never block, and are not stored, so they come back on undo and
redo (which run the checks) but not on a read.

- `overlap`: a finished entry whose start or end the batch created or changed overlaps
  other finished entries (half-open intervals). `Overlaps <n> other entr(y|ies).`, the
  other ids in `details.with`. Running timers are left out on both sides; an edit that
  only rewords an entry does not warn.
- `long`: a finished entry longer than 24 hours whose interval the batch created or
  changed. `Longer than 24 hours.`

`core.batch` returns the warnings of all its commands and checks, merged.

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
