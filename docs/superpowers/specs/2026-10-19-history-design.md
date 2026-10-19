# Phase 5c, history — design

Date: 2026-10-19. Roadmap item 5c, the last part of phase 5. Written without the
operator under the continuous development experiment (operator, 2026-10-18); every
choice not taken from the vision, the roadmap, decisions 1–5, `DESIGN.md` or the
earlier specs is marked **(call)**.

## Intent

"Nothing is lost. Every change is recorded; any change, or batch of changes, can be
undone" (vision). Today only the newest action can be undone, from its strip, and only
until the next load. Phase 5's exit is that "any change made there is undone in one
step from the history". This part is a **History** screen: every batch, newest first,
with what it changed, and any batch, or chosen changes of one or several batches,
undone and redone. It matters most for agents (phase 7): "a wrong tidy-up is one undo",
found here after the fact.

The core already records everything this needs: `history.list` (batches newest first
with their changes, each marked undone or not), `undo({ batchId })` and
`undo({ changeIds })`. "Redo is undo of the undo" (core.md); the core lacks a command
that says so by name and labels it so.

## Goals

- `core.redo({ batchId } | { changeIds })`: undoes the undo of a batch's changes, or
  of chosen changes, as one batch labelled `Redo …`.
- A **History** screen (`/history`): the batches as a ruled list grouped by day, each
  with its label, time, who made it, its changes on demand, and Undo or Redo.
- Chosen changes, from one or several batches on the page, undone or redone together.

## Non-goals

- Searching or filtering the history, or the history of one entry or project
  **(call: paging by date is enough for "what did that agent do"; the Entries screen
  finds entries)**.
- Deleting or editing history: rows are never updated or deleted (core.md).
- Links from a change to the record it touched **(call)**.
- History on the phone's bar: it is PC work, as Entries and Templates **(call)**; the
  screen stays usable at phone widths.
- Changing the strip: it keeps its one Undo of the newest action.

## Anti-goals

- A rule enforced in the screen. Every refusal is the core's, shown as it gives it.
- A history row changed by anything, undo and redo included: they only add batches.
- An undo or redo that half-happens: one refused change refuses the whole request.
- A browser dialog, or a screen that needs JavaScript.

## Decided

### The core command (`redo`)

`core.redo({ batchId } | { changeIds })` **(call: a named command rather than the
screen undoing undo batches, so the label reads `Redo "Edit 12 entries"` and not
`Undo "Undo "Edit 12 entries""`, and so the MCP server gets the same verb)**:

- For each named change that is undone, it undoes the standing change that reverts it
  (the one `history.list` reports through `undoneBy`). It writes one new batch, the
  inverses applied newest first, exactly as `undo` writes; the result is
  `{ reverted }` as for `undo`, naming the original changes redone.
- `{ batchId }` redoes every undone change of the batch and skips those that stand; it
  is refused with `conflict`, "That batch is not undone.", when none is undone.
- `{ changeIds }` (1 to 1000, as `undo`) is strict: a chosen change that stands refuses
  the request with `conflict`, "That change is not undone."
- Every other refusal is `undo`'s, because it is an undo: a later change touched the
  row (the message names the later batches), an older shape, a rule, a foreign key.
  An unknown batch or change, or another user's, is `not_found`.
- Labels: `Redo "<original label>"` for a batch, `Redo 1 change` / `Redo <n> changes`
  for chosen changes.
- Its batch's changes carry `reverts` like an undo's (they revert the undo), so undo
  and redo keep alternating: undoing a redo batch undoes the changes again.

`docs/core.md` records it beside Undo.

### The screen (`/history`)

**The list** is the user's batches, newest first, 50 to a page **(call: the core's
default)**, under a heading per day (the day in the request's zone, written as the app
writes dates, with the weekday) **(call: a time card reads by day)**. Each batch is one
ruled row:

- the time, `HH:mm` in the request's zone, punched as on Today;
- the label, as the core stored it;
- who made it when not the UI: an "Agent" or "System" chip **(call)**;
- the count, "1 change" / "<n> changes", as a disclosure that opens the batch's
  changes (`<details>`, so it works without JavaScript) **(call)**;
- its state: nothing when it stands; "Undone" when every change is undone (the row's
  text muted); "Partly undone, <k> of <n>" otherwise **(call)**;
- its buttons, outline as on the strip: **Undo** when any change stands, **Redo** when
  any change is undone; a partly undone batch has both **(call)**.

Undo and redo batches are batches like any other: listed with their labels, and their
own Undo undoes them (the core's alternation) **(call: no hiding, the history is the
whole record)**.

**Paging.** The screen asks the core for 51 and shows 50; when the 51st exists, an
"Older" link loads the next 50
(`/history?before=<the last batch's id>`); a page reached that way has a "Newest" link
back to `/history`. An unknown `before` redirects to `/history` **(call)**. Empty:
"Nothing recorded yet."

