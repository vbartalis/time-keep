# Round 2 report

Round 2 (items 17, 10–16 and 18–20) rebuilt the app to make it usable: a new look,
one entry form and timer bar, calendar views, the timesheet table, and every other
screen redone. **The round stopped as failed**: the usability check's second run
(item 16, 2026-10-22) failed, first on a builder check before the gate, then, rerun
with the operator's approval once that was fixed, on one gate finding (below). This
report was written by that run. It points at the done notes in the
[roadmap](roadmap.md) rather than repeating them.

## Why the round stopped

The second run's first attempt failed before the usability gate was dispatched:
`npm run test:unit` had one failing test, `/entries/new > save > starts an untouched
Start at the moment of saving, stopping the old timer there`, whose fixed fake clock
had fallen behind real time. A defect in the test, not the app
([issue #9](https://github.com/vbartalis/time-keep/issues/9)); the operator fixed it
(75a1165) and approved one more run
([issue #10](https://github.com/vbartalis/time-keep/issues/10)).

On the rerun every builder check passed (`npm run check`, `npm run lint`,
`npm run test:unit` 1158 of 1158, `npm run test:e2e` 400 passed, 200 skipped as the
other surface's), and the gate ran the twelve tasks at 390 px and 1440 px in light
and dark, each on a freshly seeded month. Tasks 1–11 passed at all four settings, and
task 12 at 1440 px. It failed one finding:

- **Calendar's day view on the phone scrolls sideways with a crowded run.** After
  tasks 2, 3, 7 and 8, today holds seven short overlapping timer entries around 18:00
  (from task 3's same-minute starts). At 390 px the day view gives each a 68 px lane
  (item 19's floor), so the whole day's grid is 529 px wide: blocks far from the run
  are cut at the right edge ("Myself › time-k"), a block overlapping nothing is drawn
  474 px wide, and the day's total in the grid header is off screen. The PC's day
  view of the same day fits, and the week view folds such a run into "+6". Kimai,
  Google and Samsung keep a day to one screen width; Samsung folds crowded events
  into "+3". Item 19 chose sideways scrolling for the day views; the gate judged it
  against the bar at phone width.

The gate's other observations, not failing: PC tables cut a long project name
("CompZ – Audit 20…", the title on hover); the New user dialog clears its password
after a refused username; an edited Start keeps End, as the first run saw.

What follows is the operator's. The roadmap runs item 16 twice; a further run, or an
item for the finding, is their call.

## What round 2 built

- [17][17], autopilot dry run: Today's "At the desk" placeholder panel removed, on
  phone and PC.
- [10][10], reference study: [the study](reference-study.md) of Kimai, the calendar
  apps and three trackers, with verdicts; the vision gained a Views section.
- [11][11], design direction: Kimai's structure in Kimai's skin (decision 9), its
  tokens, light and dark, and the shell with a timer bar on every screen.
- [12][12], the entry and the timer: one entry form opened in place over every screen,
  forgiving time input, and a timer bar that starts, stops and restarts.
- [13][13], calendar views: a Calendar screen with day, week and month on both
  surfaces; drag to create, move and resize on the PC.
- [14][14], the timesheet table: Entries as a table grouped by day, one Filter control
  with kept presets, search, and bulk edit and delete once rows are ticked.
- [15a][15], Today, templates and Setup: redone, with the phone's bottom bar and More
  reaching every screen.
- [15b][15], History: redone as a ruled list with paging and a bulk undo bar.
- [15c][15], Copy-out and Reports: redone as output screens sharing Entries' filter;
  round 1's filter bar removed.
- [15d][15], Account, Users, Backup and sign-in: redone; a sweep found no round 1
  layout left.
- [18][18], starting a timer on a project that has one running: the running one
  stops, whatever the minute; only a typed Start in an earlier minute is refused.
- [19][19], overlaps in the Calendar's week view: only blocks drawn into each other
  share a column, at a readable width, with a "+n" chip where more than fit.
- [20][20], the phone's timer strip with several timers running: two rows, the
  project's name in full, wrapping rather than cut.
- [16][16], usability check: every task in the app run on phone and PC, in light and
  dark. The first run (2026-10-22) failed on three findings, which became items 18–20;
  the second run (2026-10-22) failed, on a builder check and then on the gate, as above.
  The first run's screenshots and verdict, which items 18–20 cite under
  `.autopilot/screenshots/16/`, are kept in `.autopilot/screenshots/16-run-1/` and
  `.autopilot/verdicts/16-run-1.json`; the rerun's are under `16`.

## Calls made in the operator's place

### The stand-in's ungrounded calls, queued

Each is an entry in [questions](questions.md), with what would change.

- 10: Kimai's public demo, default setup, stands for the operator's Kimai.
- 10: the study decides the weekly hours grid, reject or defer by default.
- 10: what was relied on in Kimai is only what the record names.
- 10: templates replace recents; the timer bar has no recents list.
- 10: no description autocomplete beside templates.
- 10: a past interval logged through a short form still counts as fast capture.
- 10: the phone's "fix today" is left as it is; past days are reached through views.
- 11: a project's colour is worked out from the project, nothing stored.
- 11: the skin is Kimai's (neutral grounds), not option A's green ledger skin.
- 11: light and dark follow the device only; no in-app choice.
- 11: nothing beyond the recorded quotes makes a look feel wrong.
- 12: the working day is only the recorded split (phone capture, PC month-end).
- 12: a bare number in a duration is minutes (`90` is 1:30), as in Kimai.
- 12: the `input` stroke stays below 3:1 (also issue #1).
- 12: both blue fills in the PC header stay.
- 13: the calendar always opens on today (day on the phone, week on the PC).
- 14: bulk edit does not move times.
- 14: the table screen stays "Entries".
- 15: templates stay one thing called Templates.
- 15: templates are made from an entry and on their own screen, not in Setup.
- 15: Setup is laid out for the PC first, not a daily path.
- 15a: Today is one column on the PC, and the PC opens on it.
- 15a: templates are offered by name.
- 15a: Setup stays one screen with three lists.
- 15a: in Archived, an active customer is a heading, not a row.
- 15b: History is one list, no filter or search.
- 15b: a change does not open the record it touched.
- 15b: a changed field reads as one line, "Field: old → new".
- 15b: the old value is plain muted text, not struck through.
- 15b: paging is in the toolbar and at the foot.
- 15c: Copy-out and Reports share one kept range, apart from Entries'.
- 15c: ticked columns and options are kept per device; the column order is fixed.
- 15c: Reports shows all four totals at once.
- 15c: a total leads nowhere.
- 15c: numbers only, no bars or chart.
- 15c: four separate lists, not nested ones.
- 15c: durations only, no shares.
- 15c: a weekday with no time is left out of Reports.
- 15c: with no matching rows, Copy and Download CSV are both off.
- 15d: Account is opened rarely, mostly on the PC.
- 15d: Users and Backup are opened rarely, on the PC.
- 15d: Account stays one page of two sections, not tabs.
- 15d: Account, Users and Backup are about 48 rem wide on the PC.
- 18: an untouched Start means the moment Save is pressed.
- 18: a typed Start earlier than the running timer's is refused, not taken as a stop.
- 19: lanes in a group stay equal, not widened into free room.
- 19: the day view hides nothing and scrolls sideways past the readable floor.
- 19: on the phone's day, the swipe scrolls the grid first, then changes the day.
- 20: the phone strip has two rows, one layout for any number of timers, and long
  names wrap.

### The inferred calls most likely to be overruled

- 11: the direction is option A, Kimai's structure, over options B and C. Inferred.
- 10: the weekly hours grid is rejected; item 14 did not build it. Inferred (the
  study's).
- 10: a bare number in a duration read as hours. Inferred (the study's); item 12
  turned it to minutes, queued above.
- 10, 12, 14: no confirm before a delete, and no trash; Undo after instead. Inferred.
- 10: drag to move and resize is the PC's only; the phone moves entries through the
  form. Inferred.
- 10: Restart copies every field, the description included. Inferred.
- 12: a form saved with no end and no duration starts a running timer. Inferred.
- 12: the PC form is a centred dialog, the phone's a sheet. Inferred.
- 13: drags snap to 5 minutes; the phone's handles step 15. Inferred.
- 14: fixed columns per surface, no column chooser. Inferred.
- 14: only a range preset is kept between visits; a custom range lasts the visit.
  Inferred.
- 14: the bulk edit sets project, activity, location, reference and description text,
  as round 1. Inferred.
- 15: Today is part of item 15, rebuilt with the other screens. Inferred.
- 15a: the phone's bottom bar is Today, Calendar, Entries, More; Templates moves into
  More. Inferred.
- 15c: the phone gets a reduced Copy-out (no sheet shown). Inferred.
- 18: a reopened form shows the current minute; Cancel discards what was typed.
  Inferred.
- 19: the PC week always draws at least two lanes, a lane's first word possibly ending
  in "…" below two floors' width. Inferred.
- 19: running blocks are drawn first, then the longest; the shortest go into the
  "+n" chip. Inferred.

### The builder's calls

Counted roughly from each done note in the [roadmap](roadmap.md), where they are
listed:

- [17][17]: 6.
- [10][10]: 14 (8 in the study's section 9, 6 in the spec).
- [11][11]: about 24.
- [12][12]: about 30.
- [13][13]: about 25.
- [14][14]: about 30.
- [15a, 15b, 15c, 15d][15]: about 13, 17, 17 and 20.
- [18][18]: about 10.
- [19][19]: about 20.
- [20][20]: about 6.
- [16][16]: 4 in the first run; 4 more in the second (calls 19, 21 and 22 of its
  spec, and writing the report before the gate, rewritten on the fail).

### Item 16's second run

Its spec, `docs/superpowers/specs/2026-10-22-usability-check-2-design.md`, carries the
first run's calls 1–13 over and adds calls 14–22. The stand-in's, with sources in the
spec:

- Tasks 3 and 12 also do what items 18–20's exits name; nothing else added. Inferred.
- The first run's two observations (End appended to after a click; an edited Start
  keeping End) are named as already seen, findings only if they hit a rule. Inferred.
- Items 18–20's deferred minors fail only when they hit a rule. Grounded.
- This report gives items 18–20 one line each and item 16 one line on both runs.
  Inferred.
- Otherwise the first run's spec stands; a failing second run spawns no items.
  Grounded.
- A failing second run leaves item 16 not done and the round stopped. Inferred.

## Open questions

Titles only; the entries, with the call made and what would change, are in
[questions](questions.md).

- 10: which Kimai setup was used; Kimai's weekly hours grid; what in Kimai was relied
  on; recents in the timer bar; description autocomplete; fast capture for past
  entries; the phone's "fix today".
- 11: where a project's colour comes from; the skin; light and dark; what makes a look
  feel wrong.
- 12: the working day; a bare number in a duration; the `input` stroke contrast; two
  blue fills in the PC header.
- 13: whether the calendar remembers the last view.
- 14: whether bulk edit moves times; the table screen's name.
- 15: Templates or Favourites; where templates are made; what is done in Setup, where
  and how often.
- 15a: Archived and an active customer; one Setup screen or one per kind; the order of
  templates; what the PC opens on.
- 15b: a filter on History; a change opening its record; how a changed field reads;
  the old value's look; where paging goes.
- 15c: a shared kept range; kept columns and options; all four totals at once; a total
  leading to its entries; bars or a chart; four lists or nested; shares; empty
  weekdays; the actions with no matching rows.
- 15d: when Account is opened; when Users and Backup are opened; Account as one page or
  tabs; the width on the PC.
- 18: an untouched Start; an earlier typed Start.
- 19: lanes widening into free room; the day view's sideways scroll; the phone day's
  swipe.
- 20: the phone strip's layout.

Go-live (item 9) is the operator's, and waits for them and for round 2 to pass.

[17]: roadmap.md#17-autopilot-dry-run--todays-placeholder-panel--done-2026-10-19
[10]: roadmap.md#10-reference-study--done-2026-10-20
[11]: roadmap.md#11-design-direction-round-2--done-2026-10-20
[12]: roadmap.md#12-the-entry-and-the-timer--done-2026-10-20
[13]: roadmap.md#13-calendar-views--done-2026-10-20
[14]: roadmap.md#14-the-timesheet-table--done-2026-10-20
[15]: roadmap.md#15-the-rest-of-the-screens--done-2026-10-22
[18]: roadmap.md#18-starting-a-timer-on-a-project-that-has-one-running--done-2026-10-22
[19]: roadmap.md#19-overlaps-in-the-calendars-week-view--done-2026-10-22
[20]: roadmap.md#20-the-phones-timer-strip-with-several-timers-running--done-2026-10-22
[16]: roadmap.md#16-usability-check
