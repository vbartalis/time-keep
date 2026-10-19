# Phase 6b, reports — design

Date: 2026-10-19. Roadmap item 6b, the second and last part of phase 6. Written
without the operator under the continuous development experiment (operator,
2026-10-18); every choice not taken from the vision, the roadmap, decisions 1–5,
`DESIGN.md` or the earlier specs (6a's above all) is marked **(call)**.

## Intent

The vision's output has two parts: the copy-out (6a, done) and **reports: totals per
day, week, customer and project**. At month-end the operator checks a month before
copying it out: did every working day get its hours, how did the weeks go, how much
went to each customer and project. The roadmap asks for these totals "over the same
filters and the same output rules", and phase 6's exit for "the reports match the
stored entries".

"Store exactly, present flexibly" (vision): the totals are computed from the stored
entries on the way out, with 6a's rounding and splitting, and stored nowhere.

## Goals

- A **Reports** screen (`/reports`): the Entries screen's filters, the output
  options, and four tables of totals: per day, per week, per customer, per project.
- The totals are the sums of exactly the rows the Copy-out screen writes for the same
  filters and options, so the two screens cannot disagree.

## Non-goals

- Charts **(call: four short tables answer "how much, when, for whom"; a chart adds a
  library or hand-drawn SVG for no new number)**.
- Totals per activity or location, or any grouping beyond the vision's four
  **(call)**.
- A copy button or CSV for the reports **(call: the Copy-out screen is the way out;
  a report table can still be selected and copied by hand)**.
- Budgets, targets, expected hours per day, or overtime **(call: not in the vision)**.
- Days with no time listed as zero rows **(call: a range may be open-ended; a missing
  day shows as a gap in the dates, and the weekday beside each date makes a gap easy
  to see)**.
- Any change to the core: the screen reads `entries.list` as Copy-out does.
- Running time counted: running entries are left out, as on Copy-out.

## Anti-goals

- A total that differs from adding up the Copy-out screen's rows for the same query.
- Four tables whose grand totals differ from each other: every minute belongs to
  exactly one day, one week, one customer and one project.
- Totals rounded after summing: rounding is per entry, as on Copy-out, and the sums
  are exact sums of those minutes.
- A rounded or split value stored anywhere.
- A screen that needs JavaScript.

## Decided

### Which entries, and the options

Exactly as on Copy-out: the Entries filters (`readSearch`, the same query names and
messages, default the current month in the request's zone), entries that **started**
in the range, no row limit, the **This month** and **Last month** links beside Clear,
and running entries left out with the faded line "1 running entry left out." /
"<n> running entries left out.".

The three output options, with Copy-out's query names and defaults: **Round to
5 minutes** (on), **Split at midnight** (off), **Duration as** `h:mm` (default) or
decimal hours. There are no columns to choose. One `GET` form, a hidden `show=1` as on
Copy-out telling a submitted form from the defaults, and one primary **Show** button.

### What is summed

The Copy-out pieces: each finished entry, its start and end rounded (or cut to the
minute), split at midnight in its start zone when asked, gives one or more pieces,
each with a **date** (the piece's start date in the start zone, the row's Date on
Copy-out) and **minutes**. A report sums pieces' minutes:

- **Day:** by the piece's date. Without splitting, an overnight entry counts whole on
  the day it started (vision: an entry belongs to the day it started); with
  splitting, each day gets its part.
- **Week:** by the ISO week of the piece's date, Monday to Sunday (vision: Monday
  first). A week the range cuts (October starting on a Thursday) counts only the days
  in the range **(call: the filters decide which entries; the label shows the whole
  week, the total what was found)**.
- **Customer:** by the entry's customer.
- **Project:** by the entry's project.

The pieces come from the same code that writes Copy-out's rows **(call: the builder
splits 6a's `outputRows` into a function giving pieces as numbers, which both the
copy-out writer and the reports use; the copy-out output does not change)**, so a
day's total is the sum of the Copy-out rows with that date. An entry rounding to
nothing is a piece of `0:00`, as it is a `0:00` row on Copy-out, and its day, week,
customer and project appear even when that is all they hold **(call: the tables
list what Copy-out would write)**. For the same reason, an entry that started on
2026-10-31 at 23:58 and rounds to `2026-11-01 00:00` counts on November 1 and in
that day's week, as its Copy-out row says **(call)**.

