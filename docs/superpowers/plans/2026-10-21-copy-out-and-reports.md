# Copy-out and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redo Copy-out and Reports in item 11's direction and the patterns of items
12–14 (roadmap item 15c), and remove round 1's filter bar.

**Architecture:** A browser-safe output model (`src/lib/filter/output.ts`) reads and
writes the columns and options in the address and in a kept cookie value, beside item
14's filter model. One server reader (`src/lib/server/screens/output.ts`) resolves a
request into the filter, the columns and the options, address over kept, and says what
to keep; Copy-out, its CSV route and Reports all use it, with Entries' `listInput`
(no limit, oldest first) in place of round 1's `readSearch`/`searchInput`. The pages
reuse Entries' toolbar, filter popover and sheet, chips and search, generalised to
take the screen's path and carry the output choice; Copy-out gets an output band and
a ruled sheet, Reports four ruled lists. The rows, the writers, the CSV format and the
totals' arithmetic do not change; nothing in the core, the database or the MCP does.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind 4, shadcn-svelte,
Lucide, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-copy-out-and-reports-design.md` (read it
whole; cited as "spec, <section>", its calls as "call <n>"). Mockups:
`docs/superpowers/specs/2026-10-21-copy-out-and-reports/` (`pc-copy`, `ph-copy`,
`pc-reports`, `ph-reports`, each `-light`/`-dark`). Where a mockup differs from the
spec, the spec wins: on the phone every control keeps the 56 px right margin clear of
the "+" (the mockup's buttons reach 334 px); the sidebar keeps the shell's own icons.
Round 1's plans (`2026-10-19-copy-out.md`, `2026-10-19-reports.md`) describe the
behaviour kept.

## Global Constraints

- Imports use `#lib/...`. Reads only: `openCore(getDb(), user.id, 'ui', () => now)`
  and `core.entries.list`, for the request's user; no write, no core, database or MCP
  change (spec, Constraints; call 29).
