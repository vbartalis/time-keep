# The entry and the timer Implementation Plan

Approved by the operator stand-in, revision 2, 2026-10-20.

The approval's note: a month and day alone (`10.18`, `1018`) read month then day; the
date hint and refusal show that order.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One entry form for creating and editing, opened in place over every screen, and a
timer bar that starts and restarts timers from every screen (roadmap item 12).

**Architecture:** A pure time parser shared by browser and server; server helpers that
turn the form into `entries.create`/`entries.update` input; the form as a SvelteKit page
(`/entries/new`, `/entries/[id]`) that works without JavaScript, opened over the current
screen with SvelteKit shallow routing (`preloadData` + `pushState`) when JavaScript runs.
Timer start and restart are small POST routes like round 1's `/timers/stop`. No core,
MCP or database change.

**Tech Stack:** SvelteKit 3, Svelte 5 runes, TypeScript, Tailwind 4, shadcn-svelte, Vitest
(server project, `svelte/server` render for components), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-entry-and-timer-design.md` (read it whole;
its sections are cited below as "spec, <section>"). Mockups:
`docs/superpowers/specs/2026-10-20-entry-and-timer/` (`pc-modal`, `pc-new`, `pc-start`,
`phone-sheet`, `phone-start`; build to the spec where a mockup differs: no × on the phone
sheet, customer › project on the strip).

## Global Constraints

- Imports use `#lib/...`, never `$lib`. Every write is one core call through
  `openCore(getDb(), user.id, 'ui', () => now)`; no rule is enforced in a screen.
- Everything works without JavaScript as plain pages and form posts; JavaScript only
  enhances (dialog, sheet, linking, combobox, keys).
- DESIGN.md is the visual system: one blue primary per form; Delete red outline;
  44 px targets below `lg` (1024 px), 36 px controls from `lg`; type sizes only 12, 14,
  15, 17, 21 px; `figures` on every time, date and duration; `caps` for heads; shadows only
  on floating sheets and popovers; 150 ms ease-out colour changes only.
- English, 24-hour `HH:mm`, ISO dates `YYYY-MM-DD`; times shown in the entry's own zones;
  a new entry uses the device zone (hidden `timeZone` field filled by the layout's
  `fillZone`).
- Exact copy from the spec: "No end: this starts a timer.", "Start at previous end
  HH:MM", "Times: 9, 900, 9:00, 1330 · Duration: 5:30, 5.5, 5h30, 90 (minutes)",
  "Already running", "Save or cancel your changes first", "next day", "+N days",
  "Start a timer", "Start on a project…", "Create a template", "Fill from",
  "New entry (n)", "Stop (s)".
- Conventional Commits, no scope, lowercase imperative, no attribution.
- Every task ends with `npm run check`, `npm run lint` and `npm run test:unit` passing;
  tasks that touch screens also run the e2e files they change (`npx playwright test
  e2e/<file>`).

## Review Focus

- **A stale or vanished entry:** saving, deleting or restarting an entry edited or
  deleted elsewhere shows the core's message (with Reload, or "This entry was deleted
  elsewhere.") inside the open form, never a crash or a silent no-op (Task 3 tests).
- **An unchanged long or two-zone entry:** saving only a new description on an entry
  that ends 2 days later in another zone keeps its end instant exactly (Task 2 test
  `keeps an untouched end`).
- **Back after the overlay:** after saving or closing an overlay form, the browser's Back
  does not reopen it, and reloading the screen does not show it (Task 5 e2e).
- **A refusal in the overlay:** a core refusal (a timer already running that started
  later, a future running start) keeps the dialog open with the message beside the field
  and the typed values intact (Task 5 e2e).
- **The keys in a field:** typing `n` or `s` in any input, textarea or the combobox never
  opens a form or stops a timer (Task 5 e2e).

---

### Task 1: The forgiving time parser

**Files:**
- Create: `src/lib/time-input.ts`
- Test: `src/lib/time-input.test.ts`