### The tables

Each table: one ruled row per group and a **Total** row at the foot, the durations
punched, in the chosen format (`h:mm` or decimal hours, summed from minutes and
written once, as Copy-out's total) **(call)**.

| Table | A row's label | Order |
|-------|---------------|-------|
| Days | the date and the weekday, `2026-10-19 Mon` | by date |
| Weeks | the ISO week and its Monday to Sunday, `W43 2026-10-19 – 2026-10-25` | by date |
| Customers | the customer's name | by name, case-insensitive |
| Projects | `Customer › Project` | by customer, then project name |

**(call: the labels; week numbers are the ISO week year's, so 2026-12-31 and
2027-01-01 are both `W53`, labelled with that week's own Monday and Sunday)**. Names
are as stored, archived ones included; a customer and a project are identified by
their ids, so two customers' projects of the same name are two rows. Customer and
project rows are not nested **(call: the customer table answers "how much for
CompA", the project table "how much on each", and the chain-in-the-name convention
keeps the project label readable)**.

Every table's Total is the same number, also shown beside the result's head as
"<n> entries, <total>" ("1 entry") **(call: entries, not rows, since the reports are
about time, not lines; the running ones are not counted)**.

### The screen (`/reports`)

Under the screen title, as on Copy-out: **Filters** (the Entries filter bar, shared
as `EntryFilters`, with the month links) holding the **Options** (round, split,
duration; Copy-out's option pickers without the column picker) and **Show**. Below
it, the result **(call: the layout)**:

- on the PC, two columns: **Days** on the left (the longest table), **Weeks**,
  **Customers** and **Projects** stacked on the right;
- at phone widths, one column in the order Customers, Projects, Weeks, Days
  **(call: the short answers first)**.

Each table sits under a section head with its name. The running-entries line sits
under the result head. None: "No entries match." with Clear, as on Copy-out, and,
when only running entries matched, the running-entries line under it, as on
Copy-out **(call)**. A date mistake shows as on Entries, with no result.

### Navigation

The rail gains **Reports** after Copy-out (Lucide `chart-column`, 16 px) **(call)**;
the phone's bar does not, as the other PC screens, and the screen works at phone
widths. The shell keeps Reports current on `/reports`.

### Tests

- Unit (the pieces and the sums):
  - the pieces equal what the copy-out rows say (date and minutes) for the same
    entries and options, rounded and not, split and not;
  - day totals: an overnight entry whole on its start day unsplit, divided split;
  - weeks: Monday as first day, a range cutting a week, the ISO year boundary
    (2026-12-31 and 2027-01-01 in `W53`, 2027-01-04 in `W01`);
  - customers and projects: grouping by id, two projects of one name under two
    customers, the order;
  - every table's total equal, and equal to the copy-out sheet's minutes;
  - an entry rounding to nothing; running entries counted out.
- Unit (the screen's reading of the query): the options' defaults and a submitted
  form, shared with Copy-out's reading.
- Browser, at phone and PC sizes, seeded through the core:
  - the default month shows the four tables with totals matching the seeded entries;
  - split at midnight moves an overnight entry's time across two days;
  - decimal hours;
  - Last month;
  - a running entry left out with its line;
  - "No entries match.";
  - JavaScript off: the form and the tables work.

### Documentation

`docs/app.md` (the Reports screen, the navigation, the layout rows), `DESIGN.md` (the
report tables and the two-column result) through impeccable's document step,
`docs/roadmap.md` (6b and phase 6 done). No decision record **(call)**.

## Exit

From the PC, a month's entries, filtered as on Entries, show as totals per day, week,
customer and project, rounded and split as on Copy-out, and every total equals the
sum of the Copy-out rows it covers. Check, lint, unit and browser tests pass, at
phone and PC sizes.

## Left to the builder

Where the report code lives (a `screens/reports.ts` beside `copy-out.ts` is the
obvious place); how the copy-out option pickers are shared; the tables' component
structure; how the query reading is shared with Copy-out; copy beyond the strings
above.
