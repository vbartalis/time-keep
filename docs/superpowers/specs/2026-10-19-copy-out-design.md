# Phase 6a, copy-out — design

Date: 2026-10-19. Roadmap item 6a, the first part of phase 6. Written without the
operator under the continuous development experiment (operator, 2026-10-18); every
choice not taken from the vision, the roadmap, decisions 1–5, `DESIGN.md` or the
earlier specs is marked **(call)**.

## The split

Phase 6 is split into two parts, worked in order **(call: as phase 5 was; each is one
screen and one review)**:

- **6a. Copy-out** (this spec): a month's entries as the columns chosen at output
  time, copied into Excel and exported as CSV, with rounding to 5 minutes and
  splitting at midnight as output options. It owns the output rules both parts use.
- **6b. Reports**: totals per day, week, customer and project, over the same
  filters and the same output rules.

Phase 6's exit needs both: "a month pastes into Excel as the chosen columns and
exports as CSV, and the reports match the stored entries."

## Intent

Month-end ends in the operator's Excel sheets. The sheets are custom and differ, so
there is no fixed export to any one of them (vision); what the sheets usually need is
start and end (sometimes only a duration), task, place, project and, for support work,
the ticket and the end client (discovery). The operator called copy-out "the least
concern and the easiest part": it should be plain, and right.

"Store exactly, present flexibly" (vision): entries are stored to the second and never
rounded; rounding to 5 minutes, durations, splitting at midnight and the layout are
applied here, on the way out, and nowhere else.

## Goals

- A **Copy-out** screen (`/copy-out`): the Entries screen's filters, the columns to
  output, and the output options; the result as a ruled table.
- **Copy**: one button puts the rows on the clipboard so that they paste into Excel
  as the chosen columns.
- **CSV**: a link downloads the same rows as a CSV file.
- The output rules in one module, unit-tested, that 6b reuses: rounding to 5 minutes,
  splitting at midnight, duration formats, and writing values for Excel and CSV.

## Non-goals

- Totals per day, week, customer or project (6b). The screen shows the count and the
  summed hours of its rows, as Entries does.
- Choosing the order of the columns **(call: they come in one fixed order; moving a
  column in Excel is one drag, and ordering controls that work without JavaScript
  cost more than they save)**.
- Remembering the last choice of columns and options other than in the URL **(call:
  the screen is a `GET` form, so a choice is a bookmark; the month links keep it)**.
- Any change to the core: the screen reads `entries.list` as it is **(call: "grouping
  by local day is the reports' job", core.md)**.
- Excel files (`.xlsx`), other delimiters, other number formats, a time zone other
  than each entry's own **(call)**.
- Editing entries here: Entries edits.

## Anti-goals

- A rounded or split value stored anywhere. Output only.
- A copy or a CSV that silently holds fewer rows than the screen says it has.
- An entry that breaks the pasted columns: a tab or a line break in a description
  must not start a new cell or row.
- A value Excel runs as a formula.
- A screen that needs JavaScript to get the rows out (the CSV link and selecting the
  table work without it; only the Copy button needs it).

## Decided

### Which entries

The **filters** are the Entries screen's, read the same way (`readSearch` and
`searchInput` in `screens/entries.ts`, the same query names, the same messages):
From and To (default: the current month in the request's zone), Customer, Project,
Activity, Location, Text. They select entries that **started** in the range
(`startedIn`), oldest first, as Entries does: an entry belongs to the day it started
(vision), so an overnight entry on the month's last day is the month's, whole.

Beside Clear, two links: **This month** and **Last month** **(call: month-end is done
in the first days of the next month)**. Each sets From and To to that month in the
request's zone and keeps every other filter, column and option.

There is **no row limit** **(call: a copy-out that drops rows is worse than a long
page; Entries' 500-row cut does not apply)**: the screen asks `entries.list` without
`limit`. A range with both dates blank outputs everything, which is the user's
choice.

**Running entries** are left out of the rows (they have no end yet); when any match,
a faded line says "1 running entry left out." / "<n> running entries left out."
**(call)**.

### Columns

Ten columns, in this fixed order, each a checkbox **(call: the vision's list, with
start and end each split into a date and a time so Excel reads them as dates and
times)**:

| Column | Value |
|--------|-------|
| Date | the start's date, `YYYY-MM-DD`, in the start zone |
| Start | the start's time, `HH:mm`, in the start zone |
| End | the end's time, `HH:mm`, in the end zone (see below) |
| Duration | end minus start, in the chosen duration format |
| Customer | the customer's name |
| Project | the project's name |
| Activity | the activity's name, or empty |
| Location | the location's name, or empty |
| Reference | the reference, or empty |
| Description | the description, or empty |

Names are as stored, archived ones included.

**End** is the time alone when the end falls on the row's date; **`24:00`** when it is
exactly the next midnight **(call: the timesheet convention, and Excel reads `24:00`
as one day, so End − Start stays right)**; otherwise, an overnight row without
splitting, the end's date and time, `YYYY-MM-DD HH:mm` **(call: rare, and a time
alone would be wrong)**.

Default when the query names no column: all ten. A submitted form with no column
ticked shows "Choose at least one column." by the columns and no rows **(call)**.

### Options

Three, each part of the `GET` form and the URL **(call: the defaults)**:

- **Round to 5 minutes**, on by default. Each entry's start and end instants are
  rounded to the nearest 5 minutes (2.5 minutes rounds up), and the duration is the
  rounded end minus the rounded start, so the columns always agree **(call: rounding
  the times rather than only the duration; every zone in use today has an offset
  that is a whole multiple of 5 minutes, so rounding the instant rounds the local
  time)**. An entry that rounds to nothing (09:01–09:02) is a row of `0:00`, not
  dropped **(call)**.
- **Split at midnight**, off by default. An entry that crosses midnight in its start
  zone becomes one row per day: the first ending `24:00`, any whole day in between
  `00:00`–`24:00`, the last starting `00:00`; every piece keeps the entry's other
  values, and each piece's date, start and end are in the start zone **(call: one
  zone for the pieces of one entry)**. Splitting comes after rounding, so the
  pieces' durations add up to the entry's rounded duration; a piece of no length (an
  entry ending exactly at midnight) is not written. A day with a daylight-saving
  change has its real length.
