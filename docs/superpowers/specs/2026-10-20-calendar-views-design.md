# Calendar views — design

Approved by the operator stand-in, revision 1, 2026-10-20.

Roadmap item 13. Written 2026-10-20 in an autopilot design session; the operator
stand-in answered in the operator's place (see the last section). The mockups it
judged are in [`2026-10-20-calendar-views/`](2026-10-20-calendar-views/), each in
light and dark (`<name>-light.png`, `<name>-dark.png`).

## Intent

The operator named Kimai's calendar, and Google's and Samsung's, as "quite important"
(2026-10-19): day, week and month views of their own time. Round 1 had none; an entry
could be read only as a row. This item builds a Calendar screen with the three views on
both surfaces, where the week is read at a glance, a past interval is logged by tapping
or dragging the time it covers, and a wrong entry is moved or stretched where it sits.

Every write is an existing core command (decision 4): a new entry goes through item
12's entry form, a move or resize is one `entries.update`. Nothing in the core, the MCP
server or the database changes.

## The screen

A screen of its own, `/calendar`, titled "Calendar" in the shell.

- **Navigation.** On the PC, Calendar sits in the sidebar right after Today. On the
  phone it joins the bottom bar between Today and Entries, which becomes five cells:
  Today, Calendar, Entries, Templates, More. Today stays as it is, and the phone still
  opens on Today.
- **The address holds the view and the date**: `/calendar?view=week&date=2026-10-14`.
  A reload or Back returns to the same place (reference study, Moving 5). Without
  `date`, today in the request's zone; without `view`, the week. The phone's bottom-bar
  link is `/calendar?view=day`, so the phone opens on today's day view and the PC on this
  week's; nothing is remembered between visits.
- **The toolbar**, above the view, on both surfaces: previous and next arrows, Today, the
  period's title ("12 – 18 October 2026" with "Week 42"; "Wednesday 14 October 2026";
  "October 2026") with a chevron, opening a date picker, the period's total ("Week
  27:45"; the day view also gives the week's), and Day / Week / Month as a segmented
  control. Today is always shown; on the current period it is still a working link. On
  the phone the toolbar is two rows: Day / Week / Month with Today, then the arrows
  around the title and total (`ph-day`).
- **The date picker** is a small month of days under the title, with its own previous
  and next month; choosing a day keeps the view and moves to the period holding that
  day (`pc-picker`). It works without JavaScript.
- **Moving by swipe** on the phone: a horizontal swipe across the grid or the month
  moves one period back or forward, in all three views (Moving 1). A vertical scroll is
  never read as a swipe.
- **Keys on the PC**, outside fields and while no dialog is open: `←`/`→` or `k`/`j`
  previous and next, `t` today, `d` `w` `m` the views (Moving 4). Item 12's `n` and `s`
  keep working.
- The Calendar draws its own undo strip, under the toolbar, as Today and Entries do.

## Day and week: the time grid

All 24 hours, as Kimai, Google and Samsung draw them (`pc-week`, `pc-week-past`,
`pc-day`, `ph-day`).

- **Columns.** The week is Monday to Sunday, seven columns; the day is one. Each column
  head shows the weekday, the date and **the day's total** at its right (Totals 1).
  Today's date sits in a filled circle in the text colour.
- **Rows.** An hour label every hour in the gutter, a hairline every hour and a dotted
  one at the half hour on the PC. Hours before 08:00 and from 20:00 are shaded (Kimai).
- **On open** the grid is scrolled to the working day: 07:00 at the top, earlier when an
  entry in view starts earlier, and always with now in view when the period holds now.
  The full day stays reachable by scrolling; nothing is cut off.
- **Blocks.** Each entry is a block placed and sized by its times, in its project's
  colour: the pale fill, a strong left edge and the dark ink on it (DESIGN.md's project
  palette; the Project Ink Rule). A block reads, as far as its height allows: the
  project name in bold, then start–end and the reference, then the description. Text
  ends on a whole line with an ellipsis, never through a line. A short block (under 45
  minutes) is one line: the project, then the start. The day view, with room, also
  shows the customer (`CompX › ClientY – ProjectZ`), the duration, the activity and the
  location. A block's full text is its accessible name and its tooltip.
