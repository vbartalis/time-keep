# Phase 2b, entries and timers — design

Date: 2026-10-18. Roadmap item 2b. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap or decisions 1–4 is marked **(call)**.

## Intent

The entry is what the app is for: a stretch of work on a project, from a start to an
end, at a place, doing an activity. The vision fixes its shape: always an interval,
entered as start and end or start and duration, stored with the time zone it was
entered in, allowed to cross midnight and to last longer than a day, belonging to the
day it started, overlapping others with a warning but never a block. An entry without
an end is a running timer; several may run, but starting on a project stops that
project's timer. This part adds entries and timers to the core built in 2a, so every
one of those rules holds for the phone, the PC and agents alike, and every change to
an entry is recorded and undoable.

## Goals

- Entries in the core: create, edit, delete, list, each recorded and undoable.
- Start + end or start + duration as input, stored as start and end with their time
  zones.
- Timers: start, stop, several running, one per project.
- Overlap warnings on any write that leaves the user's entries overlapping, undo and
  redo included.

## Non-goals

- Templates (2c), screens (4, 5), reports and rounding (6), the MCP server (7).
- Splitting at midnight, durations by day, rounding: output concerns (phase 6).
- Time zone conversion for display: the core returns instants and zone names.

## Anti-goals

- Storing anything rounded or derived: stored data is exact (vision principle 4).
- Blocking an overlap.
- A write path for entries other than the core's recorded one.

## Decided

### The entry

| Field | Stored as | Rule |
|---|---|---|
| `projectId` | text, required | the user's project |
| `activityId` | text, nullable | the user's activity **(call: optional, so a timer can start before the activity is known)** |
| `locationId` | text, nullable | the user's location **(call: optional, likewise)** |
| `startAt` | integer ms (instant) | required |
| `startZone` | text, IANA zone name | required |
| `endAt` | integer ms, nullable | null while running; otherwise > `startAt` |
| `endZone` | text, nullable | null exactly when `endAt` is null |
| `reference` | text, nullable | trimmed, at most 200 characters **(call)** |
| `description` | text, nullable | trimmed, at most 2000 characters **(call)** |

Plus `id`, `userId`, `version`, `createdAt`, `updatedAt` like every core row. The
customer is the project's; an entry does not store it **(call, from 2a)**. An entry's
day is the date of `startAt` in `startZone`; the core stores nothing for it.

An entry may refer to an archived project, activity or location, new or edited: the
vision has archived data leave the pickers, which is the screens' job, and an import
or a fix to an old month must be able to use what was current then **(call)**. The
references must exist and be the user's (`not_found` otherwise).

### Input

