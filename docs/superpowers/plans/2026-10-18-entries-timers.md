# Entries and Timers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entries and timers in the core: intervals with time zones, start + end or duration, local or instant input, create/edit/delete/list, timers with one running per project and auto-stop, end-of-batch checks, and overlap and long-entry warnings.

**Architecture:** Extends 2a's core (`src/lib/server/core/`, see `docs/core.md`). New: batch checks run by `runBatch` before commit on touched rows; `Warning` gains `subject` and `details`; a time-input helper; the `entry` entity with its commands, checks and lists; wiring in `openCore`.

**Tech Stack:** TypeScript, Drizzle on better-sqlite3 (synchronous), zod, `Intl` (time zones), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-entries-timers-design.md`

## Global Constraints

- All 2a constraints hold (`docs/core.md`): writes only through the Writer; commands synchronous `(w, input: unknown)`; Result/CoreError shapes; another user's ids → `not_found`; optional `expectedVersion` → `conflict` on mismatch; core columns plain `integer`/`text`; `#lib` explicit paths or relative imports in core/; tests never import `$app/*`.
- Times: integer ms instants; zones: IANA names validated with `Intl.DateTimeFormat(undefined, { timeZone })` (throws on unknown).
- `Warning = { code: string; message: string; subject?: string; details?: Record<string, unknown> }`; a batch's warnings unique by `(code, subject)`.
- Entry text: `reference` trimmed ≤200, `description` trimmed ≤2000; empty after trimming → null.
- Never run docker; never git push. Conventional Commits, no scope, no AI attribution.

## Review Focus

1. **A batch that swaps two entries' times** (A takes B's slot and B takes A's) produces no overlap warning and no error, because checks see the final state — Task 1 and Task 4.
2. **A local start inside a daylight-saving gap** (`2026-03-29T02:30` in `Europe/Budapest`) is `invalid`; the repeated hour (`2026-10-25T02:30`) takes the earlier instant — Task 2.
3. **Undo of a timer stop** that would leave two running timers on one project is refused with `conflict` — Task 4.
4. **Rewording an entry that already overlaps another** returns no warning — Task 4.
5. **Starting a timer on a project whose running timer started later than the new start** is refused, not given a negative interval — Task 4.

---

### Task 1: Batch checks and warnings with subjects

**Files:**
- Modify: `src/lib/server/core/result.ts` (Warning), `src/lib/server/core/write.ts`, `src/lib/server/core/batch.ts`
- Test: `src/lib/server/core/checks.test.ts`

**Interfaces:**
- Produces: `type BatchCheck = (tx: Tx, ctx: { userId: string; batchId: string; touched: string[]; now: number }) => { error?: CoreError; warnings?: Warning[] } | null`; `registerBatchCheck(entity: Entity, check: BatchCheck): void`; the Writer tracks touched ids per entity (insert, update, restore; deleted rows included); `runBatch`, after `fn` succeeds and the batch has changes, runs every registered check for each entity with touched ids, in registration order; any `error` rolls back and is returned; warnings are merged into the result, unique by `(code, subject)`, after any warnings `fn` returned.
- [ ] **Step 1: Failing tests** with a throwaway check registered on `customer` in the test (removed after via a test-only `clearBatchChecks(entity)` export): a check sees the batch's final state (two writes, check sees both); an error from a check rolls back everything; warnings are merged and deduplicated by code and subject; a batch with no changes runs no checks; the touched list holds each id once.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** — **Step 4: Run, PASS**, then `npm run check && npm run lint && npx vitest run`
- [ ] **Step 5: Commit** — `git commit -m "feat: run checks once at the end of a batch"`

---

### Task 2: Time input

**Files:**
- Create: `src/lib/server/core/time.ts`, `src/lib/server/core/time.test.ts`

