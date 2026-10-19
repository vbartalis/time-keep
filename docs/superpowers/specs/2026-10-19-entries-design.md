# Phase 5b, finding and bulk editing entries — design

Date: 2026-10-19. Roadmap item 5b. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap, decisions 1–5, `DESIGN.md` or the earlier specs is marked **(call)**.

## Intent

Month-end is PC work (vision, "Two surfaces"; PRODUCT.md: "correcting and rewording
entries in bulk, month-end tables"). Today only today's entries can be seen and they
are edited one at a time. This part is an **Entries** screen: find a month's (or any
range's) entries by customer, project, activity, location and text, then change or
delete many of them at once as one batch, undone from the strip. The core already
runs many commands as one batch (`core.batch`); it lacks the reads to find entries by
activity, location and text.

The 2a spec settled the shape: "a bulk edit on the PC (phase 5) is one form post", one
batch. The discovery's rejected alternatives settled one detail: with customer ›
project flat and the chain in the project name, "everything for CompB" is a **name
filter**, so the text search matches customer and project names too.

## Goals

- `entries.list` gains filters by activity, location (including "none") and text, a
  "started in the range" mode, and a limit.
- An **Entries** screen (`/entries`): a filter form, the matching entries in a ruled
  table with a checkbox per row, and a "Change selected" form and "Delete selected".
- Every bulk change or delete is one `core.batch`, one strip, one undo.
- The entry edit screen returns to the screen it was opened from.

## Non-goals

- The history screen and undo of older batches (5c).
- Totals per day, week, customer or project, the copy-out and CSV (6). The screen
  shows the count and the summed hours of what it lists, nothing grouped **(call: a
  sum to check a month against, not a report)**.
- Shifting times, changing time zones or setting start and end for many entries at
  once: rare, and done per entry on the edit screen **(call)**.
- Rewording with patterns or anything beyond a literal find and replace: that is the
  agents' job through the MCP server (7) **(call)**.
- Saved searches; paging past the limit **(call: narrow the filters instead)**.
- Creating entries on this screen: Today and templates create, the MCP bulk-adds.

## Anti-goals

- A rule enforced in a screen. Every refusal is the core's, shown as it gives it.
- Half a bulk change. One refused entry refuses the whole batch; nothing is written.
- A bulk change that silently overwrites a change made elsewhere since the list was
  loaded: every update and delete sends the row's `expectedVersion`.
- A modal or browser dialog, or a screen that needs JavaScript.

## Decided

### The core read (`entries.list`)

Existing inputs stay as they are (`from`, `to`, `projectId`, `customerId`, `running`).
New, all optional **(call, every one)**:

- `activityId`, `locationId`: an id, or `null` for entries without one.
- `text`: trimmed, 1–200 characters; matches entries whose reference, description,
  project name or customer name contains it, Unicode case-insensitively as names are
  compared (SQLite's `LIKE` folds ASCII only, so the match is not left to it).
- `startedIn: true`: only entries that **start** in `[from, to)`, since an entry
  belongs to the day it started (vision); without it the list keeps its "touches the
  range" meaning, which Today relies on.
- `order: 'asc' | 'desc'`, default `desc` (as now): `asc` lists oldest start first.
- `limit`: 1–1000; without it the list is unbounded, as now.

Wrong types and an unknown id are `invalid` and `not_found` as for the existing
filters. `docs/core.md` records them.

### The screen (`/entries`)

**Filters** are a `GET` form, so a search is a URL: bookmarkable, kept by Back, and
the place every action returns to **(call)**.

- From and To: `date` inputs, inclusive, read as days in the request's zone (the
  zone rules of `docs/app.md`); the list asks for entries started from From's start of
  day to the day after To. Default: the current month in that zone **(call:
  month-end is the use)**. A field submitted blank means no bound on that side (the
  limit below still narrows) **(call)**. From after To shows a message by the fields
  and no list.
- Customer and Project: pickers of every customer and project, **archived included**
  and marked "(archived)" (old months use them), projects grouped by customer; "Any"
  first. With JavaScript choosing a customer narrows the projects, as on the template
  form **(call)**.
- Activity and Location: "Any", "None", then every row, archived marked.
- Text: one field, matched as the core matches it.
- Search submits; a "Clear" link returns to the default month.

**The list** is a ruled table, oldest first (a time card reads down the month), at
most **500** rows **(call)**; when the core returns a 501st, the screen says "Showing
the first 500 entries; narrow the filters." Columns: a checkbox, date, in, out (or
Running), hours, customer › project, activity, location, reference, description, each
time in the entry's own zone, punched, as on Today. The date links to the entry's edit
screen. The narrower PC widths drop activity and location; the phone stacks each row
as DESIGN.md's ruled table allows. Above the table: "<n> entries, <h:mm>" (running
entries counted to now, as Today counts them). Empty: "No entries match." with the
Clear link.