**A change** opened in its batch is one ruled line, in the batch's order:

- a checkbox (its id), unless the batch shows more than its first 100 (below);
- what it did and to what: **Created**, **Changed**, **Archived**, **Unarchived** or
  **Deleted**, then the record: "Entry 2026-10-07 09:00–10:30, CompA › ProjC", "Customer
  CompA", "Project CompA › ProjC", "Activity Travel", "Location Office", "Template
  Daily standup". An entry is named from its row after the change (before it for a
  delete), its times in the entry's own zones; a running entry reads "09:00–running";
- for a change (op `update`), each field that differs, one per line: "Description:
  old → new", blank written "none". Ids show as the current names, archived included;
  an id no longer found shows "(unknown)". Text longer than 80 characters is cut with
  "…" **(call)**. The bookkeeping columns (`version`, `created_at`, `updated_at`,
  `name_key`, `user_id`) and `id` are never shown **(call)**;
- an entry's start and its zone are one line, "Start", and its end and zone one line,
  "End": shown when either the time or the zone differs, each side written in its own
  zone, and naming its zone when the two sides' zones differ ("Start: 2026-10-07 09:00
  Europe/Budapest → 2026-10-07 08:00 Europe/London") **(call: a zone change is never
  shown as a time change, nor lost)**;
- an `update` whose only differing field is `archived_at` reads **Archived** or
  **Unarchived** like those ops, with no field line, since undo records an archive's
  inverse as an update; otherwise `archived_at` shows as "Archived: no → yes" **(call)**.
  Every other undo or redo change reads by its recorded op (undoing a create reads
  **Deleted**);
- "Undone" muted, when it is.

A batch with more than 100 changes shows the first 100 and "and <n> more; undo or redo
the whole batch." without checkboxes on any of them **(call: a Kimai import is one
agent batch of thousands, and a page of thousands of checkboxes helps no one)**.

**Undoing and redoing.** The list is one `POST` form **(call: so changes of several
batches are chosen together)**. A batch's Undo and Redo are submit buttons carrying its
id (`name="batchId"`) to the actions `?/undo` and `?/redo`. Above the list
**(call: in reach without scrolling, as the Entries change form)**: "Undo selected
changes" and "Redo selected changes", which post the ticked change ids to the same
actions; with JavaScript a line says how many are selected and the two buttons are
disabled at none; without it, posting none says "Select at least one change.", and
more than the core's 1000 says "Select at most 1000 changes." **(call: the core's own
refusal there is a raw validation message)**. No
confirmation: an undo is itself undone from the strip **(call)**.

**After** an undo or redo the screen redirects (303) to the same page (its `before`
kept) with the strip: "Done: Redo "Edit 12 entries".", whose Undo undoes that batch
through the shared `/undo` route and returns here. The core's warnings show in the
strip.

**Refusals** re-render the page with the core's message in a red-bordered strip above
the list, announced as an alert, the ticked changes kept ticked and their batches open
**(call)**.

### Navigation

The rail gains **History** after Setup (Lucide `history`, 16 px) **(call: after the
screens whose changes it records)**; the phone's bar does not. The shell keeps History
current on `/history`.

### Tests

- Unit:
  - `redo`: a whole batch; chosen changes; a partly undone batch (redoes only the
    undone); refused when nothing is undone and when a chosen change stands; refused
    after a later change touched the row; labels; undoing a redo batch; redoing the
    undo of a delete whose row is gone writes a change, never an empty batch reported
    as redone.
  - The change description: each op and entity, the field diff, ids as names
    (archived, unknown), an entry's times in its own zones and running, a zone-only
    change, an archive undone (Unarchived), the cut at 80, bookkeeping hidden.
- Browser, at phone and PC sizes:
  - the history shows a batch with its label, time and changes.
  - undo a batch from the list: it reads Undone and the record is restored; Redo
    brings the change back.
  - tick two of a batch's three changes and undo them: Partly undone, 2 of 3; the
    third change stands.
  - choose changes from two batches and undo them in one step.
  - a refused undo (a customer's creation once a project is under it) shows the core's
    message and nothing changes.
  - Older and Newest.
  - an agent batch shows the Agent chip.
  - undo selected changes with JavaScript off.

### Documentation

`docs/core.md` (redo), `docs/app.md` (the History screen, the navigation),
`DESIGN.md` (the history list, the change lines, the selected-changes bar) through
impeccable's document step. No decision record **(call)**.

## Exit

From the PC, the user sees every batch with its changes and undoes or redoes any batch,
or chosen changes, in one step from the history. Check, lint, unit and browser tests
pass, at phone and PC sizes.

## Left to the builder

Component structure; how `redo` finds the reverting changes (inside the core, beside
`undo`); field names and their order in a change's lines; the date heading's exact
form; how the page learns the names of ids (one list per kind, archived included);
copy beyond the strings above.