**Interfaces:**
- Produces: `isTimeZone(name: string): boolean`; `parseTime(text: string, zone: string): { ok: true; at: number } | { ok: false; message: string }` — accepts `YYYY-MM-DDTHH:mm`, `…:ss`, `…:ss.SSS`, each with optional `Z` or `±HH:mm`; with an offset or `Z` it is that instant (zone ignored); without, it is the local time in `zone`: nonexistent (DST gap) → `{ ok: false, message: 'That time does not exist in <zone>.' }`; ambiguous → the earlier instant; anything else unparseable or out of range → `'Use a date and time like 2026-10-18T09:00.'`. Implement the local conversion with `Intl.DateTimeFormat` offsets (no new dependency): compute the zone offset at candidate instants, adjust, and verify the round trip.
- [ ] **Step 1: Failing tests**: `2026-10-18T09:00` in `Europe/Budapest` → `2026-10-18T07:00Z`; `2026-10-18T09:00:00+02:00` → same; `…Z` ignores the zone; `2026-03-29T02:30` Budapest → the gap message; `2026-10-25T02:30` Budapest → `2026-10-25T00:30Z` (earlier); `2026-01-15T09:00` in `America/New_York` → `14:00Z`; `Asia/Kolkata` half-hour offset; garbage and `2026-13-01T00:00` → the format message; `isTimeZone('Mars/Base')` false.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** — **Step 4: Run, PASS**, then the full checks
- [ ] **Step 5: Commit** — `git commit -m "feat: read local and offset times"`

---

### Task 3: The entry: table, create, edit, delete, read

**Files:**
- Modify: `src/lib/server/db/schema.ts`, `src/lib/server/core/write.ts` (Entity, SHAPES, table map)
- Create: `src/lib/server/core/entries.ts`, `src/lib/server/core/entries.test.ts`, a migration under `drizzle/`

**Interfaces:**
- Consumes: Tasks 1–2; reference tables.
- Produces:
  - Table `entry`: `id`, `userId` → user, `projectId` → project (not null), `activityId` → activity (nullable), `locationId` → location (nullable), `startAt`, `startZone`, `endAt` (nullable), `endZone` (nullable), `reference` (nullable), `description` (nullable), `version`, `createdAt`, `updatedAt`; indexes `(user_id, start_at)`, `(user_id, end_at)`, `(project_id)`. `Entity` gains `'entry'`; `SHAPES.entry = 1`. Type `Entry`.
  - Per-write rule on `entry`: `endAt` null exactly when `endZone` null; `endAt > startAt` when set (`invalid` `The end must be after the start.`); referenced project/activity/location exist and are the user's (`not_found`). Archived references are allowed.
  - `createEntry(w, input)`, `updateEntry(w, input)`, `deleteEntry(w, input)` per the spec's input rules (`start`, `timeZone`, `end` | `durationMinutes` | neither, `endTimeZone`, `reference`, `description`; update is partial with `expectedVersion`, `end: null` makes it running, `durationMinutes` sets the end from the (new) start; a partial update that changes `end` without `endTimeZone` keeps the existing `endZone`, or uses the start zone when the entry was running). Running creates, and edits that make an entry running, call `beforeRunning(w, projectId, startAt, exceptId?)`, an internal function Task 4 fills in; in this task it does nothing.
  - `getEntry(tx, userId, input)`, `listEntries(tx, userId, input, now)` per the spec: interval touches `[from, to)`, a running entry reaches `now`, filters `projectId`, `customerId`, `running`; newest start first; each item with `projectName`, `customerId`, `customerName`, `activityName`, `locationName`.
- [ ] **Step 1: Failing tests**: create with end, with duration (end = start + minutes), running; local and offset input; unknown zone → `invalid` `fields.timeZone`; end before start → invalid; both `end` and `durationMinutes` → invalid; other user's project → not_found; archived project allowed; update partial (description only), `end: null`, `durationMinutes` with a new start, stale `expectedVersion` → conflict; delete recorded with op `delete`, and undoing it restores the entry; list by range touching (an entry starting before `from` and ending inside is listed), running reaches now, filters, names; get.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** (`npx drizzle-kit generate --name entries`) — **Step 4: Run, PASS**, then the full checks
- [ ] **Step 5: Commit** — `git commit -m "feat: add entries to the core"`