**Interfaces:**
- Produces:
  - `type Read<T> = { ok: true; value: T } | { ok: false; reason: string }`
  - `readClock(text: string): Read<string>` — a time of day as `HH:mm`
  - `readDuration(text: string): Read<number>` — whole minutes, > 0
  - `readDate(text: string, today: string): Read<string>` — a date as `YYYY-MM-DD`;
    `today` (`YYYY-MM-DD`) supplies the year for a month and day alone
  - `durationText(minutes: number): string` — `h:mm` (`330` → `5:30`, `5` → `0:05`, `1500` → `25:00`)
  - `minutesBetween(start: string, end: string): number` — `HH:mm` to `HH:mm`; an end at
    or before the start is the next day (`'22:00','06:00'` → 480; `'09:00','09:00'` → 1440)
  - `endAfter(start: string, minutes: number): { time: string; days: number }`
    (`'13:00', 330` → `{ time: '18:30', days: 0 }`; `'22:00', 480` → `{ time: '06:00', days: 1 }`)

- [ ] **Step 1: Write the failing tests** — one `it.each` per table of the spec, "Forgiving
  time input", with every row's inputs and readings, plus:
  - `readClock`: `''` and `'abc'` refuse with `'Not a time. Type 9, 900, 9:00 or 1330.'`;
    `'9:5'` with `'Minutes take two digits, as in 9:05.'`; `'17.5'` with
    `'Type 17:30 or 17:05.'` (the numbers follow the input: `'8,3'` → `'Type 8:30 or 8:03.'`);
    `'24'`, `'2400'`, `'960'`, `'25:00'` with `'Not a time of day.'`; surrounding spaces
    and upper case (`' 9 AM '`) read.
  - `readDuration`: `''` and `'x'` refuse with
    `'Not a duration. Type 5:30, 5.5, 5h30 or 90 (minutes).'`; `'0'`, `'0:00'`, `'0m'` with
    `'A duration is more than zero.'`; `'0.25'` → 15, `'1.30'` → 78, `'1h30m'` → 90,
    `':90'` → 90, `'90'` → 90, `'330'` → 330, `'5'` → 5.
  - `readDate` with today `2026-10-20`: `2026-10-18`, `20261018`, `2026.10.18`,
    `2026/10/18`, `2026,10,18` → `2026-10-18`; `10.18`, `1018`, `10-18` → `2026-10-18`;
    `2026-02-30`, `2026-13-01`, `''`, `'x'` refuse with
    `'Not a date. Type 2026-10-18, 20261018 or 10.18.'`. (The phone's keypad for the
    field has no hyphen; a dot or digits alone must do.)
  - `durationText`, `minutesBetween`, `endAfter` with the values in Interfaces.
- [ ] **Step 2: Run** `npx vitest run src/lib/time-input.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the six exports in `src/lib/time-input.ts`, no imports (it
  ships to the browser). Decimal durations round to the nearest minute.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat: add the forgiving time parser`

### Task 2: The form's values and core input

**Files:**
- Create: `src/lib/server/screens/entry-form.ts`
- Create: `src/lib/components/entry/types.ts`
- Test: `src/lib/server/screens/entry-form.test.ts`

**Interfaces:**
- Consumes: Task 1; `toLocalInput`, `formatTime` from `src/lib/server/screens/today.ts`;
  `given`, `wholeNumber`, `rows`, `groupProjects` from `actions.ts`; `colourOf` from
  `src/lib/project-colour.ts`; `EntryItem`, `TemplateItem`, `Core` from the core.
- Produces, in `src/lib/components/entry/types.ts` (browser-safe):
  - `EntryFormValues = { id: string | null; version: string; date: string; start: string; end: string; duration: string; endDays: number; endZone: string | null; timeZone: string; projectId: string; activityId: string; locationId: string; reference: string; description: string; running: boolean }`
    (`start`/`end` `HH:mm` or `''`; `duration` `h:mm` or `''`; `endZone` set only when it
    differs from `timeZone`)
  - `PickerProject = { id: string; name: string; customerId: string; customerName: string; colour: number; archived: boolean }`
  - `PickerOption = { id: string; name: string; archived: boolean }`
  - `FillTemplate = { id: string; name: string; colour: number | null; label: string | null; startTime: string | null; endTime: string | null; durationMinutes: number | null; projectId: string | null; activityId: string | null; locationId: string | null; reference: string | null; description: string | null }`
    (`label` is `customer › project`)
  - `EntryFormData = { mode: 'new' | 'edit'; values: EntryFormValues; projects: PickerProject[]; activities: PickerOption[]; locations: PickerOption[]; templates: FillTemplate[]; back: string; failure: EntryFormFailure | null }`
  - `EntryFormFailure = { action: 'save' | 'delete' | 'saveAsTemplate'; error: string; fields: Record<string, string>; conflict: boolean; gone: boolean; values?: Record<string, string> }`
