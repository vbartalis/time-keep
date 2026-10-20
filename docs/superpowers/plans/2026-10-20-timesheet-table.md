# Timesheet table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Entries (`/entries`) as Kimai's timesheet done better: newest first,
grouped by day with day totals, one Filter control with kept presets, one live search,
a row menu, bulk edit and delete once rows are ticked, on PC and phone; and put the
same filter on the Calendar (roadmap item 14).

**Architecture:** A browser-safe filter model (`src/lib/filter/`) reads and writes the
address (range preset or custom range, customer › project, activity, location, search)
and is shared by Entries and the Calendar. The server shapes the core's rows into day
groups (`src/lib/server/screens/timesheet.ts`); `/entries` renders a plain page that
works without JavaScript, and the script adds live filtering, the popover and sheets,
the row menu, ticking and the bulk dialog. Every write is an existing core command:
`entries.delete` (a row), `core.batch` of `entries.update`/`entries.delete` (bulk),
`/timers/restart` and item 12's form (`/entries/[id]`, `/entries/new?copy=`). One core
change: `entries.list`'s `text` also matches activity and location names.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind 4, shadcn-svelte,
Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-timesheet-table-design.md` (read it whole;
cited as "spec, <section>", its calls as "call <n>"). Mockups:
`docs/superpowers/specs/2026-10-20-timesheet-table/` (`pc-table`, `pc-filter`,
`pc-filtered`, `pc-menu`, `pc-selected`, `pc-bulk`, `ph-table`, `ph-filter`, `ph-menu`,
`ph-select`, each `-light`/`-dark`). Where a mockup differs from the spec, the spec
wins: the bulk bar names its set (calls 18, 42), From and To show only under Custom,
date hints are short ISO (call 41), and nothing sits under the phone's "+" (rows'
durations included).

## Global Constraints

- Imports use `#lib/...`, never `$lib`. `src/lib/filter/*` imports nothing from
  `#lib/server/*`. Every write is one core call through
  `openCore(getDb(), user.id, 'ui', () => now)`; a bulk change is one `core.batch`; no
  rule is enforced in the screen.
- Without JavaScript the screen is plain pages (spec, Without JavaScript): the filter a
  `<details>` holding a GET form with Show; search submits on Enter; PC tick boxes and
  the bulk bar's Edit and Delete always shown; the phone's Select a link
  (`select=1`); the row menu a `<details>` of links and post buttons.