**Selecting.** The table, the change form and the delete button are one `POST` form;
each row's checkbox posts its id and a hidden version posts with it (`version.<id>`)
**(call)**. A head checkbox selects all shown (JavaScript); without JavaScript a
"Select all" link reloads the same search with every row checked (`&all=1`) **(call)**.
With JavaScript the change form says how many are selected and its buttons are disabled
at none; without it, posting none says "Select at least one entry."

**Change selected** sits above the table **(call: in reach without scrolling a
month)**, one ruled line per field, each left as it is unless set **(call)**:

- Project: "Keep" or an active project (grouped by customer).
- Activity, Location: "Keep", "None", or an active one.
- Reference: a text field, blank keeps it, and a "Clear the reference" checkbox.
- Description: "Find" and "Replace with": every literal, case-sensitive occurrence in
  each selected entry's description is replaced; a description left empty becomes
  none. Find and Replace are taken as typed, not trimmed, so a leading space or a
  doubled space can be replaced; a Find of only spaces counts as blank, and blank Find
  keeps the description **(call)**.

"Apply to selected" (the form's one primary button) sends one `core.batch` with one
`entries.update` per selected entry that the form would change, each with its
`expectedVersion`, only the set fields, in order of start, oldest first **(call: so
running entries moved onto one project stop each other in time order, as timers do,
rather than being refused)**. The label is `Edit <n> entries` (`Edit 1 entry`), `n`
counting the entries the form updates, not the selection **(call)**. If nothing would change (all "Keep", or no entry contains the
Find text), no batch is stored and the screen says "Nothing to change." The core's
rules apply per entry as everywhere: moving a running entry onto a project with a
running timer stops that timer in the same batch, or is refused.

**Delete selected** (outline, red when confirming) asks on the page, as the entry edit
screen does: "Delete <n> entries?" with "Yes, delete them" and "Keep them"; then one
`core.batch` of `entries.delete`, each with its version, labelled `Delete <n> entries`
**(call)**.

**After** either action the screen redirects (303) to the same search with the strip
("Done: Edit 12 entries.", Undo); undo returns there too (`back` is the search's path
and query). The core's warnings (overlap, long) show in the strip and mark their rows,
as on Today.

**Refusals.** The form re-renders with the search, the selection and the posted values
kept. A refusal names the entry it came from ("2026-10-07 09:00, CompA › ProjC: <the
core's message>") under the change form **(call)**; a stale version adds a Reload link
to the same search. Field messages of the change form show beside its fields.

### Opening an entry from the list

The date links to `/entries/<id>?back=<the search>`; the edit screen keeps `back`
(through `safeBack`) and returns there after a save, a delete or "This entry was
deleted elsewhere." **(call)**. Without `back` it returns to Today, as now.

### Navigation

The rail gains **Entries** after Today (Lucide `list`, 16 px) **(call)**. The phone's
bottom bar does not: the screen is PC work, as Templates **(call)**; it stays usable
at phone widths. The shell keeps Entries current on `/entries`, and on
`/entries/[id]` only when it was opened from the list (its `back` starts with
`/entries`); reached from Today, the edit screen keeps Today current **(call)**.

### Tests

- Unit: the new `entries.list` filters (activity and location ids and none, text
  across the four fields with non-ASCII case, `startedIn` against an entry crossing the
  range's start, `order`, `limit`, invalid inputs); the search's reading of the query
  string (default month, From after To, `all`); the bulk input builder (keep, none,
  clear, find and replace, nothing to change, the label).
- Browser, at phone and PC sizes, seeded through the core:
  - find by range, customer, project, activity "None", and text matching a project
    name and a description; Clear.
  - select three, set an activity and replace a word; undo restores all three.
  - delete two after confirming; undo brings them back.
  - a selected entry edited elsewhere: the whole change refused with Reload; nothing
    written.
  - a refusal naming its entry (moving a running entry behind a later timer).
  - open an entry from the list, save, land back on the same search.
  - search, select all and apply with JavaScript off.

### Documentation

`docs/core.md` (the list's inputs), `docs/app.md` (the screen, `back` on the edit
screen, the navigation), `DESIGN.md` (the filter bar, the selectable table and the
change form) through impeccable's document step. No decision record **(call)**.

## Exit

From the PC alone, the user finds a month's entries by range, customer, project,
activity, location and text, changes or deletes many of them at once, and undoes each
such change in one step from its strip. Check, lint, unit and browser tests pass, at
phone and PC sizes.

## Left to the builder

Component structure; how the core matches text (in SQL with a folded column, or in
TypeScript over the range's rows); the exact layout of the filter bar and the change
form; how the screen learns which entry a refusal came from inside `core.batch`; copy
beyond the strings above.