- Produces, in `entry-form.ts`:
  - `valuesFromEntry(e: EntryItem): EntryFormValues`
  - `newValues(opts: { date: string; zone: string; start?: string }): EntryFormValues`
  - `templateValues(t: TemplateItem, base: EntryFormValues): EntryFormValues`
  - `copyValues(e: EntryItem): EntryFormValues` (id null, version `''`, running false)
  - `formPickers(core: Core, current?: { projectId: string; activityId: string | null; locationId: string | null }): Pick<EntryFormData, 'projects' | 'activities' | 'locations' | 'templates'>`
    (active rows, plus the current archived one marked; projects sorted by customer then
    name; templates by name)
  - `type FormRead = { ok: true; input: Record<string, unknown> } | { ok: false; fields: Record<string, string> }`
  - `createInput(form: FormData): FormRead` → `entries.create` input
  - `updateInput(form: FormData, entry: EntryItem): FormRead` → `entries.update` input
  - `previousEnd(core: Core, date: string, zone: string, before: string | null): string | null`

- [ ] **Step 1: Write the failing tests** (in-memory core from `src/lib/server/testing/db.ts`,
  as other screen tests do):
  - `createInput`: date `2026-10-19`, start `9`, end `1430` → `{ start: '2026-10-19T09:00', end: '2026-10-19T14:30', timeZone }`;
    start `22:00`, end `06:00` → end `'2026-10-20T06:00'`; start `13`, duration `5.5` →
    `durationMinutes: 330` and no `end`; end and duration both empty → neither key
    (running); start `17.5` → `{ ok: false, fields: { start: 'Type 17:30 or 17:05.' } }`;
    empty start → `fields.start` `'Not a time. Type 9, 900, 9:00 or 1330.'`; blank
    activity/location/reference/description are left out; `endTimeZone` never sent.
  - `updateInput` on an entry 2026-10-19 09:00–14:30 Europe/Budapest: start `930`, end
    unchanged → sends `start` only (the end holds); duration typed `2:00` with start
    unchanged → `durationMinutes: 120`; end and duration emptied → `end: null`; end typed
    `08:00` → `'2026-10-20T08:00'` in `endTimeZone` = the entry's end zone; nothing
    changed → no `start`, no `end`, no `durationMinutes`; always sends `id`,
    `expectedVersion`, `timeZone` (the start zone), the pickers and texts (blank → null).
  - `keeps an untouched end`: an entry starting 2026-10-17 22:00 Europe/Budapest, ending
    2026-10-19 07:15:30 in America/New_York; changing only the description sends no `end`
    and no `durationMinutes`; `valuesFromEntry` gives `endDays: 2` and
    `endZone: 'America/New_York'`.
  - `valuesFromEntry` of a running entry: `end: ''`, `duration: ''`, `running: true`.
  - `newValues({ date, zone, start: '10:05' })` sets `start`; `templateValues` of a
    template with start 09:00 and duration 15 on `newValues` → start `09:00`, end `09:15`,
    duration `0:15`, its project, activity, location, reference, description; a template's
    blank fields leave the base's values.
  - `previousEnd` on a day with entries ending 08:50, 12:30 and 17:40: `null` before →
    `'17:40'`; before `'12:00'` → `'08:50'`; a day without finished entries → `null`; a
    running entry is ignored.
  - `formPickers` with an archived current project returns it with `archived: true`;
    colours match `colourOf`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/screens/entry-form.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Field names posted by the form: `date`, `start`, `end`,
  `duration`, `timeZone`, `projectId`, `activityId`, `locationId`, `reference`,
  `description`, `version`, `back`. "Unchanged" compares the posted text with
  `valuesFromEntry(entry)`'s (after reading it through Task 1, so `9` equals `09:00`).
  Duration wins only when it changed and the end did not.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat: read the entry form into core input`

### Task 3: The routes: entry form, start, restart, stop's restart

**Files:**
- Create: `src/routes/(app)/entries/new/+page.server.ts`
- Rewrite: `src/routes/(app)/entries/[id]/+page.server.ts`
- Create: `src/routes/(app)/entries/previous-end/+server.ts`
- Create: `src/routes/(app)/timers/start/+page.server.ts`
- Create: `src/routes/(app)/timers/restart/+page.server.ts`
- Modify: `src/routes/(app)/timers/stop/+page.server.ts`, `src/lib/server/screens/flash.ts`,
  `src/lib/components/today/types.ts` (`Flash`), `src/lib/server/screens/edit.ts` (remove
  what Task 2 replaces), `src/lib/shell.ts` (`screenTitle` for `/entries/new`: "New entry";
  `/entries/[id]`: "Edit entry"; `currentItem` as for `[id]`)
- Test: `src/lib/server/screens/timer-actions.test.ts`, `src/lib/server/screens/flash.test.ts`,
  `src/lib/server/screens/entry-form.test.ts` (route helpers), `src/lib/shell.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `/entries/new` load: query `date`, `start` (`HH:mm`), `timer=1` (start = now in the
    zone, end empty), `template=<id>` (with `timer=1`: times ignored, start now),
    `copy=<id>`, `back` (through `safeBack`) → `EntryFormData` with `mode: 'new'`.
    `actions.default`: `createInput` → `entries.create` → `done(core, cookies, r, back)`;
    refusals `fail(400, EntryFormFailure)` with `values` echoed.
  - `/entries/[id]` load → `EntryFormData` with `mode: 'edit'` (404 when missing).
    Actions `save` (as round 1: no-change → redirect without flash; stale → `conflict`;
    gone → `gone`), `delete` (no confirm: deletes at once with the version), `saveAsTemplate`
    (returns to `back`, not `/templates`).
  - `GET /entries/previous-end?date=&zone=&before=` → `{ time: string | null }` JSON.
  - `POST /timers/start` (`templateId`, optional `description`, `timeZone`, `back`):
    `timers.start` with the template's project, activity, location, reference and the
    typed description (else the template's); a template without a project → 303 to
    `/entries/new?template=<id>&timer=1&back=…`. GET redirects to `/`.
  - `POST /timers/restart` (`id`, `timeZone`, `back`): reads the entry and calls
    `timers.start` with its project, activity, location, reference and description, in its
    start zone; refusal → flash `error`. GET redirects to `/`.
  - Both start routes end a success with `done(core, cookies, r, back)`, so the strip on
    `back` shows "Done: <label>." with Undo and the core's warnings, like every save.
  - `startFromTemplateInput(t: TemplateItem, description: string | undefined, zone: string): Record<string, unknown>`
    and `restartInput(e: EntryItem): Record<string, unknown>` in
    `src/lib/server/screens/timer-actions.ts`.
  - `Flash.restartId?: string`, set by `/timers/stop` on success (the stopped entry's id),
    kept by the zod schema and capped like the other strings.

- [ ] **Step 1: Write the failing tests** — `startFromTemplateInput` ignores the
  template's start time, end time and duration and its zone (uses the given zone);
  description typed wins, blank → the template's; `restartInput` copies project,
  activity, location, reference, description and `timeZone: e.startZone`, and no start;
  `setFlash`/`takeFlash` round-trip `restartId`; `createInput` reads the date through
  `readDate` (`20261018` → `2026-10-18…`, a bad date → `fields.date`); `screenTitle('/(app)/entries/new')` is
  `'New entry'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/screens src/lib/shell.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the helpers and the routes listed above.
- [ ] **Step 4: Run** the same command, then `npm run check` — Expected: PASS (the old
  edit page's `.svelte` may fail `check` until Task 4; if so, keep its old load fields
  until Task 4 replaces the page, or do Tasks 3 and 4 in one sitting before running
  `check`).
- [ ] **Step 5: Commit** `feat: add the entry form and timer routes`

### Task 4: The entry form component and its pages

**Files:**
- Create: `src/lib/components/entry/EntryForm.svelte`, `ProjectPicker.svelte`,
  `TimeRow.svelte`, `match.ts`
- Rewrite: `src/routes/(app)/entries/[id]/+page.svelte`
- Create: `src/routes/(app)/entries/new/+page.svelte`
- Test: `src/lib/components/entry/match.test.ts`, `src/lib/components/entry/EntryForm.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `matchProjects(query: string, projects: PickerProject[]): { customerId: string; customerName: string; projects: PickerProject[] }[]`
    — every word of the query (NFD, accents stripped, lower case) is found in
    `customerName + ' ' + name`; groups in customer order; empty query → all.
  - `EntryForm.svelte` props: `{ data: EntryFormData; action: string; onDone?: (location: string) => void; onCancel?: () => void }`.
    Without `onDone` it is a plain page form (`use:enhance` default behaviour); with it,
    a successful redirect calls `onDone(location)` instead of navigating.

- [ ] **Step 1: Write the failing tests**
  - `matchProjects('compx support', …)` finds only `CompX › CompY - Support`;
    `'clienty'` finds `ClientY - ProjectZ`; `'Café'` matches `cafe`; `''` returns every group.
  - `EntryForm` rendered with `svelte/server`: fields labelled Date, Start, End, Duration,
    Customer › project, Activity, Location, Reference, Description in that DOM order; a new
    entry shows "Fill from" with each template's name, an edit does not; an edit shows
    Delete, Copy, Restart, Save as template, a new entry none of them; a running entry's
    Restart is `disabled` and its text includes "Already running"; empty end and duration
    show "No end: this starts a timer."; `endDays: 2` shows "+2 days"; the hint line is the
    spec's exact text; one `type="submit"` primary Save; without JavaScript the project
    field is a `<select name="projectId">` with an `<optgroup>` per customer.
- [ ] **Step 2: Run** `npx vitest run src/lib/components/entry` — Expected: FAIL.
- [ ] **Step 3: Implement** to the spec, "The entry form":
  - Labels left of fields from `lg` (`pc-modal`), above them below `lg` (`phone-sheet`).
  - `TimeRow`: Start, End, Duration inputs (`inputmode="text"`, `autocomplete="off"`),
    read with Task 1 on blur and on submit, rewritten to the normal form, linked as the
    spec says (track which of end/duration was typed last); a refusal shows beside the
    field with `aria-invalid` and `aria-describedby`; "next day" / "+N days" beside End;
    the end zone beside End when `endZone` is set; "Start at previous end HH:MM" fetched
    from `/entries/previous-end` when date or start changes (JavaScript only).
  - Date: `<input type="text" inputmode="decimal" autocomplete="off">` read with
    `readDate` on blur and on save and shown back as `YYYY-MM-DD` (the iOS decimal pad has
    a dot, the numeric pad nothing but digits), with
    Today and Yesterday buttons (JavaScript sets the value; without it they are absent).
  - `ProjectPicker`: progressive combobox (WAI-ARIA combobox pattern, listbox grouped by
    customer, colour dots, arrow keys, Enter, Escape) over the hidden `projectId`; renders
    the `<select>` until hydrated.
  - Fill from (new only): a button per template applying `FillTemplate` like Task 2's
    `templateValues`, then focusing the first empty needed field, else Description.
  - Footer: Delete (red outline), Copy (link to `/entries/new?copy=<id>&back=…`),
    Restart (form to `/timers/restart`), Save as template (a disclosure with Name and
    "Save template"); all four disabled with "Save or cancel your changes first" while
    the form differs from its loaded values; Cancel (link to `back`, or `onCancel`) and
    Save on the right. Ctrl/Cmd+Enter submits.
  - Focus on mount: Start, or Customer › project when `values.start` is set.
  - Refusals from `data.failure` beside their fields; the general message above the
    footer; conflict → Reload link; gone → "This entry was deleted elsewhere." with a link
    to `back`.
  - The pages render `<EntryForm data={data} action=…>` inside the shell (round 1's page
    goes).
- [ ] **Step 4: Run** `npx vitest run src/lib/components/entry`, `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: build the entry form`

### Task 5: The form over every screen

**Files:**
- Create: `src/lib/components/entry/EntryOverlay.svelte`, `src/lib/entry-link.ts`
- Modify: `src/app.html` (viewport meta), `src/app.d.ts` (`App.PageState { entryForm?: EntryFormData & { href: string } }`),
  `src/routes/(app)/+layout.svelte` (header "+ New entry", phone "+", overlay, keys),
  `main`'s bottom padding (room for the "+")
- Test: `e2e/entry-form.test.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `openInPlace(event: MouseEvent, href: string): Promise<void>` in `entry-link.ts`:
    ignores modified clicks and non-primary buttons; `preloadData(href)`; on `loaded`
    with data, `pushState(href, { entryForm: { ...data, href } })`; else `goto(href)`.
  - Any `<a data-entry-form href=…>` in the app is opened with `openInPlace` (one
    delegated click listener in the layout).

- [ ] **Step 1: Write the failing e2e tests** (pattern of `e2e/phone.test.ts`: seed with
  `seedUser`, sign in, run in both Playwright projects): gate tasks 1, 2, 3, 4, 5, 6, 10
  and 11 of the spec on the seeded user (10's "appears in the bar's start list" waits for
  Task 6); plus the Review Focus items: after Save, `page.goBack()`
  shows the screen without the form; a refused save (start a running entry 10 minutes in
  the future) keeps the dialog open with the message and the typed description; typing
  `n` and `s` into Description changes nothing else.
- [ ] **Step 2: Run** `npx playwright test e2e/entry-form.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**
  - The phone keyboard never covers Save: `src/app.html`'s viewport meta gains
    `interactive-widget=resizes-content` (Chrome on Android shrinks the layout viewport
    for the keyboard), and the sheet's height follows `window.visualViewport` (a
    `--keyboard-free` CSS variable set from its `resize` and `scroll` events, iOS Safari
    ignoring the meta), so the sheet ends at the keyboard's top with the footer inside it
    and the fields scrolling above. e2e at 390×844: focus Description, then
    `page.setViewportSize({ width: 390, height: 420 })` (the height left by a keyboard),
    and expect Save `toBeInViewport()`; a unit test pins the meta in `src/app.html`.
  - `EntryOverlay`: a native `<dialog>` opened with `showModal()` (focus trap, Escape,
    focus returned to the opener), centred 660 px from `lg` (`pc-modal`), a sheet below
    `lg` from under the top bar to the bottom with the footer fixed (`phone-sheet`, no ×);
    a click on the backdrop closes it on the PC. It renders `EntryForm` with
    `onDone(location)` → `goto(location, { replaceState: true, invalidateAll: true })` and
    `onCancel` → `history.back()`; it closes when `page.state.entryForm` is gone.
  - Header (PC): `<a data-entry-form href="/entries/new?back=…" title="New entry (n)">+ New entry</a>`
    as the blue primary, right of the timer bar; phone: a fixed 56 px "+" (`aria-label="New entry"`)
    bottom right above the bottom bar, with main's bottom padding raised so it covers
    nothing.
  - Keys: `n` → open the new-entry form; `s` → submit the Stop of the timer shown in
    full in the bar (marked `data-shown-stop` by Task 6; before Task 6, the bar's first
    timer's Stop), never one in the "+N" list; ignored when
    the event target is an input, textarea, select or contenteditable, or a modifier is
    held, or a dialog is open.
- [ ] **Step 4: Run** `npx playwright test e2e/entry-form.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: open the entry form over every screen`

### Task 6: The timer bar starts and restarts

**Files:**
- Create: `src/lib/components/shell/StartList.svelte`
- Modify: `src/lib/components/shell/TimerBar.svelte`, `src/lib/components/shell/types.ts`,
  `src/lib/server/screens/shell.ts` (bar templates), `src/routes/(app)/+layout.server.ts`,
  `src/lib/components/UndoStrip.svelte` (Restart)
- Test: `src/lib/components/shell/TimerBar.test.ts`, `src/lib/server/screens/shell.test.ts`,
  `e2e/entry-form.test.ts`

**Interfaces:**
- Consumes: Tasks 3 and 5.
- Produces: `BarTemplate = { id: string; name: string; colour: number | null; label: string | null; hasProject: boolean; hasDescription: boolean }`;
  `shellTemplates(core: Core): BarTemplate[]` (by name); layout data `templates`.

- [ ] **Step 1: Write the failing tests**
  - `TimerBar` header render: a "Start" button outside the `section[aria-label="Timer"]`
    pill; the running timer's elapsed time and name are a link to
    `/entries/<id>?back=…` with `data-entry-form`; Stop has `title="Stop (s)"` and `data-shown-stop`; the "+N" list's Stops have no
    `data-shown-stop`.
  - Strip render: shows `CompX › ClientY - ProjectZ` (customer included) and no
    description; a ▶ button labelled "Start a timer" beside Stop, both `h-11 min-w-11`.
  - `StartList`: "Start a timer" head; templates by name with label; a template with a
    description is a form button posting `templateId`; one without a description is a
    `<details>` holding a description input and a Start button; one without a project is
    a `data-entry-form` link to `/entries/new?template=<id>&timer=1`; last, "Start on a
    project…" linking `/entries/new?timer=1`; no templates → that link and "Create a
    template" to `/templates/new`.
  - `UndoStrip` with `restartId` shows a Restart button posting `id` to `/timers/restart`
    beside Undo.
  - e2e: gate tasks 7, 8 and 9 (phone and PC); after a start from the list and after
    a Restart, the strip says "Done: Start timer on …" with an Undo that stops-and-removes
    the new timer.
- [ ] **Step 2: Run** `npx vitest run src/lib/components/shell src/lib/server/screens/shell.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** PC: the list opens under Start as a popover (a `<details>`,
  so it works without JavaScript; Escape and an outside click close it with JavaScript),
  popover shadow per DESIGN.md. Phone: the same list as a bottom sheet over a scrim.
  Opening a template's `<details>` focuses its description input. Stop's flash carries
  `restartId` (Task 3); every strip (the shell's and the screens' own) gets Restart.
- [ ] **Step 4: Run** the unit command and `npx playwright test e2e/entry-form.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: start and restart timers from the bar`

### Task 7: Today and Entries open the form in place

**Files:**
- Modify: `src/routes/(app)/+page.svelte`, `src/routes/(app)/+page.server.ts` (drop
  `StartTimer` and its `start` action), `src/lib/components/today/TodayEntries.svelte`,
  `src/lib/components/entries/EntryTable.svelte`
- Delete: `src/lib/components/today/StartTimer.svelte`, and `startInput` from `actions.ts`
  with its tests
- Modify: `e2e/phone.test.ts`, `e2e/shell.test.ts`, `e2e/touch-targets.test.ts`,
  `e2e/entries.test.ts` where they pin "Start a timer", the edit page's datetime fields
  or its delete confirm
- Test: those e2e files

**Interfaces:**
- Consumes: Tasks 5 and 6.

- [ ] **Step 1: Update the e2e tests first:** Today has no "Start a timer" region; timers
  start from the bar's Start list; a Today row and an Entries row open the form over the
  screen (the URL's path changes, the screen stays under it); a finished row has a
  "Restart" button (accessible name `Restart <customer › project>`) that starts a timer;
  the edit flow fills Start/End as `HH:mm` texts; delete has no confirm.
- [ ] **Step 2: Run** `npx playwright test e2e/phone.test.ts e2e/shell.test.ts e2e/entries.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement:** rows link with `data-entry-form` and `back` = the screen's
  path and query (Today: `/`); a ▶ Restart form per finished row (44 px below `lg`),
  outside the row's link; the Entries table keeps its checkboxes and bulk forms.
- [ ] **Step 4: Run** `npm run test:e2e` — Expected: PASS (the whole suite).
- [ ] **Step 5: Commit** `feat: open today's and the entries' rows in place`

### Task 8: Docs

**Files:**
- Modify: `docs/app.md` (Layout table: new routes and components; Shell: Start, "+ New
  entry", the "+", keys, the strip; Screens: replace "Edit entry" with "The entry form
  (`/entries/new`, `/entries/[id]`)", Today without Start a timer, Entries' rows; Done and
  undo: Restart after a stop; Tests: the new e2e file)
- Modify: `PRODUCT.md` "Capabilities and Constraints" (built today: the entry form and
  starting timers)

- [ ] **Step 1:** Write the sections from what Tasks 1–7 built (read the code, not this
  plan).
- [ ] **Step 2: Run** `npx prettier --check docs/app.md PRODUCT.md` — Expected: PASS.
- [ ] **Step 3: Commit** `docs: describe the entry form and the timer bar`

### Task 9: impeccable's critique, audit and record (controller)

Run by the controller, not an implementer: impeccable's `critique` and `audit` on the
form, the overlay and the bar at 390 and 1440 px in both themes on a seeded month
(`TZ=Europe/Budapest npx tsx scripts/seed-month.ts <db> <user> <password>`), the
detector (`impeccable detect --json` over the changed `.svelte` files), fixes as tasks
through the implementer and reviewer loop, then impeccable's documenter for `DESIGN.md`,
`.impeccable/design.json` and the shell's surface brief. Commit
`docs: record the entry form and timer bar in the design system`.