- DESIGN.md is the visual system (item 11's Kimai skin): the ruled table, project dots
  and the phone's 4 px project bar, blue only for running, the primary action and
  focus, red only for overlaps, Delete and refusals; type 12, 14, 15, 17, 21 px only;
  `figures` on every time, date and duration; `caps` for heads; 44 px targets below
  `lg` (1024 px), 36 px controls from `lg`; the phone's right-edge controls and row
  durations keep out of the "+"'s column.
- Formats: 24-hour `HH:mm`, ISO dates, Monday-first weeks, durations `h:mm` exact and
  truncated to the minute; a running entry counts to now and ticks (call 28).
- Times show in each entry's own zone and a row's day is its start date in its start
  zone (call 26); ranges are read as days in the request's zone, both ends inclusive.
- Address (Entries): `range=today|yesterday|this-week|last-week|this-month|last-month|custom`,
  `from`, `to` (custom only, `YYYY-MM-DD`, a blank side open: call 40), `customer`,
  `project`, `activity`, `location` (`none` or an id), `q`; plus `select=1` (phone,
  no JS) and `all=1` (tick every row, no JS). The Calendar adds `customer`, `project`,
  `activity`, `location` to its `view` and `date`.
- Cookie: `entries_range`, the preset only, path `/`, `max-age` 400 days, `sameSite`
  lax, `httpOnly`; written by every load whose address names a preset (call 37); read
  only when the address has no `range`; absent or unknown → `this-month`.
- Copy: "Entries"; "Filter"; "+n"; "Search entries"; "54 entries · 72:40" ("1 entry");
  "Clear filters"; "Activity: <name>", "Location: <name>", "Activity: None";
  presets "Today", "Yesterday", "This week", "Last week", "This month", "Last month",
  "Custom range", hints "10-20", "10-19 – 10-25", "2026-10"; "Any", "None",
  "(archived)"; "Running"; "Overlaps another entry"; "Already running"; menu "Restart",
  "Copy", "Edit", "Delete"; "5 selected · 6:00", "Edit…", "Delete", "Clear selection",
  "Select", "Done"; dialog "Edit 5 entries", "Keep as it is", "Clear it", "Find",
  "Replace with", "Only what you set changes. One undo puts all 5 back.", "Cancel",
  "Apply to 5 entries"; batch labels `Edit <n> entries`, `Delete <n> entries` (singular
  "entry"); "Show 54 entries"; "Showing the newest 500 entries; narrow the filters.";
  "No entries in this range."; "No entries match “<text>”."; the Calendar's
  "Week 12:30 (filtered)"; day heads "Tue 2026-10-20" (PC), "TUE 2026-10-20" (phone,
  via `caps`).
- WCAG 2.2 AA in both themes; the table, menus, popover, sheets and bulk dialog work by
  keyboard; tick state (incl. mixed) and the overlap mark are announced.
- Dialogs and sheets are native `<dialog>` (as item 12's `EntryOverlay`); the PC filter
  popover is the no-JS `<details>` enhanced (Escape and an outside click close it,
  focus returns to Filter). No new UI dependency.

## Review Focus

1. **A filter change while rows are ticked**: the ticks clear and the bulk bar goes,
   so a bulk action never acts on rows no longer shown (call 19). Task 6 tests it.
2. **Overlap partner filtered out**: a row keeps its red edge when its partner is
   outside the filter or the range edge (call 32). Task 3 tests it.
3. **A stale bulk selection** (an entry edited or deleted elsewhere after load): the
   dialog shows round 1's refusal naming the entry, nothing changes. Tasks 4 and 6
   test it.
4. **The live search typed fast, then Back**: focus and caret stay in the field while
   typing; one history entry per search, not per keystroke; Back restores the table
   it left. Task 5 tests it.
5. **A preset kept across days**: "This week" is recomputed from today on the next
   visit, never frozen dates in the cookie. Task 2 tests it.

---

### Task 1: The core's search matches activity and location

**Files:**
- Modify: `src/lib/server/core/entries.ts` (the text filter near line 614)
- Test: `src/lib/server/core/entries.test.ts`
- Modify: `docs/core.md`, `docs/mcp.md` (what `text` matches)

- [ ] **Step 1: Write the failing test** `finds text in activity and location names`:
  an entry with activity "Support ticket", one with location "Café Nero", one bare;
  `text: 'ticket'` → the first only; `text: 'café'` → the second only.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/core/entries.test.ts` → FAIL.
- [ ] **Step 3: Add** `match(i.activityName, needle) || match(i.locationName, needle)`
  to the text filter; update its doc comment, `core.md`, `mcp.md`, and the MCP tool's
  description if it lists the fields (grep `src/lib/server/mcp`).
- [ ] **Step 4: Run** the core and MCP unit tests → PASS.
- [ ] **Step 5: Commit** `feat: search activity and location names too`.

### Task 2: The filter model

**Files:**
- Create: `src/lib/filter/filter.ts`, `src/lib/filter/filter.test.ts`

**Interfaces:**
- Produces:
  - `type Preset = 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month'`
  - `const PRESETS: { preset: Preset; label: string }[]` (spec order)
  - `type Pick = 'any' | 'none' | string`
  - `type Scope = { customer: string; project: string; activity: Pick; location: Pick }` (blank = not set)
  - `type Filter = Scope & { range: Preset | 'custom'; from: string; to: string; q: string }` (`from`/`to` always the resolved days; blank only for an open custom side)
  - `presetDays(preset: Preset, today: string): { from: string; to: string }`
  - `presetHint(preset: Preset, today: string): string` ("10-20", "10-19 – 10-25", "2026-10")
  - `readFilter(params: URLSearchParams, kept: string | undefined, today: string): { filter: Filter; error: string | null }` — `kept` is the cookie's value; a `scope=customer:<id>|project:<id>` param (the no-JS select) maps onto `customer`/`project`; errors as round 1's ("Use dates like 2026-10-01.", "From must not be after To.").
  - `readScope(params: URLSearchParams): Scope`
  - `scopeQuery(scope: Scope): string` (only set keys, in the order customer, project, activity, location; `''` when none)
  - `filterQuery(filter: Filter): string` (`range` always; `from`/`to` only for custom; then the scope; then `q`)
  - `scopeCount(scope: Scope): number` (the button's "+n"; customer and project count once)
  - `rangeLabel(filter: Filter): string` ("This month", "2026-09-01 – 2026-09-15", "From 2026-09-01", "Until 2026-09-15", "All time")
  - `matchesScope(e: { customerId: string; projectId: string; activityId: string | null; locationId: string | null }, scope: Scope): boolean` (Task 8 uses it)
- Consumes: `addDays` and the Monday-first week arithmetic in `#lib/calendar/dates.js`.

- [ ] **Step 1: Write the failing tests**: each preset's days for `today = '2026-10-20'`
  (this week 10-19…10-25, last week 10-12…10-18, last month 2026-09-01…09-30; for
  `2026-01-10` last month is 2025-12); the hints; `readFilter` with no `range` and
  kept `'last-month'` → last month; with an unknown kept value → this month; with
  `range=custom&from=&to=2026-10-05` → `from: ''`; bad dates and From after To → the
  errors; `scope=customer:c1` → `customer: 'c1'`; `filterQuery` round-trips through
  `readFilter`; `scopeCount`; `rangeLabel`; `matchesScope` for each key, `none`
  included; Review Focus 5: the same kept `'this-week'` with two `today`s a week apart
  gives two different weeks.
- [ ] **Step 2: Run** `npx vitest run src/lib/filter` → FAIL.
- [ ] **Step 3: Implement** `filter.ts` to the interfaces.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add the shared filter model`.

### Task 3: The table's data

**Files:**
- Create: `src/lib/server/screens/timesheet.ts`, `src/lib/server/screens/timesheet.test.ts`
- Create: `src/lib/components/timesheet/types.ts`
- Modify: `src/lib/server/screens/entries.ts` and its test: drop only `searchPath`
  (Entries alone used it) once Task 4 stops using it. `Search`, `readSearch`,
  `searchInput` and `searchFilters` stay with their tests: Copy-out and Reports use
  them until item 15 (call 35). `BulkForm`, `readBulk`, `selection`, `bulkUpdates`,
  `editLabel`, `deleteLabel` and `runBulk` stay for the bulk actions.

**Interfaces:**
- Produces (`types.ts`, browser-safe):
  - `TableRow = { id: string; version: number; startAt: number; endAt: number | null; start: string; end: string | null; plusDays: number; running: boolean; customer: string; project: string; colour: number; activity: string | null; location: string | null; reference: string | null; description: string | null; overlaps: boolean }`
  - `TableDay = { date: string; label: string /* "Tue 2026-10-20" */; totalMs: number; rows: TableRow[] }`
  - `Timesheet = { days: TableDay[]; count: number; totalMs: number; truncated: boolean }`
  - `FilterOptions = { projects: PickerProject[]; activities: PickerOption[]; locations: PickerOption[] }` (types from `#lib/components/entry/types.js`)
- Produces (server):
  - `listInput(filter: Filter, zone: string): Record<string, unknown>` (`order: 'desc'`, `limit: 501`, `startedIn: true`, the range's instants via `startOfDay`, the scope, `text: q`)
  - `timesheetFor(core: Core, filter: Filter, zone: string, now: number): Timesheet`
  - `filterOptions(core: Core, opts: { archived: boolean }): FilterOptions` (archived rows included and flagged when asked; colours by `colourOf`)
- Consumes: Task 2's `Filter`; `overlapping` from `#lib/calendar/grid.js`; `formatDate`,
  `formatTime`, `startOfDay` from `./today`.

- [ ] **Step 1: Write the failing tests** (on a test core as `entries.test.ts` builds
  one): days newest first, rows newest start first within a day; a day's `label` and
  `totalMs`; an entry 22:00–01:30 has `plusDays: 1` and counts whole in its start day;
  a running entry counts to `now`, `end: null`, `running: true`; an entry started in
  another zone shows that zone's times and day (call 26); 501 matching → 500 rows,
  `truncated`, count and total of the 500; Review Focus 2: two overlapping entries on
  different projects filtered to one project → that row `overlaps`; an entry
  overlapping one that starts the day before the range → `overlaps`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Overlaps come from a second, unfiltered `entries.list`
  over the range widened by one day on each side (an open side stays open), through
  `overlapping`. Rows group by `formatDate(startAt, startZone)`; `plusDays` is the day
  difference between that and `formatDate(endAt, endZone ?? startZone)`.
- [ ] **Step 4: Run** `npx vitest run src/lib/server/screens` → PASS.
- [ ] **Step 5: Commit** `feat: shape entries into days for the table`.

### Task 4: The Entries server

**Files:**
- Modify: `src/routes/(app)/entries/+page.server.ts`
- Move: `src/lib/components/entries/types.ts`'s `BulkFailure` and `Chosen` into
  `src/lib/components/timesheet/types.ts`, adding `BulkEdit = { action: 'edit'; chosen: Chosen[] }`; `ListRow` and `DeleteConfirm` go; `Option` stays (`EntryFilters` uses it)
- Test: `src/routes/(app)/entries/entries-routes.test.ts` (call the load and actions
  directly, as `src/routes/(app)/entry-and-timer-routes.test.ts` does)

**Interfaces:**
- `load` returns `{ filter: Filter; error: string | null; dateError: boolean; sheet: Timesheet; options: FilterOptions /* archived included */; choices: FilterOptions /* active only, for the bulk form */; hints: Record<Preset, string>; flash; back: string /* '/entries?' + filterQuery */; today: string; now: number; select: boolean; all: boolean }`.
- Actions (each posts `id`, `version.<id>`, `back`; the query carries the filter so a
  refusal renders the same table):
  - `edit` (no JS: Edit in the bulk bar) → `BulkEdit`, or round 1's "Select at least one entry.";
  - `apply` → round 1's, unchanged (`bulkUpdates`, `runBulk`, `refusal`, `done`);
  - `delete` → at once, `runBulk(core, deleteLabel(n), inputs, 'delete')`, `done` on success (call 8), the named refusal otherwise. `confirmDelete` goes.
- Consumes: Tasks 2 and 3.

- [ ] **Step 1: Write the failing tests**: `load` with no query and no cookie → this
  month, and `entries_range=this-month` set; `range=last-month` → that cookie
  `last-month`; no `range` with the cookie `last-week` → last week, `back` naming
  `range=last-week`; `range=custom` → no cookie written; `delete` of two entries → one
  batch labelled `Delete 2 entries`, a redirect to `back`; Review Focus 3: `apply` with
  a version older than the entry's → 400, `error` beginning with the entry's date,
  time and "<customer> › <project>:", nothing changed; `edit` with none ticked →
  "Select at least one entry.".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the load and the actions.
- [ ] **Step 4: Run** the unit tests and `npm run check` → PASS (adapt the old page's
  props only as far as it must compile; Task 5 replaces it).
- [ ] **Step 5: Commit** `feat: serve entries by day with a kept preset`.

### Task 5: Filter, search and the PC table

**Files:**
- Create in `src/lib/components/timesheet/`: `FilterPanel.svelte` (presets with hints,
  Custom with From and To, `ScopePicker`, Activity, Location, Clear filters; a
  `range: boolean` prop, false for the Calendar), `FilterButton.svelte` (Filter, the
  range label, "+n"; the `<details>` popover from `lg`), `ScopePicker.svelte`,
  `FilterChips.svelte`, `SearchField.svelte`, `Toolbar.svelte`, `DayTable.svelte`,
  `RowMenu.svelte`, `live.ts`
- Rewrite: `src/routes/(app)/entries/+page.svelte`
- Delete: `src/lib/components/entries/EntryTable.svelte` and `ChangeForm.svelte`
  (the bulk form returns in Task 6 as `BulkForm`). `EntryFilters.svelte` and
  `types.ts`'s `Option` stay: Copy-out and Reports keep round 1's filter bar until
  item 15 (spec, Non-goals; call 35)
- Rewrite: `e2e/entries.test.ts` (round 1's tests go now; this task adds the filter,
  search and table tests, Tasks 6 and 7 theirs)

**Interfaces:**
- `ScopePicker` props `{ projects: PickerProject[]; customer: string; project: string; id: string }`: a combobox like item 12's `ProjectPicker` (reuse `matchProjects`) whose list also offers each customer heading as an option ("<Customer>, all projects"); "Any" clears. It renders hidden `customer` and `project` inputs; without JS, a `<select name="scope">` of `customer:<id>` and `project:<id>` options grouped by customer. Archived rows marked "(archived)".
- `live.ts`: `applyForm(form: HTMLFormElement, opts: { replace: boolean }): Promise<void>` navigates with `goto('/entries?' + filterQuery(…), { keepFocus: true, noScroll: true, replaceState: opts.replace })`. The search field (`name="q"`, `form="filter"`) applies 250 ms after typing stops, replacing the history entry while one search is being typed (the first keystroke pushes; Review Focus 4); every other control applies at once with a push.
- `RowMenu` props `{ row: TableRow; back: string; surface: 'pc' | 'phone' }`: Restart (post `/timers/restart` with `id`, `back`; disabled with "Already running" on a running row), Copy (link `/entries/new?copy=<id>&back=…`, `data-entry-form`), Edit (link `/entries/<id>?back=…`, `data-entry-form`), a rule, Delete in red (post `/entries/<id>?/delete` with `version`, `back`). PC: a `<details>` enhanced to the menu-button pattern (arrows, Home/End, Escape returns focus to ⋯). The phone's sheet is Task 7.

- [ ] **Step 1: Write the failing e2e tests** (1440 px, a seeded month via
  `e2e/seed.ts`; add an overlapping pair and a midnight crossing to its month seed if
  it lacks them): opens on this month, newest day first, day heads' labels and totals,
  the toolbar's count and total; the overlapping rows carry the red top edge and
  "Overlaps another entry" in their accessible names; the midnight entry shows "+1";
  choosing Last month applies at once and the button reads "Last month"; Today and
  back to Entries still shows Last month; typing `printer` filters live with the focus
  kept in the field, then a `T-` reference, then `café` (a location), then × clears;
  a project and an activity give chips and "+2", removing a chip, Clear filters; a row
  click opens the form in place and Save returns to the same address with the strip;
  ⋯ Copy opens a new-entry form from the row; ⋯ Delete removes it, Undo brings it
  back; ▶ restarts it in the timer bar; `/` focuses the search; the menu works by
  keyboard; at 1180 px no Location or Reference column and no sideways scroll; no
  entries → "No entries in this range."; a search with none → "No entries match
  “…”."; a custom From after To → the message by the fields and no list; JavaScript off: the `<details>` form's Show filters, search on Enter, the
  row menu's Delete posts. Review Focus 4: type `vpn` fast, Back once → the table
  from before the search.
- [ ] **Step 2: Run** `npx playwright test e2e/entries.test.ts` → FAIL.
- [ ] **Step 3: Implement** to spec, The toolbar (PC), The filter, The table (PC),
  Limits and states. A click on a row outside its tick box, ▶, ⋯ and links calls
  `openForm` (`#lib/entry-link.js`) with the row's Customer › project link, which has
  `data-entry-form` and is the keyboard's way in; its accessible name holds the times,
  the project, the description and the overlap. A running row's hours, its day total
  and the toolbar total tick with `nowTicker` (`#lib/components/calendar/now.svelte.js`).
  Flashed rows are marked as Today's `TodayEntries` marks them.
- [ ] **Step 4: Run** the e2e file, `npm run check`, `npm run lint` → PASS; and
  Copy-out's and Reports' tests, unchanged:
  `npx vitest run src/lib/server/screens/copy-out.test.ts src/lib/server/screens/reports.test.ts`
  and `npx playwright test e2e/copy-out.test.ts e2e/reports.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: rebuild entries as a day-grouped table`.

### Task 6: Selecting and bulk changes (PC)

**Files:**
- Create in `src/lib/components/timesheet/`: `BulkBar.svelte`, `BulkForm.svelte`
  (round 1's `ChangeForm` reshaped to `pc-bulk`), `BulkDialog.svelte`,
  `selection.svelte.ts`, `selection.test.ts`
- Modify: `DayTable.svelte`, `Toolbar.svelte`, `+page.svelte`,
  `src/lib/components/entry/ProjectPicker.svelte` (an optional `placeholder` prop,
  default unchanged)
- Test: `e2e/entries.test.ts`

**Interfaces:**
- `createSelection(rows: () => string[])` → `{ readonly ids: string[]; has(id: string): boolean; toggle(id: string, shift: boolean): void; setMany(ids: string[], on: boolean): void; clear(): void; state(ids: string[]): 'none' | 'some' | 'all' }`. Shift ticks the run between the last toggled row and this one, in display order (call 31). Ids no longer in `rows()` drop out. The page clears it when `data.back` changes and after a successful bulk action (Review Focus 1, call 19).
- `BulkForm` props `{ choices: FilterOptions; chosen: { id: string; version: string }[]; failure: BulkFailure | null; back: string; query: string }`, posting to `?/apply&<query>`: Customer › project (`ProjectPicker`, placeholder "Keep as it is"), Activity and Location (Keep as it is, None, rows), Reference (Keep as it is, a field, Clear it), Find and Replace with; copy per Global Constraints.

- [ ] **Step 1: Write the failing tests**: unit — shift runs in both directions, a
  day's state, ids dropping when rows change; e2e — a day head's box ticks its rows
  (mixed when some are); shift-click ticks a run; the bulk bar takes the toolbar's
  place with "n selected · h:mm" and the set it acts on ("This month · “printer”"),
  the chips still under it; Edit… opens "Edit n entries"; set Location and replace
  `Standup` with `Daily standup`, apply → strip "Done: Edit n entries.", the rows
  changed; Undo restores them all; tick two, Delete → gone at once, Undo → back;
  Review Focus 1: tick rows, change the range → no ticks, the toolbar back; Review
  Focus 3: a ticked entry edited elsewhere (`editElsewhere`), apply → the refusal in
  the dialog naming it; JavaScript off: tick boxes, Edit → the bulk form on the page,
  apply; `all=1` ticks every row.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** to spec, Selecting and bulk changes (PC).
- [ ] **Step 4: Run** the e2e file, the unit tests, check and lint → PASS.
- [ ] **Step 5: Commit** `feat: tick rows to edit or delete them together`.

### Task 7: The phone

**Files:**
- Create in `src/lib/components/timesheet/`: `PhoneList.svelte`, `Sheet.svelte` (a
  bottom sheet on native `<dialog>`; scrim, Escape and Back close it),
  `FilterSheet.svelte`
- Modify: `Toolbar.svelte`, `RowMenu.svelte` (phone: a sheet headed by the row:
  customer › project, then the date, start–end and activity; 48 px items),
  `BulkBar.svelte`, `BulkDialog.svelte` (a sheet below `lg`), `+page.svelte`
- Test: `e2e/entries.test.ts` (390 px), `e2e/touch-targets.test.ts` (add `/entries`)

- [ ] **Step 1: Write the failing e2e tests** at 390 px: Entries from the bottom bar;
  the toolbar's Filter and Select, the search under them, the count and total under
  that; day heads in `caps` with totals; rows at least 64 px with the project bar, a
  leading ⋯, start over end ("Running" under the start when running), customer ›
  project, the muted lines, the duration at the right; the "+"'s box intersects no
  row's duration and no toolbar control; the filter sheet: Last week applies at once
  and "Show n entries" updates, Show closes it, a scrim tap keeps the choice; search
  `VPN`; a tap on a row opens its entry form as a sheet; ⋯ opens the sheet naming its
  row, Copy opens the form; ⋯ Restart on a finished row runs it in the timer bar
  (call 17); Select → tick boxes in
  place of ⋯ and on day heads, the "+" hidden, the bulk bar "n selected" over the
  total with Edit…, Delete, Done; Edit… as a sheet, set Activity to Research, apply,
  Undo; Done clears the ticks; every target at least 44 px; JavaScript off: Select is
  a link to `select=1`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** to spec, The phone.
- [ ] **Step 4: Run** → PASS, plus check and lint.
- [ ] **Step 5: Commit** `feat: lay the table out for the phone`.

### Task 8: The Calendar's filter

**Files:**
- Modify: `src/lib/calendar/dates.ts` (`calendarHref(view: View, date: string, scope = ''): string`, appending `&<scope>` when set) and every caller (`CalendarToolbar`, `MonthGrid`, `DatePicker`, `TimeGrid`, `calendar/+page.svelte`), which pass the page's `scopeQuery`
- Modify: `src/lib/server/screens/calendar.ts` (`calendarFor` takes `scope: Scope`:
  overlaps from every entry found, then the entries and every total from the matching
  ones only), `src/lib/components/calendar/types.ts` (`scope: Scope`, `scopeQuery:
  string`, `filtered: boolean`, `options: FilterOptions`),
  `src/routes/(app)/calendar/+page.server.ts`, `CalendarToolbar.svelte` (the Filter
  button holding `FilterPanel` with `range={false}`; "(filtered)" after the totals),
  `calendar/+page.svelte` (the chips under the toolbar), `live.ts` (a Calendar target
  keeping `view` and `date`)
- Test: `src/lib/server/screens/calendar.test.ts`, `src/lib/calendar/dates.test.ts`, `e2e/calendar.test.ts`

**Interfaces:**
- Consumes: Task 2's `Scope`, `readScope`, `scopeQuery`, `scopeCount`, `matchesScope`;
  Task 5's `FilterPanel`, `FilterButton`, `FilterChips`, `ScopePicker`; Task 3's
  `filterOptions`.

- [ ] **Step 1: Write the failing tests**: unit — `calendarFor` with a project scope
  lists only its entries and `totals`, `periodTotal` and `weekTotal` count only them;
  a shown entry overlapping a filtered-out one keeps `overlaps` (call 38);
  `calendarHref` with a scope; e2e — PC week and phone day: filter on Myself ›
  time-keep → only its blocks, the totals reduced and "(filtered)", the chip; ‹ a week
  back still filtered, as are the views, Today and the date picker; Clear filters.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** to spec, The Calendar's filter.
- [ ] **Step 4: Run** the unit tests and `npx playwright test e2e/calendar.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: filter the calendar by project, activity and location`.

### Task 9: Look, critique and docs

**Files:**
- Modify: as the critique finds; `DESIGN.md` (the Filter control and chips, the
  day-grouped ruled table, the row menu, the bulk bar and dialog, bottom sheets, the
  phone's rows); `docs/app.md` (the Entries screen rewritten, the Calendar's filter,
  the layout rows for `src/lib/filter/`, `components/timesheet/`,
  `screens/timesheet.ts`; `components/entries/` removed)

- [ ] **Step 1:** Seed a month (`TZ=Europe/Budapest npx tsx scripts/seed-month.ts
  <db> <user> <password>`), run the app as `.claude/agents/usability-gate.md`
  describes, and screenshot `/entries` (the table, filtered, the popover and sheet,
  the menu, ticked, the bulk dialog) and the filtered Calendar at 390 and 1440 px in
  light and dark, under `.autopilot/screenshots/14/build/`.
- [ ] **Step 2:** Run `impeccable:impeccable` critique and audit (its detector over
  the changed `.svelte` files and the rendered pages) against the spec and mockups;
  its visual choices go to the stand-in with the screenshots.
- [ ] **Step 3:** Fix what they find; each fix keeps the suites green.
- [ ] **Step 4:** Record `DESIGN.md` from what shipped (impeccable's documenter) and
  update `docs/app.md`.
- [ ] **Step 5: Run** `npm run check`, `npm run lint`, `npm run test:unit`,
  `npm run test:e2e` → all pass (Copy-out's and Reports' tests among them,
  unchanged).
- [ ] **Step 6: Commit** `docs: record the timesheet table's design`.

Approved by the operator stand-in, revision 2, 2026-10-20.
