# Today, templates and Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redo Today, the Templates screen and its form, Setup and the phone's
navigation in item 11's Kimai direction and the patterns of items 12–14 (roadmap item
15a).

**Architecture:** No core, database or MCP change. Today reuses item 14's timesheet
rows (`DayTable`, `PhoneList`, `RowMenu`, `Sheet`) for today's entries, shaped by a
new `todayFor`; its template sheet becomes a `Sheet` asking for every blank field. A
template is edited in item 12's `EntryForm` with a template kind, opened in place by
`openForm` and `EntryOverlay` like an entry, its routes still pages without
JavaScript. Templates becomes item 14's ruled table with a row menu. Setup's shaper
gains the Active | Archived | All filter and effective archive state; its screen gets
⋯ menus, rename in place and a create dialog. The bottom bar drops Templates into
More, which becomes a `Sheet`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind 4, shadcn-svelte,
Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-today-templates-setup-design.md` (read it
whole; cited as "spec, <section>", its calls as "call <n>"). Mockups:
`docs/superpowers/specs/2026-10-20-today-templates-setup/` (`pc-today`, `ph-today`,
`ph-template-sheet`, `pc-template-sheet`, `pc-templates`, `pc-templates-menu`,
`ph-templates`, `pc-template-form`, `ph-template-form`, `pc-setup`, `pc-setup-menu`,
`pc-setup-rename`, `pc-setup-create`, `pc-setup-archived`, `ph-setup`, `ph-setup-menu`,
`ph-more`, each `-light`/`-dark`). Where a mockup differs from the spec, the spec wins:
the Ticket sheet asks for Location too (call 15); the sidebar keeps the shell's own
icons.

## Global Constraints

- Imports use `#lib/...`, never `$lib`. Every write is one core call through
  `openCore(getDb(), user.id, 'ui', () => now)`; no rule is enforced in a screen; the
  core's refusals and messages are shown as it gives them.
- Without JavaScript every screen is plain pages (spec, Without JavaScript): Today's
  template sheet a `<details>` posting `?/fromTemplate`; the template form its page;
  Setup's row menu a `<details>` of links and post buttons, rename and create forms
  rendered by `?rename=<id>` and `?new=customer|project|activity|location` (with
  `&customer=<id>` for a project), the filter three links; More a `<details>`.
- DESIGN.md is the visual system: ruled tables and lists, project dots (projects only)
  and the phone's 4 px bar, blue only for running, the primary action, focus and the
  TIMER mark (see Task 9's critique note), red only for Delete, overlaps and refusals;
  type 12, 14, 15, 17, 21 px only; `figures` on times, dates, durations; `caps` heads;
  44 px targets below `lg` (1024 px), 36 px controls from `lg`; nothing in the phone
  "+"'s column (56 px right margin on right-edge controls, ⋯ leading rows).
- Formats: 24-hour `HH:mm`, ISO dates, durations `h:mm` exact and truncated to the
  minute; a running entry counts to now and ticks.
- Dialogs and sheets are native `<dialog>`: item 14's `Sheet.svelte` (`dialog` for a
  centred dialog from `lg`) and item 12's `EntryOverlay`. Menus follow `RowMenu`'s
  menu-button pattern (arrows, Home, End, Escape returns focus to ⋯). No new UI
  dependency.
- Copy: "TEMPLATES", "Manage templates" (phone "Manage"), "TIMER", "LOG", "No
  templates yet.", "Create a template", "TODAY · TUE 2026-10-20" (`caps` over "Today ·
  Tue 2026-10-20"), "Nothing logged today.", "Since 2026-10-19", "Change times", "Log",
  "Start timer", "Cancel"; Templates: "New template", "3 templates" ("1 template"),
  menu "Edit", "Log…" / "Start timer…", "Delete"; form "New template", "Edit template",
  "Name", "Time zone", hint "Blank uses the device's zone", note "Any field may stay
  blank; only the blanks are asked when it is used."; Setup: "Active", "Archived",
  "All", "CUSTOMERS AND PROJECTS", "ACTIVITIES", "LOCATIONS", "+ New customer", "+ New
  activity", "+ New location", menu "Rename", "Add project", "Archive", "Unarchive",
  dialogs "New customer", "New project", "New activity", "New location", "Customer",
  "Name", "Create", chip "Archived", empty "No customers yet.", "No activities yet.",
  "No locations yet.", "No archived customers.", "No archived activities.", "No
  archived locations."; More lists "Templates", "Setup", "Copy-out", "Reports",
  "History", "Account", "Users", "Backup", "Sign out".
