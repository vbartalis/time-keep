# Crowded runs in the phone's day view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the phone the Calendar's day view keeps to the screen's width. A run too
crowded for the 68 px lane floor folds into a "+n" chip, and the chip opens a sheet of
exactly the folded entries.

**Architecture:** `layoutDay` (pure, `src/lib/calendar/grid.ts`) already folds a group
past `fit` lanes into chips. Each chip now also carries the indices of the boxes it
hides, and a new pure `growChips` grows a chip toward 44 px into free time.
`TimeGrid.svelte` gives the phone's day (`create === 'tap'`) a measured fit and drops
its sideways column. A new `MoreSheet.svelte` lists a chip's entries on the existing
bottom `Sheet`. `MoreChip.svelte` gains a sheet-opening mode, whose fallback without
JavaScript is a link to Entries on that day. The PC's day, both weeks and the months do
not change.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind, Vitest
(`npm run test:unit`), Playwright (`npm run test:e2e`; projects `phone`, a Pixel 7,
and `pc`, 1440×900).

**Spec:** `docs/superpowers/specs/2026-10-22-crowded-phone-day-design.md` (approved,
revision 2). Read it before each task.

## Global Constraints

- The phone's day is the `TimeGrid` with `create === 'tap'`. The PC's day (`create === 'drag'`), the phone's week (`compact`) and the PC's week keep today's behaviour exactly.
- Lane floor: `LANE_FLOOR` (68 px, `src/lib/components/calendar/block.ts`), unchanged. The phone day's fit is `Math.max(2, Math.floor(columnWidth / LANE_FLOOR))`, measured on the rendered `[data-body]`. It falls back to 4 before measuring and without JavaScript.
- The chip's accessible name and title on the phone's day: `${n} more ${n === 1 ? 'entry' : 'entries'} from ${HH:mm}; show them`. The sheet's title: `${n} more ${n === 1 ? 'entry' : 'entries'} from ${HH:mm}`. The week chip's name stays `… , <day name>; open the day`.
- Without JavaScript, the phone day's chip `href` is `/entries?range=custom&from=<date>&to=<date>`, followed by `&<scope>` when the filter's scope query is not empty.
- No back-end change. No new dependency.
- Tests first (TDD) in every task. Commits follow Conventional Commits with no scope, lowercase and imperative, with no attribution.
- Copy is English. Times are `HH:mm`, 24-hour.

## Review Focus

