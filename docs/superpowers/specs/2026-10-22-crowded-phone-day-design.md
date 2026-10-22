# Crowded runs in the phone's day view — design

Roadmap item 21. Written 2026-10-22 in an autopilot design session; the operator
stand-in answered in the operator's place (see the last section).

## Intent

On the phone, the Calendar's day view is where the operator reads and fixes one day.
The usability check's second run (item 16, gate task 12 at 390 px, light and dark)
failed it. Today held a run of seven short timer entries around 18:00, all started in
the same few minutes. Item 19 lets the day view hide nothing: every lane keeps the
readable floor (68 px), and past the screen the grid scrolls sideways. Seven lanes made
the grid 529 px wide on a 390 px screen. The whole day widened, not only the crowded
run. A lone block was drawn 474 px wide, other blocks were cut at the right edge, and
the day's total in the head was off screen. To read the day, the user had to scroll
sideways. Kimai, Google and Samsung keep a day to the screen's width, and Samsung
shows a "+3" chip where short events crowd. This app's week view already does the
same.

After this item the phone's day keeps to the screen's width. A run too crowded for
the floor folds into a "+n" chip, by the week view's rule. Tapping the chip opens a
sheet with exactly the folded entries, and each row opens its entry's form, so nothing
is hidden for good. The PC's day view does not change.

Screenshots of the defect: `.autopilot/screenshots/16/defect-calendar-day-today-390-light.png`,
`-390-dark.png`, `-scrolled-390-light.png`, `-evening-390-light.png`.
Mockups: `.autopilot/screenshots/21/design/mock-four-390.png` (the fold) and
`mock-sheet-390.png` (the sheet). They are layout sketches, not the look: the build
uses DESIGN.md's block, chip, sheet and row styles. Where they disagree with the rules
below, the rules hold. The sketch's sheet rows are out of start order, and its second
"ClientY – ProjectZ" block is cut through a line; neither is intended.

## What the phone's day view does, after this item

1. **The grid keeps to the screen's width.** At 390 px the day's column is the screen
   less the hour gutter. Nothing in the phone's day view scrolls sideways. A block that
   overlaps nothing runs the column's full width. The day's head, with its total, stays
   in view.
2. **The lanes that fit.** The phone day fits as many lanes as its column holds at
   item 19's floor (`LANE_FLOOR`, 68 px), measured on the rendered column and measured
   again when it resizes. That is four at 390 px (about 338 px). It is the week view's
   rule (`weekFit`), applied to the phone's day. Before it is measured, and without
   JavaScript, the fallback is four.
3. **The fold is item 19's.** A group that needs more lanes than fit uses `layoutDay`
   as the week does. Running blocks take the first lanes, then the longest. Lanes before
   the last one that fits are drawn. Each run of hidden blocks that meet gets one "+n"
   chip in the last lane, spanning the run's drawn time (a line at least). Only the
   crowded stretch is folded. Item 19's rules 6–8 hold for the blocks still drawn:
   names wrap only between words, a block grows only into free time, and text is never
   cut through a line.
4. **The chip** looks as the week's does (DESIGN.md `calendar-more-chip`: "+n" on the
   surface, a 1 px `input` stroke). On the phone's day it does what a block there does:
   it grows toward a 44 px target into the free time under it (DESIGN.md: "on the phone
   day a block grows toward 44 px into the free time under it"). It stays at its run's
   drawn height only where something drawn follows right after in its lane. The time it
   grows into is taken, as a block's is: no other block grows into it. Its accessible
   name says what it holds and what it does: "4 more entries from 18:04; show them".
5. **Tapping the chip opens a sheet** (the phone's bottom `Sheet`, as Entries' row
   sheet and Filter use) titled "4 more entries from 18:04". It lists exactly the
   folded entries, in start order, as rows in the phone month's day-list look: a 4 px
   edge in the project's colour; start over end ("now" in blue for a running one);
   customer › project, wrapping, never cut; activity · description in muted text;
   "Overlaps another entry" in red where it does; the duration at the right. Each row
   is at least 44 px tall.
6. **A row opens that entry's form** over the Calendar, as a block does (an
   `a[data-entry-form]` link carrying the Calendar's `back`). The sheet closes as the
   form opens. Saving, Delete and Cancel return to the day view as they do from a
   block, and Undo shows in the strip as usual. The layout then follows the change.
7. **Closing the sheet:** Escape, a tap on the scrim, the browser's Back, or a Close
   button in its head. Each of these returns focus to the chip.
8. **Without JavaScript** the chip is a link to Entries on that day
   (`/entries?range=custom&from=<date>&to=<date>`, carrying the filter's scope), so
   the folded entries are still reached. The fit is the fallback of four.
9. **The swipe.** With no sideways scroll on the phone's day, a horizontal swipe
   anywhere on the grid changes the day again. Item 19's call 17 (scroll first, then
   change the day) no longer applies on the phone. A swipe that starts on the chip is
   still a swipe; a tap on it opens the sheet.
10. **Keyboard.** The chip is reached by Tab in the grid's order and opened by Enter.
    The sheet traps focus while open; its rows and Close are reached by Tab.

## What does not change

- **The PC's day view** (from `lg`): every lane, nothing hidden, and the sideways
  scroll past the view's width under the sticky gutter (item 19's rule 12). At
  1440 px it fits sixteen lanes, so it does not scroll in practice.