- WCAG 2.2 AA in both themes; every menu, sheet, dialog and rename works by keyboard
  and returns focus (DESIGN.md, Focus returns): after a done action to the strip's
  Undo; a closed menu, sheet or dialog to its opener; a cancelled rename to the row's ⋯.
- Round 1's e2e tests for Today (`e2e/phone.test.ts`), Templates and Setup
  (`e2e/setup.test.ts`, `e2e/shell.test.ts`) are rewritten for the new screens, not
  deleted untested.

## Review Focus

1. **A template with a customer but no project** (or whose customer has no active
   projects): the sheet offers only that customer's active projects; with none it says
   so and Log is off, never a core error page. Task 3 tests it.
2. **An entry from yesterday still running today**: listed on Today with "Since
   2026-10-19", not counted in today's total, its hours ticking. Task 2 tests it.
3. **The template form opened over a screen, then Back**: it closes with the screen
   unchanged; a Save returns to the screen it was opened over (Today, Templates), not
   to `/templates`. Task 5 tests it.
4. **A refused rename or create** (an empty or duplicate name): the row stays in rename
   (the dialog stays open) with the core's message beside the field, focused, the
   typed name kept. Task 8 tests it.
5. **A template naming an archived activity, location or project**: the form shows it
   marked "(archived)" and a save that does not touch it keeps it. Task 4 tests it.

---

### Task 1: The phone's navigation

**Files:**
- Modify: `src/lib/shell.ts`, `src/lib/shell.test.ts` (or the existing shell unit test)
- Modify: `src/lib/components/shell/BottomBar.svelte`
- Test: `e2e/shell.test.ts`

**Interfaces:**
- Produces: `barItems(): NavItem[]` → Today, Calendar (`/calendar?view=day`), Entries;
  `moreItems(isAdmin: boolean): NavItem[]` → Templates, Setup, Copy-out, Reports,
  History, Account, (Users, Backup); `inMore(routeId: string | null, isAdmin: boolean):
  boolean` (true for every More route and their sub-routes, e.g. `/(app)/templates/[id]`).

- [ ] **Step 1: Write the failing unit tests**: `barItems` labels are `['Today',
  'Calendar', 'Entries']`; `moreItems(false)` labels start `['Templates', 'Setup',
  'Copy-out', 'Reports', 'History', 'Account']`, `moreItems(true)` end `['Users',
  'Backup']`; `inMore('/(app)/templates/[id]', false)` is true, `inMore('/(app)/entries',
  false)` false.
- [ ] **Step 2: Run** `npx vitest run src/lib/shell` → FAIL.
- [ ] **Step 3: Implement** in `shell.ts`.
- [ ] **Step 4: BottomBar**: four equal cells (Today, Calendar, Entries, More), More
  current when `inMore`. More opens a `Sheet` (not `dialog`) headed "More" (a visually
  hidden heading is fine) with 48 px rows (icon + label, the current one marked with
  `aria-current="page"` and the accent fill), a `border` rule, then Sign out (the
  existing form). It sits above the bar (the sheet's bottom offset is the bar's height
  plus the safe area). Choosing an item, Escape, the scrim and Back close it; focus
  returns to More. Without JavaScript it stays the existing `<details>`.
- [ ] **Step 5: e2e** (phone, 390 px): the bar has four cells; More lists the items in
  order; Templates is reached in two taps and More's cell is current there; Escape and a
  scrim tap close the sheet; without JavaScript the `<details>` still lists them.
- [ ] **Step 6: Run** the unit and `npx playwright test e2e/shell.test.ts` → PASS.
- [ ] **Step 7: Commit** `feat: move templates into the phone's more sheet`.

### Task 2: Today's data

**Files:**
- Modify: `src/lib/server/screens/today.ts`, `src/lib/server/screens/today.test.ts`
- Modify: `src/lib/server/screens/timesheet.ts` (extract the row builder),
  `src/lib/components/timesheet/types.ts`

