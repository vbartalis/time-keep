# Calendar views Implementation Plan

Approved by the operator stand-in, revision 1, 2026-10-20.

The approval's notes, folded in: a three-way overlap is tested (Tasks 2 and 6); the
stale move's message stands in for a Reload link, since the redirect already shows the
entry as it is; the PC month shades days outside the month (Task 7).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Calendar screen with day, week and month views on the PC and the phone:
entries as project-coloured blocks on a 24-hour grid, totals per day and week, the
running timer live, creating by tap or drag on empty time, and moving and resizing by
drag on the PC (roadmap item 13).

**Architecture:** Pure, browser-safe modules in `src/lib/calendar/` hold the date
arithmetic and the grid's geometry (pieces per day, lanes, overlaps, totals, snapping);
the server (`src/lib/server/screens/calendar.ts`) reads the entries for the period
through `entries.list` and shapes them for the page; `/calendar` renders the three views
as a plain page that works without JavaScript, and attachments add the gestures. A move
or resize posts to the page's `?/move` action, one `entries.update`. New entries go
through item 12's form (`/entries/new`, which gains `end`). No core, MCP or database
change.

**Tech Stack:** SvelteKit 3, Svelte 5 runes, TypeScript, Tailwind 4, shadcn-svelte,
Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-calendar-views-design.md` (read it whole;
cited below as "spec, <section>", its calls as "call <n>"). Mockups:
`docs/superpowers/specs/2026-10-20-calendar-views/` (`pc-week`, `pc-week-past`,
`pc-day`, `pc-month`, `pc-picker`, `pc-drag`, `ph-day`, `ph-day-past`, `ph-create`,
`ph-week`, `ph-month`; build to the spec where a mockup differs: call 10's fixes).

## Global Constraints

- Imports use `#lib/...`, never `$lib`. `src/lib/calendar/*` imports nothing from
  `#lib/server/*` (the browser uses it). Every write is one core call through
  `openCore(getDb(), user.id, 'ui', () => now)`; no rule is enforced in the screen.
- The views, the toolbar, the date picker and every block and cell link work without
  JavaScript; gestures, keys, scrolling on open and the live block need it (spec,
  Without JavaScript).
- DESIGN.md is the visual system: project fill, edge and ink for blocks (the
  `project-N` family by `colourOf`), blue only for running, the primary action and
  focus, red only for overlaps and refusals; type sizes 12, 14, 15, 17, 21 px only;
  `figures` on every time, date and duration; `caps` for heads; 44 px targets below `lg`
  (1024 px), 36 px controls from `lg`; shadows only on floating things (the dragged
  block lifts with the popover-down shadow).
- Formats: 24-hour `HH:mm`, ISO dates, ISO weeks, Monday first, durations `h:mm`
  (exact, never rounded: call 28).
- Measures: hour height 44 px in the PC week, 52 px in the PC day, 56 px in the phone
  day, 34 px in the phone week. Shading before 08:00 and from 20:00. Open scrolled to
  07:00, earlier for an earlier entry in view, with now in view on a period holding now.
- Snapping: 5 minutes for every PC drag; 15 minutes for the phone's handles (call 18).
  A click or tap without movement (under 4 px) creates the half hour, rounded down, for
  one hour (calls 4, 17).
- Address: `/calendar?view=day|week|month&date=YYYY-MM-DD`; default week and today;
  the phone's bottom-bar link is `/calendar?view=day` (call 15).
- Copy: "Calendar"; "Week 42"; "Week 27:45", "Day 5:45 · Week 27:45", "Month 72:40";
  "+n more"; "now · Running 1:40"; "from the previous day"; "Overlaps another entry";
  the phone's create bar: the times, "Drag the handles to change it", Cancel, New entry.

## Review Focus

- **A daylight-saving day** (23 or 25 hours): blocks are placed by local wall time, so a
  03:30 entry on the spring-forward day still sits at 03:30 and nothing throws; the
  grid keeps 24 rows. Pinned in Task 2.
- **An entry longer than a day** (Tuesday 22:00 to Thursday 02:00): three pieces, the
  middle one the whole of Wednesday; dragging any piece moves the whole entry; handles
  only at the real start and end. Pinned in Tasks 2 and 9.