- **Duration as** `h:mm` (default) or **decimal hours** (`5.50`, two decimals,
  rounded half up, a dot as the decimal mark) **(call: Excel sums both; which one a
  sheet wants differs)**.

Without rounding, times are cut to the minute, as everywhere in the app, and the
duration is computed from those minutes, so `09:00:40–09:30:10` reads
`09:00`–`09:30`, `0:30` **(call: the columns agree)**.

Which entries are output is decided by their stored start (the filters), and what a
row says by its output values: an entry starting 2026-10-31 23:58 is in October's
copy-out, and with rounding its row reads `2026-11-01`, `00:00` **(call: every
column of a row comes from the same rounded times; a two-minute edge case does not
earn a clamp)**.

**Number formats.** Dates ISO, times 24-hour, a dot as the decimal mark and a comma
between CSV values, per the vision's English formats **(call: the operator's Excel
regional settings are not recorded; a Hungarian Excel expects `;` and a decimal
comma, which would open the CSV as one column and paste decimal hours as text. The
pasted copy separates by tabs and the default `h:mm` durations paste as times in
either setting, so only the CSV and decimal hours depend on it)**.

### The screen (`/copy-out`)

One `GET` form under the screen title, as on Entries: the Filters (the Entries filter
bar), then **Columns** (the ten checkboxes in one wrapping row) and **Options** (the
round and split checkboxes and the duration choice), and one Show button **(call:
primary, the form's only button; Entries' Search is outline because the change form
owns its primary)**.

Below it, the **result** under a section head with "<n> rows, <total>" ("1 row"): the
rows' minutes summed (rounded when rounding is on) and written in the chosen duration
format, `h:mm` or decimal hours **(call: rows, not entries, since splitting makes
several rows of one entry; summed from minutes, so it can differ from adding up the
shown decimals by a hundredth)**:

- a **Copy** button (outline) and a **Download CSV** link styled as an outline button
  **(call: Show keeps the one primary)**;
- the running-entries line, when any;
- the rows as a ruled table with the chosen columns as its column heads, every value
  exactly as it will be copied, the times and durations punched.

None: "No entries match." with Clear, no Copy and no CSV link. A date mistake shows as
on Entries, with no result.

The screen stays usable at phone widths (the table scrolls sideways and does not
stack: it is the sheet).

### Copy