**Interfaces:**
- Produces:
  - `TableRow` gains `since: string | null` (the start's `YYYY-MM-DD` when it is before
    the day shown; `null` on Entries).
  - `tableRow(e: EntryItem, ctx: { colours: Map<string, number>; overlaps: Set<string>;
    since: string | null }): TableRow` exported from `timesheet.ts`, used by
    `timesheetFor` and `todayFor`.
  - `todayFor(core: Core, zone: string, now: number): TodayData` in `today.ts`, with
    `TodayData = { day: TableDay; templates: TemplateCard[] }` where `day.date` is today,
    `day.label` "Tue 2026-10-20", `day.rows` the entries touching today newest start
    first, `day.totalMs` only the rows whose start date (in their start zone) is today,
    running ones to `now`; `TemplateCard` (in `components/today/types.ts`) as today plus
    `colour: number | null` and `runs: boolean`, sorted by name.

- [ ] **Step 1: Write the failing tests** `todayFor`: (a) two entries today 09:30–09:45
  and 10:00–12:18 → rows newest first, `totalMs` 2 h 33 min; (b) an entry from
  yesterday 22:00 still running → listed with `since: '<yesterday>'`, not in `totalMs`;
  (c) an overlapping pair today → both `overlaps: true`; (d) templates come by name with
  their project's colour and `runs` true for one with no end and no duration.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/screens/today.test.ts` → FAIL.
- [ ] **Step 3: Implement** `tableRow` (moved out of `timesheetFor`, which keeps its
  tests green) and `todayFor` (one `entries.list` over `todayRange`, overlaps from
  `overlapping` over today ± a day, colours from `colourOf`).
- [ ] **Step 4: Run** the screens' unit tests → PASS.
- [ ] **Step 5: Commit** `feat: shape today's entries as timesheet rows`.

### Task 3: The Today screen

