# Overlaps in the Calendar's Week View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only blocks drawn into each other share a day's column, each lane at least a
readable width; the PC week puts a "+n" chip where more meet than fit; the day view
hides nothing and scrolls sideways past the floor.

**Architecture:** A pure day layout in `src/lib/calendar/grid.ts` replaces the
two-pass `lanes` use in `TimeGrid.svelte`: it groups one-line boxes once, puts running
blocks in a group's first lanes, caps the lanes at what fits and returns chips for the
hidden runs; a second pure step grows a shared block for its name only into free time.
`TimeGrid` measures the week column's width for the cap, renders a new `MoreChip`, and
gives the day view a minimum width so it scrolls sideways; the `swipe` attachment
yields to a sideways scroll that can still move.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-week-overlaps-design.md` (approved,
revision 1). Read it, especially "The design" rules 1–13 and calls 9–17. The
stand-in's approval notes (`.autopilot/agents/19-spec-approval-1.md`) are folded in
below: the design mockups cut "ClientY" and broke "time-keep" at its hyphen, and the
64 px floor estimate looked low; the build must do neither and measure the floor.

## Global Constraints

- A block's drawn box for grouping is its time, at least one line tall:
  `drawnExtent(from, to, heightFor(1, marks), hour)`; the phone day's `growInto` 44 px
  growth stays applied before grouping (as `first` is today).
- Boxes that only touch at an edge do not meet (today's `lanes` rule: `from >= end`).
- Lanes in a group are equal; no widening into free room.
- The red top edge stays `entry.overlaps` (the core's rule); the layout never sets it.
- Readable floor: one exported constant `LANE_FLOOR` (px) in
  `src/lib/components/calendar/block.ts`, measured once so the first words "ClientY",
  "CompY", "time-keep", "Myself", "CompZ" show whole in a lane with the block's 3 px
  edge and 6 px padding each side. The PC week column at 1440 px (about 150 px) must
  hold two lanes; if the measurement says it cannot, stop and report it.
- The PC week's lanes that fit: `max(1, floor(columnWidth / LANE_FLOOR))`, measured on
  the rendered column and on resize; `2` before measuring and without JavaScript. The
  day views (PC and phone) never hide: their fit is `Infinity`.
- The chip's copy: text `+{n}`; accessible name
  `{n} more {n === 1 ? 'entry' : 'entries'} from {HH:mm}, {dayName(date)}; open the day`
  (e.g. "4 more entries from 06:12, Thursday 22 October; open the day").
- The chip's look: one line tall (`heightFor(1, 0)` px), the lane's width less 2 px,
  `bg-card`, 1 px `border-input`, `rounded-sm`, 12 px semibold text colour, hover
  `bg-accent`, the 2 px blue focus ring (`focus-visible:ring-2 ring-ring`). Never blue
  or red fill.
- A name wraps only between words and never inside one, "time-keep" included (its
  hyphen is not a break). An ellipsis where the room ends is fine once the first word
  shows whole.
- In a one-line block whose group has more than one lane, the start time gives way
  before the name is cut; the running time is never cut.
- The phone week (`compact`) is unchanged.
- Commits: Conventional Commits, no scope, lowercase imperative, no attribution.

## Review Focus

1. A running timer started in the same minute as stopped ones: it must be drawn, never
   behind a chip (Task 1 test "running blocks take the first lanes").
2. A long block overlapping many short ones hours apart: one chip per run of hidden
   blocks that meet, not one count for the whole group (Task 1 test "one chip per
   run").
3. A shared block growing for its name must not grow into the next group or a full-width
   block below it, and growing must not change any lane (Task 1 test "growth stops at
   the next block").
4. A narrow window or zoom where a week column fits only one lane: every group of two
   or more becomes one chip, and nothing overlaps (Task 1 test "fit of one"; Task 2 e2e
   at 1100 px).
5. The phone day's swipe after the sideways scroll reaches its edge: one touch never
   both scrolls and changes the day (Task 3 test "yields while it can scroll").

---

### Task 1: The day layout, pure

**Files:**

- Modify: `src/lib/calendar/grid.ts` (add after `lanes`, which stays exported)
- Test: `src/lib/calendar/grid.test.ts`

**Interfaces:**

- Produces:

  ```ts
  /** A box to lay out: its drawn extent in minutes, and whether it runs (drawn first). */
  export type Box = { from: number; to: number; running: boolean };
  export type Laid<T> = T & { lane: number; lanes: number; group: number };
  /** A "+n" chip: in lane `lane` of `lanes`, one line from `from`, counting `count`. */
  export type Chip = { from: number; lane: number; lanes: number; count: number; group: number };
  export function layoutDay<T extends Box>(
  	boxes: T[],
  	fit: number
  ): { shown: Laid<T>[]; chips: Chip[] };
  /** Each shared block's drawn end grown toward `from + want(b)`, only into free time. */
  export function growShared<
  	T extends { from: number; to: number; lane: number; lanes: number; group: number }
  >(shown: T[], chips: Chip[], want: (b: T) => number, line: number): T[];
  ```

  `shown` keeps the input order of the boxes it holds (hidden boxes are dropped).
  `group` numbers groups in start order from 0; a lone box is its own group with
  `lanes: 1`.

- [ ] **Step 1: Write the failing tests** in `grid.test.ts`, `describe('layoutDay')`
      and `describe('growShared')`, with boxes as `{ from, to, running }` minutes
      (`running` false unless stated):
  - "a lone box takes the full width": `[{360,380}]`, fit 2 → `lane 0, lanes 1`.
  - "boxes that only touch do not share": `[{360,380},{380,400}]` → both `lanes 1`.
  - "a crowded minute does not split the day":
    `[{372,397},{372,397},{372,397},{420,445},{480,810},{540,630},{780,930}]`, fit
    `Infinity` → the three 372 boxes `lanes 3`; 420 `lanes 1`; 480 and 540 `lanes 2`
    in lanes 0 and 1; 780 `lanes 2`, in the same group as 480.
  - "more than fit: the last lane holds a chip": five boxes `{372,397}`, fit 2 →
    `shown` has one box (`lane 0, lanes 2`); `chips` is
    `[{ from: 372, lane: 1, lanes: 2, count: 4, group: 0 }]`.
  - "running blocks take the first lanes": `[{372,397},{372,397},{372,500,running}]`,
    fit 2 → the running box is shown in lane 0; one chip counting 2.
  - "one chip per run": `[{480,1000},{500,525},{500,525},{900,925},{900,925}]`, fit 2
    → shown: the 480 box (lane 0); chips at 500 (count 2) and 900 (count 2), lane 1.
  - "fit of one": `[{360,420},{380,440}]`, fit 1 → `shown` empty; one chip
    `{ from: 360, lane: 0, lanes: 1, count: 2, group: 0 }`. A lone box with fit 1 is
    shown.
  - "fit Infinity never hides": ten boxes `{372,397}` → ten shown, `lanes 10`, no chips.
  - growShared "grows into free time in its lane": the 480/540/780 group above (lanes
    2; 540 in lane 1, 780 in lane 1), `want` 120 minutes for the 540 box, line 25 → the
    540 box's `to` becomes 660 (free until 780); the 480 box is unchanged by it.
  - growShared "growth stops at the next block": a group `[{480,505},{480,505}]` (lanes
    2) and a lone `{520,545}`; `want` 90 for both → each grown `to` is 520.
  - growShared "never shrinks and leaves lone blocks alone": `want` smaller than the
    box → unchanged; a `lanes: 1` box is never grown.

- [ ] **Step 2: Run to see them fail**

  Run: `npx vitest run src/lib/calendar/grid.test.ts`
  Expected: FAIL, `layoutDay` and `growShared` are not exported.

- [ ] **Step 3: Implement `layoutDay` and `growShared` in `grid.ts`**

  `layoutDay`: form groups as `lanes` does (sort by from, then to; a box starting at or
  after the group's end closes it). Inside each group assign lanes anew: running boxes
  first (by from), then finished ones (by from, then to), each into the first lane
  holding no box whose `[from, to)` intersects it. If the group's lane count `L` is at
  most `fit`, every box is shown with `lanes: L`. Otherwise the group shows
  `lanes: fit`: boxes in lanes `0 … fit-2` are shown, the rest hidden; the hidden boxes
  form runs (boxes whose `[from, to)` intersect, chained, in start order) and each run
  gives one chip `{ from: run's first from, lane: fit-1, lanes: fit, count: run's size }`.

  `growShared`: for each box with `lanes > 1`, its new `to` is
  `max(to, min(from + want(b), limit))`, where `limit` is the least `from` at or after
  this box's `to` among the other shown boxes in the same group and lane, the chips in
  that lane of the group, and every shown box or chip of another group; `1440` when
  none. A chip occupies `[from, from + line)`.

- [ ] **Step 4: Run the tests**

  Run: `npx vitest run src/lib/calendar/grid.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/calendar/grid.ts src/lib/calendar/grid.test.ts
  git commit -m "feat: lay out a day's blocks once, with chips past the fit"
  ```

### Task 2: The week and day grids use it; the "+n" chip

**Files:**

- Create: `src/lib/components/calendar/MoreChip.svelte`
- Modify: `src/lib/components/calendar/TimeGrid.svelte` (`placed`, the `column`
  snippet, `onpointerdown`'s ignore list), `src/lib/components/calendar/EntryBlock.svelte`
  (the name's words, the one-line block's start time),
  `src/lib/components/calendar/block.ts` (`LANE_FLOOR`)
- Modify: `e2e/seed.ts` (a crowded-day fixture), `e2e/calendar.test.ts`
- Docs: `docs/app.md` (Calendar), `DESIGN.md` (Calendar: Block, a new "More chip"
  bullet; a `calendar-more-chip` token beside `calendar-block`), and
  `.impeccable/design.json` if the documenter keeps tokens there

**Interfaces:**

- Consumes: `layoutDay`, `growShared`, `Chip`, `Box` from Task 1.
- Produces: `MoreChip.svelte` with props
  `{ chip: Chip; date: string; hour: number; scope: string; startTime: string }`,
  rendering `<a data-more-chip href={calendarHref('day', date, scope)} …>`;
  `LANE_FLOOR: number` from `block.ts`; `seedCrowdedDay(prefix, zone, crowd = 5)` from
  `e2e/seed.ts`.

- [ ] **Step 1: Write the failing browser tests** in `e2e/calendar.test.ts`, a
      `test.describe('crowded columns')` on a new fixture `seedCrowdedDay` (today in the
      zone: `crowd` entries at 06:12–06:15 alternating "ClientY – ProjectZ" and
      "time-keep", one of them running from 06:12; a lone "CompZ – Audit 2026" at
      07:00–07:20; 08:00–13:30, 09:00–10:30 and 13:00–15:30; returning the ids). At
      1440 × 900, the week view of today:
  - "a lone block takes the column's width": the 07:00 block's width is the column
    body's width less 2 px (±1).
  - "the crowded minute shows what fits and a chip": exactly one of the 06:12 blocks is
    visible, and it is the running one; one `[data-more-chip]` reads "+4", its
    accessible name is "4 more entries from 06:12, <dayName(today)>; open the day".
  - "names wrap only between words": for every `[data-word]` in the week grid,
    `getClientRects().length === 1`, and none is cut before the end of its block's
    first word.
  - "the overlapping three share two lanes": the 08:00 and 09:00 blocks are each about
    half the column wide and side by side; the 13:00 block has the same width.
  - "the chip opens the day by keyboard": focus the chip, press Enter → the address has
    `view=day&date=<today>`, and all five 06:12 blocks are visible side by side.
  - "at 1100 px a column fits one lane": every group of two or more is a chip, and no
    two visible blocks or chips intersect.
  - Update "three overlapping entries each show their project" and "back-to-back short
    entries are drawn apart" where they assert the old lane counts.

- [ ] **Step 2: Run to see them fail**

  Run: `npx playwright test e2e/calendar.test.ts -g "crowded columns"`
  Expected: FAIL (no chip; the lone block is narrow).

- [ ] **Step 3: Implement**
  - `block.ts`: export `LANE_FLOOR`, measured in Chromium against the five first words
    (semibold 12 px label type) plus the 3 px edge, 12 px padding and 2 px gap; the
    comment records the measurement.
  - `TimeGrid.svelte` `placed`: per day (not compact),
    `layoutDay(grown(ds), detail === 'week' ? weekFit : Infinity)`, then
    `growShared(shown, chips, want, line)` where `want` is the lines from `needOf`
    (default 2, or 3 among three or more lanes, as today) turned into minutes through
    `heightFor` and `hour`, and `line` the one-line minimum in minutes. Delete the
    second `lanes` pass (`wider`). `placed` also yields each day's chips. Compact keeps
    today's single `lanes` call. `weekFit`: `$state(2)`, set by a `ResizeObserver` on
    the first week column's `[data-body]` to `Math.max(1, Math.floor(width / LANE_FLOOR))`.
  - The `column` snippet renders each chip as a `MoreChip`; `onpointerdown` ignores
    `[data-more-chip]` as it does a block; `BlockDrag` never picks a chip up.
  - `MoreChip.svelte`: positioned as a block is (`top` from `chip.from`, one line tall,
    `left`/`width` from `lane`/`lanes`), with the look and copy in Global Constraints,
    `z-[1]`.
  - `EntryBlock.svelte`: the name rendered as its words split on spaces, each in
    `<span data-word class="whitespace-nowrap">` joined by spaces, so a line breaks only
    between words; drop `wrap-break-word` from the name. In a one-line block with
    `piece.lanes > 1`, the start time is hidden first when the name would be cut.
  - Docs as listed: the grouping, the floor, the chip, the day view hiding nothing.

- [ ] **Step 4: Run the browser tests and the unit tests**

  Run: `npx playwright test e2e/calendar.test.ts && npm run test:unit`
  Expected: PASS.

- [ ] **Step 5: impeccable critique and audit** of the week at 1440 px, light and dark,
      on the seeded month and the crowded fixture (run by the controller); findings are
      fixed in this task.

- [ ] **Step 6: Commit**

  ```bash
  git add -A src/lib/components/calendar e2e docs/app.md DESIGN.md .impeccable
  git commit -m "feat: draw only meeting blocks side by side, with a +n chip"
  ```

### Task 3: The day view scrolls sideways past the floor; the swipe yields

**Files:**

- Modify: `src/lib/calendar/gestures.svelte.ts` (`swipe`, a new pure `swipeYields`)
- Modify: `src/lib/components/calendar/TimeGrid.svelte` (the day view's minimum width,
  sticky gutter, `data-swipe-scroll`)
- Test: `src/lib/calendar/gestures.test.ts` (create), `e2e/calendar.test.ts`
- Docs: `docs/app.md` (Calendar: the phone day's swipe), `DESIGN.md` (Time grid)

**Interfaces:**

- Consumes: `seedCrowdedDay(prefix, zone, crowd)` and `LANE_FLOOR` from Task 2.
- Produces:

  ```ts
  /** A sideways scroller's room when a touch began: whether it could still move. */
  export type Room = { back: boolean; on: boolean };
  /** Whether a swipe in `dir` (-1 previous, 1 next) is the scroller's, not the period's. */
  export function swipeYields(dir: -1 | 1, room: Room | null): boolean;
  ```

  `back` is `scrollLeft > 0`; `on` is `scrollLeft + clientWidth < scrollWidth - 1`. A
  swipe right (`dir -1`) yields when `room.back`; a swipe left (`dir 1`) when
  `room.on`; `null` (no sideways scroller under the touch) never yields.

- [ ] **Step 1: Write the failing tests**
  - `gestures.test.ts`, "yields while it can scroll": `swipeYields(-1, {back:true,on:false})`
    true; `swipeYields(1, {back:true,on:false})` false; `swipeYields(1, {back:false,on:true})`
    true; `swipeYields(-1, null)` false.
  - `e2e/calendar.test.ts`, phone 390 × 844 with touch, `seedCrowdedDay(…, 8)`, the day
    view of today: "the phone day keeps lanes readable and scrolls sideways": every
    06:12 block is at least `LANE_FLOOR` − 2 px wide, the grid scroller's
    `scrollWidth > clientWidth`, no chip, and the hour gutter stays in view after
    scrolling right. "a swipe scrolls first, then changes the day": from the left
    edge, a swipe left scrolls and the date stays; at the right edge, a swipe left
    moves to the next day; from the left edge, a swipe right moves to the day before.
  - PC 1440, the same day view: all eight side by side, no sideways scroll.

- [ ] **Step 2: Run to see them fail**

  Run: `npx vitest run src/lib/calendar/gestures.test.ts && npx playwright test e2e/calendar.test.ts -g "sideways"`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  - `swipeYields` as specified. `swipe`: on `touchstart`, find the target's closest
    `[data-swipe-scroll]` and record its `Room` (`null` when it does not overflow
    sideways); on `touchend`, when `swipeYields(dir, room)`, do not call `onSwipe`.
    Room is read only at the start, so reaching the edge mid-touch never changes the
    day.
  - `TimeGrid.svelte`, day view only (`detail === 'day'`): the grid's columns become
    `{gutter}px minmax({maxLanes * LANE_FLOOR}px, 1fr)`, `maxLanes` being the most
    lanes any group in the day takes; the scroller adds `overflow-x-auto` and
    `data-swipe-scroll`; the gutter column and its head are `sticky left-0` on the
    card's background above the blocks. The week and the phone week are unchanged.
  - Docs as listed.

- [ ] **Step 4: Run the tests**

  Run: `npx vitest run src/lib/calendar && npx playwright test e2e/calendar.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/calendar src/lib/components/calendar e2e docs/app.md DESIGN.md
  git commit -m "feat: scroll a crowded day sideways before the swipe moves it"
  ```

Approved by the operator stand-in, revision 1, 2026-10-22.