- **The PC's and the phone's week views**, the month views, and the week chip's link to
  the day.
- How entries are grouped, which ones fold, and how blocks grow (item 19's
  `layoutDay` and `growShared`, unchanged in behaviour).
- Creating on the phone's day (tap, handles, the create bar). A tap on the chip is not
  a tap on empty time.
- No back-end change.

## The reference each part follows

| Part | Follows | Departs from |
| --- | --- | --- |
| The day to the screen's width | Kimai, Google and Samsung, whose day view keeps one screen width (gate finding; study, Views) | Item 19's rule 12 on the phone (the sideways grid), taken back for the phone only |
| The fold and the "+n" | Samsung's "+3" where short events crowd (study, Views); this app's week chip (item 19) | — |
| The chip opening a sheet | Google's phone, which edits in a bottom sheet (study, Phone against desktop); the phone's sheets for More, the form, the start list and the row menu (items 12, 14, 15a) | The week chip's link to the day (in the day view that leads nowhere) |
| The sheet's rows | The phone month's day list (item 13; study, For time-keep 5, Samsung's month with the day's list) | — |

## Goals

- At 390 px, in light and dark, the phone's day view with the second run's crowded day
  never scrolls sideways. Lone blocks run full width, the day's total shows, and the
  crowded run shows as many blocks as fit plus a "+n" chip.
- Every folded entry is reachable from the chip in two taps (the chip, then its row),
  and from the keyboard.

## Non-goals

- Any change to the PC's day view, to either week view or to the month views.
- Changing the lane floor, the grouping or which entries fold.
- Opening the sheet from the week's chip.
- Widening lanes into free room (queued under item 19; not taken here).

## Anti-goals

- Anything on the phone's day view wider than the screen: the grid, a block or the
  day's head.
- A folded entry that cannot be reached, or a sheet that lists entries the chip did not
  fold.
- A chip that opens a create block, or a tap on it that also changes the day.
- A name cut through a line, or a block narrower than the floor.

## Constraints

- Tests first (TDD). The layout's pure parts (which entries a chip folds) get unit
  tests in `src/lib/calendar/grid.test.ts`. An e2e at 390 px seeds a crowded day and
  asserts three things: the grid's `scrollWidth` equals its `clientWidth`, a chip shows
  with the right count, and the sheet lists exactly the folded entries, each opening its
  form. A test at 1440 px asserts the PC's day is unchanged (every lane drawn, no chip).
- `layoutDay` gives each chip the ids of the entries it folds, so the sheet lists
  exactly those. Its existing behaviour for the week does not change.