**Files:**
- Modify: `src/routes/(app)/+page.server.ts`, `src/routes/(app)/+page.svelte`
- Modify: `src/lib/server/screens/actions.ts` (`fromTemplateInput` passes `activityId`
  and `locationId`; blank means the template's)
- Replace: `src/lib/components/today/Templates.svelte`, `TemplateSheet.svelte`
  (delete `TodayEntries.svelte`, `SectionHead.svelte` if unused)
- Modify: `src/lib/components/timesheet/DayTable.svelte`, `PhoneList.svelte` (props
  `selectable = true`, `dayHeads = true`; Today passes `false` for both)
- Test: `src/lib/server/screens/actions.test.ts`, `e2e/phone.test.ts` (rewritten as
  Today's tests), a new `e2e/today.test.ts` for the PC

**Interfaces:**
- Consumes: Task 2's `todayFor`, `TemplateCard`, `TableRow.since`.
- Produces: `TemplateSheet.svelte` props `{ template: TemplateCard; projects:
  PickerProject[]; activities: PickerOption[]; locations: PickerOption[]; back: string;
  open: boolean; onclose: () => void; failure: ActionFailure | null }`, usable over any
  screen (Task 6 uses it). The `fromTemplate` action reads `back` (`safeBack`, default
  `/`) and returns there with the strip; a refusal re-renders the sheet open.

- [ ] **Step 1: Write the failing unit test**: `fromTemplateInput` with `activityId` and
  `locationId` posted sends them; posted blank, leaves them out.
- [ ] **Step 2: Implement** it; run → PASS.
- [ ] **Step 3: Server**: the load returns `todayFor(...)`, the pickers (active
  projects, activities and locations, as the entry form's) and the flash; the action
  reads `activityId`, `locationId`, `back`.
- [ ] **Step 4: Screen** per spec, Today: the TEMPLATES head with Manage, template rows
  (dot, name, muted line, mark; PC mark and chevron at the right, phone mark leading the
  line), the sheet (a `Sheet` with `dialog`, asking every blank field: the picker only
  without a project, from its customer's active projects when it has a customer, with
  "No active projects for <customer>." and Log off when there are none; Activity and
  Location selects only when blank; Reference only when blank; Description always,
  the template's own as placeholder; a "Change times" disclosure with date, start, end,
  duration read like item 12's `TimeRow`; pinned Cancel and Log/Start timer; first
  field focused); the day head with the ticking total; `DayTable`/`PhoneList` with
  `selectable={false}` and `dayHeads={false}`, rows showing "Since …" muted under the
  start when `since`; the empty states. Remove the date, "Signed in as" and zone lines.
- [ ] **Step 5: e2e** (both widths): spec gate tasks 1–2 (Standup asks only the
  description; Ticket asks location, reference, description; the total; the row form
  in place; Copy and Delete with Undo from ⋯; ▶ restart and stop); a template with a
  customer and no project offers only its projects; no templates shows "No templates
  yet." with Create a template; without JavaScript the `<details>` sheet logs.
- [ ] **Step 6: Run** `npm run check`, the unit tests and `npx playwright test
  e2e/phone.test.ts e2e/today.test.ts` → PASS.
- [ ] **Step 7: Commit** `feat: redo today with timesheet rows and template sheets`.

### Task 4: The template form's server

**Files:**
- Modify: `src/lib/server/screens/templates.ts`, its test
- Modify: `src/lib/components/entry/types.ts`
- Modify: `src/routes/(app)/templates/new/+page.server.ts`,
  `src/routes/(app)/templates/[id]/+page.server.ts`
- Test: `src/routes/(app)/templates/templates-routes.test.ts` (create, following
  `entries-routes.test.ts`)

**Interfaces:**
- Produces:
  - `EntryFormData` gains `kind: 'entry' | 'template'` (every existing builder sets
    `'entry'`); `EntryFormValues` gains `name: string` and `customerId: string` (`''`
    for entries); for a template `date` is `''`, `timeZone` the template's zone or `''`.
  - `templateFormData(core: Core, t: Template | null, back: string): EntryFormData`
    (`mode` `'new'` | `'edit'`, `kind: 'template'`, pickers with the template's
    archived refs marked, `back` checked by `safeBack`).
  - `templateFromForm(form: FormData, customerOf: (projectId: string) => string | null):
    Record<string, unknown>`: name; `startTime`/`endTime` as `HH:mm` read by
    `#lib/time-input.js`; `durationMinutes` from a typed duration (`h:mm`); only one of
    end and duration, the one named in the posted `linked` field (`'end'` |
    `'duration'`); blanks as `null`; a project with no customer sent with its customer;
    `customerId` alone allowed.
  - `/templates/new` default action and `/templates/[id]` `?/save` and `?/delete`
    (delete at once with the version; no confirm) redirect to `back` with the strip;
    refusals return `EntryFormFailure` (`action` `'save'` | `'delete'`).

- [ ] **Step 1: Write the failing tests**: `templateFromForm` for "09:30"/"09:45"
  linked end → `{ startTime: '09:30', endTime: '09:45', durationMinutes: null }`;
  "0:30" linked duration → `durationMinutes: 30, endTime: null`; customer only →
  `{ customerId, projectId: null }`; all blank but name → every field `null`. Route
  tests: create saves and redirects to `back` (`/` when posted from Today); a save over
  a stale version is a conflict; delete removes at once and the strip's undo restores
  it; a template naming an archived activity loads it marked archived and a save
  without touching it keeps it.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/screens/templates.test.ts
  src/routes/(app)/templates` → FAIL.
- [ ] **Step 3: Implement**; drop `TEMPLATE_FIELDS`/`templateInput` and the confirm step
  once nothing uses them.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: serve templates to the entry form`.

### Task 5: The template form's UI

**Files:**
- Modify: `src/lib/components/entry/EntryForm.svelte`, `TimeRow.svelte`,
  `ProjectPicker.svelte`, `EntryOverlay.svelte`, `src/lib/entry-link.ts`
- Replace: `src/routes/(app)/templates/new/+page.svelte`, `templates/[id]/+page.svelte`
  (render `EntryForm`); delete `src/lib/components/templates/TemplateForm.svelte` and
  its test
- Modify: `src/lib/components/shell/StartList.svelte` ("Create a template" carries
  `data-entry-form`)
- Test: `src/lib/components/entry/EntryForm.test.ts`, `e2e/templates.test.ts` (new)

**Interfaces:**
- Consumes: Task 4's `EntryFormData.kind`, `templateFormData`, the routes' actions.
- Produces: `openForm(href)` opens `/templates/new?…` and `/templates/<id>?…` in place
  too (the template routes join `FORM_PAGES`); `ProjectPicker` prop `customers?:
  { id: string; name: string }[]` (when given, a customer heading is a choice, posting
  `customerId` with an empty `projectId`).

- [ ] **Step 1: Write the failing component test**: a template-kind form renders Name
  first and focused, no Date, the time row, Customer › project, Activity, Location,
  Reference, Description, Time zone with its hint, the note; no Copy, Restart or Save as
  template; Delete only when editing.
- [ ] **Step 2: Run** `npx vitest run src/lib/components/entry` → FAIL.
- [ ] **Step 3: Implement**: `EntryForm` by `kind` (title "New template" / "Edit
  template" in the overlay; times of day, an end not after the start showing "next
  day"; the `linked` hidden field); `EntryOverlay` posts to the template routes for
  `kind: 'template'` and closes on Delete; the template pages render `EntryForm`.
- [ ] **Step 4: e2e** (both widths): spec gate tasks 3–5 (create Café evening with no
  times → TIMER; start it from the bar's Start list and stop; Standup's end to 09:50 →
  duration 0:20; delete Ticket from the form, Undo); opened over Today then Back →
  Today unchanged; saved over Today → back on Today with the strip; Create a template
  from the Start list opens in place; without JavaScript `/templates/new` saves as a
  page.
- [ ] **Step 5: Run** the unit tests and `npx playwright test e2e/templates.test.ts
  e2e/entry-form.test.ts` → PASS.
- [ ] **Step 6: Commit** `feat: edit templates in the entry form`.

### Task 6: The Templates screen

**Files:**
- Modify: `src/routes/(app)/templates/+page.server.ts`, `+page.svelte`
- Create: `src/lib/components/templates/TemplateTable.svelte` (PC),
  `TemplateList.svelte` (phone), `TemplateMenu.svelte`
- Test: `e2e/templates.test.ts`

**Interfaces:**
- Consumes: Task 2's `TemplateCard` (the load uses the same shaping), Task 3's
  `TemplateSheet` (posting to `/?/fromTemplate` with `back=/templates`), Task 4's
  delete action (posted from the menu to `/templates/<id>?/delete` with `back`).

- [ ] **Step 1: Server**: the load returns the cards, the pickers and the flash;
  `/templates` draws its own strip (`ownsStrip`).
- [ ] **Step 2: Screen** per spec, The Templates screen: the toolbar (outline New
  template with `data-entry-form`, the count), the PC table (Activity and Location from
  1280 px; a row click opens the form in place; the name a `data-entry-form` link for
  the keyboard), the phone rows (leading ⋯, wrapping lines), `TemplateMenu` (Edit, Log…
  or Start timer… opening the sheet, Delete at once; PC popover, phone row sheet headed
  by the name and customer › project; without JavaScript a `<details>`), the empty
  state.
- [ ] **Step 3: e2e** (both widths): rows by name with dot, fields and mark; ⋯ → Edit
  opens the form; ⋯ → Log… logs and returns to Templates with the strip; ⋯ → Delete,
  Undo; the menu by keyboard (arrows, Escape back to ⋯); nothing under the "+".
- [ ] **Step 4: Run** `npx playwright test e2e/templates.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: list templates in the ruled table`.

### Task 7: Setup's server

**Files:**
- Modify: `src/lib/server/screens/setup.ts`, `setup.test.ts`
- Modify: `src/routes/(app)/setup/+page.server.ts`

**Interfaces:**
- Produces:
  - `type Show = 'active' | 'archived' | 'all'`; `readShow(params: URLSearchParams):
    Show` (`show=archived|all`; `archived=1` → `'all'`; else `'active'`).
  - `setupTree(core: Core, show: Show): SetupTree` where `SetupTree = { customers:
    SetupCustomer[]; activities: SetupRow[]; locations: SetupRow[] }`, `SetupRow = { id;
    name; version; archived: boolean; kind }`, `SetupCustomer = SetupRow & { projects:
    (SetupRow & { colour: number; underArchived: boolean })[]; heading: boolean }`.
    Archived means effective: a project under an archived customer is `archived: true,
    underArchived: true` (its menu: Rename only). In `'archived'` an active customer
    with archived projects comes with `heading: true` (no menu); in `'active'` archived
    rows, and the projects under an archived customer, are left out.
  - The actions `create` (with `kind`, `name`, `customerId` for a project), `rename`,
    `archive`, `unarchive` keep their inputs and return to `/setup` with the posted
    `show` kept; a refusal returns `{ action, kind, id?, name, error }` so the screen
    reopens the rename row or the create dialog.

- [ ] **Step 1: Write the failing tests** `setupTree`: active shows only active rows by
  name; archived shows archived activities, an archived project under "CompX" with
  `heading: true`, an archived customer with all its projects `underArchived`; all shows
  both, the archived marked; `readShow` maps `archived=1` to `'all'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/screens/setup.test.ts` → FAIL.
- [ ] **Step 3: Implement**; the load reads `show`, `rename`, `new`, `customer`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: shape setup by active, archived and all`.

### Task 8: The Setup screen

**Files:**
- Modify: `src/routes/(app)/setup/+page.svelte`
- Replace: `src/lib/components/setup/SetupRow.svelte`, `AddLine.svelte`,
  `AddProject.svelte` with `SetupList.svelte`, `SetupMenu.svelte`, `RenameRow.svelte`,
  `CreateDialog.svelte`, `ShowFilter.svelte`
- Test: `e2e/setup.test.ts` (rewritten)

**Interfaces:**
- Consumes: Task 7's `SetupTree`, `Show`, the actions' refusal shape; item 14's `Sheet`.

- [ ] **Step 1: Screen** per spec, Setup: `ShowFilter` (three links styled as the
  segmented control, `aria-current` on the chosen); two columns from `lg`, stacked
  below; section heads with their outline "+ New …"; rows (customers 15 px semibold,
  projects indented with dots, archived muted with the chip, headings without ⋯);
  `SetupMenu` (PC popover at the right, phone row sheet leading the row, headed "<name>"
  over "<customer> · project" / "customer" / "activity" / "location"); `RenameRow` (the
  field selected, Cancel and Save; Enter saves, Escape cancels to ⋯; one at a time);
  `CreateDialog` (`Sheet` with `dialog`, 440 px on the PC; the name focused, a customer
  select for a project preset from Add project; Enter creates; a refusal beside the
  field, the typed name kept); the empty states; the strip.
- [ ] **Step 2: e2e** (both widths): spec gate tasks 6–7, a duplicate name refused in
  the dialog and in rename (Review Focus 4), the menu and rename by keyboard, the
  filter kept across an action, without JavaScript `?rename=` and `?new=` forms work.
- [ ] **Step 3: Run** `npm run check` and `npx playwright test e2e/setup.test.ts` →
  PASS.
- [ ] **Step 4: Commit** `feat: redo setup with row menus and a create dialog`.

### Task 9: Look, critique and docs

**Files:**
- Modify: as the critique finds; `DESIGN.md`, `.impeccable/design.json` (impeccable's
  documenter); `docs/app.md` (Shell's phone bar and More, Today, Templates, the entry
  form's template kind, Setup)

- [ ] **Step 1:** Seed a month (`TZ=Europe/Budapest npx tsx scripts/seed-month.ts …`,
  the app run as `.claude/agents/usability-gate.md` describes) and screenshot Today,
  Templates, the template form and sheet, Setup (all three filters, a menu, rename,
  create) and More at 390 and 1440 px in both themes; on the PC check the sidebar
  fills the window's height on each, scrolled to the bottom (spec, Round 1's rail).
- [ ] **Step 2:** Run `impeccable:impeccable` critique and audit (its detector over the
  changed components) on those screens, weighing the stand-in's note: the blue TIMER
  mark on a template that is not running (spec, Anti-goals): keep it, or make it muted
  with a timer icon, as the critique finds.
- [ ] **Step 3:** Fix every P0–P2 finding through the implementer and reviewer loop;
  P3s as the reviewer rules.
- [ ] **Step 4:** Record `DESIGN.md` from what shipped (impeccable's documenter):
  Navigation (four cells, the More sheet), Today, the template sheet, the Templates
  table, the template form, Setup's list, menu, rename and create dialog; drop the
  "Screen components carried from round 1" entries for Today, templates and Setup.
  Update `docs/app.md`.
- [ ] **Step 5:** Run `npm run check`, `npm run lint`, `npm run test:unit`, `npm run
  test:e2e` → all PASS.
- [ ] **Step 6: Commit** `docs: record today, templates and setup`.

Approved by the operator stand-in, revision 1, 2026-10-20.