- `outputRows`, `outputPieces`, `toTsv`, `toCsv`, `safeText`, `formatDuration`,
  `csvName` and the CSV response (BOM, header row, `text/csv; charset=utf-8`,
  attachment, `time-keep-<from|all>-<to|all>.csv`, a refused query a 400 with the
  screen's message) are unchanged; their tests keep passing.
- Defaults: columns all ten in `COLUMNS` order; Round to 5 minutes on, Split at
  midnight off, Duration `hm` (call 14). Column order is always `COLUMNS` order (call 9).
- Kept per device, `path: '/'`, `maxAge` 400 days, `sameSite: 'lax'`, `httpOnly`:
  `output_range` (the preset, shared by Copy-out and Reports; never `custom`; written
  as Entries writes `entries_range`, call 5) and `output_choice` (the columns and
  options, call 7). The address beats the kept values; an address naming columns or
  options writes `output_choice`, unless it names no column (call 26). The CSV route
  reads both cookies and writes neither (call 22).
- DESIGN.md is the visual system: ruled tables in a surface panel, `caps` heads,
  `figures` on every date, time and duration, type 12, 14, 15, 17, 21 px only; Copy is
  the screen's one primary (call 10), the header's "+ New entry" the only other blue
  fill; red only for a refusal or "Choose at least one column."; 36 px controls from
  `lg` (1024 px), 44 px below; nothing in the phone "+"'s column (`max-lg:pr-14`).
- Copy, exactly: "Columns", "Round to 5 minutes", "Split at midnight", "Duration",
  "h:mm", "Decimal", "Copy <n> rows" / "Copy 1 row", "Download CSV", "Copied <n> rows." /
  "Copied 1 row.", "Copy failed; select the table and copy it.", "Choose at least one
  column.", "<n> rows · <total>" / "1 row · <total>", "<n> entries · <total>" / "1 entry
  · <total>", "1 running entry left out." / "<n> running entries left out.", "No entries
  match.", "Clear filters", "Total", "Days", "Weeks", "Customers", "Projects",
  "Options · <h:mm|decimal>, <rounded|exact>[, split]" (e.g. "Options · h:mm, rounded",
  "Options · decimal, exact, split"), "Options", "Done", "Apply", "COLUMNS", "OPTIONS".
- Labels: days "Thu 2026-10-01" (Entries' `labelOf`), weeks "W40 · 2026-09-28 – 10-04",
  the Sunday in full when its year differs ("W01 · 2026-12-28 – 2027-01-03") (calls 23,
  28). Totals follow the Duration option everywhere (call 27).
- Without JavaScript both screens work as `GET` pages (spec, Without JavaScript); parts
  only these pages have carry `data-nojs`.
- WCAG 2.2 AA in both themes; chips are `aria-pressed` toggle buttons; the segmented
  Duration is a radio group; popovers and sheets return focus to their openers.
- Round 1's `e2e/copy-out.test.ts` and `e2e/reports.test.ts` are rewritten, keeping
  each round 1 behaviour tested: the rows as written (24:00, a date-and-time end, the
  formula guard), rounding, split, decimal, the CSV's header, BOM and file name, the
  CSV's 400s, signed-out CSV → `/login`, the running line, the totals equal to the
  sheet, the sidebar current item.

## Review Focus

1. **A round 1 address** (`/copy-out?from=2026-10-01&to=2026-10-31&customerId=x&text=y&show=1&col=date`,
   bookmarked before this change): no crash and no error; the unknown names are ignored
   and the view reads as the kept range with the kept choice. Task 1 tests it.
2. **No column on, then a reload or a CSV**: the screen says "Choose at least one
   column." with Copy and Download CSV off; the kept columns stay as they were, so the
   next plain visit shows them; `/copy-out/csv?cols=` is a 400 with that message.
   Tasks 2 and 3 test it.
3. **A custom range on Copy-out, then Reports**: the custom range is not kept;
   Reports opens on the kept preset, not on the custom dates, and not on an error.
   Task 2 tests it.
4. **An open-ended custom range** (only From): "From 2026-10-01" names it, every entry
   from then on is listed oldest first with no 500-row cap. Task 1 tests it.
5. **A week across New Year** in Reports: "W01 · 2026-12-28 – 2027-01-03". Task 4
   tests it.

---

### Task 1: The output model and its reader

**Files:**
- Create: `src/lib/filter/output.ts`, `src/lib/filter/output.test.ts`,
  `src/lib/server/screens/output.ts`, `src/lib/server/screens/output.test.ts`
- Modify: `src/lib/server/screens/copy-out.ts` (`CopyOutOptions` becomes an alias of
  `OutputOptions`)

**Interfaces:**
- Produces, browser-safe, in `src/lib/filter/output.ts`:
  - `export type OutputOptions = { round: boolean; split: boolean; duration: DurationFormat }`
  - `export type OutputChoice = { columns: Column[]; options: OutputOptions }`
  - `export const DEFAULT_CHOICE: OutputChoice`
  - `export function readChoice(params: URLSearchParams, kept: string | undefined):
    { choice: OutputChoice; named: boolean; columnsError: string | null }` — `cols`
    (comma-separated column names; unknown names dropped, order always `COLUMNS`),
    `round` and `split` (`1` on, `0` off), `duration` (`hm` | `decimal`); each name the
    address lacks comes from `kept` (a string in the same format), then the default.
    `named` is true when the address has any of the four. `cols` present but empty (or
    only unknown names) gives `columns: []` and `columnsError: 'Choose at least one column.'`.
  - `export function choiceQuery(choice: OutputChoice): string` — always all four
    names, e.g. `cols=date,start,end&round=1&split=0&duration=hm`.
  - `export function optionsLabel(options: OutputOptions): string` — "Options · h:mm,
    rounded" etc. (Global Constraints).
- Produces, server, in `src/lib/server/screens/output.ts`:
  - `export const OUTPUT_RANGE_COOKIE = 'output_range'`,
    `export const OUTPUT_CHOICE_COOKIE = 'output_choice'`
  - `export type OutputView = { filter: Filter; choice: OutputChoice }`
  - `export function readOutput(params: URLSearchParams, cookies: { range?: string;
    choice?: string }, today: string): { view: OutputView; error: string | null;
    columnsError: string | null; keepRange: Preset | null; keepChoice: string | null }`
    — `readFilter` for the filter (kept range from `cookies.range`); `keepRange` as
    Entries decides (a named preset, or a first visit with neither address range nor
    cookie); `keepChoice` is `choiceQuery(choice)` when `named` and no `columnsError`,
    else null.
  - `export function keepOutput(cookies: Cookies, keep: { keepRange: Preset | null;
    keepChoice: string | null }): void` — sets the two cookies (Global Constraints).
  - `export function outputQuery(view: OutputView): string` — `filterQuery(filter)` +
    `&` + `choiceQuery(choice)`.
  - `export function outputInput(filter: Filter, zone: string): Record<string, unknown>`
    — `listInput` with `limit` removed and `order: 'asc'`.

- [ ] **Step 1: Write the failing tests** in `src/lib/filter/output.test.ts`:
  `readChoice(new URLSearchParams(''), undefined)` → `DEFAULT_CHOICE`, `named: false`;
  `cols=description,date` → columns `['date', 'description']`; `cols=date,bogus` →
  `['date']`; `cols=` → `[]` with "Choose at least one column."; `round=0&duration=decimal`
  → round false, decimal, columns from `kept`; `kept` = `cols=date&round=0&split=1&duration=decimal`
  with an empty address → that choice, `named: false`; `choiceQuery(DEFAULT_CHOICE)` →
  `cols=date,start,end,duration,customer,project,activity,location,reference,description&round=1&split=0&duration=hm`;
  `readChoice(new URLSearchParams(choiceQuery(c)), undefined).choice` equals `c`;
  `optionsLabel` for the default → "Options · h:mm, rounded", for decimal, unrounded,
  split → "Options · decimal, exact, split".
- [ ] **Step 2: Write the failing tests** in `src/lib/server/screens/output.test.ts`
  (today `2026-10-21`): an empty address and no cookies → This month
  (2026-10-01–2026-10-31), the default choice, `keepRange: 'this-month'`,
  `keepChoice: null`; cookie range `last-month` → September, `keepRange: null`;
  `range=last-week` → `keepRange: 'last-week'`; Review Focus 4
  (`range=custom&from=2026-10-01`) → `keepRange: null`, filter from `2026-10-01`, to
  `''`, and `outputInput` with a `from` and no `to`; `cols=` → `columnsError` set and
  `keepChoice: null`; `cols=date&round=0` → `keepChoice` =
  `cols=date&round=0&split=0&duration=hm`; Review Focus 1 (the round 1 address above,
  cookie range `last-month`) → September, the default choice, `error: null`;
  `outputInput` has no `limit`, `order: 'asc'`, and `from`/`to` instants of the range;
  `outputQuery` reads back through `readOutput` to the same view.
- [ ] **Step 3: Run** `npx vitest run src/lib/filter/output.test.ts src/lib/server/screens/output.test.ts` → FAIL.
- [ ] **Step 4: Implement** the two files as in Interfaces; alias `CopyOutOptions`.
- [ ] **Step 5: Run** the two test files → PASS; `npm run check` → clean.
- [ ] **Step 6: Commit** `feat: add the output choice and its reader`.

### Task 2: Copy-out and Reports read the new address

**Files:**
- Modify: `src/lib/server/screens/copy-out.ts` (`sheetFor`), `src/lib/server/screens/reports.ts`
  (`reportFor`), `src/routes/(app)/copy-out/+page.server.ts`,
  `src/routes/(app)/copy-out/csv/+server.ts`, `src/routes/(app)/reports/+page.server.ts`
- Create: `src/routes/(app)/copy-out/copy-out-routes.test.ts`,
  `src/routes/(app)/reports/reports-routes.test.ts` (in the style of
  `src/routes/(app)/entries/entries-routes.test.ts`)
- Remove from `copy-out.ts`: `readOptions`, `readCopyOut`, `optionsQuery`,
  `copyOutQuery`, `monthRange`, the `CopyOut` type; from `reports.ts`: `readReport`,
  `reportQuery`, `ReportQuery` (and their tests)

**Interfaces:**
- Consumes: Task 1.
- Produces: `sheetFor(core: Core, view: OutputView, zone: string)` and
  `reportFor(core: Core, view: OutputView, zone: string)` (same results as now, reading
  through `outputInput`). The loads return, for both screens:
  `{ filter, error, choice, columnsError, options: filterOptions(core, { archived: true }),
  hints: Record<Preset, string>, query: outputQuery(view), count, total, running }`;
  Copy-out adds `rows`, `heads`, `csvHref: '/copy-out/csv?' + outputQuery(view)`;
  Reports adds `days`, `weeks`, `customers`, `projects` (each `{ key, label, duration }[]`)
  and `entries`. `count` is the rows (Copy-out) or finished entries (Reports); `total`
  is `formatDuration(minutes, choice.options.duration)`.

- [ ] **Step 1: Write the failing route tests**: Copy-out's load with `range=last-month`
  sets `output_range=last-month`; with `cols=date,duration` sets `output_choice` and
  returns heads `['Date', 'Duration']`; with `cols=` returns `columnsError`, no rows, and
  sets no `output_choice` (Review Focus 2); Review Focus 3 (Copy-out with
  `range=custom&from=…&to=…`, then Reports with only the cookies) → Reports' filter is
  the kept preset with `error: null`; Reports' `total` equals Copy-out's for the same
  address, rounded and not; the CSV route with only `range=last-month` and an
  `output_choice` cookie of `cols=date,description&…` answers a header
  `Date,Description` and sets no cookie; with `cols=` → 400 "Choose at least one
  column."; a search over 200 characters → 400 with the core's message.
- [ ] **Step 2: Run** `npx vitest run src/routes/(app)/copy-out src/routes/(app)/reports` → FAIL.
- [ ] **Step 3: Implement**: both loads call `readOutput` with the two cookies and
  `keepOutput`; the CSV route calls `readOutput` and never `keepOutput`; delete the
  round 1 readers listed above. The pages may render the new data plainly until Tasks
  3–4 (keep `npm run check` clean).
- [ ] **Step 4: Run** the route tests and `npx vitest run src/lib/server/screens` → PASS;
  `npm run check` → clean.
- [ ] **Step 5: Commit** `feat: read copy-out and reports from the new filter`.

### Task 3: Copy-out on the PC and the phone

**Files:**
- Modify: `src/lib/components/timesheet/live.ts` (`applyForm` for any screen's path),
  `src/lib/components/timesheet/Toolbar.svelte` (props `action`, `noun`, optional
  Select, `hidden` fields passed to the filter panel and sheet),
  `src/lib/components/timesheet/FilterSheet.svelte` (the `hidden` snippet),
  `src/routes/(app)/entries/+page.svelte` (the new Toolbar props, behaviour unchanged)
- Create: `src/lib/components/output/ColumnChips.svelte`, `OutputOptions.svelte`
  (replaces `components/copy-out/OutputOptions.svelte` and `OutputFields.svelte`,
  deleted), `ChoiceForm.svelte` (the `GET` form `id="output"` holding the filter's
  hidden fields, the chips and options; live with JavaScript, an Apply submit without),
  `RunningLine.svelte`
- Modify: `src/lib/components/copy-out/CopyRows.svelte` (the primary "Copy <n> rows",
  disabled with no column), `SheetTable.svelte` (Entries' panel, wrapping, the Total
  row), `src/routes/(app)/copy-out/+page.svelte`
- Test: `e2e/copy-out.test.ts` (rewritten; a `describe` at 390 × 844)

**Interfaces:**
- Consumes: Task 2's Copy-out data.
- Produces: `applyForm(form, opts)` building, for a form whose action is
  `/copy-out` or `/reports`, `?<filterQuery(formFilter(form))>&<choiceQuery(<the form's
  cols/round/split/duration>)>`; `Toolbar` props `{ action: string; noun: [string, string];
  hidden?: Snippet; selectHref?: string; onSelect?: () => void; … }` (Select shown only
  when `selectHref` or `onSelect` is given); `ColumnChips` `{ columns: Column[]; form: string }`;
  `OutputOptions` `{ options: OutputOptions; form: string; size: 'pc' | 'phone' }`;
  `RunningLine` `{ running: number }`. Task 4 reuses all four.

- [ ] **Step 1: Build the PC** (spec, Copy-out: The output band, The sheet; Shared):
  the toolbar with "rows"; chips under it; the running line; the band (Columns chips,
  a `border` rule, the options line, Copy and Download CSV at its right with the status
  under them; "Choose at least one column." in red under the chips with both buttons
  off, focusable, `aria-disabled`); the sheet as a surface panel, Entries' head band and
  hairlines, `figures`, Duration right-aligned, text columns wrapping (no `truncate`),
  the panel `overflow-x-auto` only, the Total row under Duration when that column is on;
  the empty state with Clear filters. A chip or option change navigates at once with
  `replace`, keeping focus on the control.
- [ ] **Step 2: Build the phone** (spec, The phone): the toolbar; Copy and Download CSV
  full width, stacked, 44 px; COLUMNS and OPTIONS section heads; chips and options at
  44 px; no sheet below `lg`; everything inside `max-lg:pr-14`.
- [ ] **Step 3: Without JavaScript** (spec, Without JavaScript): the filter as Entries'
  no-JS form with the choice as hidden fields; the chips as visible checkboxes and the
  options as checkbox and radio inputs in `ChoiceForm` with "Apply"; no Copy.
- [ ] **Step 4: e2e**, rewriting `e2e/copy-out.test.ts`: the spec's Gate tasks 1–4, 6
  and 8 at 1440 px (Last month from Filter changing the count with no submit; chips off
  removing columns at once; Copy and the clipboard's tab-separated rows, read with
  `context.grantPermissions(['clipboard-read','clipboard-write'])`; a project chip and
  its removal; the CSV's header row being the columns on; Round off and Decimal; Split
  adding one row for the seeded past-midnight entry; kept after Entries and back, with
  Entries on its own range; "T-4" narrowing; "No entries match."; the running line);
  Review Focus 2 (all chips off: the message, both buttons disabled, a plain revisit
  shows the kept columns); no Description cut (each Description cell's `scrollWidth <=
  clientWidth`) and the sheet panel not wider than the main column at 1440; the round
  1 behaviours in Global Constraints; at 390 px: no sheet, no horizontal scroll
  (`scrollWidth <= 390`), every control ending left of `390 - 56`, Copy-out reached
  from More; without JavaScript: a chip unticked and Apply changes the sheet.
- [ ] **Step 5: Run** `npm run check`, `npx playwright test e2e/copy-out.test.ts
  e2e/entries.test.ts e2e/touch-targets.test.ts` → PASS.
- [ ] **Step 6: Commit** `feat: redo copy-out with an output band and sheet`.

### Task 4: Reports, and round 1's filter bar removed

**Files:**
- Modify: `src/lib/server/screens/reports.ts` (day and week labels, calls 23, 28),
  `src/lib/server/screens/reports.test.ts`, `src/routes/(app)/reports/+page.svelte`,
  `src/lib/components/reports/TotalsTable.svelte` (a surface panel of ruled rows; an
  optional project dot)
- Create: `src/lib/components/output/OptionsSheet.svelte` (the phone's Options button
  and bottom sheet, on item 14's `Sheet`; a `<details>` without JavaScript)
- Delete: `src/lib/components/entries/` (both files), `src/lib/components/narrowing.svelte.ts`,
  and in `src/lib/server/screens/entries.ts` `readSearch`, `searchInput`,
  `searchFilters`, `searchPath`, the `Search` type and their tests (once nothing
  imports them)
- Test: `e2e/reports.test.ts` (rewritten; a `describe` at 390 × 844)

**Interfaces:**
- Consumes: Task 2's Reports data; Task 3's `Toolbar` (noun "entries"), `ChoiceForm`,
  `OutputOptions`, `RunningLine`.
- Produces: `Total` gains `colour?: number` on Projects rows (the project's palette
  number, from `filterOptions`), for the dot.

- [ ] **Step 1: Write the failing unit tests** in `reports.test.ts`: a day's label
  `Thu 2026-10-01`; a week's `W40 · 2026-09-28 – 10-04`; Review Focus 5 (an entry on
  2026-12-31) → `W01 · 2026-12-28 – 2027-01-03`. Run `npx vitest run
  src/lib/server/screens/reports.test.ts` → FAIL; implement; → PASS.
- [ ] **Step 2: Build** (spec, Reports): the toolbar with "entries", chips, running line;
  on the PC the options line always shown under them, then Days at the left and Weeks,
  Customers, Projects stacked at the right, each a section head over a surface panel
  with a Total row; on the phone `OptionsSheet` ("Options · h:mm, rounded", the sheet
  with the options at 44 px and a pinned "Done"), then Customers, Projects, Weeks,
  Days edge to edge; durations only; the empty state.
- [ ] **Step 3: Delete** round 1's filter bar and readers (Files); `rg "EntryFilters|narrowing|readSearch|searchInput|searchFilters|searchPath" src e2e`
  → nothing.
- [ ] **Step 4: e2e**, rewriting `e2e/reports.test.ts`: the spec's Gate tasks 4 (Reports
  on Copy-out's kept range and options), 5 (each list's Total equal to the toolbar's,
  and to Copy-out's total for the same address, rounded and not; the Projects dots) and
  6 ("T-4" narrowing) at 1440 px; at 390 px Gate task 7 (Options sheet, Decimal, every
  total decimal, the order Customers, Projects, Weeks, Days, no horizontal scroll,
  nothing in the "+"'s column); without JavaScript the options' Apply; round 1's
  behaviours in Global Constraints.
- [ ] **Step 5: Run** `npm run check`, `npm run lint`, `npx playwright test
  e2e/reports.test.ts e2e/copy-out.test.ts e2e/touch-targets.test.ts` → PASS.
- [ ] **Step 6: Commit** `feat: redo reports as four ruled lists`.

### Task 5: Look, critique and docs

**Files:**
- Modify: as the critique finds; `DESIGN.md`, `.impeccable/design.json` (impeccable's
  documenter); `docs/app.md` (Copy-out, Reports, the code map rows for
  `components/entries/`, `components/copy-out/`, `components/reports/`,
  `components/output/`, `narrowing.svelte.ts`, `screens/`, `filter/`)

- [ ] **Step 1:** Seed a month (`TZ=Europe/Budapest npx tsx scripts/seed-month.ts …`,
  the app run as `.claude/agents/usability-gate.md` describes) and screenshot Copy-out
  (default, Last month with two chips off, no column on, a project chip, the empty
  state) and Reports (default, Decimal, the phone's Options sheet open) at 390 and
  1440 px in both themes, and Copy-out at 1024 px.
- [ ] **Step 2:** Run `impeccable:impeccable` critique and audit (its detector over
  `src/lib/components/output/`, `copy-out/`, `reports/` and the two pages) on those
  screenshots.
- [ ] **Step 3:** Fix every P0–P2 finding through the implementer and reviewer loop;
  P3s as the reviewer rules.
- [ ] **Step 4:** Record `DESIGN.md` from what shipped (impeccable's documenter): the
  output band and its toggle chips and segmented control, the sheet, the totals lists,
  the Options sheet; drop Copy-out and Reports and their filter bar from the round 1
  carry-overs; update the Layout paragraph listing which screens keep round 1's
  layouts. Update `docs/app.md`'s Copy-out and Reports sections and code map.
- [ ] **Step 5:** Run `npm run check`, `npm run lint`, `npm run test:unit`, `npm run
  test:e2e` → all PASS.
- [ ] **Step 6: Commit** `docs: record the copy-out and reports screens`.

Approved by the operator stand-in, revision 1, 2026-10-21.