- Works without JavaScript (item 8 above).
- `docs/app.md` (Calendar: the day views' fit, the chip, the sheet, the swipe) and
  DESIGN.md (the day view's crowding, the chip on the phone's day, the sheet) are
  updated with the build.
- The interface work goes through impeccable as the runbook requires. Build to
  DESIGN.md's existing patterns (chip, sheet, day-list rows), then critique and audit
  the phone's day view and the sheet at 390 px in both themes. No new direction work.

## Gate tasks

On a seeded month (`TZ=Europe/Budapest npx tsx scripts/seed-month.ts <db> <user>
<password>`), signed in as the seeded user. First make the second run's crowded day on
today. From the phone's strip, start timers in quick succession, within a few
minutes: two on CompX › ClientY – ProjectZ, three on Myself › time-keep and one on
CompX › CompY – Support. Starting on a project stops its running timer, which leaves
short overlapping entries. Then stop every timer, so today holds a run of seven or more
short overlapping entries around now. Also log shape (a) 09:00–10:30 on CompX ›
ClientY – ProjectZ and a lone 07:00–07:30 entry on a project that overlaps nothing.
Then, at 390 px in light and in dark:

1. **The day fits.** Open the Calendar's day view on today. Nothing scrolls sideways:
   a swipe right on the grid shows yesterday, and a swipe left comes back to today. The
   07:00–07:30 block runs the full width. The 09:00–10:30 block shares its column only
   with what it overlaps, with its name readable. The day's total shows in the head.
2. **The crowded run.** At the run, as many blocks as fit are drawn, their names
   starting with a whole word, and a "+n" chip counts the rest. The blocks drawn plus
   n equal the run's entries.
3. **The chip.** Tap the chip. A sheet lists the n folded entries, each with its times,
   customer › project in full and its duration. Close it with the scrim tap, then open
   it again.
4. **Correct a folded entry.** From the sheet, tap one entry and change its
   description in the form. Save. The day view shows again, and Undo in the strip
   restores the description.
5. **Delete from the fold.** Open the chip's sheet, open an entry, Delete it. The chip
   now counts one fewer, or the entry it freed is drawn. Undo brings it back.
6. **Keyboard.** With a keyboard at 390 px, Tab to the chip and press Enter. The sheet
   opens with focus inside it. Escape closes it and focus returns to the chip.

At 1440 px in light (the PC is unchanged):

7. **The PC day.** The same day in the day view draws every entry of the run side by
   side, with no chip. The week view holding today still shows its "+n" chip, and
   that chip still opens the day.

## Builder's latitude

- How the phone's day is told apart from the PC's in `TimeGrid` (for example
  `create === 'tap'`, or a new prop), and whether the fit is measured by the same
  effect as `weekFit`.
- Whether the sheet lives in `MoreChip`, `TimeGrid` or a new component, and how the
  chip's link is turned into a button with JavaScript (for example `data-js` /
  `data-nojs`, as Copy-out does, or a click handler that prevents the link).
- The sheet's exact spacing on the 4 px grid, within DESIGN.md's `bottom-sheet` and
  `sheet-row`.

## Calls made in the operator's place

The stand-in's answers (`.autopilot/agents/21-standin-q1.md`):

1. **Tapping the chip opens a sheet with exactly the folded entries,** each row opening
   that entry's form in place (option A). The sideways grid (option C) is what the gate
   failed. Entries on the day (option B) leaves the calendar and buries the folded
   entries among the day's rows. Without JavaScript, Entries on that day is the
   fallback. Source: roadmap item 21; item 12's exit ("without leaving the current
   view"); study, Phone against desktop (Google's bottom sheet); the phone's other
   sheets; operator's voice (Kimai "weak on the phone", small things "fiddly").
   Confidence: inferred.
2. **The phone day fits as many lanes as its column holds at item 19's 68 px floor**
   (four at 390 px), not two wider lanes; the blocks drawn keep item 19's rules 6–8.
   Source: roadmap item 21 ("too crowded for item 19's lane floor … as the week view
   does"); roadmap item 19; study, Views 10. Confidence: grounded.

The builder's calls:

3. **The PC's day view keeps item 19's sideways scroll**, since item 21's exit says no
   other screen changes. At 1440 px it fits sixteen lanes. (Builder's call.)
4. **The fit falls back to four** before measuring and without JavaScript, which is
   what 390 px holds, as the week's falls back to two. (Builder's call.)
5. **The sheet closes when a row's form opens,** so one modal shows at a time and Back
   from the form returns to the day view. (Builder's call.)
6. **The sheet's title names the count and the run's first start** ("4 more entries
   from 18:04"), as the week chip's accessible name does. (Builder's call.)
7. **The swipe changes the day anywhere on the phone's grid again;** item 19's call 17
   and its queued question no longer apply on the phone. (Builder's call.)

From the builder check (`.autopilot/agents/21-builder-check.md`, nothing important
left):

8. **The fit is two lanes at least** on a narrower phone, as the week's is: one block
   and the chip. (Builder's call.)
9. **The chip keeps its place in the tab order**, after its column's blocks, as the
   week's does. (Builder's call.)

From the stand-in's review of revision 1 (`.autopilot/agents/21-standin-spec-r1.md`):

10. **The chip grows toward 44 px into free time,** as the phone day's blocks do,
    because it is the only way to the folded entries. Source: DESIGN.md (the phone
    day's 44 px growth; 44 px targets on the phone); roadmap item 11 (phone controls at
    least 44×44 px). Confidence: inferred.
11. **The swipe keeps its direction** (left moves forward, right moves back); gate
    task 1 was corrected to match. Source: docs/app.md (Calendar, the swipe); item 21's
    exit ("no other screen changes"). Confidence: grounded.

Approved by the operator stand-in, revision 2, 2026-10-22.