- **The running timer** is a block from its start to now, growing as time passes, with
  a dashed blue foot and "now · Running 1:40" in blue where the end would be, on both
  surfaces (Timers 6). It is drawn even when its start is on an earlier day.
- **The line at now**: a 2 px line in the text colour across today's column with a dot
  at its left, and the time ("11:40") in a small text-colour tag in the gutter, as
  Samsung prints it (Views 2). Not red (red is for what is wrong) and not blue (blue is
  running and primary).
- **Overlaps show as overlaps**: entries whose times intersect sit side by side, each
  taking an equal share of the column, and each carries a red top edge, Kimai's overlap
  mark (Views 10). The mark follows the core's rule: two finished entries whose
  half-open intervals intersect. As a block narrows its text drops, the description
  first, then the times, keeping the project name with an ellipsis.
- **An entry crossing midnight** is drawn on every day it covers in the grid; the piece
  on the following day reads "from the previous day". It belongs to the day it started
  (vision): that day's total counts all of it, the next day's none of it.
- **A day's total** is the time of the entries that started that day, a running one up
  to now; the week's is the sum of its days. An entry's day is its start's date in the
  screen's zone (see Time zones). Totals are exact `h:mm`, never rounded: rounding to 5
  minutes is an output option (vision), so a week here can read a few minutes off
  Reports' rounded total.

## The phone's week

Seven narrow columns, drawn for 390 px (Phone against desktop 3; `ph-week`). Each
column head is the weekday's letter, the date (today in its circle) and the day's total
under it ("–" when none). Blocks are colour only, no letters. Hour labels are the bare
hour. A tap anywhere in a column, head or grid, opens that day's day view; the phone
does not create or move from the week.

