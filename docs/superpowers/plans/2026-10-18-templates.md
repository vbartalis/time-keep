# Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Templates in the core: saved partial entries, used to make entries and start timers in one tap, and saved from entries.

**Architecture:** A `template` entity added to 2a/2b's core (`src/lib/server/core/`, `docs/core.md`), written only through the Writer; `entries.fromTemplate` resolves a template plus given fields into an input for 2b's `createEntry`, run in the same batch so every entry rule applies.

**Tech Stack:** TypeScript, Drizzle on better-sqlite3, zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-templates-design.md`

## Global Constraints

- All core constraints hold (`docs/core.md`): writes only through the Writer; synchronous commands `(w, input: unknown)`; Result/CoreError; other users' ids → `not_found`; optional `expectedVersion`; refusals inside commands use `w.refuse`; core columns plain `integer`/`text`; relative imports in core/; tests never import `$app/*`.
- Names: as 2a (`nameSchema`, `nameKey`), unique per user on `name_key`.
- `startTime`/`endTime`: `HH:mm`, `00:00`–`23:59` (`invalid` `Use a time like 09:00.`).
- Reuse 2b: `parseTime`, `isTimeZone`, `createEntry`, the duration bound (1–2 628 000), the reference/description limits.
- Never run docker; never git push. Conventional Commits, no scope, no AI attribution.

## Review Focus

1. **A duration-only template tapped at 17:00** makes an entry ending at 17:00, not one starting then — Task 2.
2. **An `endTime` earlier than `startTime`** (night shift 22:00–06:00) ends the next day — Task 2.
3. **A template with `startTime` on a daylight-saving gap date** (02:30 on 2026-03-29, Budapest) gives `invalid`, not a wrong instant — Task 2.
4. **Two templates named `Ügyfél` and `ügyfél`** collide — Task 1.
5. **Using a template whose project was archived since** still works (archived references are allowed) — Task 2.

---

### Task 1: The template: table, commands, lists

**Files:**
- Modify: `src/lib/server/db/schema.ts`, `src/lib/server/core/write.ts` (Entity, SHAPES, table map)
- Create: `src/lib/server/core/templates.ts`, `src/lib/server/core/templates.test.ts`, a migration under `drizzle/`

**Interfaces:**
- Produces:
  - Table `template`: `id`, `userId` → user, `name`, `nameKey`, `customerId` → customer (nullable), `projectId` → project (nullable), `activityId` → activity (nullable), `locationId` → location (nullable), `startTime`, `endTime` (text, nullable), `durationMinutes` (integer, nullable), `timeZone` (nullable), `reference`, `description` (nullable), `version`, `createdAt`, `updatedAt`; unique `(user_id, name_key)`; index `user_id`. `Entity` gains `'template'`, `SHAPES.template = 1`, type `Template`.
  - Per-write rule: references exist and are the user's (`not_found`); project's customer equals `customerId` when both set (`invalid` `fields.projectId` `That project is not this customer's.`); `endTime` requires `startTime` (`invalid` `fields.endTime` `An end time needs a start time.`); not both `endTime` and `durationMinutes` (`invalid`); `timeZone` valid when set.
  - `createTemplate(w, input)`, `updateTemplate(w, input)` (partial; null clears a field; `expectedVersion`), `deleteTemplate(w, input)` (recorded `delete`, undoable), `getTemplate(tx, userId, input)`, `listTemplates(tx, userId)` (sorted with the 2a collator by name; each with `customerName`, `projectName`, `activityName`, `locationName`). Duplicate name → `conflict` `fields.name` `A template with this name already exists.`
- [ ] **Step 1: Failing tests**: create a full template and an empty one (name only); every rule above; duplicate `Ügyfél`/`ügyfél` (Review Focus 4); update partial and clearing; stale version; delete and undo; another user's ids → `not_found`; list order and names.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** (`npx drizzle-kit generate --name templates`; a second generate reports no changes) — **Step 4: Run, PASS**, then `npm run check && npm run lint && npx vitest run`
- [ ] **Step 5: Commit** — `git commit -m "feat: add templates to the core"`

---

### Task 2: Entries from templates, templates from entries

**Files:**
- Modify: `src/lib/server/core/templates.ts`
- Create: `src/lib/server/core/use-template.test.ts`

**Interfaces:**
- Consumes: Task 1; `createEntry` (entries.ts), `parseTime`, `isTimeZone`.
- Produces:
  - `entryFromTemplate(w, input): Result<Entry>` per the spec's resolution: zone (given ?? template's ?? `invalid` `fields.timeZone` `Pick a time zone.`); start (given `start` → as 2b; else template `startTime` on `date` — `YYYY-MM-DD`, default today's date in the zone at `w.now` — as the local string `<date>T<startTime>`; else if an end or duration is known: end = `w.now`, start = end − duration; else start = `w.now`, running); end (given `end`/`durationMinutes`; else template `endTime` on the start's local date as `<date>T<endTime>`, or the next local date when not after the start; else template `durationMinutes`; else running); project (given ?? template's ?? `invalid` `fields.projectId` `Pick a project.`; a given project must be the template customer's when the template has one); activity, location, reference, description: given (including explicit null) ?? template's. It builds a 2b `createEntry` input (instants as ISO strings with `Z`, or local strings with the zone) and calls `createEntry(w, built)` so all entry rules, timers and warnings apply; the result is `createEntry`'s.
  - `templateFromEntry(w, { entryId, name }): Result<Template>`: project, the project's customer, activity, location, reference, description, `timeZone` = entry `startZone`; `startTime` = local `HH:mm` of the start in that zone; when finished and ending on the same local date, `endTime` = local `HH:mm` of the end; when finished across dates, `durationMinutes` = round((end − start) / 60 000), minimum 1; running → no end.
- [ ] **Step 1: Failing tests**: a full template used with only `description` and `date` → the expected instants and fields; a duration-only template at `w.now` 17:00 → 15:00–17:00 (Review Focus 1); 22:00–06:00 → ends next day (Review Focus 2); a gap date → `invalid` (Review Focus 3); no end anywhere → a running timer (auto-stop of the same project's timer applies); a start-only template before its time → refused by the future limit; a customer-only template without `projectId` → `Pick a project.`; a given project of another customer → refused; no zone anywhere → `Pick a time zone.`; given description replaces; archived project still works (Review Focus 5); `templateFromEntry` for a same-day entry, a cross-midnight entry and a running one; undo of a `fromTemplate` batch removes the entry.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** — **Step 4: Run, PASS**, then the full checks
- [ ] **Step 5: Commit** — `git commit -m "feat: make entries from templates"`

---

### Task 3: Wiring and documentation

**Files:**
- Modify: `src/lib/server/core/index.ts`, `src/lib/server/core/core.test.ts`, `docs/core.md`

**Interfaces:**
- Produces on `Core` and `BatchCore`: `templates.{create, update, delete, fromEntry}`, `entries.fromTemplate`; on `Core` only: `templates.{list, get}`. Labels: `Create template "<name>"`, `Edit template "<name>"` (the current name), `Delete template "<name>"`, `Save entry as template "<name>"`, `Create entry from template "<name>"`, or `Start timer from template "<name>"` when the result is running. Re-export `Template` types.
- [ ] **Step 1: Failing tests** in `core.test.ts`: each label (including the running variant); warnings come back from `entries.fromTemplate`.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** — **Step 4: Run, PASS**, then the full checks
- [ ] **Step 5: Docs** — `docs/core.md`: templates (fields, rules, no archive, delete), `fromTemplate` resolution (zone, start, end, project, replacements, duration-only ends now, refused future starts), `fromEntry`.
- [ ] **Step 6: Commit** — `git commit -m "feat: open templates in the core api"`
