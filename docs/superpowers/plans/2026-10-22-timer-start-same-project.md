# Starting a timer on a project that has one running — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new timer on a project whose timer runs stops that timer instead of being refused, whatever the minute; the one refusal left names the running timer's start; the entry form opened again shows the current minute.

**Architecture:** The rule lives in the core's `beforeRunning` (`src/lib/server/core/entries.ts`), which now returns the start to use for a new running entry (rule 2 moves it one millisecond past the running timer's start) and refuses only a start in an earlier minute. The entry form marks a Start it filled with now; the new-entry route then starts the timer through `core.timers.start` with no start, so the core uses the request's time. The PC's in-place form stops reusing a preloaded form.

**Tech Stack:** SvelteKit 2 / Svelte 5, TypeScript, Drizzle on SQLite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-timer-start-same-project-design.md`

## Global Constraints

- Refusal copy, exact: `This project's timer has been running since HH:MM. Start after HH:MM, or stop that timer first.` HH:MM is the running timer's start in the new entry's zone; when that local day is not the new start's local day, `HH:MM` becomes `YYYY-MM-DD HH:MM` in both places.
- The old message `The running timer on this project started later; stop it first.` appears nowhere afterwards (code, tests, docs).
- Refusal code stays `conflict`; for a new entry or timer it carries `fields.start`; for an edit it carries `fields.start` only when the edit's input gave `start`.
- "Same minute" = `localParts(at, zone)` (`src/lib/server/core/time.ts`) gives the same `date` and `time` for both instants, in the new entry's zone.
- Rule 2's new start is exactly the running timer's start + 1 ms (spec, builder's call 6).
- Rule 2 applies to new running entries only (`insertEntry`: create, timers.start, fromTemplate); edits keep their saved start (rules 1 and 3 only).
- The start and the stop stay one batch (one Undo).
- No new control, setting or layout. Works without client script.
- Conventional Commits, no scope, no attribution.

## Review Focus

1. A running timer started late in its minute and a same-minute typed start: the new start still reads that minute — test in Task 1.
2. A refused save in timer mode, then saved again untouched: the posted `startNow` survives the refusal, so the retry starts now — test in Task 2.
3. A timer-mode form whose date was changed but Start left as filled: taken as typed, not now — test in Task 2.
4. Two zones: the running timer started in Asia/Tokyo, the new entry in Europe/Budapest: "same minute" and HH:MM are read in the new entry's zone — test in Task 1.
5. An edit that clears an end, with the project's timer started in a later minute: refused as the form's general message (no `fields.start`), nothing changed — test in Task 1.

---

### Task 1: The rule in the core

**Files:**
- Modify: `src/lib/server/core/entries.ts` (`STARTED_LATER`, `beforeRunning`, `insertEntry`, `updateEntry`)
- Test: `src/lib/server/core/timers.test.ts` (replaces "refuses when the running timer started at or after the new start, writing nothing")
- Modify: `docs/core.md:250-254` (the rule's paragraph)

**Interfaces:**
- Produces: `beforeRunning(w: Writer, projectId: string, startAt: number, opts: { zone: string; exceptId?: string; startGiven?: boolean; edit?: boolean }): number` — returns the start the running entry gets (`startAt`, or the running timer's start + 1 under rule 2); refuses through `w.refuse` under rule 3. `insertEntry` stores the returned start; `futureStart` still checks the given one.

- [ ] **Step 1: Write the failing tests** in `timers.test.ts` with `setup()`, `T9` (09:00Z), `H`:
  - `a start in the running timer's minute, before it, starts just after it and stops it`: timer A started at `T9 + 27_000` (UTC); `createEntry` start `2026-10-18T09:00`, UTC, at `T9 + 40_000` → new `startAt === T9 + 27_001`; A has `endAt === T9 + 27_001`, `endZone === 'UTC'`.
  - `the same late in the minute still reads that minute`: A at `T9 + 59_998`; typed 09:00 → new `startAt === T9 + 59_999`, `localParts(startAt,'UTC').time === '09:00'`.
  - `a start typed in an earlier minute is refused, naming the running start, writing nothing`: A at `T9 + 2 * H`; typed `2026-10-18T10:50` → `err(r)` equals `{ code: 'conflict', message: M, fields: { start: M } }` with `M = "This project's timer has been running since 11:00. Start after 11:00, or stop that timer first."`; one entry, still running; batch count unchanged.
  - `names the running start with its date when the new start is on another day`: A at `T9`; typed `2026-10-17T20:00` → message `…running since 2026-10-18 09:00. Start after 2026-10-18 09:00, or stop that timer first.`
  - `reads the minute and the time in the new entry's zone`: A started with `timeZone: 'Asia/Tokyo'` at `T9 + 27_000`; `createEntry` in `Europe/Budapest` typed `2026-10-18T11:00` → new `startAt === T9 + 27_001`. And typed `2026-10-18T10:50` Budapest → refused with `since 11:00` (A's 09:00:27Z read in Budapest).
  - `an edit clearing an end, the running one later, is refused without a field`: finished entry 08:00–08:30Z on p; timer on p since `T9`; `updateEntry({ id, end: null })` → `{ code: 'conflict', message: <since 09:00 copy> }` with no `fields`; both rows unchanged.
  - `an edit clearing an end, after the running one, stops it at its start`: timer on p since `T9`; finished entry 09:30–10:00Z; clear its end → A ends at `T9 + 30 min`; edited entry's `startAt` unchanged.
  - Keep the existing rule-1 tests passing unchanged.

- [ ] **Step 2: Run** `npx vitest run src/lib/server/core/timers.test.ts` — Expected: the new tests FAIL (old message).

- [ ] **Step 3: Implement** in `entries.ts`: replace `STARTED_LATER` with `runningSince(runningAt: number, startAt: number, zone: string): string` building the exact copy from `localParts`; `beforeRunning` per Interfaces — for each running `other`: `startAt > other.startAt` → stop at `startAt`; same minute and not `edit` → new start `other.startAt + 1`, stop `other` there; else refuse `conflict` with `fields: { start }` unless `edit && !startGiven`. `insertEntry` passes `{ zone: row.startZone }` and inserts with the returned start; `updateEntry` passes `{ zone: next.startZone, exceptId: row.id, edit: true, startGiven: data.start !== undefined }`.

- [ ] **Step 4: Run** `npx vitest run src/lib/server/core` — Expected: PASS (`use-template`, `warnings` included).

- [ ] **Step 5: Update** `docs/core.md`'s rule paragraph: the three cases, the edit rule, the copy.

- [ ] **Step 6: Commit** `fix: stop a project's timer started in the same minute`

### Task 2: An untouched Start means now

**Files:**
- Modify: `src/lib/components/entry/types.ts` (`EntryFormValues`), `src/lib/server/screens/entry-form.ts` (`newValues`, `valuesFromEntry`, `copyValues`, `newEntryValues`, `createInput`, `FORM_FIELDS`/`postedForm`, the `coreFailure` comment), `src/lib/components/entry/EntryForm.svelte` (one hidden input), `src/routes/(app)/entries/new/+page.server.ts`
- Test: `src/routes/(app)/entry-and-timer-routes.test.ts`; `src/lib/components/entry/EntryForm.test.ts`
- Modify: `docs/app.md` (entry form section)

**Interfaces:**
- Consumes: Task 1's core.
- Produces: `EntryFormValues.startNow: string` — `''`, or `` `${date}T${start}` `` when the form filled date and Start with now (timer mode, with or without a template); posted as hidden `startNow`. `createInput(form)`'s ok branch gains `startsNow: boolean`: `startNow` non-empty, equal to the posted date + `T` + read start, no end, no duration.

- [ ] **Step 1: Write the failing tests**:
  - Routes, load: `?timer=1` → `values.startNow === \`${values.date}T${values.start}\``; `?start=09:00`, `?copy=<id>`, `?template=<id>` without `timer` → `''`.
  - Routes, save: timer on project P started 20 s before the action's now; post P with `startNow` and date/start as filled, no end or duration → redirect; the old timer's `endAt` equals the new entry's `startAt`, which equals the action's `Date.now()` (fake it with `vi.useFakeTimers`/`vi.setSystemTime` set to a second-offset instant like `…:40.000`, or the file's existing clock pattern).
  - Routes, save: the same with `date` changed to the day before → refused, `fields.start` carries the Task 1 copy (typed, not now).
  - Routes, save: a refused post's `failure.values.startNow` equals the posted one.
  - Component: `EntryForm` for a new entry with `startNow` set renders a hidden `startNow` input with it; an edit renders none.

- [ ] **Step 2: Run** `npx vitest run "src/routes/(app)/entry-and-timer-routes.test.ts" src/lib/components/entry` — Expected: FAIL.

- [ ] **Step 3: Implement**: `startNow` in the type and every values builder; `postedForm` keeps `startNow`; the hidden input for new entries; `createInput` computes `startsNow`; the `/entries/new` action calls `c.timers.start` with the input minus `start` when `startsNow`, else `c.entries.create`. Reword the `coreFailure` comment.

- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS.

- [ ] **Step 5: Update** `docs/app.md`'s entry form section: an untouched Start in timer mode starts at Save.

- [ ] **Step 6: Commit** `fix: start an untouched timer form at save time`

### Task 3: A reopened form is fresh, and the gate tasks end to end

**Files:**
- Modify: `src/lib/entry-link.ts` (`openForm`) and whatever the confirmed cause needs
- Test: `e2e/entry-form.test.ts` (beside "gate 8")
- Modify: `docs/app.md` (the in-place form paragraph, if the mechanism changes)

**Interfaces:**
- Consumes: Tasks 1–2.

- [ ] **Step 1: Write the e2e tests** (both projects), with the file's helpers (`newUser`, `signIn`, `startButton`, `startList`, `dialog`, `pickProject`, `typeTime`, `saveButton`, `shown`, `bar`, `done`, `clockIn`). The server clock is real:
  - `item 18: a second timer on the same project at once stops the first`: "Start on a project…" on Acme › Operations, then on another project, then on Acme › Operations again with Start untouched → the dialog closes with no refusal; two timers run; Entries shows the first Operations entry with an end.
  - `item 18: one Undo takes back the start and the stop`: right after that save, Undo in the strip → the first Operations timer runs again, the new one is gone.
  - `item 18: the form opened again in the next minute shows that minute`: open "Start on a project…" (on the PC hover the link first), read Start, Cancel; wait until the minute changes (`expect.poll`, timeout 65 s); open again → Start shows the new minute.
  - `item 18: a start typed ten minutes before the running one is refused with its start`: Operations timer running; new form on Operations, `typeTime(page, 'start', clockIn(-10))` → the dialog stays; Start's message is the exact copy with the running timer's minute; the typed Start is kept.

- [ ] **Step 2: Run** `npx playwright test e2e/entry-form.test.ts -g "item 18"` — Expected: the reopen test FAILS on the PC (stale Start); the others pass after Tasks 1–2.

- [ ] **Step 3: Diagnose and fix** (superpowers:systematic-debugging): confirm whether `preloadData` returns a hover-preloaded result for the same href. Fix so a new-entry form's data is loaded at each open, keeping the in-place dialog and Back.

- [ ] **Step 4: Run** `npx playwright test e2e/entry-form.test.ts` — Expected: PASS on phone and pc.

- [ ] **Step 5: impeccable pass** on the refusal's copy and placement (clarify/harden only): screenshots at 390 and 1440 px, light and dark, in `.autopilot/screenshots/18/build/`; fix only copy or placement findings.

- [ ] **Step 6: Commit** `fix: show the current minute in a reopened entry form`

Approved by the operator stand-in, revision 1, 2026-10-22.