**The "+" over the phone's grid.** The phone's fixed "+" stays on the day and week
views and the grid scrolls under it, as Google's does; the grid's foot leaves room so
the last hours scroll clear of it. A day block runs the full width, so more than 44 px
of it stays beside the "+" (item 12's rule for a covered control); a week column is
one tap target from head to foot, so it is reachable above the "+".

## Month

**PC** (`pc-month`): a grid of the weeks touching the month, Monday first, with the ISO
week number at the left and **the week's total** in a column at the right (Views 4).
Each cell: the date at the left (today in its circle), the day's total at the right,
then up to four entries, one line each: the project's dot, the start time and the
project name, ending in an ellipsis; then "+n more". Days outside the month are shaded.
An overlapping entry's line has a thin red outline; a running one's start is blue. A
click on an entry opens its form; on the date, "+n more" or the cell's empty space,
the day view of that day.

**Phone** (`ph-month`, Samsung's month with the day's list, Views 5): the month grid at
the top, each cell the date, the day's total and one dot per project worked that day;
under it the chosen day's entries as a list, headed by the date and the day's total,
each row as Today's rows: start over end, customer › project, activity and description,
the duration, the project's bar at its left, "Overlaps another entry" in red where it
applies. A tap on a cell chooses that day (the address keeps it); a tap on a row opens
its form; the list's head links to the day view. The list's foot leaves room so its last
row scrolls clear of the "+".

## Creating from the grid

A tap or drag on empty time opens item 12's entry form, in place, at that time, with
focus in customer › project (Creating 1, 2, 3).

- **PC, a click** on empty time: a new entry from the half hour clicked, rounded down,
  lasting one hour.
- **PC, a drag** down empty time: the range dragged, snapped to 5 minutes, shown as a
  blue-outlined block with its times as it grows (`pc-drag`, Thursday); releasing opens
  the form with that start and end. In the week, a drag stays in its day.
- **Phone, a tap** on empty time in the day view: a one-hour block from the half hour
  tapped, rounded down, appears outlined in blue with **a round handle at its top and
  bottom**, and a bar at the foot says its times with Cancel and New entry (`ph-create`;
  Google's handles). Dragging a handle stretches the start or the end in 15-minute
  steps, the bar following. New entry (or a tap on the block) opens the form with those
  times; Cancel, a tap elsewhere or a swipe drops it. Nothing is saved until the form
  is.
- **Month**: on the PC a click on a cell's empty space goes to that day's view (not
  the form); on the phone a tap chooses the day. A new entry for that day is the "+" or
  "+ New entry", which opens the form on the day in view.
- The form is opened as `/entries/new?date=…&start=…&end=…&back=<the calendar's
  address>`; the new-entry route gains `end`, read like the form's End. Saving returns to
  the calendar where it was, with the new block and the strip's Undo. Without
  JavaScript the "+ New entry" link carries the day in view.

## Moving and resizing (PC)

On the PC, with a mouse or pen (Editing 4; `pc-drag`).

- **Drag a block** to move it: the duration kept, the start snapped to 5 minutes, to
  another time or, in the week, to another day. While dragging, the block lifts (the
  popover-down shadow), a dashed outline in the project's colour marks where it was, and
  a text-colour tag over it says where it will land ("Fri 14:15–15:30").
- **Drag its top or bottom edge** to change the start or the end, snapped to 5 minutes;
  the other end stays. The edges show a small handle on hover and on a selected block
  (Kimai has none; Editing 4). An end is never moved before its start: at least 5
  minutes remain.
- **Releasing** saves at once as one `entries.update` with the entry's loaded version:
  the block lands, and the strip says "Done: Edit entry on "<project>"." with Undo.
  `Escape` while dragging puts it back and saves nothing. A press and release without
  movement is a click: it opens the form.
- **A refusal** (the entry changed or was deleted elsewhere, or any core refusal) puts
  the block back and shows the core's message in the strip as an alert; a stale version
  offers Reload.
- **The running block** is not dragged or stretched; a click opens its form, where the
  start can be changed.
- An entry's zones are kept: a move or resize sends instants, so the entry's start and
  end zones stay as they were.
- **An entry drawn in pieces** (crossing midnight, or longer than a day): dragging any
  piece moves the whole entry by the same amount; the top handle shows only on the
  piece that holds the real start and the bottom handle only on the piece that holds the
  real end.
- On the phone, moving and resizing go through the form (reference study's call 5).
- Keyboard and screen-reader users move an entry through its form; each block is a link
  to it, in time order.

## Without JavaScript

The screen is a server-rendered page: the toolbar's links, the date picker, the three
views, the blocks as links to the entry form's page, the month's cells as links. The
grid is not scrolled and shows from 00:00. Creating from the grid, dragging, swiping,
keys, the live running block and the now line need JavaScript; "+ New entry" and the
blocks' forms do the same work as pages.

## Time zones

The calendar places entries in the screen's zone, the request's zone as every screen
finds it (`screens/zone.ts`: the device's zone through the `tz` cookie). An entry's
day is its start's date in that zone. Entries made in another zone appear at the time
they happened here; their forms still show their own zones, as now. When the zone is
only the default (no cookie yet), the toolbar says so, as Today does.

## The reference each part follows

| Part | Follows | Departs from |
|------|---------|--------------|
| Three views, switched in place, on both surfaces | Kimai, Google, Samsung (Views 1) | — |
| Time grid, blocks sized by time, today marked | Google, Samsung, Toggl, Clockify (Views 2) | Google's red line at now and blue today: here the text colour (red and blue have meanings) |
| Block colour by project | Toggl, Clockify (Views 3) | Kimai's single grey |
| Day totals in the column head, week total in the toolbar | Kimai's week, Toggl (Totals 1, 2) | — |
| Month with chips, "+n more", day and week totals | Google's and Kimai's month (Views 4) | Kimai's month has no totals |
| Phone month with the day's list | Samsung (Views 5) | — |
| Phone week, colour only, tap opens the day | — | Kimai's seven letter-wrapped columns (Phone against desktop 3) |
| Overlaps side by side with a red top edge | Kimai's mark (Views 10) | Toggl's slivers |
| Running timer as a growing block | Toggl, Clockify (Timers 6) | — |
| Tap or drag on empty time opens the form | Google, Toggl, Clockify (Creating 1) | Kimai's long press on the phone |
| Handles on a new block on the phone | Google Android (Creating 2) | — |
| Drag to move and resize, 5-minute snap, visible handles | Google, Toggl, Clockify (Editing 4) | Kimai's drag with no handle; no drag on the phone |
| Swipe, arrows, Today, date picker, keys, the address | Samsung, Google, Kimai (Moving 1–5) | Kimai's calendar has no date picker and ignores a swipe |
| No all-day band, no agenda view | — | Google, Samsung (Views 2, 8) |

## Goals

- Read a week of entries at a glance on the PC and the phone: what, when, how long,
  which overlap, and each day's and the week's total.
- Log a past interval by tapping or dragging the time it covers, then picking the
  project in the form.
- Correct an entry's time where it sits: drag it on the PC, its form on both surfaces;
  every change one undo.
- Move between days, weeks and months by swipe, buttons, picker and keys, with the
  address keeping the place.
- See the running timer on the grid as it runs.

## Non-goals

- A filter on customer or project (item 14 builds the one filter control; the calendar
  takes it then).
- Dropping a template on the grid (optional in the study; "Fill from" in the form does
  it in one more click).
- Remembering the last view between visits (queued).
- An all-day band, an agenda or schedule view, a 3-day view, a year view.
- Restart from a block (the form has Restart; rows keep theirs).
- Any core, MCP or database change; any change to Today, Entries or the other screens
  beyond the navigation.

## Anti-goals

- Kimai's phone week: seven columns of letter-wrapped titles.
- A calendar that hides an overlap or shows one entry over another.
- Blocks whose text is cut through a line, or a "+" that covers an entry so it cannot
  be reached.
- Red or blue used for anything but what is wrong and what is running or primary.
- A drag on the phone that fights the scroll.

## Constraints

- SvelteKit, server-rendered; the views work without JavaScript as pages, the gestures
  with it (PRODUCT.md). Tailwind and shadcn-svelte (decision 2); item 11's tokens and
  shell (decision 9, DESIGN.md), item 12's entry form and its in-place opening.
- Every write is one core call through `openCore(getDb(), user.id, 'ui')`; no rule is
  enforced in the screen. The overlap mark is a display of the core's rule, computed for
  the view.
- WCAG 2.2 AA in both themes; 44 px targets on the phone; every block reachable and
  openable by keyboard; drag is never the only way to change anything.
- English, 24-hour clock, ISO weeks, Monday first; durations `h:mm`.
- The phone's bottom bar gains a fifth cell; the e2e tests that count or name its cells,
  and the touch-target sweep, take the Calendar screen in.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`: the 30 days before today, weekdays only,
nothing today; a midnight-crossing entry and an overlap are seeded, and this item adds
a second of each in last week: an overlap on its Wednesday and an entry from its
Tuesday 23:00 to Wednesday 01:00), signed in as the seeded user, at 390 px and 1440 px, in light and in dark. "Last week" is the Monday to
Sunday before the current one.

1. **Read a week (PC).** From the sidebar open Calendar: this week's week view, today
   circled, the line at now. Go back one week with ‹: read each day's total and the
   week's total in the toolbar, and find the day with the overlap (red top edges, side
   by side) and the entry drawn across Tuesday's midnight, counted in Tuesday's total.
   Hover a block: its full text shows.
2. **Create by dragging (PC).** In last week's Thursday, drag on empty time from 16:00
   to 17:30: the form opens with that date, 16:00 and 17:30, focus in customer ›
   project. Pick CompX › CompY – Support, reference `#4711`, save: the block is there,
   Thursday's and the week's totals grew by 1:30, the strip offers Undo.
3. **Correct by dragging (PC).** Drag that block to Friday 14:15: it lands at 14:15–15:45
   and the strip offers Undo. Drag its bottom edge to 16:00: 14:15–16:00. Undo once: back
   to 14:15–15:45. Press `Escape` in the middle of another drag: nothing changes.
4. **Correct through the form (PC).** Click a block from last week: its form opens over
   the calendar. Change the description, save: still on the same week. Undo.
5. **Month and back (PC).** Press `m`: this month, each day's total and each week's.
   Click a day of last week: its day view, every field of its blocks readable. Press
   `w`, then `t`: this week. Use the date picker to reach a day of last month.
6. **The running timer (PC).** Start a timer from the bar on Myself › time-keep: a
   block on today grows from its start, with "Running"; stop it from the bar: the block
   ends there.
7. **The phone's day.** At 390 px tap Calendar in the bottom bar: today's day view. Swipe
   right twice: two days back (the toolbar says so). Tap empty time at 18:00: a block
   18:00–19:00 with two handles; drag the bottom handle to 19:30; tap New entry: the
   form holds 18:00 and 19:30. Pick Myself › time-keep, save: the block is there, the
   day's total grew by 1:30, Undo shows.
8. **The phone corrects.** Tap a block from that day: its form opens as a sheet; change
   its end, save: the block is shorter.
9. **The phone's week and month.** Choose Week: seven columns with each day's total; tap
   a day: its day view. Choose Month: tap a day: its entries listed under the grid with
   the day's total; tap a row: its form. Nothing is hidden under the "+".
10. **Keys and look.** On the PC, `j`/`k` move a week, `d` `w` `m` switch the view.
    Both themes, both widths: blocks readable in the project colours, text ending on
    whole lines, one blue primary per form, red only on overlaps and refusals.

## Builder's latitude

The plan decides, within the above: the hour heights and exact measures (from
DESIGN.md's tokens and ramp), how the grid is scrolled and laid out (CSS grid, absolute
positions), the lane algorithm for overlaps, the drag mechanism (pointer events) and the
action the move posts to, the swipe's thresholds, the date picker's markup, the
component structure, and how the live block and the line at now are updated. The
screen's server logic is unit-tested; the gestures are covered by browser tests.

## Calls made in the operator's place

The stand-in's answers (`docs/questions.md` holds what it queued):

1. **A Calendar screen of its own,** in the sidebar after Today and in the phone's bottom
   bar between Today and Entries; Today stays, and the phone still opens on Today.
   Source: item 11's spec (design-direction, line 96, "Calendar joins the bottom bar …
   between Today and Entries"); reference study, Views (Kimai's calendar is its own
   page), Phone against desktop 1. Confidence: inferred.
2. **The views open on today: the day view on the phone, the week on the PC; the address
   keeps view and date within a visit; nothing is remembered between visits.** Source:
   reference study, call 6 and Phone against desktop (Kimai's day view "the readable
   one"), Moving 5; roadmap item 13's exit. Confidence: inferred for the views;
   ungrounded for remembering, queued.
3. **All 24 hours, scrolled on open to the working day,** with Kimai's 08:00–20:00
   shading; no fixed window. Source: reference study, Views (Kimai opens at 06:00, shades
   outside 08:00–20:00); vision ("An entry may cross midnight and last longer than 24
   hours"). Confidence: inferred.
4. **A tap on the phone makes a start and an end:** the half hour tapped, rounded down,
   for one hour, with round handles to stretch it before the form opens; focus in
   customer › project. Source: reference study, Creating 2 and 3; Google's and Samsung's
   hour (walk-through); vision ("An entry without an end is running"). Confidence:
   inferred.
5. **Drags on the PC snap to 5 minutes, and a block may move to another day in the
   week;** each drag is one undo. Source: reference study, Editing 4; Google and Clockify
   move across days; vision, rounding and undo. Confidence: inferred.
6. **The phone's week is seven narrow columns, colour only, a tap opening the day;** no
   3-day view. Source: reference study, Phone against desktop 3; vision, "Views".
   Confidence: grounded.
7. **No filter in this item;** item 14 builds it and the calendar shares it. Source:
   roadmap items 13 and 14; reference study, Filters 3. Confidence: inferred.
8. **No template drop on the grid in this item.** Source: reference study, Recents 5
   ("not required"); item 12's Fill from. Confidence: inferred.
9. **An entry crossing midnight is drawn on every day it covers and counts toward the day
   it started;** a month line shows on the start day only. Source: vision, "Views" ("on
   the time they cover") and "The entry" ("belongs to the day it started"); Reports and
   Copy-out unsplit by default. Confidence: grounded; the month line and totals
   inferred.
10. **What the mockups lacked, fixed in this design:** the phone week's day heads with
    their totals; "Running" on the PC's running block; a short block naming the project,
    not the description; text ending on whole lines; room under the "+"; the first hour
    label clear of the heads; ellipses on month lines; a chevron on the phone's title;
    readable overlapping blocks. Source: roadmap item 13; reference study, Totals 1,
    Timers 6, Views 10, Phone against desktop 3 and 7. Confidence: inferred.
11. **The line at now is the text colour,** not red or blue. Source: DESIGN.md (the Red
    Means Wrong Rule; blue is running and primary). Confidence: inferred.
12. **Today is a filled text-colour circle around the date,** not a tinted column or a
    blue circle. Source: reference study, Views 2 (Google's and Samsung's today mark);
    DESIGN.md's blue rule. Confidence: inferred.
13. **Overlaps side by side, each with a red top edge,** Kimai's mark. Source: reference
    study, Views 10; vision ("The app warns, never blocks"). Confidence: grounded.
14. **The PC month lists entries, one line each (dot, start, project), up to four and
    "+n more",** with day and week totals; the phone's cell has the total and dots.
    Source: reference study, Views 4 and Phone against desktop 8. Confidence: grounded.
14a. **The phone's "+" stays on the day and week views, the grid scrolling under it
    with room at its foot;** no clear lane, and not hidden. A block under it keeps more
    than 44 px beside it. Source: reference study, Phone against desktop 2 ("a fixed,
    thumb-reach add action on every phone view"); item 12's done note (the "+" always
    shown; the 44 px guard); DESIGN.md ("Text may pass under the '+'; a control may
    not"). Confidence: inferred.

The builder's:

15. **The address is `/calendar?view=&date=`; the sidebar links the week, the phone's
    bar links `view=day`.** That gives each surface its opening view without JavaScript
    or a stored setting.
16. **The span in view is named in the toolbar, not the header;** the header keeps the
    fixed "Calendar". It settles item 11's deferred raise (a view's header names the
    span) for this screen, beside the arrows that change it.
17. **A click on empty time on the PC makes the same one hour from the half hour as the
    phone's tap,** and opens the form directly; a drag gives any other range.
18. **The phone's handles step by 15 minutes,** not 5: at about 56 px an hour, 5 minutes
    is under 5 px of finger travel. The form takes any minute.
19. **A month cell's empty space goes to the day view, not the form;** a new entry for
    a day is the "+" or "+ New entry" on that day's view.
20. **The running block is not dragged or stretched;** its start is changed in its form.
    A running entry has no end to stretch, and moving it would move a live timer.
21. **A move or resize sends instants,** so an entry's zones are kept.
22. **Entries are placed in the screen's zone,** and an entry's day is its start's date
    there, so a week reads as the user lives it; each form keeps its entry's zones.
23. **Overlapping blocks share their column equally,** with text dropping as they narrow
    and the full text in the accessible name and tooltip; no fixed minimum width.
24. **No Restart on a block;** the form has it, and rows keep theirs.
25. **The phone does not create or move from the week view;** a tap opens the day, where
    it does.
26. **Without JavaScript the grid shows from 00:00 unscrolled,** and creating and moving
    go through "+ New entry" and the blocks' forms.
27. **The seed gains a second overlap and a second midnight crossing, in last week,**
    beside the existing ones, so the gate finds both a week back; last Thursday from
    16:00 stays empty for gate task 2. The seed is a dev tool, and an addition leaves
    what other gates rely on in place.
28. **Totals are exact,** not rounded: the vision rounds on output only, and Entries'
    totals are exact too.
29. **A piece of a midnight-crossing entry moves the whole entry;** its handles show
    only where its real start and end are drawn, so a resize never cuts part of it.

The approval's notes, the stand-in's, not blocking:

30. **With three or more overlapping entries each block must still show its project
    name;** call 23's equal shares are checked for that, against the study's "readable
    minimum width" (Views 10). Source: reference study, Views 10. Confidence: inferred.
31. **The mockups' leftover defects** (text cut through a line, the first hour label
    under the phone's toolbar, a duration under the "+") are call 10's to fix and the
    gate's to confirm gone. Source: this spec, call 10. Confidence: inferred.