**Copy** (JavaScript) writes the rows to the clipboard as text: one line per row,
values separated by tabs, lines by `\r\n`, **no header row** **(call: it is pasted
under the sheet's own heads)**. Excel pastes such text as columns. A status line,
announced politely, says "Copied <n> rows." ("Copied 1 row.") or, if the browser
refuses, "Copy failed; select the table and copy it." **(call)**. Without JavaScript
the button is not shown; selecting the table and copying it pastes into Excel as
columns too.

In copied text a tab, a carriage return or a line feed inside a value becomes one
space **(call: one entry stays one row)**.

### CSV

**Download CSV** is a link to `/copy-out/csv` with the same query; it works without
JavaScript. The file:

- UTF-8 with a byte-order mark, so Excel reads accented names **(call)**;
- comma-separated, lines ending `\r\n`, values quoted RFC 4180 style when they hold a
  comma, a quote or a line break (quotes doubled); line breaks inside a value are
  kept, quoted;
- a **header row** of the column names as in the table above **(call: a file stands
  alone)**, then the rows;
- named `time-keep-<from>-<to>.csv` (`time-keep-2026-10-01-2026-10-31.csv`), a blank
  side written `all` (`time-keep-all-2026-10-31.csv`) **(call)**;
- `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`.

The route requires a signed-in user like every screen (a `+server.ts` is not covered
by the app layout's load, so it checks for itself), reads only that user's entries,
and answers a query the screen would refuse (a bad date, From after To, no column)
with 400 and the screen's message as plain text.

### Formula safety

A text value (customer, project, activity, location, reference, description) that
begins with `=`, `+`, `-`, `@`, a tab or a carriage return is written with a leading
apostrophe, in the copy and in the CSV, and shown so in the table **(call: OWASP's
CSV-injection guard; a description such as "- fixed the export" would otherwise paste
as a broken formula)**. Dates, times and durations are never prefixed.

### The output module

The rules above live in one module shared by the server and the browser (no server
imports, as `src/lib/format.ts`) **(call: the Copy button builds the text in the
browser from the rows the page already has; 6b's reports reuse the rounding and
splitting)**: entries in, rows of values out, and the rows written as tab-separated
text or as CSV. The screen, the CSV route and the Copy button all write through it,
so the table, the clipboard and the file cannot disagree.

### Navigation

The rail gains **Copy-out** after Entries (Lucide `sheet`, 16 px) **(call: it is the
step after finding and fixing a month)**; the phone's bar does not, as the other PC
screens. The shell keeps Copy-out current on `/copy-out`.

### Tests

- Unit (the output module):
  - rounding: to the nearest 5 minutes, 2.5 minutes up, an entry rounding to
    nothing, the duration from the rounded ends; without rounding, cut to the minute
    with seconds in both ends.
  - splitting: an entry over one midnight, over two (a whole middle day), ending
    exactly at midnight (one row, `24:00`), a daylight-saving day (23 and 25 hours),
    splitting after rounding (an entry ending 23:58 that rounds to midnight).
  - End: same day, `24:00`, and an overnight row unsplit (date and time); different
    start and end zones.
  - duration formats, including decimals rounded half up.
  - the copied text: tabs and line breaks inside values replaced, no header.
  - the CSV: header, quoting of commas, quotes and line breaks, the byte-order mark,
    `\r\n`.
  - formula safety for each leading character, and never on dates or durations.
  - column choice: subsets in the fixed order.
- Unit (the screen's reading of the query): default columns, none ticked, the
  options' defaults, This month and Last month across a year boundary, the file name.
- Browser, at phone and PC sizes, seeded through the core:
  - the default month shows its entries with all columns; choosing columns and
    decimal hours changes the table.
  - Copy puts the tab-separated rows on the clipboard (PC size, the browser's
    clipboard permission granted).
  - Download CSV gives the file with its header and rows.
  - Split at midnight turns an overnight entry into two rows; rounding off shows
    exact minutes.
  - a running entry is left out with its line.
  - Last month.
  - JavaScript off: the form, the table and the CSV link work, and no Copy button.
  - the CSV route signed out redirects to sign-in or is refused, and never returns
    another user's entries.

### Documentation

`docs/app.md` (the Copy-out screen, the CSV route, the navigation, the layout rows),
`DESIGN.md` (the column and option pickers, the result's bar, the sheet table, the
navigation) through impeccable's document step, `docs/roadmap.md` (the split of 6).
No decision record **(call)**.

## Exit

From the PC, a month's entries, filtered as on Entries, paste into Excel as the
chosen columns and download as CSV, rounded to 5 minutes and split at midnight when
asked, with nothing stored changed. Check, lint, unit and browser tests pass, at
phone and PC sizes.

## Left to the builder

Component structure and how far the Entries filter bar is shared or generalised; the
query names of the columns and options; how the page hands the rows to the Copy
button; the exact layout of the column and option pickers; copy beyond the strings
above.