---

### Task 4: Timers, checks and warnings

**Files:**
- Modify: `src/lib/server/core/entries.ts`
- Create: `src/lib/server/core/timers.test.ts`, `src/lib/server/core/warnings.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `beforeRunning(w, projectId, startAt, exceptId?)`: finds the user's running entry on `projectId` (other than `exceptId`); if its `startAt >= startAt` → `CoreFailure` `conflict` `The running timer on this project started later; stop it first.`; else updates it to `endAt = startAt`, `endZone = its startZone`.
  - `startTimer(w, input)` (`start` defaults to `w.now`; a start more than 60 000 ms after `w.now` → `invalid` `A timer cannot start in the future.`), `stopTimer(w, input)` (`end` defaults to `w.now`; not running → `conflict` `That timer is already stopped.`; `expectedVersion` optional). Updates that move a running entry to another project call `beforeRunning` for the new project.
  - Batch checks on `entry`, registered at module load:
    - one running entry per project, for the projects of the entries the batch touched → `conflict` `Only one timer can run on a project.`;
    - for each touched finished entry that was created in this batch or whose `startAt`/`endAt` differs between its first `before` in this batch and its final row (read this batch's change rows via `ctx.batchId`; a reworded entry is skipped): `overlap` warning with `subject` = its id, `details.with` = ids of the user's other finished entries overlapping it (half-open), message `Overlaps 1 other entry.` / `Overlaps <n> other entries.`; `long` warning when `endAt - startAt > 86 400 000`, message `Longer than 24 hours.`
- [ ] **Step 1: Failing tests** (`timers.test.ts`): start defaults to now; future start refused; a second timer on another project allowed; a timer on the same project stops the first at the new start in the same batch (one batch, two changes); a running entry that started later → conflict, nothing written (Review Focus 5); stop defaults to now, already stopped → conflict; moving a running entry onto a project with a running timer stops that one; undo of the auto-stop batch restores both; undo of a stop that would leave two running on one project → conflict (Review Focus 3). (`warnings.test.ts`): overlap with subject and `details.with`; a timer never warns, logging while a timer runs never warns; rewording an overlapping entry → no warning (Review Focus 4); swapping two entries' times in one `runBatch` → no warning (Review Focus 1); long entry warns; an undo that recreates an overlap warns; warnings unique by code and subject.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** — **Step 4: Run, PASS**, then the full checks
- [ ] **Step 5: Commit** — `git commit -m "feat: run timers and warn about overlaps"`

---

### Task 5: Wiring and documentation

**Files:**
- Modify: `src/lib/server/core/index.ts`, `src/lib/server/core/core.test.ts`, `docs/core.md`

**Interfaces:**
- Produces on `Core` and `BatchCore`: `entries.{create, update, delete}`, `timers.{start, stop}`; on `Core` only: `entries.{list, get}`. Labels: `Create entry on "<project>"`, `Edit entry on "<project>"`, `Delete entry on "<project>"`, `Start timer on "<project>"`, `Stop timer on "<project>"` (the entry's project name before the command; for create/start the input project's name). Re-export the entry item types.
- [ ] **Step 1: Failing tests** in `core.test.ts`: each label; warnings returned through `Core`; `core.batch` with an entry create and a timer start returns the merged warnings.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** — **Step 4: Run, PASS**, then the full checks
- [ ] **Step 5: Docs** — `docs/core.md`: entries (fields, input forms, local vs offset times, DST rules, archived references allowed), timers (one per project, auto-stop, future limit), batch checks, warnings (`subject`, `details`, overlap and long rules, running timers left out), lists as an instant primitive.
- [ ] **Step 6: Commit** — `git commit -m "feat: open entries and timers in the core api"`
