# Reference study

Approved by the operator stand-in, revision 2, 2026-10-20.

How Kimai, two phone calendars and three dedicated time trackers handle what time-keep
does, and what time-keep takes from each. Roadmap item 10; written 2026-10-20 from
research done 2026-10-19 and 2026-10-20. The design is
[the item's spec](superpowers/specs/2026-10-19-reference-study-design.md).

## Purpose and how to use it

Round 1's screens were designed without studying how Kimai, or any good time or
calendar app, is used. This study is the reference that round 2's specs cite: each
screen names the behaviour it follows or departs from, and why (roadmap, "In round 2,
also").

Its first readers are the builders of items 11–15; the operator reads it too. A spec
cites it by section heading and verdict number, for example "reference study, Creating
an entry, 3". Section 3 holds the findings by subject; sections 4–7 answer the
questions the roadmap asks of the study; [section 8](#8-for-each-round-2-item) is the
quickest way in for an item's designer, and it shortens a subject to its first word
("Editing 4" is Editing, moving and deleting, verdict 4). Section 9 lists the calls
the study made in the operator's place.

Each subject ends with **For time-keep:**, a numbered list of verdicts:

- **Follow:** do it the same way.
- **Adapt:** take the idea, change the named parts.
- **Reject:** do not do it.

Every verdict carries its reason. Every finding carries its source: a screenshot in
[`reference-study/`](reference-study/), a URL, or "seen live" for what was seen in
Kimai's demo but not captured. A finding taken from public material, not seen in the
app itself, is marked **from docs**.

## 1. The references

| Reference | What it is | How it was looked at | Main URLs |
|-----------|------------|----------------------|-----------|
| **Kimai** 2.70.0 | Self-hosted web time tracker; the app time-keep replaces. | **Live**: the public demo, signed in as the published demo user `john_user`, in Playwright's Chromium at 1440×900 ("pc") and 390×844 with touch ("phone"), 2026-10-19. Read only: every non-GET request was blocked by the scripts and none fired; nothing was saved, started, deleted, dragged or resized. | https://demo.kimai.org, https://www.kimai.org/documentation/ |
| **Google Calendar** | Web app plus Android and iOS apps. | From docs: Google's help centre, Workspace Learning Center, product page and Play Store screenshots, read in Chromium 2026-10-19/20. It needs an account. | https://support.google.com/calendar, https://workspace.google.com/products/calendar/ |
| **Samsung Calendar** 12.7 | Native Android app on Galaxy phones; no web or desktop version. | From docs: Samsung's support pages, Galaxy Store and Play Store pages and screenshots, 2026-10-19/20. | https://www.samsung.com/levant/support/mobile-devices/how-to-add-and-manage-events-using-the-calendar-app-on-your-samsung-galaxy-phone/ |
| **Toggl Track** | Web, desktop and phone time tracker. | From docs: its help centre, blog and community, 2026-10-19. It needs an account. | https://support.toggl.com |
| **Clockify** | Web, desktop and phone time tracker. | From docs: its help centre, feature pages and a staff forum post, 2026-10-19. It needs an account. | https://clockify.me/help |
| **Timing** | Native macOS tracker built on automatic app-usage capture, with a phone web app. | From docs: its help pages and product page, 2026-10-19. | https://timingapp.com/help |

Notes on the sources:

- **Kimai's demo is shared.** Other visitors changed `john_user`'s data and preferences
  during the session: entries appeared, and the format moved from US (`11/1/2026`,
  `6:40 PM`) to 24-hour `DD/MM/YYYY`. The screenshots are in the 24-hour state; some
  figures below quote the earlier US form.
- **Kimai's setup.** The demo runs the **default tracking mode** (begin, end and
  duration all editable), and that mode stands for the operator's Kimai, in the
  browser (spec; queued in [questions](questions.md)). Where another mode changes a
  finding, it says so; the modes are compared under
  [Kimai's tracking modes](#kimais-tracking-modes). Third-party phone apps for Kimai
  were not studied.
- **The calendars and trackers were not used.** None offers a public demo or a
  no-account view. Their screenshots are captures of the vendors' own help, product or
  store pages (named `-docs`), so they may show an older or idealised UI.
  Third-party articles are cited only where the vendor's pages are silent, and named as
  third-party.

## 2. The screenshots

All taken by this study in Chromium; nothing was downloaded.

| Kimai, live | Calendars, from docs | Trackers, from docs |
|-------------|----------------------|---------------------|
| [timesheet, PC](reference-study/kimai-timesheet-pc.png) | [Google week, desktop](reference-study/google-calendar-week-docs.png) | [Toggl calendar](reference-study/toggl-calendar-docs.png) |
| [timesheet row menu, PC](reference-study/kimai-timesheet-rowmenu-pc.png) | [Google schedule, phone](reference-study/google-calendar-schedule-phone-docs.png) | [Toggl list](reference-study/toggl-list-docs.png) |
| [timesheet filter, PC](reference-study/kimai-timesheet-filter-pc.png) | [Google create, phone](reference-study/google-calendar-create-phone-docs.png) | [Toggl timesheet](reference-study/toggl-timesheet-docs.png) |
| [timesheet, phone](reference-study/kimai-timesheet-phone.png) | [Google month, phone](reference-study/google-calendar-month-phone-docs.png) | [Clockify timer and list](reference-study/clockify-timer-list-docs.png) |
| [calendar month, PC](reference-study/kimai-calendar-month-pc.png) | [Samsung month, phone](reference-study/samsung-calendar-month-phone-docs.png) | [Clockify calendar](reference-study/clockify-calendar-docs.png) |
| [calendar week, PC](reference-study/kimai-calendar-week-pc.png) | [Samsung quick add](reference-study/samsung-calendar-quick-add-docs.png) | [Clockify timesheet](reference-study/clockify-timesheet-docs.png) |
| [calendar month, phone](reference-study/kimai-calendar-month-phone.png) | [Samsung views menu](reference-study/samsung-calendar-views-menu-docs.png) | [Timing timeline](reference-study/timing-activities-timeline-docs.png) |
| [calendar week, phone](reference-study/kimai-calendar-week-phone.png) | [Samsung week](reference-study/samsung-calendar-week-docs.png) | [Timing start timer](reference-study/timing-start-timer-docs.png) |
| [calendar day, phone](reference-study/kimai-calendar-day-phone.png) | | [Timing web app, phone](reference-study/timing-web-app-phone-docs.png) |
| [create form, PC](reference-study/kimai-create-pc.png) | | |
| [create form pickers, PC](reference-study/kimai-create-picker-pc.png) | | |
| [create form, phone](reference-study/kimai-create-phone.png) | | |
| [weekly hours, PC](reference-study/kimai-weekly-pc.png) | | |
| [weekly hours, phone](reference-study/kimai-weekly-phone.png) | | |
| [dashboard, PC](reference-study/kimai-dashboard-pc.png) | | |
| [navigation, phone](reference-study/kimai-nav-phone.png) | | |

## 3. Findings by subject

### Views

**Kimai** (live).

- **My times**, the timesheet table: a flat list, newest first, 50 rows a page
  ("Show entries 1 to 50 from 895", 18 pages). Columns at 1440 px: tick box, date,
  begin, end, duration, customer, project, activity, "…" row menu; description, tags,
  billable and exported are hidden by default. Columns drop out by width: begin and end
  below 576 px, customer below 768 px, project and activity below 1200 px. Every column
  but tags sorts. Customer, project and activity carry a colour dot. Overlapping
  entries get a red top border. A click anywhere on a row opens the edit form.
  [timesheet, PC](reference-study/kimai-timesheet-pc.png)
- **No grouping by day and no totals** in the table by default. A user preference,
  "Show daily stats in timesheet", groups rows per day with day statistics (from docs:
  https://www.kimai.org/documentation/user-preferences.html). Off in the demo.
- "Customize display" chooses the table's columns, with a separate set for desktop and
  mobile (seen live).
- **Calendar**, month, week and day, with a "today" button and ‹ › arrows.
  - **Month:** weeks numbered, Monday first; each entry a grey dot, its start time and
    its activity, truncated; at most 4 a day, then "+more"; today pale yellow; **no day
    or week totals**; a hover tooltip shows the times, customer, project, activity and
    description. [month, PC](reference-study/kimai-calendar-month-pc.png)
  - **Week:** a time grid in 30-minute rows labelled hourly, opening at 06:00; **each
    day's total under its header** ("Mon 19/10 8:51"); an all-day row for holidays and
    absences; every block the same grey whatever its project, showing "14:46 - 15:46"
    and the activity; short entries collapse to one truncated line; a red line at now;
    hours outside 08:00–20:00 shaded; today's column pale yellow.
    [week, PC](reference-study/kimai-calendar-week-pc.png)
  - **Day:** the same grid, one column, the day total in the header.
    [day, phone](reference-study/kimai-calendar-day-phone.png)
  - On the PC a right-hand column (about 280 px) holds "Restart one of your last
    activities" (5 recent project and activity pairs) and the Tasks plugin's list.
- **Weekly hours**: a grid of project and activity rows against Monday–Sunday, each
  cell a duration; covered under [Kimai's weekly hours grid](#4-kimais-weekly-hours-grid).
- **Dashboard**: a bar chart of the week's days and four totals: today, this week, this
  month, this year. [dashboard, PC](reference-study/kimai-dashboard-pc.png)

**Google Calendar** (from docs).

- Web: Day, Week, Month, Year, Schedule (agenda) and a custom view of a set number of
  days; the chosen view stays the default
  (https://support.google.com/calendar/answer/6110849). Android: Schedule, Day, 3 Day,
  Week, Month, opening on Schedule. Mobile web: Day and Month only
  (https://support.google.com/calendar/answer/65923).
- Day and week: timed events as blocks on an hour grid, all-day events in a band above
  it; a red line with a dot at now; today's date in a filled circle.
  [Google week](reference-study/google-calendar-week-docs.png)
- Month: events as small coloured chips with truncated titles, multi-day events as
  bars, "More" when a day overflows.
  [Google month, phone](reference-study/google-calendar-month-phone-docs.png)
- Schedule: days stacked down the page, a date badge on the left, each event a
  full-width coloured card with title, time and place, and a line marking now between
  cards. [Google schedule, phone](reference-study/google-calendar-schedule-phone-docs.png)
- How overlapping timed events are laid out is not stated in any page read.

**Samsung Calendar** (from docs).

- Year, Month, Week, Day and a Reminder list, picked from a drawer; no agenda or list
  view. [views menu](reference-study/samsung-calendar-views-menu-docs.png)
- **Month with the day's list:** the month grid in the top half, the selected day's
  events listed below it, each with its start time and a coloured bar; swiping up
  enlarges the day. [Samsung month](reference-study/samsung-calendar-month-phone-docs.png)
- Week: seven columns, a week number, an all-day row, an hour grid with titled blocks,
  a red line at now **with the time printed in the hour gutter**, and a "+3" chip where
  short events crowd. [Samsung week](reference-study/samsung-calendar-week-docs.png)

**Toggl Track** (from docs).

- The Timer page holds three views of the same entries, switched by a segmented
  control: **Calendar** (day, 5-day, week), **List** and **Timesheet**
  (https://support.toggl.com/en-us/article/the-timer-page-x46p31/).
- **List:** entries under a day header with the **day's total** at the right; each row
  shows description, coloured project, start–end and duration; a tick box on the day
  header selects that day. "Group similar time entries" folds identical entries into
  one row. [Toggl list](reference-study/toggl-list-docs.png)
- **Calendar:** blocks in project colour on an hour grid; the day's total in each
  column header; a line at now; zoom buttons; only the last 90 days are shown.
  Overlapping blocks become unreadable slivers.
  [Toggl calendar](reference-study/toggl-calendar-docs.png)
- **Timesheet:** a weekly hours grid with row and column totals and "Copy last week".
  [Toggl timesheet](reference-study/toggl-timesheet-docs.png)

**Clockify** (from docs).

- **Time Tracker:** the timer bar on top, then entries grouped by week and day
  ("Today", "Yesterday") with a total per day and per week; each row description,
  project, tags, start–end, duration, a play button and a menu.
  [Clockify timer and list](reference-study/clockify-timer-list-docs.png)
- **Calendar:** a week grid zoomable from one hour to 5 minutes; each day's total
  under its date; a blue line at now; external calendar events shown beside tracked
  ones, view only. [Clockify calendar](reference-study/clockify-calendar-docs.png)
- **Timesheet:** project rows by day, with totals, enabled per workspace.
  [Clockify timesheet](reference-study/clockify-timesheet-docs.png)

**Timing** (from docs).

- One day's timeline beside a list of the day's app usage; weeks only as reports.
  [Timing timeline](reference-study/timing-activities-timeline-docs.png)

**For time-keep:**

1. **Follow:** day, week and month calendar views and a table view over the same
   entries, switched in place. Every reference with a calendar has the three; the two
   web trackers put calendar, list and timesheet side by side as views of one set of
   entries; the operator named the calendar views and the table as "quite important"
   ([operator's voice](operator-voice.md), 2026-10-19).
2. **Follow** the time grid of Google, Samsung, Toggl and Clockify for day and week:
   blocks placed and sized by their times, a line at now, today marked in the header.
   **Reject** their all-day band: time-keep has no all-day entries.
3. **Adapt** Kimai's week view: keep each day's total under its header; **reject**
   its single grey for every block. Blocks take a colour from the customer (or
   project), as in Toggl and Clockify and as Google's help suggests ("make all events
   related to a project the same color"). Kimai's grey makes a week unreadable at a
   glance. Which field carries the colour is item 11's and 13's call.
4. **Adapt** the month view of Google and Kimai: entries as chips (start time and
   customer or project), a "+n" overflow; **add** each day's total in the cell and a
   week total per row, which Kimai's month lacks and item 13 asks for.
5. **Follow** Samsung's month-with-the-day's-list on the phone: the grid above, the
   chosen day's entries listed below. On a 390 px screen a month grid alone shows only
   truncated chips ([Kimai month, phone](reference-study/kimai-calendar-month-phone.png));
   the list below makes the month usable for reading and correcting a day.
6. **Adapt** the table from Kimai, with Toggl's and Clockify's day grouping: newest
   first, grouped by day with each day's total in the group header, always on (Kimai
   hides this behind a preference). Kimai's flat, paginated list of 895 rows is what
   the operator worked with; the grouped list is what the trackers converged on.
7. **Follow** Kimai's per-surface columns, with different choices: on the phone Kimai
   keeps only date and duration ([timesheet, phone](reference-study/kimai-timesheet-phone.png)),
   so no row says what it was. **Reject** that: a phone row keeps start–end, duration,
   customer › project and activity, on two lines if it must.
8. **Reject** an agenda (schedule) view as a separate view. The day-grouped table is
   the list; a third list-shaped view would duplicate it. Google's Schedule is a phone
   calendar's answer to having no table.
9. **Reject** the dashboard as a screen of its own. Its totals belong in the views
   they total (see [Totals](#totals)) and in Reports.
10. **Follow** Kimai's overlap mark: an overlapping entry is marked in the table and
    shown as an overlap on the grid, side by side, never hidden (vision: "the app
    warns, never blocks"; item 13: "overlaps show as overlaps"). **Reject** Toggl's
    slivers: overlapping blocks keep a readable minimum width.

### Creating an entry

**Kimai** (live). [create form, PC](reference-study/kimai-create-pc.png)

- **Where from:** "+ Create" in My times; the green ▶ `0:00` in the top bar, which
  opens the **same** form; a click on empty time in the week or day view (a 30-minute
  slot, seen live: 10:00–10:30); a click-drag on the grid for a range (from docs:
  https://www.kimai.org/documentation/calendar.html); a row's "Create copy"; dragging a
  recent project and activity from the calendar's side box onto the grid (from docs);
  the weekly hours grid.
- **The form**, a modal about 720 px wide with labels on the left, 7 rows and 9
  inputs, 3 required:
  1. From: a date (with a month picker) and a time;
  2. Duration and End, linked: typing either fills the other (9:00 + 5:30 → 14:30);
  3. Customer (optional), 4. Project, 5. Activity: searchable selects;
  6. Description; 7. Tags. Save and Close.
- **Defaults:** today, begin **now**, duration and end empty. **Focus starts in
  Duration**, not the begin time, and the begin comes last in the tab order. Saving
  with no end and no duration starts a timer (from docs).
- **Time input is forgiving** (seen live): `9`, `900`, `9:00`, `09.00`, `9am` → 9:00;
  `1330` → 13:30; durations `5:30`, `5.5`, `5,5`, `5h30`, `90m`; end `1030` → 10:30.
  Two traps: `17.5` in a time field becomes 17:05, and `330` in duration is read as
  minutes. Each time field also has a ▾ grid of quarter hours; duration a ▾ of presets
  0:15–10:00.
- **The pickers** ([pickers, PC](reference-study/kimai-create-picker-pc.png)): projects
  grouped under customer headings, filtered by project **or** customer name, but a
  query mixing both ("pagac vitae") finds nothing. **Picking a project leaves Customer
  blank**; picking a customer first clears project and activity and narrows the
  projects. The activity list puts the project's own activities first, then the global
  ones. A new tag can be created by typing it. Archived customers are not offered.
- **Phone** ([create form, phone](reference-study/kimai-create-phone.png)): the same
  modal, full width, labels above fields; it is 955 px tall in an 844 px screen, so
  **Description, Tags and Save sit below the fold**.

**Google Calendar** (from docs).

- Web: click empty time for a small dialog (title, details, Save), or **drag down the
  grid** to set a longer range; "More options" opens the full editor; the Create button
  and the `c` key open the full editor directly
  (https://support.google.com/calendar/answer/72143).
- **Quick create in words:** "Dinner at 7pm" in the title creates it at that time.
- Android: tap empty time in day, 3-day or week view, a block appears with **round
  handles at top and bottom** to drag its length, and a bottom sheet holds title and
  time; swipe it up for the rest; Save.
  [Google create, phone](reference-study/google-calendar-create-phone-docs.png)
- The editor's fields: title (focused first), date and times, repeat, guests, place,
  alerts, description. **No duration field anywhere**: an event is a start and an end.
  The default length is a setting (one hour for non-Google accounts; 30 minutes in the
  screenshot).

**Samsung Calendar** (from docs).

- A full-width **"Add event on <date>" bar** at the foot of month, week and day views,
  and a round "+" beside it, both using the selected date.
  [Samsung month](reference-study/samsung-calendar-month-phone-docs.png)
- Typing "3pm Movie" proposes 15:00–16:00 **and earlier events with matching titles**
  to pick. [quick add](reference-study/samsung-calendar-quick-add-docs.png)
- The full form: title, start and end, all day, place (previous places suggested),
  calendar, colour, alerts, repeat, notes. No duration field. Tapping empty time on the
  grid is not documented.

**Toggl Track** (from docs).

- A **timer bar** across the top of the web app: "What are you working on?", project,
  tags, billable, a duration and a play button; a toggle (or `M`) turns it into a
  **manual** bar with start, end and duration in the same strip; Enter saves
  (https://support.toggl.com/creating-a-time-entry).
- Typing **`@` in the description picks a project, `#` a tag**, on web and phone.
- Click empty time on the calendar, or drag a range, for a popup with every field;
  on Android, long-press for a 30-minute slot or press and drag.
- Picking an earlier entry from the description's suggestions copies it.
- Durations typed as `2h`, `5:30`; a lone number is minutes.

**Clockify** (from docs).

- The same timer bar, with a manual mode: description, project, tags, start and end
  **or** a duration, a date icon, ADD
  (https://clockify.me/help/track-time-and-expenses/adding-time-manually).
- The most fully documented time input of all: `0345` → 03:45, `9.45` → 9:45, `1pm`
  and `13` → 13:00, `130` → 1:30; durations `2h`, `2:00`, `1.5`, `1h30m`, `:30`. A
  duration alone starts the entry now, or at the previous entry's end when adding
  several in a row.
- The project picker matches project and client names; starred projects first.
- **Description autocomplete:** after two letters, up to 8 earlier entries matching
  description, project, client or tag; an empty field lists the 8 latest
  (https://forum.clockify.me/t/time-tracker-description-missing-most-frequent-entry/1926,
  a Clockify staff post).
- Click or drag on the calendar to draw an entry.

**Timing** (from docs).

- Drag a range on the day's timeline, or "New Time Entry"; the editor has project,
  title (autocomplete of past titles with their project), notes, start and stop with
  −5m / +5m buttons and **"prev"**, which starts the entry where the previous one ended
  (https://timingapp.com/help/time-entries).
  [Timing start timer](reference-study/timing-start-timer-docs.png)

**For time-keep:**

1. **Follow** Google, Toggl and Clockify: **a tap or drag on empty time opens the
   entry form at that time** (item 13). It is the fastest way, in every reference, to
   log a past interval, and round 1 had no way at all to add an entry for an arbitrary
   time. On the phone, a tap (Google), not Kimai's 1.5-second long press, which reads
   as "nothing happens".
2. **Follow** Google's round handles on a new block on the phone, to stretch the range
   before the form opens, and the drag on the PC.
3. **Adapt** Kimai's linked Duration and End: both shown, typing either fills the
   other, as the vision's "start + end or start + duration" requires. **Reject**
   Kimai's focus in Duration with the begin last in the tab order: the order is
   date, start, end or duration, then customer › project, activity, location,
   reference, description, with focus on the first field the user has not been given
   (the start, unless a tap on the grid set it; then customer › project).
4. **Follow** Kimai's and Clockify's forgiving time input, documented on screen:
   `9`, `900`, `9:00`, `9.00`, `9am`, `1330`; durations `5:30`, `5.5`, `5h30`, `90m`.
   **Reject** their two traps: `17.5` in a time field is not 17:05, and a bare
   three-digit duration like `330` is read as 3:30, not as minutes (Kimai, Toggl and
   Clockify all read a lone number as minutes; for the operator's "for 5½ hours" an
   hours reading is the safe one). Item 12's spec settles the full table.
5. **Adapt** Kimai's project picker: one field for **customer › project, matched on
   either name and on both together** ("compx clienty"), the project list grouped by
   customer. **Reject** Kimai's blank customer after picking a project: picking a
   project sets its customer. **Reject** a separate customer field that clears the
   project. The operator's support work is three companies deep, carried as
   `CompX` › `ClientY – ProjectZ` (vision); the picker must find it from any part.
6. **Follow** Kimai's activity list with the project's own first (here: the user's
   activities ranked by use on that project), and **adapt** it for location, which no
   reference has as a field (see the
   [walk-through](#5-the-operators-entries-walked-through)): a picked list, as the
   vision has it, never a tag.
7. **Reject** Toggl's `@`/`#` typed shortcuts: they turn a ticket number like `#4711`
   into a tag (Toggl's own docs warn of it), and time-keep has a reference field.
8. **Adapt** the timer bar of Toggl and Clockify as the always-present entry point on
   the PC (item 11's shell, item 12's timer bar): a description, customer › project
   and play, and a manual mode reached from it.
9. **Reject** Kimai's form height on the phone: Save is always on screen (a sheet with
   a fixed Save, as Google's bottom sheet and Samsung's Save above the keyboard do).
10. **Adapt** Timing's "prev" and Clockify's "start at the previous end" for a day's
    entries logged one after another: the start can be set to the previous entry's
    end in one action.
11. **Reject** Google's and Samsung's natural-language quick add ("9am CompX …") for
    now: it parses a time and a title, and time-keep's entry is structured fields. A
    template plus a tap on the grid gives the same speed with no parser to guess.

### Editing, moving and deleting

**Kimai** (live).

- A row click, a row menu's Edit and a click on a calendar block open **the same
  form, prefilled**, with Save and Close only: no delete, copy or history in it.
- Row menu ([row menu, PC](reference-study/kimai-timesheet-rowmenu-pc.png)): Start
  again, Edit, Create copy, Record expense, Delete in red with a confirm question.
  Start again and Create copy show on only 18 of the 50 rows on the first page, with
  no reason on screen.
- A right-click on a calendar block: Edit, Record expense, Delete.
- **Bulk:** a tick box per row and a select-all; ticking rows puts Edit and Delete in
  the table's **footer**, out of sight below the rows.
- Move and resize: blocks can be dragged (the duration kept) and stretched by the
  bottom edge (from docs; the blocks carry draggable and resizable classes, seen live;
  nothing was dragged). There is no visible handle or hint.
- **No undo and no history** anywhere in the interface; an audit-log plugin views
  changes but does not revert them (from docs:
  https://www.kimai.org/documentation/plugin-audit-trail.html).

**Google Calendar** (from docs).

- Click an event, then Edit; `e` opens it. Drag to move, to another time or day, on
  the web and in Android's day, 3-day and week views (snapping to 15 minutes, a
  third-party report), with an **Undo** toast after a drag; `z` undoes
  (https://support.google.com/calendar/answer/37034). Resize by the round handles on
  Android.
- Delete by key on the web, or event › More › Delete › Delete on Android; deleted
  events stay in a **trash for 30 days**.

**Samsung Calendar** (from docs).

- Touch and hold an event to edit or delete it; since late 2024, hold and drag to
  another date. Resizing is not documented. A recycle bin keeps deletions 30 days; no
  undo is documented.

**Toggl Track** (from docs).

- **Inline edit in the list**: click any field of a row to change it in place.
- Row menu: Duplicate, Split, Delete, Pin as favourite.
- Bulk edit from the day header's tick box, in an overlay; bulk delete one day at a
  time.
- Calendar: drag to move, drag the top or bottom edge to change start or end, snapping
  to 5 or 10 minutes by zoom.
- A brief **undo** after a delete (5 seconds on the phone); none for edits.

**Clockify** (from docs).

- Click an entry to edit; changes save as they are made. Row menu: Split, Duplicate,
  Delete, Add as favourite. Bulk edit from an icon by the day's total. After a delete,
  **undo for 20 seconds** on the web, 4–5 on the phone. Calendar: drag to move, also to
  another day; drag edges to resize.

**For time-keep:**

1. **Follow** Kimai: one form for create and edit, opened by a row click or a block
   tap, prefilled (item 12).
2. **Adapt** Kimai's row menu: Restart, Copy, Edit, Delete (item 14), on **every**
   row; **reject** Kimai's actions that vanish from some rows with no reason. A row
   that cannot take an action shows it disabled with the reason.
3. **Adapt** the edit form: unlike Kimai's, it can delete and copy from inside, since on
   the phone the form is where the user already is.
4. **Follow** Google, Toggl and Clockify: on the PC, **drag a block to move it** (the
   duration kept) and **drag its top or bottom edge to resize**, snapping to 5 minutes
   (Toggl's step; the vision's output rounding is 5 minutes). Kimai has the same with
   no visible handle; time-keep shows the handles on hover and on a selected block.
   On the phone, moving is through the form (Samsung and Google drag on the phone only
   after a long press, and a drag in a scrolling grid is easily mistaken; item 13 asks
   for drag on the PC).
5. **Adapt** Kimai's and Toggl's bulk selection: tick boxes per row and per day group,
   with the bulk actions appearing **at the top, in view**, only once something is
   ticked (item 14). **Reject** Kimai's footer, out of sight.
6. **Adapt** the undo toast of Google, Toggl and Clockify after **every** save, move,
   stop and delete, not only deletes, and lasting until the next action rather than 5
   or 20 seconds: time-keep's history makes every change one undo (vision, "History and
   undo"; item 12). **Reject** confirm dialogs before a delete: undo replaces them.
   **Reject** a trash or recycle bin: history already keeps the deleted entry.
7. **Reject** Toggl's inline edit of every cell in the table, for now: it makes a
   change easy to make by accident, and the form opened in place costs one click. Item
   14 may revisit it for single fields with undo behind it.

### Timers

**Kimai** (live, and from docs).

- The top bar's ▶ `0:00` is on every page; it opens the create form with begin now,
  and saving with no end starts the timer. While a timer runs it becomes a red ⏹ with
  the elapsed time; one click stops it; `s` as an access key stops it from any page
  (from markup and docs: https://www.kimai.org/documentation/timesheet.html). None ran
  in the demo.
- **Several at once** is a setting, default 1; at 1 a new timer stops the running one;
  above 1 the top-bar clock becomes a list (from docs:
  https://www.kimai.org/documentation/configurations.html).
- Restart: the top bar's ↻ lists recent activities and restarts one now in one click;
  a row's "Start again" also copies the description and tags.
- "Records: Active" in the table's filter finds running entries.

**Google and Samsung Calendar:** no timers.

**Toggl Track** (from docs).

- Play and Stop in the timer bar, `N` and `S` by key; **one timer at a time**, a new
  one stops the old. Continue: a play icon on a list row, `C` for the last entry, Play
  in a calendar block's popup; it starts a new entry with the same details.
- Phone: a lock-screen live activity on iOS, a notification and widgets on Android.

**Clockify** (from docs).

- The same: Start and Stop, `N`, `S`, `C`; one timer per workspace; play on a row
  starts a copy; clicking the running time corrects its start. On the phone the running
  timer is pinned at the bottom.

**Timing** (from docs).

- A start dialog with an **estimated duration**, after which a notification asks "Done
  with …?"; a quick-start list of recent timers; new timers can start "15 minutes
  earlier".

**For time-keep:**

1. **Follow** Kimai, Toggl and Clockify: the running timers are **always on screen**,
   in a bar, with their elapsed time, and stop in one tap or click (item 12). Round 1
   put timers only on Today.
2. **Reject** one timer at a time (Toggl, Clockify, Kimai's default). The vision lets
   several run, and starting on a project stops only that project's timer. **Adapt**
   Kimai's above-one display: the bar shows one running timer in full and a count that
   opens the rest.
3. **Follow** Toggl's and Clockify's restart from a past entry: a play action on a
   table row and on a calendar block starts a new entry now with the same customer,
   project, activity, location and reference, and **follow** Kimai's "Start again" in
   copying the description too. Toggl, Clockify and Kimai all copy it; the user
   rewrites it if this time differs.
4. **Adapt** Clockify's correction of a running timer's start: tapping the running
   time opens the entry form for it.
5. **Follow** Kimai's and Toggl's keys on the PC: `n` new entry, `s` stop, documented
   in the interface. Item 12 settles the full set.
6. **Follow** the running timer drawn live on the calendar (item 13), as a block that
   grows with the time.
7. **Adapt** Timing's "started earlier": starting a timer can set its start a few
   minutes back, through the form's start field.
8. **Reject** idle detection, Pomodoro, estimated durations and lock-screen widgets:
   outside the vision, and the web app cannot reach a lock screen.

### Recents, favourites and templates

**Kimai** (live).

- The top bar's ↻ lists the last activities (project and activity) to restart now;
  each has a hidden star that marks it a favourite. The calendar's side box offers the
  last 5 pairs to drag onto the grid.
- "Favorites" in the preferences are menu bookmarks, not entries.
- **No templates** of any kind.

**Google Calendar** (from docs): no recents or templates; Duplicate on an event opens a
prefilled copy; repeat rules.

**Samsung Calendar** (from docs): **the title field suggests earlier events with
matching titles** and the place field earlier places.
[quick add](reference-study/samsung-calendar-quick-add-docs.png)

**Toggl Track** (from docs).

- **Favourites:** up to 10, in the sidebar; one click starts one; in manual mode a
  favourite fills the details and only the times are typed. A favourite keeps
  description, project, tags, never times (https://support.toggl.com/en-us/article/favorites-lmebfy/).
- The description's suggestions copy an earlier entry. The phone shows three to four
  frequent entries as suggestions.

**Clockify** (from docs).

- Favourite entries, at most 5, as tabs under the timer bar; keys 1–5; a favourite
  keeps all of the original's data. Description autocomplete over the last 250 entries.
  Weekly timesheet templates.

**Timing** (from docs): recents only, a quick-start list and title autocomplete.

**For time-keep:**

Weighed against the discovery call: user-saved templates, which may be partial,
replace "recent" and "repeat last entry" ([operator's voice](operator-voice.md),
"Data and entries").

1. **Adapt** Toggl's and Clockify's favourites **as time-keep's templates**: a saved,
   possibly partial entry, started or logged in one tap from the timer bar and the
   entry form, filling what it holds and leaving the rest for typing. Unlike Toggl's, a
   template may hold a start and a duration (vision, "Templates"). Item 15 puts
   templates inside favourites; this study reads them as one thing.
2. **Reject** an automatic recents list as a separate source in the timer bar (Kimai's
   ↻, Timing's quick start): the discovery call replaces it with templates. This
   departs from roadmap item 12's wording, where the timer bar starts "from recents,
   favourites and templates"; the operator's own words are followed over the
   roadmap's, and the conflict is queued in [questions](questions.md).
3. **Follow** the one recents behaviour both sources keep: **restart of a past
   entry** from the views (items 12 and 14), as under [Timers](#timers) 3.
4. **Reject**, for now, description autocomplete that copies an earlier entry's fields
   (Toggl, Clockify, Samsung, Timing): it is the references' main fast path, but the
   discovery call chose templates over recents. Queued in [questions](questions.md);
   item 12 builds it only if the operator says so.
5. **Adapt** Kimai's drag from a side list onto the grid, for templates on the PC
   calendar: dropping a template on a time creates an entry there with the template's
   fields (item 13 may take it; it is not required).

### Moving between dates

**Kimai** (live).

- Calendar: ‹ ›, "today" (greyed while on the current period), the view switch; **no
  date picker**; the URL keeps the date and view.
- **A swipe across the phone's day grid did nothing** (seen live).
- My times: no day navigation; a time-range preset or a range picker in the filter,
  then pages.
- Weekly hours: ‹ › and a list of the last 9 weeks.

**Google Calendar** (from docs).

- Web: ‹ ›, Today, and a small month calendar in the side drawer to pick a date; keys
  `j`/`k` (or `n`/`p`) next and previous, `t` today, `g` go to a typed date, `d` `w`
  `m` for the views. Android: tap the month name for a swipeable month strip, a
  "jump to today" icon showing today's date number.

**Samsung Calendar** (from docs).

- **A horizontal swipe moves to the next or previous day, week, month or year**; a
  today icon with today's date number; tap the title to jump to a month or year.

**Toggl and Clockify** (from docs): a date-range picker with ‹ ›; `T` jumps to today in
Toggl.

**For time-keep:**

1. **Follow** Samsung: on the phone, **a horizontal swipe moves by one period** in day,
   week and month (item 13). Kimai's grid ignores the swipe.
2. **Follow** Google and Kimai: ‹ › and a **Today** button on both surfaces. **Adapt**
   Kimai's greyed Today: keep it, but show it as the current period rather than a
   disabled control, as Google's and Samsung's today icon with the date number does.
3. **Follow** Google and Samsung: **a date picker** from the period's title (tap the
   title, pick a day). Kimai's calendar has none, so reaching last month's 3rd is
   arrows only.
4. **Follow** Google's keys on the PC: `j`/`k` or arrows for next and previous, `t`
   today, `d` `w` `m` for the views.
5. **Follow** Kimai: the URL keeps the date and the view, so a reload or the back
   button returns to the same place.
6. **Follow** Kimai's time-range presets in the table, relative ones (today,
   yesterday, this week, last week, this month, last month) **kept between visits**
   (item 14).

### Totals

| Reference | Where totals show | Source |
|-----------|-------------------|--------|
| Kimai | Week and day: each day's total under its header. Month: none. Table: none by default (a preference adds day stats). Weekly hours: row, day and week totals. Dashboard: today, week, month, year. | live; [week, PC](reference-study/kimai-calendar-week-pc.png), [dashboard](reference-study/kimai-dashboard-pc.png) |
| Google | None; Time Insights counts only meetings with other guests, on work accounts. | from docs, https://support.google.com/calendar/answer/10738043 |
| Samsung | None. | from docs |
| Toggl | Day total in the list's day header and the calendar's column header; today and this week in a sidebar; timesheet row and column totals. | from docs, [Toggl list](reference-study/toggl-list-docs.png) |
| Clockify | Day and week totals in the list; day totals in the calendar header; timesheet totals. | from docs, [Clockify timer and list](reference-study/clockify-timer-list-docs.png) |
| Timing | Durations beside each project in the sidebar and list. | from docs |

**For time-keep:**

1. **Follow** Toggl, Clockify and Kimai's week view: **the day's total where the day
   is headed**, in every view: the calendar's column header, the month cell, the
   table's day group (items 13, 14).
2. **Adapt** Toggl's sidebar totals: the current **week's total** in the view's header
   (calendar and table), and the period's total for a filtered table.
3. **Reject** Kimai's dashboard of four totals as a screen; Reports keeps totals per
   customer and project (vision, "Output").
4. **Follow** Kimai's `h:mm` for durations on screen; **reject** Toggl's `h:mm:ss`, as
   seconds are noise for logged work.

### Filters and search

**Kimai** (live). [filter, PC](reference-study/kimai-timesheet-filter-pc.png)

- A funnel opens a panel: time range (presets and a range picker), customer, project,
  activity, tags, running or stopped, billable, exported, page size, order; nothing
  applies until "Search" is pressed. A separate search box beside it.
- Archived customers fade in the table.

**Google Calendar** (from docs): live search as you type (`/`), with an advanced filter:
calendars, what, who, where, doesn't have, dates; at most 200 results. The grid itself
is filtered by showing or hiding calendars.

**Samsung Calendar** (from docs): search with recent searches as chips, by colour or
sticker; calendars shown by tick boxes.

**Toggl and Clockify** (from docs): no search on the timer page; filters live in
Reports (client, project, tag, description).

**For time-keep:**

1. **Adapt** Kimai's panel, **folded into one control** (item 14): a single filter
   button showing how many filters are on, with time range, customer › project,
   activity and location; Kimai's billable, exported and page size have no
   counterpart in time-keep. Filters apply as they change, not on a Search button.
2. **Follow** Google's live search: **one search box across customer, project,
   activity, location, reference and description** (item 14), results as you type.
   Kimai has no reference to search, and Toggl's and Clockify's search lives only in
   reports.
3. **Adapt** Google's show-or-hide calendars for the calendar views: a filter on
   customer (or project) narrows the grid, with the same control as the table.

### Phone against desktop

**Kimai** (live).

- At 390 px the sidebar becomes a dark top bar: ☰, the page title, ▶, ↻, avatar; ☰
  pushes a full-width menu down over the page. [navigation, phone](reference-study/kimai-nav-phone.png)
- **My times** keeps only date and duration; "+ Create" moves into a "…" menu.
  [timesheet, phone](reference-study/kimai-timesheet-phone.png)
- **Calendar:** the side box is gone; the month cells cut entries to "4:40 I…"; the
  week's seven 45 px columns run their headers together and wrap block titles letter
  by letter; **the day view is the readable one**. A tap on empty time does nothing; a
  long press opens Create. No swipe.
  [month](reference-study/kimai-calendar-month-phone.png),
  [week](reference-study/kimai-calendar-week-phone.png),
  [day](reference-study/kimai-calendar-day-phone.png)
- **Weekly hours** is 921 px wide in a 372 px card: one day visible, the rest behind a
  sideways scroll. [weekly, phone](reference-study/kimai-weekly-phone.png)
- **Create:** Save below the fold. A floating "?" help button covers content on every
  page. Kimai's mobile story is the responsive web app added to the home screen (from
  docs: https://www.kimai.org/documentation/homescreen.html).

**Google Calendar** (from docs).

- The Android app keeps Schedule, Day, 3 Day, Week and Month; it **leaves out** the
  year and custom views, Time Insights, density and colour settings, keyboard
  shortcuts and the advanced search; it opens on the Schedule list. Creating and
  editing happen in a bottom sheet that swipes up into the full form; a "+" button
  bottom right. Mobile web keeps only Day and Month.

**Samsung Calendar** (from docs): phone only; a drawer for views and calendars, the
title in the middle, search and today at the top right, the "Add event on …" bar and
"+" at the bottom of every view.

**Toggl Track** (from docs): bottom navigation Timer, Calendar, Reports; the phone
calendar shows **one day**; the timesheet is not on the phone; swipes on a row delete,
favourite or continue.

**Clockify** (from docs): a side menu; the timesheet tucked in it; press and hold to
create on the calendar; swipes to continue or delete.

**Timing** (from docs): the phone gets a web app with recent timers, start and stop, a
new-entry form; no timeline or entry list.

**For time-keep:**

1. **Follow** Google and Toggl: **the phone opens on today**, with creation one tap
   away (a fixed "+" and the timer bar) (vision, "Phone: quick capture").
2. **Follow** Samsung's bottom "add" bar and Google's "+": a fixed, thumb-reach add
   action on every phone view. **Reject** Kimai's Create hidden in a "…" menu.
3. **Adapt** the phone's views: day and month (with the day's list) are the phone's
   main calendar views, as Google's mobile web and Samsung lead with; the week view
   on the phone is kept (the vision's Views section puts all three on both surfaces)
   but drawn for 390 px: shorter labels, blocks as colour without letter-wrapped text,
   a tap opening the day. **Reject** Kimai's seven-column week at phone width as it
   is.
4. **Follow** Google and Toggl: the phone **reaches past entries** in the calendar and
   the table (round 1's phone could not).
5. **Adapt** Toggl's bottom navigation, over Kimai's ☰ that pushes the page down: the
   main views one tap away at the bottom; the rest behind one "more" (item 11's
   shell).
6. **Reject** Kimai's weekly hours on the phone, and any table wider than the screen:
   a phone table row wraps onto two lines (Views 7).
7. **Reject** a floating help button over the content.
8. **Follow** Google: on the PC the same views with more in them (keyboard keys, drag
   to move, bulk edit); on the phone the same entries, fewer controls.

### Look and layout

Observations only; item 11 chooses the direction from rendered options.

- **Kimai** (live): the Tabler (Bootstrap 5) admin theme. A 240 px dark sidebar
  (#262626) with a blue bar on the active item; a 56 px header; body 14 px, grey text on
  #fafafa; table headers 12 px uppercase; one primary blue (#066fd1); cards with thin
  borders; 46 px table rows, 16 rows at 1440×900; colour dots per customer, project and
  activity; calendar blocks all one grey; today pale yellow; bright, dark and automatic
  skins.
  [timesheet, PC](reference-study/kimai-timesheet-pc.png)
- **Google Calendar** (from docs): solid saturated block colours with white text,
  title then time; small blocks title only; today a filled circle; a red line at now;
  a sans-serif in small dense labels; density settings (responsive, comfortable,
  compact) on the computer; light and dark.
  [Google week](reference-study/google-calendar-week-docs.png)
- **Samsung Calendar** (from docs): white, thin rules, pastel fills with dark text, a
  thin coloured bar on list items, today a filled square, generous touch targets,
  sparse density; title size from extra small to extra large; dark mode.
  [Samsung week](reference-study/samsung-calendar-week-docs.png)
- **Toggl Track** (from docs): a dark left navigation, light content, the timer bar
  fixed at the top, one magenta accent; **project colour is the only strong colour** in
  rows and blocks; small type, dense rows.
  [Toggl calendar](reference-study/toggl-calendar-docs.png)
- **Clockify** (from docs): light, airy grey-blue chrome, one blue accent, project
  colour as text and as a left stripe on blocks, generous rows.
  [Clockify calendar](reference-study/clockify-calendar-docs.png)
- **Timing** (from docs): native macOS, translucent sidebar, many small coloured dots,
  right-aligned durations; its phone web app is plain Bootstrap.

**For time-keep:** options for item 11 to render, not verdicts. The spec keeps the
direction out of this study; the operator named Kimai's structure and the calendars as
the inspiration ([operator's voice](operator-voice.md), 2026-10-19), and item 11 chooses
from rendered options.

1. **Option A, Kimai's structure in a new skin:** a left sidebar with the views, the
   timer in the header, the table and calendar as Kimai lays them out, restyled. It is
   the layout the operator knows and compared round 1 against ("nothing like kimai").
2. **Option B, the calendars' and trackers' look:** a quiet light and dark chrome
   with one accent and entry colour as the only strong colour (Google, Toggl,
   Clockify, Samsung), the timer bar fixed across the top of the content on the PC
   (Toggl, Clockify).
3. **Option C, a mix:** Kimai's sidebar and views with the calendars' block colour,
   type and spacing.
4. **In every option**, from the findings above rather than taste: blocks coloured by
   customer or project, not one grey (Views 3); a dense PC density and a touch density
   for the phone, with no user setting (Google's density settings, adapted); light and
   dark themes (every reference has both).

### Kimai's tracking modes

From docs: https://www.kimai.org/documentation/configurations.html.

| Mode | What changes | Effect on the findings |
|------|--------------|------------------------|
| **Default** (the demo) | Date, begin, end and duration all editable. | All findings above. |
| **Duration** | Begin and end leave the form; only a duration is entered. Calendar drag and drop is turned off. | The create form loses its begin and end; the calendar's create and move findings do not hold. |
| **Time-clock** (punch) | Only start and stop; no calendar range or day click; no weekly hours. | Only the timer findings hold. |

The default mode matches time-keep's entry, always an interval. If the operator ran
another mode, the findings on the entry form and the calendar would be redone
(queued in [questions](questions.md)).

## 4. Kimai's weekly hours grid

**What it is** (live; [weekly hours, PC](reference-study/kimai-weekly-pc.png)):
project and activity rows, Monday–Sunday columns, a duration per cell (typed or picked
from 0:15–10:00), row totals, a total row and a week total, Save and "+ Add". Rows are
prefilled from recent pairs. Many cells are disabled with no reason given. ‹ › and a
list of the last 9 weeks; no future weeks.

**What a cell saves** (from docs: https://www.kimai.org/documentation/weekly-times.html):
**a duration only**; every record made that day gets the same begin from the "default
start-time" setting, and clearing a cell deletes the record. Toggl's timesheet does the
same: a new entry starting at 8 AM described "System Added Time Entry", or an existing
one stretched
(https://support.toggl.com/en-us/article/adding-time-entries-in-timesheet-view-5qe6a6/).
Clockify's cell needs a menu to add a start and an end
(https://clockify.me/help/track-time-and-expenses/timesheet-view).

**Against the entry model.** In time-keep an entry is always an interval, and
duration-only entries were rejected (vision, "The entry"; 2026-10-18 discovery). A grid
cell holds a number of hours: no start, no location, no reference, no description. Its
start is invented (Kimai's default start-time, Toggl's 8 AM), so the stored interval is
not the time worked. A grid that saved true intervals would need a start and an end per
cell, which is the entry form in a cell.

**Against the walk-through** ([section 5](#5-the-operators-entries-walked-through)): none
of the operator's four shapes fits a cell. The support entry needs its ticket and end
client, the development and client entries their place, and the start-plus-duration
entry its 9:00 start, which the grid replaces with a default. The grid suits someone who
logs the same project for whole days and does not care when; the operator logs
intervals at places, with references.

**Verdict: reject. Item 14 does not build the weekly hours grid.** Its useful parts are
kept elsewhere: the week's totals per day (Totals 1, 2) and per customer and project
(Reports), and filling a week from earlier work (templates; the MCP server's bulk
entry). The verdict is noted under the grid's question in [questions](questions.md);
the vision leaves the grid out.

## 5. The operator's entries, walked through

The four real shapes ([operator's voice](operator-voice.md), "Data and entries"):

- **(a) Support, three companies deep:** CompX › "ClientY – ProjectZ", activity
  support, the ticket and the end client as reference and description, a standard
  timeframe (yesterday 9:00–10:30).
- **(b) Development, two deep:** own project X, 13:00–17:30, at a café, development.
- **(c) Start plus duration:** CompX › Y, from 9:00 for 5½ hours, activity A.
- **(d) At the client:** CompX › "CompY – …", doing Z, 8:00–16:00, at the client.

An action is one click or tap, one typed value, or one Enter to pick. In Kimai the
counts were made on the opened forms, nothing saved; demo customers and projects stood
in for CompX and the rest. Elsewhere they are **estimated from docs**.

### Kimai (live, on the PC form from "+ Create")

| Shape | Steps | Actions | What gets in the way |
|-------|-------|---------|----------------------|
| (a) | Create (1); begin: click, type `9` (2); end: click, type `1030` (2), duration fills; project: click, type `ClientY`, Enter (3); activity: click, type `sup`, Enter (3); description: click, type ticket and end client (2); Save (1). For yesterday, +2 (date picker). | **14** (16 for yesterday) | The begin defaults to now and focus starts in Duration, so the begin is clicked and retyped. No reference field: the ticket goes into the description. Picking the project leaves Customer blank. "compx clienty" finds nothing. The three-deep chain lives only in the project's name. |
| (b) | As (a) with `13` / `1730`, project X, activity `dev`; the café as a tag: click, type, Enter (3); no description. | **15** | No location field; a "café" tag must be created, and tags are a flat free list. |
| (c) | Create (1); duration already focused: type `5.5` (1); begin: click, type `9` (2), end becomes 14:30; project (3); activity (3); Save (1). | **11** | The one shape Kimai's focus suits. `17.5` in a time field would be 17:05; `330` in duration is minutes. |
| (d) | As (b) with `8` / `16`, tag "at the client" (3). | **15** | As (b); as (a) for finding the project. |

Other paths in Kimai: on the PC week view a click on empty 09:00 gives 09:00–09:30,
then end, project, activity and Save, about **10** for (a); a drag over 09:00–10:30
(from docs), about **8**. Dragging a recent pair from the side box makes an entry with
project and activity only, to be edited after. On the phone the form needs 1–2 scrolls
to reach Save, and the calendar a long press.

### Google Calendar (estimated from docs)

Mapping: title = "Customer › Project · Activity"; description = ticket, end client,
what was done; location = the place; calendar (and its colour) = the customer, if the
user keeps one calendar per customer.

| Shape | Desktop web, week view | Android, day view | What gets in the way |
|-------|------------------------|-------------------|----------------------|
| (a) | Drag 9:00–10:30 on yesterday (1), title (1), More options (1), description (1), calendar (2), Save (1): about **7** | Back a day (1), tap 9:00 (1), drag the handle to 10:30 (1), title (1), swipe up (1), description (1), calendar (2), Save (1): about **9** | No customer, project, activity or reference fields: all typed text, retyped every time. |
| (b) | Drag (1), title (1), More options (1), location (1), description (1), Save (1): about **6** | about **7** | The place is free text. |
| (c) | No duration input: 14:30 is worked out and dragged to. About **5**. | about **6** | Start plus duration cannot be entered. |
| (d) | about **8** | about **9** | As (a). |

Cannot be expressed: customer, project and activity as picked fields; a reference;
start plus duration; totals per day, customer or project.

### Samsung Calendar (estimated from docs; phone only)

Mapping as Google's, with notes for the description and the calendar or the event
colour for the customer.

| Shape | Steps | What gets in the way |
|-------|-------|----------------------|
| (a) | Tap yesterday (1), "+" (1), title (1, or an earlier matching title), start (2), end (2), notes (1), calendar or colour (2), Save (1): about **11** | The bottom bar ("9am CompX …") gives 9:00–10:00 and needs a second edit for 10:30. No structured fields. |
| (b) | "+" (1), title (1), start (2), end (2), place (1, earlier places suggested), notes (1), Save (1): about **9** | The place is free text. |
| (c) | Bottom bar "9am CompX › Y" (1), Save (1), then open it and set the end to 14:30 (about 4), Save (1): about **7** | No duration input. |
| (d) | about **12** | As (a). |

Cannot be expressed: structured fields, start plus duration, any totals, any PC
surface for month-end work, undo.

### Toggl Track (estimated from docs; web, list view, manual mode)

Mapping: client › project directly; activity and place as tags; the ticket in the
description.

| Shape | Steps | What gets in the way |
|-------|-------|----------------------|
| (a) | `M` for manual; set the date to yesterday; description "ticket 1234 – end client"; `@ClientY` picks "ClientY – ProjectZ • CompX"; tag support; start 9:00, end 10:30; Enter. About **7**. From the calendar: drag 9:00–10:30 on yesterday, fill the popup, about **5**. | Typing `#1234` for the ticket opens the tag picker unless that shortcut is turned off. Manual mode starts on today. The activity is a free tag (or a task, on a paid plan). |
| (b) | `M`, `@X`, `#development`, `#café`, 13:00–17:30, save: about **6** | Activity and place are both tags: alike, and neither required. |
| (c) | `M`, `@Y`, start 9:00, duration `5:30`, save: about **5** | A lone number is minutes; whether a changed duration keeps the start is not documented. |
| (d) | `M`, description "Z", `@` the project under CompX, `#at the client`, 8:00–16:00, save: about **6** | As (b). A favourite could hold CompX, the project and the tags, never the times. |

### Clockify (estimated from docs; web, time tracker, manual mode)

| Shape | Steps | What gets in the way |
|-------|-------|----------------------|
| (a) | `M`, description, Project, search "ClientY" or "CompX", pick, tag support, start `9`, end `1030`, date icon, yesterday, ADD: about **9**. From the calendar, about **6**. | Project, tags and date are three separate pop-ups; manual mode is blocked while a timer runs; the date starts on today. |
| (b) | `M`, project X, tags development and café, `13` / `1730`, ADD: about **6** | Activity and place are both tags. |
| (c) | `M`, project Y, start `9`, end `1430`, ADD: about **5**; a duration alone would start now, so the start is fixed after. | Start plus duration is not one pair. |
| (d) | about **6** | A favourite could prefill it (at most 5, paid, only when nothing runs). |

### Timing (estimated from docs; macOS)

Mapping: CompX › "ClientY – ProjectZ" as a project and subproject; activity and place
in the title or notes.

| Shape | Steps | What gets in the way |
|-------|-------|----------------------|
| (a) | Back to yesterday, drag 9:00–10:30 on the timeline, Add Time Entry, project, title "support: ticket 1234 – end client", Save: about **5** | No client level, no tags, no activity or place fields. |
| (b) | Drag 13:00–17:30, project, title or notes "development, café", Save: about **4** | The place is free text. |
| (c) | New Time Entry, project, start 9:00, stop 14:30, Save: about **5** | Start plus duration only in the phone web app's form. |
| (d) | about **4** | The timeline's app usage is empty for a day away from the Mac. |

### What the walk-through shows

- **No reference has activity, location and reference as fields.** Each carries them as
  tags or free text, retyped or re-picked each time. time-keep's picked activity and
  location and its reference field are the right model; nothing here argues for
  changing it.
- **The fastest past entry is a drag on the grid** (Google about 7, Toggl about 5,
  Kimai about 8), against 11–15 through Kimai's form. Most of Kimai's cost is the form:
  retyping a begin that defaults to now, three pickers, no place for the reference.
- **Start plus duration exists only in the trackers** (Kimai, Toggl, Clockify, Timing's
  web form), and each has a trap (a lone number as minutes; a duration that moves the
  start). Neither calendar can express it.
- **What repeats is customer › project, activity and place**; the times and the ticket
  change. A template holding the first three and a drag on the grid for the times
  leaves only the ticket and the description to type: about 4–5 actions for (a), and
  2–3 for (b) and (d) once a template exists (the builder's estimate for time-keep,
  not a measurement). That is the vision's fast capture.
- **Three companies deep is only a naming problem** in every reference: the chain
  lives in a name. It works when the picker finds the project from any part of the
  chain (Clockify, Toggl's "Project • Client" chip); it fails in Kimai's.

## 6. The vision revisited

**Two surfaces** ("Phone: quick capture: start a timer, log an entry from a template,
fix today. PC: dense work: organising, bulk edits, month-end.")

- **Holds.** Every reference splits the same way: the phone apps lead with today and
  creation and leave out the dense views (Toggl's phone has no timesheet and a one-day
  calendar; Google's leaves out the year view, insights and shortcuts); the web apps
  carry the organising (bulk edit, timesheets, reports).
- **Questioned:** "fix today" is narrower than what the phone needs. The vision's Views
  section puts the calendar views and the table on both surfaces, item 16 tests
  "correcting yesterday", and round 1's phone could not reach past entries. Every phone
  reference reaches any date. Whether the phone's line should read "fix recent days" is
  queued in [questions](questions.md); the vision is not changed.

**Fast capture** ("A new entry is a template tap and a typed description, not a form.")

- **Holds** for a running timer and for an entry logged now from a template: the
  trackers' timer bars and favourites do exactly that.
- **Questioned** for a past interval: no reference logs one without a form. The
  nearest is a drag on the grid that opens a short form with the times set. With a
  template, that is a drag, a tap and a description, which keeps the principle's
  spirit, but it is a form. Item 12's form is required by the roadmap; the study reads
  the principle as "the form asks only for what the template left blank". Whether the
  operator reads it the same way, and whether description autocomplete (every
  tracker's fast path) is wanted beside templates, are queued in
  [questions](questions.md).

**Views.** The amendment adds the calendar views and the table, and nothing else. The
study suggests nothing more for the charter: the agenda view and the weekly grid are
rejected above.

## 7. Round 1's failures, answered

| Round 1 failure (roadmap, "Round 1") | Answered by |
|--------------------------------------|-------------|
| No way to add an entry for an arbitrary time | Creating an entry 1, 2 (tap or drag on empty time), 8 (the timer bar's manual mode); Phone against desktop 2 (a fixed add action). |
| No calendar or day-grouped list | Views 1–6 (day, week, month; the day-grouped table). |
| Timers live only on Today | Timers 1, 3, 6 (the bar on every screen; restart from rows and blocks; live on the grid). |
| The phone cannot reach past entries | Phone against desktop 4; Moving between dates 1–3 (swipe, Today, a date picker). |
| The punch-card look reads as dated and heavy | Look and layout 1–4: options for item 11 to render and choose from (Kimai's structure restyled, the calendars' and trackers' look, or a mix). |

## 8. For each round 2 item

**Item 11, design direction.**
Render: the three options in Look and layout 1–3 (Kimai's structure restyled, the
calendars' and trackers' look, a mix), each with what every option carries (Look and
layout 4: colour by customer or project, a PC and a touch density, light and dark).
Follow: Kimai's, Toggl's and Clockify's timer always on screen (Timers 1). Adapt:
Toggl's bottom navigation on the phone (Phone against desktop 5). Reject: a floating
help button (Phone against desktop 7); Kimai's ☰ that pushes the page down (Phone
against desktop 5). Screenshots to render options against:
[Kimai's timesheet](reference-study/kimai-timesheet-pc.png),
[Kimai's week](reference-study/kimai-calendar-week-pc.png),
[Toggl calendar](reference-study/toggl-calendar-docs.png),
[Google week](reference-study/google-calendar-week-docs.png),
[Samsung week](reference-study/samsung-calendar-week-docs.png).

**Item 12, the entry and the timer.**
Follow: one form for create and edit (Editing 1); forgiving time input (Creating 4);
the running timers always on screen with one-tap stop (Timers 1); restart from rows
and blocks (Timers 3); `n` and `s` keys (Timers 5). Adapt: linked duration and end with
a sane field order (Creating 3); one customer › project picker matched on either name
(Creating 5); activity and location as picked lists (Creating 6); Save always on screen
on the phone (Creating 9); start at the previous end (Creating 10); templates as
Toggl's favourites (Recents 1); undo after every change (Editing 6); several timers
shown as one plus a count (Timers 2); delete and copy inside the form (Editing 3).
Reject: one timer at a time (Timers 2); `@`/`#` shortcuts (Creating 7);
natural-language quick add (Creating 11); an automatic recents list (Recents 2);
description autocomplete unless the operator asks (Recents 4); confirm dialogs and a
trash (Editing 6); a bare three-digit duration as minutes (Creating 4).

**Item 13, calendar views.**
Follow: the time grid with blocks, a line at now and today marked (Views 2); a tap or
drag on empty time opens the form, with handles on the phone (Creating 1, 2); drag to
move and resize on the PC, snapping to 5 minutes, with visible handles (Editing 4);
the running timer live on the grid (Timers 6); a swipe by period on the phone, ‹ ›,
Today and a date picker, keys on the PC, the URL kept (Moving 1–5); the day's total in
its header (Totals 1). Adapt: Kimai's week with colour by customer or project (Views
3); month chips with day and week totals (Views 4); Samsung's month with the day's
list on the phone (Views 5); the week drawn for 390 px (Phone against desktop 3);
overlaps side by side at a readable width (Views 10); a week total in the header
(Totals 2); dropping a template on the grid, optional (Recents 5); the customer filter
shared with the table (Filters 3). Reject: Kimai's long press to create (Creating 1);
one grey for all blocks (Views 3); an all-day band (Views 2); an agenda view (Views 8);
moving by drag on the phone (Editing 4).

**Item 14, the timesheet table.**
Follow: per-surface columns (Views 7); a row click opening the form (Editing 1); the
overlap mark (Views 10); relative date presets kept between visits (Moving 6); one
live search over every text field (Filters 2). Adapt: Kimai's table grouped by day with
day totals, always on (Views 6); the row menu with restart, copy, edit and delete on
every row (Editing 2); bulk actions at the top once rows are ticked (Editing 5);
Kimai's filters in one control, applied as they change (Filters 1). Reject: the weekly
hours grid (section 4); a phone row of date and duration only (Views 7); inline edit
of every cell, for now (Editing 7); a table wider than the phone (Phone against
desktop 6).

**Item 15, the rest of the screens.**
Follow: templates and favourites as one thing (Recents 1); the phone's navigation
reaching every view with the rest behind "more" (Phone against desktop 5). Adapt: the
totals Kimai's dashboard shows, kept in Reports rather than a dashboard (Views 9;
Totals 3). Reject: a dashboard screen (Views 9); round 1's look on Setup, History,
Copy-out, Reports and the rest (item 15's exit); the direction is item 11's choice. The references have no
counterpart for time-keep's History, Copy-out or agent access: those follow the
patterns of items 11–14, not a reference.

## 9. Calls made in the operator's place

The design's calls, the stand-in's, are in
[the spec](superpowers/specs/2026-10-19-reference-study-design.md), "Calls made in the
operator's place". Every verdict above is the builder's, reasoned from the findings
and the record; these are the ones that settle a choice the operator could make
differently:

1. **The weekly hours grid is rejected; item 14 does not build it.** Source: section
   4; vision, "The entry"; the 2026-10-18 discovery. Confidence: inferred. Noted under
   the grid's question in [questions](questions.md).
2. **Templates, not description autocomplete or a recents list, are the fast path.**
   Source: `docs/operator-voice.md`, "Data and entries" (templates replace recents).
   This conflicts with roadmap item 12's "start from recents, favourites and
   templates"; the operator's words are followed. Confidence: grounded on the
   operator's words, with the conflict queued (the stand-in); inferred for
   autocomplete (queued).
3. **A bare number in a duration is read as hours** (`330` → 3:30), against every
   tracker's minutes. Source: the operator's "for Z hours" shape. Confidence: inferred;
   item 12 settles the full table.
4. **No confirm before a delete, and no trash; undo after every change instead.**
   Source: vision, "History and undo". Confidence: inferred.
5. **On the phone, entries are moved through the form, not by drag;** drag to move
   and resize is the PC's. Source: roadmap item 13 ("on the PC, entries are moved and
   resized by dragging"). Confidence: inferred.
6. **The phone keeps all three calendar views,** with day and month leading and the
   week redrawn for 390 px. Source: vision, "Views". Confidence: grounded on all three,
   inferred on which leads.
7. **Restart copies every field, the description included,** as Kimai's "Start
   again" does. Source: Kimai, Toggl and Clockify (Timers); the conservative call, as
   the stand-in asked in its revision 1 review. Confidence: inferred.
8. **No agenda view and no dashboard.** Source: vision, "Views" (calendar and table
   only); vision, "Output". Confidence: grounded.

Queued in [questions](questions.md) by this study: whether the timer bar offers
recents beside templates (the stand-in); whether the phone's "fix today" should widen
to recent days; whether "not a form" in the fast-capture principle holds
when a past interval is logged through a short form; whether description autocomplete
is wanted beside templates.