1. **A wider phone (Pixel 7, 412 px)** fits five lanes, not four. Tests that pin counts set the viewport to 390×844 first. Task 2 pins the 412 px case too: the fold still keeps the grid to the screen's width.
2. **A running timer inside the crowd** must stay drawn (it takes lane 0), never in the sheet. When more timers run than lanes fit, a running one may be folded, and its row shows "now" in blue. Task 1 pins the first case; Task 3 renders "now".
3. **The data changes while the sheet is open or after a row's form saves** (an entry deleted, so the chip's count drops or the chip goes). The sheet must not show stale or missing rows, and closing it must not throw when its chip is gone. Task 3 pins Delete from the sheet's form.
4. **A tap on the chip while a new block is pending** (the phone's draft) drops the draft and opens nothing else. **A swipe that starts on the chip** changes the day and opens no sheet. Task 3 pins both.
5. **The filter on** (`scope`): the chip's no-JavaScript link carries the scope, and the folded entries respect the filter, since they come from the entries shown. Task 3 pins the `href` with a scope.

---

### Task 1: Chips know what they fold, and grow toward 44 px

**Files:**
- Modify: `src/lib/calendar/grid.ts` (the `Chip` type, `layoutDay`, a new `growChips`)
- Test: `src/lib/calendar/grid.test.ts` (`describe('layoutDay')`, a new `describe('growChips')`)

**Interfaces:**
- Produces: `Chip` gains `hidden: number[]`, the indices into `layoutDay`'s input `boxes` of the boxes the chip folds, in start order (ties by end, then by index).
- Produces: `export function growChips<T extends { from: number; to: number; lane: number; group: number }>(chips: Chip[], shown: T[], least: number): Chip[]`. Each chip's `to` becomes `Math.max(chip.to, Math.min(chip.from + least, limit))`. `limit` is the earliest `from` that is `>= chip.to` among: the shown boxes in the chip's group and lane, the shown boxes in other groups, and the other chips. It never shrinks a chip and never passes 1440.

- [ ] **Step 1: Write the failing tests**

In `describe('layoutDay')`, the existing `toEqual` chip assertions gain `hidden`:
`'more than fit: the last lane holds a chip'` expects `hidden: [1, 2, 3, 4]`, and
`'running blocks take the first lanes'` expects `hidden: [0, 1]`. Add:

```ts
it('a chip names the boxes it folds, in start order', () => {
	// Seven 3-minute timers and a running one, as the gate's crowded day, at a fit of 4.
	const boxes = [
		box(1083, 1086), box(1094, 1097), box(1083, 1086), box(1084, 1087),
		box(1094, 1097), box(1085, 1088), box(1095, 1098), box(1083, 1200, true)
	];
	const { shown, chips } = layoutDay(boxes, 4);
	expect(shown).toHaveLength(3);
	expect(shown.find((b) => b.running)).toMatchObject({ lane: 0 });
	expect(chips).toHaveLength(1);
	expect(chips[0].count).toBe(5);
	expect(chips[0].hidden).toHaveLength(5);
	const starts = chips[0].hidden.map((i) => boxes[i].from);
	expect(starts).toEqual([...starts].sort((a, b) => a - b));
	// Every box is drawn or folded, never both: the running one is drawn, never folded.
	expect(new Set(chips[0].hidden).size).toBe(5);
	expect(shown.length + chips[0].hidden.length).toBe(boxes.length);
	expect(chips[0].hidden).not.toContain(7);
});
```

New `describe('growChips')`:

```ts
const chip = (from: number, to: number, lane = 1, group = 0) =>
	({ from, to, lane, lanes: 2, count: 2, group, hidden: [1, 2] });
const at = (from: number, to: number, lane: number, group: number) => ({ from, to, lane, group });

it('grows a chip into free time toward `least`', () => {
	expect(growChips([chip(600, 603)], [at(600, 650, 0, 0)], 47)[0].to).toBe(647);
});
it('stops at the next block in its lane of its group', () => {
	expect(growChips([chip(600, 603)], [at(620, 640, 1, 0)], 47)[0].to).toBe(620);
});
it('ignores blocks in other lanes of its group', () => {
	expect(growChips([chip(600, 603)], [at(610, 700, 0, 0)], 47)[0].to).toBe(647);
});
it('stops at another group’s first block, and at another chip', () => {
	expect(growChips([chip(600, 603)], [at(615, 640, 0, 1)], 47)[0].to).toBe(615);
	expect(growChips([chip(600, 603), chip(610, 612, 1, 1)], [], 47)[0].to).toBe(610);
});
it('never shrinks a chip, nor passes midnight', () => {
	expect(growChips([chip(600, 700)], [], 47)[0].to).toBe(700);
	expect(growChips([chip(1430, 1433)], [], 47)[0].to).toBe(1440);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/lib/calendar/grid.test.ts`
Expected: FAIL. `hidden` is missing from the chips, and `growChips` is not exported.

- [ ] **Step 3: Implement**

In `layoutDay`, record each run's member indices as it builds `run` and push them as
`hidden`, sorted by `from`, then `to`, then index. Leave everything else in `layoutDay`
as it is: grouping, ranking, which boxes hide and chip spans. Then add `growChips` with
the signature above, and update the `Chip` doc comment.

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run src/lib/calendar/grid.test.ts`, then `npm run check`
Expected: all PASS; no type errors (TimeGrid and MoreChip ignore `hidden` for now).

- [ ] **Step 5: Commit**

`git commit -m "feat: give a calendar chip the entries it folds"`

### Task 2: The phone's day keeps to the screen's width

**Files:**
- Modify: `src/lib/components/calendar/TimeGrid.svelte` (`place`, `dayColumn`, a new fit measure, the chips' growth)
- Modify: `e2e/calendar.test.ts`. In `test.describe('the day scrolls sideways')`, replace the two phone tests, `'the phone day keeps lanes readable and scrolls sideways'` and `'a swipe scrolls first, then changes the day'`. Keep `'the PC day draws eight side by side without sideways scroll'`. Rename the describe to `'a crowded day'`, and update the comment above it to cite item 21.

**Interfaces:**
- Consumes: `layoutDay`, `growChips`, `Chip.hidden` (Task 1).
- Produces: in `TimeGrid`, `phoneDay = create === 'tap' && !compact`. For the phone's day, `layoutDay(boxes, dayFit)`, where `let dayFit = $state(4)` is measured as `weekFit` is (same effect pattern, `Math.max(2, Math.floor(width / LANE_FLOOR))`) on the phone day's `[data-body]`. Then `growChips(chips, shown, Math.ceil((44 * 60) / hour))` runs *before* `growShared`, so no block grows into a chip's time. `dayColumn` is `null` for the phone's day, so there is no `min-w-max`, no `overflow-x-auto` and no `data-swipe-scroll`; the PC day keeps its value. `placed` returns `chips` with `hidden` for Task 3. The week (`detail === 'week'`) and the PC day are untouched: the PC day stays `Infinity`.

- [ ] **Step 1: Write the failing e2e tests** (phone project only, `test.skip(isPc(), …)`, viewport `390×844` set before seeding; `crowdedDay` seeds with `crowd = 8`)

- `'the phone’s crowded day keeps to the screen’s width'`: the `[data-grid-scroll]`'s
  `scrollWidth <= clientWidth`. Exactly 3 of `u.entries.crowded` are drawn, the running
  one among them. One `[data-more-chip]` reads `+5`. The audit block's width is within
  2 px of the column body's (`[data-body]`) width. The day's head total is inside the
  viewport. No two drawn boxes intersect (`intersecting(await drawnIn(grid(page, 'Day')))`
  is `[]`), and every drawn crowded block is at least `LANE_FLOOR - 2` wide.
- `'at 412 px the phone’s crowded day still fits'`: viewport `412×915`, `scrollWidth <=
  clientWidth`, and drawn crowded blocks plus the chip's count equal 8.
- `'a swipe on the crowded phone day changes the day'`: from the grid's middle, a swipe
  right goes to `addDays(u.today, -1)`. Back on today, a swipe left goes to
  `addDays(u.today, 1)`. Use the existing `touchDrag` coordinates.
- `'the phone day’s chip grows toward 44 px into free time'`: the chip's height is at
  least 43 px. The seed's crowd has free time under it: nothing starts in the chip's
  lane before the audit at 07:00, or before 00:30 when the crowd is at 00:12.

- [ ] **Step 2: Run them and see them fail**

Run: `npx playwright test e2e/calendar.test.ts -g "crowded day|412 px|chip grows" --project=phone`
Expected: FAIL. The grid is wider than its view (`scrollWidth > clientWidth`), and there is no chip.

- [ ] **Step 3: Implement in `TimeGrid.svelte`** as the Interfaces block says. Update the
  doc comments on `placed`, `dayColumn` and the fit measure: the phone's day folds as
  the week does (item 21), and the PC's day keeps every lane.

- [ ] **Step 4: Run the calendar suite on both projects**

Run: `npx playwright test e2e/calendar.test.ts`
Expected: all PASS, including `'the PC day draws eight side by side without sideways scroll'`
and every `'crowded columns'` week test, which are unchanged.

- [ ] **Step 5: Commit**

`git commit -m "feat: fold a crowded run on the phone’s day into a chip"`

### Task 3: The chip opens a sheet of the folded entries

**Files:**
- Create: `src/lib/components/calendar/MoreSheet.svelte`
- Modify: `src/lib/components/calendar/MoreChip.svelte` (an `onopen` mode), `src/lib/components/calendar/TimeGrid.svelte` (wire chip to sheet)
- Test: `e2e/calendar.test.ts` (in `'a crowded day'`)

**Interfaces:**
- Consumes: `Chip.hidden` and the phone day's chips (Tasks 1–2). `Sheet` (`src/lib/components/timesheet/Sheet.svelte`: `open`, `labelledby`, `onclose`, children).
- Produces: `MoreSheet` props `{ open: boolean; title: string; entries: CalendarEntry[]; back: string; now: number; onclose: () => void }`. It renders a `Sheet` with an `h2` title (id from `$props.id()`), a Close button (`aria-label="Close"`, 44 px) in its head, and a `<ul>` of rows in the phone month's day-list look, copied from `PhoneMonth.svelte` lines 131–163. Each row is an `a[data-entry-form][data-entry-id]` to `/entries/<id>?back=<back>`, with `min-h-11`, the 4 px project-colour edge, start over end ("now" in `text-primary` for a running one), customer › project wrapping, activity · description muted, "Overlaps another entry" in `text-destructive`, and the duration at the right. A click on a row calls `onclose()`; the layout's capture listener opens the form.
- Produces: `MoreChip` gains optional `onopen?: () => void`. When it is set, the `href` is the Entries fallback (Global Constraints), the name is the "; show them" form, and `onclick` calls `preventDefault()` then `onopen()`. Without `onopen`, nothing changes (the week). On the phone's day, `TimeGrid` passes `onopen` for each chip and holds `let sheet = $state<{ key: string } | null>(null)`. The open sheet's entries are derived from the *current* `placed` chip with that key (`${group}:${from}`), mapped through `hidden` to `CalendarEntry`. When that chip is gone after a change, the sheet closes. Focus returns to the chip on close (the native dialog does this), or to the grid's scroller when the chip is gone.

- [ ] **Step 1: Write the failing e2e tests** (phone, 390×844, `crowd = 8`, unless noted)

- `'the chip opens a sheet of exactly the folded entries'`: tap the chip. A dialog named
  `5 more entries from ${u.crowdAt}` shows. Its links' `data-entry-id`s equal the
  crowded ids not drawn in the grid, as a set. Each row shows customer › project
  uncut: the name's `scrollWidth <= clientWidth`. Each row is at least 44 px tall. A tap
  on the scrim (the dialog's top-left corner, outside its box) closes it.
- `'a folded entry opens its form from the sheet, and Undo restores it'`: open the sheet,
  tap the first row. The dialog `Edit entry` shows and the sheet is hidden. Set
  Description to `Fixed from the sheet` and Save. The day view shows, and the strip's
  Undo restores the old description: check it by opening the entry's form again, or
  through the sheet.
- `'Delete from the sheet’s form: the chip counts one fewer'`: open the sheet and a row,
  then Delete. The chip reads `+4`. Undo, and it reads `+5` again.
- `'the chip by keyboard: Enter opens the sheet, Escape returns to the chip'`: focus the
  chip and press Enter. Focus is inside the sheet. Press Escape: the sheet is hidden and
  `document.activeElement` is the chip.
- `'a tap on the chip with a block pending drops the block and opens nothing'`: tap
  empty time at 20:00 (a pending block shows), then tap the chip. There is no pending
  block, and the sheet is hidden.
- `'a swipe that starts on the chip changes the day, with no sheet'`: `touchDrag` from
  the chip's centre 200 px right moves to the day before, and no sheet shows.
- Without JavaScript (`test.use({ javaScriptEnabled: false })`, phone): the chip's
  `href` is `/entries?range=custom&from=${u.today}&to=${u.today}`. With
  `&project=<u.projects.timeKeep>` in the Calendar's address, it ends with that scope.
  Following it lists the folded entries' descriptions on Entries.

- [ ] **Step 2: Run them and see them fail**

Run: `npx playwright test e2e/calendar.test.ts -g "sheet|chip by keyboard|pending drops|starts on the chip|without JavaScript" --project=phone`
Expected: FAIL (no dialog; the chip links to the day).

- [ ] **Step 3: Implement** `MoreSheet.svelte` and the `MoreChip` and `TimeGrid` changes
  as the Interfaces block says. Use only DESIGN.md's existing `bottom-sheet`,
  `sheet-row` and `calendar-more-chip` styles; no new tokens.

- [ ] **Step 4: Run the calendar suite, then the touch-target suite**

Run: `npx playwright test e2e/calendar.test.ts e2e/touch-targets.test.ts`
Expected: all PASS on both projects (the PC week's chip test still sees `; open the day` and its `href` to the day).

- [ ] **Step 5: Commit**

`git commit -m "feat: open a crowded run’s entries from its chip"`

### Task 4: Critique, audit and the docs

**Files:**
- Modify: `DESIGN.md`: the Calendar's day-view crowding; the chip on the phone's day (it grows toward 44 px, and opens the sheet); the sheet of folded entries. Update the frontmatter's `calendar-more-chip` height line.
- Modify: `docs/app.md`: Calendar. The day views' fit (the phone's day folds at the floor; the PC's day keeps every lane and scrolls past the view), the chip on the phone's day, the sheet, and the swipe (no sideways scroller on the phone's day). Add `MoreSheet` to the components table row for `src/lib/components/calendar/`.
- Test: any fix the critique or audit finds gets its own test first.

- [ ] **Step 1: Seed and run the app** as `.claude/agents/usability-gate.md` describes
  (`TZ=Europe/Budapest npx tsx scripts/seed-month.ts <db> <user> <password>`). Make the
  gate's crowded day on today: start timers from the strip in quick succession, then
  stop them all.
- [ ] **Step 2: Run `impeccable:impeccable`, critique and then audit,** on the phone's day
  view, the chip and the open sheet. Do it at 390 px in light and dark, with
  screenshots under `.autopilot/screenshots/21/build/`, against DESIGN.md. Use no
  live-browser modes. Fix what they find in the task's scope (test first), and write
  the rest in the report.
- [ ] **Step 3: Update DESIGN.md and docs/app.md** as listed above. Then run
  `npx prettier --write DESIGN.md docs/app.md`.
- [ ] **Step 4: Run** `npm run check`, `npm run lint`, `npm run test:unit`. Expected: all PASS.
- [ ] **Step 5: Commit**

`git commit -m "docs: record the phone day’s crowded runs"` (and a `fix:` commit before it for any critique fix)

Approved by the operator stand-in, revision 1, 2026-10-22.