- `start`: an ISO 8601 date-time, either with an offset or `Z`
  (`2026-10-18T09:00:00+02:00`, an instant) or without one (`2026-10-18T09:00`, a
  local time read in `timeZone`) **(call: both, so the UI, agents writing local times,
  and 2c's templates use one parser)**. A local time that does not exist in the zone
  (a daylight-saving gap) is `invalid`; one that exists twice takes the earlier
  instant **(call)**. The conversion lives in one core helper that 2c reuses.
- `timeZone`: an IANA zone name, checked with `Intl` (`Europe/Budapest`); stored as
  `startZone`, and as `endZone` unless `endTimeZone` is given **(call)**.
- Exactly one of `end` (like `start`; a local `end` is read in `endTimeZone`, else
  `timeZone`), `durationMinutes` (a positive whole
  number), or neither, which means running. Duration becomes `endAt = startAt +
  minutes`. `end` must be after `start`.
- Seconds are kept as given; nothing is rounded.

### Commands

- `entries.create({ projectId, activityId?, locationId?, start, timeZone, end? |
  durationMinutes?, endTimeZone?, reference?, description? })` → the entry. A create
  without an end is a timer start and follows the timer rule below.
- `entries.update({ id, expectedVersion?, …any field above })`: a partial edit. Giving
  `end: null` makes a finished entry running again (the timer rule applies); giving
  `durationMinutes` sets the end from the entry's (possibly new) start **(call)**.
- `entries.delete({ id, expectedVersion? })`: recorded with op `delete` and undoable.
- `timers.start({ projectId, activityId?, locationId?, timeZone, start?,
  reference?, description? })`: `start` defaults to now. Same as a create without an
  end.
- `timers.stop({ id, end?, endTimeZone? })`: `end` defaults to now and must be after
  the start; stopping a stopped entry is `conflict` **(call)**.
- `entries.list({ from?, to?, projectId?, customerId?, running? })`: entries whose
  interval touches `[from, to)` (ISO instants; a running entry reaches now), newest
  start first, each with its project, customer, activity and location names;
  `running: true` lists only running ones. This is an instant primitive: grouping by
  each entry's local day is phase 6's, which widens the window and groups by
  `startZone`; nothing day-like is stored **(call)**. `entries.get({ id })` → one
  entry with names.
- Labels: `Create entry on "<project>"`, `Edit entry on "<project>"`, `Delete entry on
  "<project>"`, `Start timer on "<project>"`, `Stop timer on "<project>"`.

### Timers

- At most one running entry per project, checked once at the end of every batch,
  undo and redo included (see "Checks at the end of a batch") **(call: a check, not a
  unique index, so its error is a clear `conflict` and no new unique index needs
  telling apart)**.
- Starting an entry on a project (a timer start, a create without an end, an edit
  that makes an entry running, or an edit that moves a running entry to another
  project) first stops that project's running entry at the new
  entry's start, in the same batch; if the running entry started at or after that
  point, the command is refused with `conflict` instead of producing an empty or
  negative interval **(call)**.
- A running entry cannot start more than a minute in the future **(call)**.
- Other projects' timers keep running.

### Checks at the end of a batch

- Besides 2a's per-write rules, an entity can register batch checks: they run once,
  after the batch's last write and before it commits, on the rows the batch touched,
  seeing the batch's final state. A check returns an error (the batch is refused and
  rolled back) and warnings **(call: so a batch that moves or swaps entries is judged
  as a whole, not halfway)**.
- Entries register two: one running entry per project (error), and the warnings
  below. Undo and redo run them too, since they are batches.

### Warnings

- `Warning` gains `subject` (the id of the entry it is about) and an optional
  `details` object; a batch's warnings are unique by `code` and `subject`
  **(call)**.
- `overlap`: a finished entry whose start or end the batch created or changed, and
  which overlaps another finished entry of the user's (half-open intervals), warns
  `Overlaps <n> other entr(y|ies).` with the other ids in `details.with`. Running
  timers are left out on both sides, so starting a timer or logging while one runs
  never warns; an edit that only rewords an entry never warns **(call)**.
- `long`: a finished entry longer than 24 hours, whose interval the batch created or
  changed, warns `Longer than 24 hours.` so a typo in a date is noticed (the vision
  allows long entries) **(call)**.

### Data and docs

- `Rule` stays as in 2a (per write, errors only); batch checks are new:
  `registerBatchCheck(entity, check)` with `check(tx, touchedIds) → { error?,
  warnings }`, run by `runBatch` before commit.
- A new `entry` table and migration; `entry` added to `Entity`, `SHAPES` (1) and the
  write path's table map; indexes on `(user_id, start_at)`, `(user_id, end_at)` and
  `(project_id)`.
- `docs/core.md` gains entries, timers and warnings; no new decision record (decision
  4 covers the write path; the entry's shape is the vision's) **(call)**.

## Exit

Every rule in the vision's entry and timer sections, and the ones above, is enforced
by the core and covered by tests; entries are created, edited, deleted, started and
stopped through the core, each recorded and undoable, with warnings surviving undo and
redo; check, lint and all tests pass.

## Left to the builder

Module layout, zod schemas, how the overlap query is written, exact messages beyond
those given, and test helpers.