- **A running timer started yesterday:** today's column draws it from 00:00 to now and
  yesterday's from its start to 24:00; it counts in yesterday's total. Pinned in Task 2.
- **A drag released outside the grid or past the week's edge:** the drop clamps to the
  week's first or last day and to 00:00–24:00; a release over the toolbar or sidebar
  cancels. Pinned in Task 9.
- **A second drag or click while a move is saving:** ignored until the save returns,
  so one release is one update and one undo. Pinned in Task 9.

---

### Task 1: Dates and periods

**Files:**
- Create: `src/lib/calendar/dates.ts`
- Test: `src/lib/calendar/dates.test.ts`

**Interfaces:**
- Produces:
  - `type View = 'day' | 'week' | 'month'`
  - `readView(query: URLSearchParams, today: string): { view: View; date: string }` (a
    bad or missing `view` is `week`; a bad or missing `date` is `today`)
  - `addDays(date: string, n: number): string`, `weekStart(date: string): string`
    (Monday), `isoWeek(date: string): number`
  - `periodDays(view: View, date: string): string[]` (day: one; week: Monday–Sunday;
    month: every day of the weeks touching the month, Monday first)
  - `shift(view: View, date: string, n: number): string` (by days, weeks or months;
    a month shift keeps the day, clamped to the month's last)
  - `periodTitle(view: View, date: string): { title: string; sub: string }` ("12 – 18
    October 2026" / "Week 42"; "28 September – 4 October 2026" across months;
    "Wednesday 14 October 2026" / "Week 42"; "October 2026" / "")
  - `calendarHref(view: View, date: string): string` (`/calendar?view=…&date=…`)

- [ ] **Step 1: Write the failing tests** — `readView` (good, bad view, bad date
  `2026-02-30`), `periodDays('week', '2026-10-14')` is `2026-10-12`…`2026-10-18`,
  `periodDays('month', '2026-10-14')` starts `2026-09-28` and has 35 days,
  `isoWeek('2026-10-14') === 42` and `isoWeek('2027-01-01') === 53`,
  `shift('month', '2026-01-31', 1) === '2026-02-28'`, `shift('week', d, -1)`, and each
  `periodTitle` above.
- [ ] **Step 2: Run** `npx vitest run src/lib/calendar/dates.test.ts` — FAIL.
- [ ] **Step 3: Implement** with UTC date arithmetic on `YYYY-MM-DD` (no zones here).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: add the calendar's date arithmetic`

### Task 2: The grid's geometry

**Files:**
- Create: `src/lib/calendar/grid.ts`
- Test: `src/lib/calendar/grid.test.ts`

**Interfaces:**
- Consumes: Task 1's `addDays`.
- Produces:
  - `localDate(at: number, zone: string): string`, `localMinutes(at: number, zone:
    string): number` (wall-clock minutes since local midnight, 0–1439; Intl-based,
    browser-safe)
  - `type Piece = { date: string; from: number; to: number; first: boolean; last: boolean }`
    (`from`/`to` in wall minutes, `to` up to 1440; `first` holds the real start, `last`
    the real end)
  - `piecesOf(e: { startAt: number; endAt: number | null }, days: string[], zone: string,
    now: number): Piece[]` (a running entry ends at `now`, `last` false)
  - `lanes<T extends { from: number; to: number }>(ps: T[]): (T & { lane: number; lanes:
    number })[]` (clusters of intersecting pieces; greedy first free lane; every piece of
    a cluster gets the cluster's lane count)
  - `overlapping(es: { id: string; startAt: number; endAt: number | null }[]): Set<string>`
    (finished entries whose half-open intervals intersect another finished one: the
    core's rule)
  - `dayTotals(es: { startAt: number; endAt: number | null }[], zone: string, now: number):
    Map<string, number>` (minutes by the start's local date; running to `now`)
  - `snap(minutes: number, step: number): number` (to the nearest step)
  - `halfHourSlot(minutes: number): { from: number; to: number }` (rounded down to the
    half hour, one hour long, `to` at most 1440)
  - `durationText` is reused from `#lib/time-input.js` for `h:mm`.

- [ ] **Step 1: Write the failing tests** — a same-day entry is one piece with
  `first` and `last`; Tuesday 22:00–Thursday 02:00 (Europe/Budapest) over Mon–Sun is
  three pieces `[1320,1440]`, `[0,1440]`, `[0,120]` with `first` only on the first and
  `last` only on the third; a running entry started yesterday 23:00 with `now` today
  09:30 gives `[1380,1440]` and `[0,570]`, `last` false; on `2026-03-29` in
  Europe/Budapest an entry 03:30–04:00 is `[210,240]`; `lanes` of 10:00–13:00 and
  10:30–11:30 gives lanes 0 and 1 of 2, three mutually
  intersecting pieces give lanes 0, 1 and 2 of 3, and a following 13:30 piece is lane 0
  of 1;
  `overlapping` marks both of an intersecting pair, not a touching pair (12:00 end, 12:00
  start), never a running one; `dayTotals` puts a 23:00–01:00 entry's 120 minutes on its
  start date only; `snap(62, 5) === 60`, `snap(63, 5) === 65`; `halfHourSlot(1079)` is
  `{from: 1050, to: 1110}` and `halfHourSlot(1430)` ends at 1440.
- [ ] **Step 2: Run** `npx vitest run src/lib/calendar/grid.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Pieces are cut at each day's local midnight in `zone`,
  read back as wall minutes, so DST days need no special case.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: add the calendar grid's geometry`

### Task 3: The server's calendar data, and `end` on a new entry

**Files:**
- Create: `src/lib/server/screens/calendar.ts`, `src/lib/components/calendar/types.ts`
- Modify: `src/lib/server/screens/entry-form.ts` (`newEntryValues`)
- Test: `src/lib/server/screens/calendar.test.ts`,
  `src/lib/server/screens/entry-form.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `startOfDay` (`screens/today.ts`), `colourOf`, `rows`.
- Produces (in `types.ts`):
  - `CalendarEntry = { id; version: number; projectName; customerName; colour: number;
    activityName: string | null; locationName: string | null; reference: string | null;
    description: string | null; startAt: number; endAt: number | null; date: string;
    startTime: string; endTime: string | null; running: boolean; overlaps: boolean }`
    (times `HH:mm` in the screen's zone)
  - `CalendarData = { view: View; date: string; today: string; zone: string;
    zoneSource: ZoneSource; days: string[]; entries: CalendarEntry[]; totals:
    Record<string, number>; periodTotal: number; weekTotal: number; now: number;
    flash: Flash | null; back: string }` (`periodTotal`: the week, day or month in view;
    `weekTotal`: the week holding `date`)
  - in `calendar.ts`: `calendarFor(core: Core, opts: { view: View; date: string; zone:
    string; now: number }): Omit<CalendarData, 'zoneSource' | 'flash' | 'back' | 'today'>`
    — lists with `entries.list({ from, to, order: 'asc' })` over `[startOfDay(first),
    startOfDay(last + 1))` (touching, so midnight crossings and earlier-started timers
    come in); a month's `periodTotal` counts only days of that month.
  - `newEntryValues` reads `end` (`readClock`) when `start` is given; an end not after
    the start gives `endDays: 1`; the duration is filled from them (`durationText`).

- [ ] **Step 1: Write the failing tests** — on an in-memory core (`createTestDb`, as
  `today.test.ts` does): a week holding an overlap marks both entries `overlaps`; a
  Tuesday 23:00–01:00 entry is in the week of the Wednesday and counts 120 on Tuesday;
  `periodTotal` of a month leaves out the leading September days; a running entry is
  `running` with `endTime` null and counts to `now`; `colour` follows `colourOf`. For the
  form: `?date=2026-10-15&start=16:00&end=17:30` gives start `16:00`, end `17:30`,
  duration `1:30`; `start=23:00&end=01:00` gives `endDays: 1`; a bad `end` is ignored.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/screens/calendar.test.ts
  src/lib/server/screens/entry-form.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: read a calendar period from the core`

### Task 4: The seed's second overlap and midnight crossing

**Files:**
- Modify: `scripts/seed-month.ts`, `scripts/seed-month.test.ts`

**Interfaces:** `seedMonth(db, userId, { today, zone })` unchanged in shape (call 27).

- [ ] **Step 1: Write the failing test** — with `today` a Tuesday (`2026-10-20`) and a
  Monday (`2026-10-19`): the week before today's week holds an entry from its Tuesday
  23:00 to Wednesday 01:00 and, on its Wednesday, a 10:30–11:30 entry overlapping the
  10:00 development block; its Thursday has nothing from 16:00 to 19:30; the earlier
  overlap and crossing are still there.
- [ ] **Step 2: Run** `npx vitest run scripts/seed-month.test.ts` — FAIL.
- [ ] **Step 3: Implement** in the loop, by date: the Tuesday and Wednesday of the
  week before `today`'s week (`today`'s Monday minus 7 and minus 6 days).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: seed an overlap and a late entry last week`

### Task 5: The Calendar screen, its toolbar and its navigation

**Files:**
- Create: `src/routes/(app)/calendar/+page.server.ts`,
  `src/routes/(app)/calendar/+page.svelte`,
  `src/lib/components/calendar/CalendarToolbar.svelte`,
  `src/lib/components/calendar/DatePicker.svelte`
- Modify: `src/lib/shell.ts` (+ `src/lib/shell.test.ts`),
  `src/lib/components/shell/Sidebar.svelte`, `BottomBar.svelte`, `NavIcon.svelte`,
  `src/routes/(app)/+layout.svelte` (the "+ New entry" date on the calendar), `e2e/seed.ts`
- Test: `e2e/calendar.test.ts` (new), `e2e/shell.test.ts`, `e2e/touch-targets.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3 (`readView`, `calendarFor`, `periodTitle`, `shift`,
  `calendarHref`).
- Produces:
  - `NavItem` gains `href?: string` and the icon `'calendar'`; `CALENDAR = { route:
    '/(app)/calendar', label: 'Calendar', icon: 'calendar' }` after Today in
    `sidebarItems`; `barItems()` is `[TODAY, { ...CALENDAR, href: '/calendar?view=day' },
    ENTRIES, TEMPLATES]`; the title "Calendar"; `ownsStrip` true for it.
  - the page's `load` returns `CalendarData` (zone by `zoneFor`, `takeFlash`, `back` the
    request's path and query); `+page.svelte` renders the toolbar, the strip
    (`UndoStrip` with `back`), and the view chosen (Tasks 6–7 fill the views; here a
    placeholder region per view is enough for the tests).
  - `CalendarToolbar` props `{ view, date, today, periodTotal, weekTotal, zoneSource }`:
    ‹ Today › as links to `calendarHref(view, shift(...))`, the title and sub with a
    chevron as the date picker's `<summary>`, the total, Day / Week / Month links (current
    marked `aria-current="page"`), and Today's default-zone note when `zoneSource` is
    `default`; two rows below `lg` (spec, The screen).
  - `DatePicker` props `{ view, date }`: a `<details>` whose panel is a month of day
    links (`calendarHref(view, day)`) with its own month ‹ › links
    (`?view=…&date=…&pick=YYYY-MM` keeps the picker open on that month); today circled.
  - On `/calendar` the shell's "+ New entry" and the phone's "+" add `&date=<date in
    view>`.
  - `e2e/seed.ts`: `seedCalendarWeek(prefix: string, zone: string)` — a user with
    CompX › ClientY – ProjectZ, CompX › CompY – Support, Myself › time-keep, and last
    week's Monday–Friday entries in the seed's shapes, with the Wednesday overlap and the
    Tuesday 23:00–Wednesday 01:00 entry (as Task 4); returns ids by name.

- [ ] **Step 1: Write the failing tests** — unit: `sidebarItems` has Calendar second;
  `barItems` labels Today, Calendar, Entries, Templates and the Calendar `href`;
  `screenTitle('/(app)/calendar')`; `ownsStrip`. e2e (`calendar.test.ts`, a user of its
  own per test from `seedCalendarWeek`): on the PC the sidebar's Calendar opens this
  week with "Week NN" and the total; ‹ goes to last week (`date` in the address); Today
  returns; Day / Week / Month switch the view keeping the date; the picker reaches a day
  of last month; on the phone the bar's Calendar opens `view=day` of today; with
  JavaScript disabled every toolbar link and the picker work.
- [ ] **Step 2: Run** `npx vitest run src/lib/shell.test.ts` and `npx playwright test
  e2e/calendar.test.ts e2e/shell.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Update `e2e/shell.test.ts` and the touch-target sweep to
  take the fifth bottom-bar cell and the Calendar screen in.
- [ ] **Step 4: Run** the unit tests and those e2e files — PASS.
- [ ] **Step 5: Commit** `feat: add the calendar screen and its toolbar`

### Task 6: The day and week grid

**Files:**
- Create: `src/lib/components/calendar/TimeGrid.svelte`,
  `src/lib/components/calendar/EntryBlock.svelte`,
  `src/lib/components/calendar/now.svelte.ts`
- Modify: `src/routes/(app)/calendar/+page.svelte`
- Test: `e2e/calendar.test.ts`

**Interfaces:**
- Consumes: Task 2 (`piecesOf`, `lanes`), Task 3 (`CalendarEntry`, `CalendarData`).
- Produces:
  - `TimeGrid` props `{ days: string[]; entries: CalendarEntry[]; totals; today; zone;
    now: number; hour: number; compact: boolean; back: string }` (`compact`: the phone's
    week: letter heads, colour-only blocks, each column a link to its day). The grid's
    hours scroll inside the view below sticky day heads; it fills the viewport below the
    toolbar; its foot leaves room for the phone's "+" (spec, The "+" over the phone's
    grid). Each column has `data-date`; each block `data-entry-id` and `data-first` /
    `data-last` for Tasks 8–9.
  - `EntryBlock` props `{ entry: CalendarEntry; piece: Piece & { lane; lanes }; hour;
    detail: 'week' | 'day' | 'none'; back }`: an `<a data-entry-form>` to
    `/entries/<id>?back=<back>` positioned absolutely; its accessible name and `title`
    the full text (customer › project, times, activity, location, reference,
    description, "Overlaps another entry"); under 45 minutes one line, project then
    start; text clamped to whole lines (`line-clamp` by the lines the block's height
    holds), dropping description then times as it narrows (container queries); a red
    top edge when `overlaps`; the running one with a dashed blue foot and "now · Running
    h:mm"; "from the previous day" on a piece without `first`.
  - `now.svelte.ts`: `nowTicker(initial: number): { readonly now: number }`, ticking
    every 30 s while mounted, so the running block, the line at now and the totals
    follow it.
  - The line at now (text colour, dot, the gutter tag) on today's column; shading
    before 08:00 and from 20:00; scroll on open per Global Constraints (after hydration;
    without JavaScript the grid starts at 00:00).

- [ ] **Step 1: Write the failing tests** — PC: last week shows each weekday's blocks
  with their project names; each head's total equals the seeded sum; the overlap's two
  blocks are side by side (their boxes do not overlap horizontally) and carry the
  overlap mark in their names; with a third entry seeded into that overlap
  (`seedEntry`-style, on that day) each of the three blocks still shows its project
  name; the crossing entry has a piece on the next day saying
  "from the previous day" and counts only in Tuesday's total; a block's `title` holds
  its description; clicking a block opens the entry form over the calendar and Back
  returns to the same week; the grid is scrolled so 07:00 is at its top. Today with a
  timer started 30 minutes ago (`startElsewhere`): its block reads "Running" and the
  line at now is in today's column. Phone: the day view of a seeded day shows
  full-width blocks; the week view's columns show letter, date and total, and tapping a
  column opens that day; no block's text is cut mid-line (each clamped element's
  `scrollHeight` ≤ its `clientHeight` + 1).
- [ ] **Step 2: Run** `npx playwright test e2e/calendar.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: draw the day and week grid`

### Task 7: The month

**Files:**
- Create: `src/lib/components/calendar/MonthGrid.svelte`,
  `src/lib/components/calendar/PhoneMonth.svelte`
- Modify: `src/routes/(app)/calendar/+page.svelte`
- Test: `e2e/calendar.test.ts`

**Interfaces:**
- Consumes: Task 3's data with `view: 'month'`.
- Produces: `MonthGrid` (from `lg`) and `PhoneMonth` (below `lg`), both `{ days;
  entries; totals; date; today; back }`, per spec, Month: PC cells with the date and the
  day's total, the date, "+n more" and the empty space linking to the day view, up to
  four entry lines (`<a data-entry-form>`: dot, start, project with an ellipsis; red
  outline on overlap; blue start when running), the week number and week total columns;
  days outside the month shaded; phone cells as links choosing the day (`calendarHref('month', day)`), with the total
  and one dot per project, then the chosen day's list (Today's row look; "Overlaps
  another entry"; its head links to the day view), with room at the foot for the "+".

- [ ] **Step 1: Write the failing tests** — PC: this month's cells show each seeded
  day's total and the week column each week's sum; a day with five entries shows four
  and "+1 more"; clicking a date opens its day view; clicking an entry line opens its
  form. Phone: tapping a cell lists that day's entries under the grid with its total;
  tapping a row opens its form; the last row clears the "+" when scrolled to the end.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: draw the calendar's month`

### Task 8: Keys, swipe and creating from the grid

**Files:**
- Create: `src/lib/calendar/gestures.svelte.ts`,
  `src/lib/components/calendar/NewBlock.svelte`
- Modify: `TimeGrid.svelte`, `src/routes/(app)/calendar/+page.svelte`
- Test: `e2e/calendar.test.ts`

**Interfaces:**
- Consumes: Task 2 (`snap`, `halfHourSlot`), Task 1 (`shift`, `calendarHref`),
  `openForm` (`#lib/entry-link.js`).
- Produces:
  - keys on the page, guarded as the layout's `n`/`s` are (outside fields, no open
    dialog, unmodified): `ArrowLeft`/`k`, `ArrowRight`/`j`, `t`, `d`, `w`, `m` → `goto`
    the shifted or switched address.
  - `swipe(opts: { onSwipe: (dir: -1 | 1) => void; enabled: () => boolean })`
    attachment: a touch whose horizontal travel is at least 60 px and twice its vertical
    travel; a right swipe is the previous period; on the view's region in all three
    views, disabled while a new block is pending or a drag is under way.
  - PC create: on empty grid (not on a block), pointer down/up under 4 px →
    `halfHourSlot`; a drag down → the range snapped to 5 minutes, drawn as a
    blue-outlined block with its times, staying in its day; either opens
    `openForm('/entries/new?date=…&start=…&end=…&back=…')`.
  - Phone create (day view only): a tap → `NewBlock` with round handles (top and
    bottom, 44 px hit areas, `touch-action: none`) and a fixed bar ("18:00 – 19:00",
    "Drag the handles to change it", Cancel, primary New entry) over the bottom bar;
    handles step 15 minutes, keep at least 15 minutes, stay inside the day; New entry or
    a tap on the block opens the form; Cancel, a tap elsewhere or a swipe drops it. The
    "+" hides while the bar shows.

- [ ] **Step 1: Write the failing tests** — PC: `k` then `j` move a week back and forth,
  `m`/`w`/`d` switch, `t` returns, and none fire while typing in the form; dragging last
  Thursday 16:00→17:30 opens the form with that date, `16:00` and `17:30`, focus in the
  project; saving shows the block, Thursday's total up 1:30 and Undo; a click at 10:40
  on an empty day opens 10:30–11:30. Phone: swiping right moves to the previous day;
  tapping 18:10 shows a block 18:00–19:00 and the bar; dragging the bottom handle down
  half an hour reads 18:00 – 19:30; New entry opens the form with those times; Cancel
  removes the block and saves nothing.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** The tests drive drags with `page.mouse` and touches with
  dispatched touch events (or `page.touchscreen` for taps).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: create entries from the calendar grid`

### Task 9: Moving and resizing on the PC

**Files:**
- Create: `src/lib/calendar/drag.ts`, `src/lib/calendar/drag.test.ts`,
  `src/lib/components/calendar/drag.svelte.ts`
- Modify: `src/routes/(app)/calendar/+page.server.ts` (action `move`),
  `EntryBlock.svelte`, `TimeGrid.svelte`
- Test: `src/lib/calendar/drag.test.ts`, `src/lib/server/screens/calendar.test.ts`
  (`moveInput`), `e2e/calendar.test.ts`

**Interfaces:**
- Consumes: Task 2 (`snap`), Task 6's `data-*` markers.
- Produces:
  - `drag.ts`: `type DragKind = 'move' | 'start' | 'end'`; `dropTimes(e: { startAt:
    number; endAt: number }, kind: DragKind, delta: { days: number; minutes: number },
    zone: string): { startAt: number; endAt: number }` — moves by wall-clock days and
    snapped minutes (a move keeps the duration; `start`/`end` keep the other end and
    leave at least 5 minutes); `clampDay(index: number, count: number): number`.
  - `calendar.ts`: `moveInput(form: FormData): { ok: true; input: { id: string;
    expectedVersion: number; start: string; end: string } } | { ok: false }`.
  - action `move` on `/calendar`: fields `id`, `version`, `start`, `end` (ISO instants
    with `Z`), `back`; `entries.update(input)`; success → `done(core, cookies, r,
    safeBack(back))`; refusal → `setFlash` with `error` (a stale version reads "This
    entry changed elsewhere. The calendar shows it as it is now.") and the same redirect.
  - `drag.svelte.ts`: attachment on the grid, PC only (`pointerType` mouse or pen):
    pointer down on a block (not running) starts a move after 4 px, on its top or bottom
    handle a resize (handles shown on hover and focus, only on the `first`/`last` piece:
    call 29); the block lifts, a dashed outline marks where it was, a tag shows "Fri
    14:15–15:30"; `Escape` cancels; release submits a hidden `use:enhance` form to
    `?/move` and ignores input until the result; the redirect is followed with
    `goto(location, { invalidateAll: true, noScroll: true })`; a press without movement
    leaves the click to open the form.

- [ ] **Step 1: Write the failing tests** — unit: `dropTimes` moves a 13:30–14:45 entry
  by +3 days and +45 minutes to 14:15–15:30 three days later; an `end` resize can't go
  before `startAt + 5 min`; across a DST change a move by one day keeps the wall times;
  `moveInput` refuses a missing id or a non-numeric version. e2e (PC): drag a block from
  Tuesday 13:30 to Friday 14:15: it lands 14:15–15:45 with Undo ("Edit entry on …");
  drag its bottom edge to 16:00; Undo once: back to 14:15–15:45; `Escape` mid-drag
  changes nothing; the running block has no handles and does not move; the crossing
  entry's handles show only at its start piece's top and its end piece's foot; a drop
  past Sunday clamps to Sunday; an entry edited elsewhere (`editElsewhere`) before the
  drop shows the stale message; two quick releases make one batch.
- [ ] **Step 2: Run** `npx vitest run src/lib/calendar/drag.test.ts
  src/lib/server/screens/calendar.test.ts` and the e2e file — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: move and resize entries by dragging`

### Task 10: Look, docs and the design record

**Files:**
- Modify: `docs/app.md` (Layout table, Shell's navigation and bottom bar, a Calendar
  section under Screens, Tests), `PRODUCT.md` (Capabilities), the shell's surface brief
  `.impeccable/surfaces/src-routes-app-layout-svelte.md` ("Item 13 adds Calendar"
  resolved), `DESIGN.md` and `.impeccable/design.json` (by impeccable's documenter)
- Test: the whole suite

- [ ] **Step 1:** Run impeccable's critique and audit on `/calendar` at 390 and 1440 px,
  light and dark, on a seeded month (`TZ=Europe/Budapest npx tsx scripts/seed-month.ts
  <db> <user> <password>`); fix every P0 and P1 through the review loop; record the
  rest as deferred minors.
- [ ] **Step 2:** Update the docs above; dispatch impeccable's documenter for DESIGN.md
  (the calendar block, the line at now, today's circle, the overlap edge, the toolbar,
  the phone's create bar).
- [ ] **Step 3: Run** `npm run check && npm run lint && npm run test:unit && npm run
  test:e2e` — all pass.
- [ ] **Step 4: Commit** `docs: record the calendar views`
