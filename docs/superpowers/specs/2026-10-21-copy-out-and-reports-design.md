# Copy-out and Reports — design

Roadmap item 15c, the third part of item 15. Written 2026-10-21 in an autopilot design
session; the operator stand-in answered in the operator's place (see the last section).
The mockups it chose are in
[`2026-10-21-copy-out-and-reports/`](2026-10-21-copy-out-and-reports/), each in light
and dark (`<name>-light.png`, `<name>-dark.png`): `pc-copy`, `ph-copy`, `pc-reports`,
`ph-reports`. They are static, with invented data; the sidebar's icons in them are a
mock artefact (the shell's own icons stay). Where this text and a mockup differ, this
text wins. Round 1's designs, whose behaviour this keeps, are
[`2026-10-19-copy-out-design.md`](2026-10-19-copy-out-design.md) and
[`2026-10-19-reports-design.md`](2026-10-19-reports-design.md).

## Intent

Copy-out and Reports are the month-end screens. The month is logged and tidied (often
by an agent through the MCP server); then, on the PC, the operator opens Reports to see
how much went where and to spot a day that looks wrong, and Copy-out to tick the
columns this client's Excel sheet wants and paste the month into it, or take a CSV
(calls 1, 2). Copy-out is "the least concern and the easiest part" (operator's voice,
2026-10-18), so it should be quick and plain.

Round 1 built both (items 6a, 6b) and they work: the rows, the rounding, the split at
midnight, the formula guard, the CSV, the totals that are sums of the Copy-out rows.
What fails is round 1's look and pattern: a grid of seven labelled fields and a Show
button on top of each screen, the sheet cut at the right edge at 1440 px, the totals as
bare stacked tables, and on the phone a ten-column sheet that shows three. This part
redoes both in item 11's direction and the patterns of items 12–14: Entries' toolbar
(Filter naming the range, the live search, the count and total, the chips), the ruled
table in a surface panel, the phone's toolbar and sections, the bottom sheet. Round 1's
filter bar (`components/entries/`) goes with them (roadmap, 15c).

What the screens compute stays round 1's (docs/app.md, Copy-out and Reports): the
same rows, the same writers (`toTsv`, `toCsv`), the same CSV route and file name, the
same totals from the same pieces. Nothing in the core, the database or the MCP changes.

## Shared by both screens

### The toolbar and the filter

Entries' toolbar and filter (item 14), as built: on the PC one row, an outline
**Filter** naming the range ("This month") with its "+n" badge, the live **search**
("Search entries", `/` focuses it, × clears it), and at the right the count and total
in figures; the filter chips under it with Clear filters while a filter other than the
range is on. The Filter popover (PC) and the filter sheet (phone) are Entries': the
presets (Today, Yesterday, This week, Last week, This month, Last month, Custom range)
with their ISO hints, and the scope (customer › project, activity, location, `none`).
Filters apply as they change; there is no Show or Search button (call 4).

- The search is Entries' one search across customer, project, activity, location,
  reference and description (`q`), replacing round 1's Text field.
- Round 1's This month and Last month links are gone: they are presets.
- **The kept range.** The preset is kept per device in a cookie of these two screens,
  shared by them and apart from Entries' `entries_range` (call 5): choosing Last month
  for the month-end output does not move Entries off This month, and Reports opens on
  the range Copy-out was last left on. A custom range lasts for the visit, as on
  Entries. A first visit opens on This month.
- The address says the whole view (range or from/to, scope, `q`, and on Copy-out the
  columns and options), so a copy-out is still a URL, and the Download CSV link is the
  same query on `/copy-out/csv`.
- The count reads "56 rows · 68:30" on Copy-out and "56 entries · 68:30" on Reports
  ("1 row", "1 entry"): split at midnight can make more rows than entries (call 6).

### The output options

Round to 5 minutes (on by default), Split at midnight (off), Duration h:mm | Decimal
(h:mm) (call 14). Two checkboxes and a two-button segmented control (the pressed side
in the `accent` fill with the text colour and a 2 px text-colour underline, the other
on the surface; a radio group to assistive technology). They are kept per device with
Copy-out's columns, in what both screens read, so Reports and Copy-out always show the
same options (call 7). Changing one applies at once, like the filter.

Every total on Reports stays the sum of the Copy-out rows it covers with the same
filter and options: with rounding on, Reports adds up to the rounded sheet (call 6).

### Running entries, nothing found, a refusal

- Running entries are left out, as now, and the line "1 running entry left out." /
  "<n> running entries left out." shows in muted 14 px under the toolbar (under the
  chips when shown).
- No match: Entries' empty state in the panel's place, "No entries match." with
  Clear filters when a filter other than the range is on (the running line too when
  the only matches run).
- A refused read (a search over 200 characters, a custom range with From after To)
  is shown as Entries shows it, with no result.

## Copy-out (`/copy-out`)

`pc-copy`, `ph-copy`.

In the PC sidebar after Entries and under More on the phone, as now. Header title
"Copy-out"; the header's timer pill, Start and "+ New entry" as on every screen.

### The output band (PC, from `lg`)

Under the toolbar (and chips), a surface panel band (call 8):

- **Columns**: a label, then the ten columns as toggle chips in their fixed order
  (Date, Start, End, Duration, Customer, Project, Activity, Location, Reference,
  Description; call 9), wrapping onto a second line when they must. A chip on: `accent`
  fill, the text colour, semibold, a 14 px check before the name; off: the surface,
  muted text, the `input` stroke, no check. 36 px tall. Each is a toggle button
  (`aria-pressed`) to assistive technology.
- Under a `border` rule inside the band, the **options** line (above).
- At the band's right, top-aligned: **Copy 56 rows**, the screen's one blue primary
  button with a copy icon (call 10), and **Download CSV**, outline with a download
  icon. The copy status ("Copied 56 rows." / "Copy failed; select the table and copy
  it.") is a polite live line under the two buttons, cleared when the rows change.
- With no column on, the band says "Choose at least one column." in red under the
  chips, Copy and Download CSV are off (50 %, still focusable, saying why), and no
  sheet shows. The chips never refuse a click (call 21).

### The sheet (PC)

The rows as Entries' ruled table in a surface panel: the muted head band of `caps`
heads in muted text, one column per chip that is on, in the fixed order; rows divided
by `border` hairlines; dates, times and durations in figures, the duration
right-aligned; every value exactly as Copy writes it (call 11).

- **Nothing is cut.** Text columns wrap; Description takes the rest of the width and
  wraps. At 1440 px all ten columns fit inside the 72 rem measure. Below that, should
  the chosen columns still not fit, the panel scrolls sideways inside itself and the
  band never does; nothing is cut with "…" (call 12).
- The midnight-crossing entry reads its end as round 1 writes it ("2026-10-14 01:00"),
  since that is what is pasted (call 11).
- A Total row at the panel's foot: "Total" and the total in semibold figures under
  Duration, on a text-colour rule. Without the Duration column there is no Total row;
  the toolbar still says the total.
- Rows are oldest first, as round 1 (the order they are pasted in).
- The rows are not links and have no menu: Copy-out only reads.

### The phone (below `lg`)

`ph-copy`. No sheet (call 13). Top to bottom:

- Entries' phone toolbar: Filter taking the width, the search under it, the count and
  total under that (kept out of the "+"'s column).
- **Copy 56 rows** (primary) and **Download CSV** (outline), full width, stacked, 44 px,
  clear of the "+"'s column; the copy status under them.
- **COLUMNS**, a section head, then the ten toggle chips at 44 px, wrapping.
- **OPTIONS**, a section head, then the two checkboxes and the segmented Duration, each
  44 px.
- The running line and the refusal as on the PC. With no column on, the message under
  the chips and the two buttons off.

### Copy and the CSV

Unchanged from round 1 (docs/app.md): Copy writes `toTsv` of the rows on screen (tabs,
`\r\n`, no header) and needs JavaScript; the CSV route answers `toCsv` of the same query
with a byte-order mark and a header row, `time-keep-<from|all>-<to|all>.csv`, and a
refused query is a 400 with the screen's message. The route reads the new address
(range or from/to, scope, `q`, columns, options) and resolves a preset as the screen
does; with no columns or options in its query it uses the kept ones (call 22).

## Reports (`/reports`)

`pc-reports`, `ph-reports`.

In the PC sidebar after Copy-out and under More on the phone, as now. Header title
"Reports".

### The PC (from `lg`)

- The toolbar and chips (above), then the **options** line always shown under them,
  at the left, on the ground (call 15).
- Then four lists, each a section head (`caps` on a text-colour rule) over a surface
  panel of ruled rows, label at the left and duration at the right in figures, and a
  Total row at the foot on a text-colour rule (semibold label and figures) (call 16):
  - at the left **Days**: "Thu 2026-10-01" (Entries' day-head form), oldest first;
  - at the right, stacked 24 px apart, **Weeks** ("W40 · 2026-09-28 – 10-04", the
    week's Monday and Sunday), **Customers** (by name), **Projects** (the project's
    8 px dot, the customer muted, "›", the project in the text colour, by customer
    then project).
- Durations only: no share column, no bars, no chart (calls 17, 18). Only days with
  time are listed (call 19). Every Total is the same number, and it equals the
  toolbar's.
- Read-only: a row leads nowhere (call 20).

### The phone (below `lg`)

`ph-reports`. Entries' phone toolbar; then an outline **Options** button summarising
the options ("Options · h:mm, rounded"; "Options · decimal, exact, split"), at the
left, clear of the "+"'s column, which opens a bottom sheet (head "Options", the two
checkboxes and the segmented Duration at 44 px, each change applied at once, a pinned
full-width "Done" closing it). Then the four lists stacked, edge to edge on the surface
with the section heads keeping the 16 px margin, in the order Customers, Projects,
Weeks, Days (call 24).

## Without JavaScript

Both screens stay usable as plain `GET` pages, the way Entries is (item 14): the
filter a form with its presets, scope and search and a submit, the chips links. On
Copy-out the columns are checkboxes and the options a checkbox pair and a radio pair
in a form with an "Apply" submit; on Reports the options are in a form with its own
Apply, and the phone's Options sheet is a `<details>`. Parts only these pages have
carry `data-nojs`, so with JavaScript nothing moves on hydration. Copy needs
JavaScript and is not shown without it (the sheet is selected and copied by hand on
the PC; the CSV works everywhere).

## Keys and focus

- `/` focuses the search; Tab reaches Filter, the search, each chip, each option,
  Copy and Download CSV, in that order; on Reports Filter, the search, the options.
- After Copy the focus stays on Copy; the status is announced.
- The Filter popover, the filter sheet and the Options sheet return focus to their
  opener when closed.
- 36 px targets on the PC, 44 px on the phone; nothing under the "+".

## The reference each part follows

| Part | Follows | Departs from |
|------|---------|--------------|
| Filter, presets kept, chips, live search | Entries (item 14; study, Filters 1–2, Moving 6) | round 1's field grid and Show |
| Columns chosen at output time, on the page | the vision, Output; round 1 | Kimai's fixed export templates |
| The sheet as a ruled table, never cut | Entries' table (item 14) | round 1's sheet cut at the right |
| Copy as the one primary action | DESIGN.md (one primary per form) | round 1's outline Copy under a primary Show |
| No sheet on the phone | study, Phone against desktop 6 (no table wider than the phone) | round 1's sideways-scrolling sheet |
| Totals per day, week, customer and project, numbers only | the vision, Output; study, Totals 3 (Kimai's dashboard rejected) | Kimai's dashboard of tiles and a bar chart |
| The options in a bottom sheet on the phone | Entries' filter sheet (item 14) | round 1's options on the page |

## Goals

- At month-end on the PC: pick Last month, tick the client's columns, Copy, paste, in
  a few clicks, with the month in view as it will be pasted.
- Download the same rows as CSV.
- See the month's totals per day, week, customer and project, adding up to the sheet.
- The same on the phone, reduced: copy or download the month, see its totals.

## Non-goals

- Any change to the rows, the writers, the CSV format, the totals' arithmetic, the
  core, the database or the MCP.
- Column order, saved column sets per client, a header row in Copy.
- Totals per activity or location; shares; charts; links from a total to its entries.
- Entries, the Calendar, Account, Users, Backup and the sign-in page (15d).

## Anti-goals

- A sheet cut at the right, or a value on screen that differs from what Copy writes.
- A Reports total that does not equal the Copy-out total for the same filter and
  options.
- A Show button; a filter that does not apply until submitted (with JavaScript).
- A control under the phone's "+"; a phone page wider than the phone.
- Blue for anything but Copy and running; red for anything but a wrong state.
- Any trace of round 1's filter bar on either screen.

## Constraints

- SvelteKit, server-rendered; usable without JavaScript as pages (PRODUCT.md).
  Tailwind and shadcn-svelte (decision 2); item 11's tokens and shell (decision 9,
  DESIGN.md); item 14's toolbar, filter model (`src/lib/filter/filter.ts`), Filter,
  chips, search, sheet and table as the patterns, reused rather than copied.
- Reads go through the core (`entries.list`, with no row limit, as round 1), for the
  request's user only. No write.
- WCAG 2.2 AA in both themes; 44 px targets on the phone, 36 px on the PC.
- English, 24-hour clock, ISO dates, Monday-first weeks.
- Round 1's Copy-out and Reports e2e tests are rewritten for the new screens, keeping
  their behaviours (the rows, the options, the CSV, the guard, the totals equal to the
  sheet); the unit tests of `outputRows`, `outputPieces`, `reportTotals`, `toTsv` and
  `toCsv` keep passing, changed only where call 23 changes a label.
- `components/entries/` and whatever only it used (`narrowing.svelte.ts`, round 1's
  `readSearch`, `searchInput`, `searchFilters`, `searchPath`, if nothing else uses
  them) are removed.
- `docs/app.md`'s Copy-out and Reports sections are updated; `DESIGN.md` is recorded
  from what ships (impeccable's documenter), dropping these screens from round 1's
  carry-overs.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`: the 30 days before today, weekdays only,
3 to 7 entries a day, one entry past midnight, one overlapping pair; customers CompX
and Myself, projects ClientY – ProjectZ and CompY – Support under CompX and time-keep
under Myself), signed in as the seeded user, at 390 px and 1440 px, in light and in
dark.

1. **Copy the month (PC).** Open Copy-out. In Filter choose Last month: the toolbar
   names it and the count and total change without pressing anything. Turn off the
   Activity and Location chips: the sheet loses those two columns at once. Copy: the
   status says "Copied <n> rows." with the toolbar's count, and the clipboard holds the
   rows tab-separated in the columns shown. Every Description reads in full; nothing is
   cut at the right.
2. **Narrow and download (PC).** Filter to CompX › CompY – Support: a chip shows it,
   every row is that project, the count and total follow. Download CSV: the file's
   header row is the columns on, and its rows are the sheet's. Remove the chip.
3. **Options (PC).** Turn off Round to 5 minutes and switch Duration to Decimal: the
   durations change to exact decimal hours. Turn on Split at midnight with a range
   holding the entry past midnight: it shows as two rows and the row count goes up by
   one while Reports' entry count does not.
4. **Kept between visits.** Go to Entries and back to Copy-out: it is still on Last
   month with Activity and Location off and the options as left; Entries is on its own
   range. Open Reports: it is on Last month with the same options.
5. **Totals add up (PC).** On Reports with This month: Days, Weeks, Customers and
   Projects each total the toolbar's total; the Projects rows carry their dots; with
   the same filter and options Copy-out's total is the same number, rounded or not.
6. **Search.** On Copy-out type a ticket number from a Reference (e.g. "T-4"): the
   sheet narrows as you type; on Reports the same search narrows the totals.
7. **The phone.** From More open Copy-out: Filter, search, count, Copy and Download CSV,
   the column chips and the options, nothing under the "+", no sideways scroll; turn
   off Reference and Copy. From More open Reports: Options opens a sheet; switch to
   Decimal and close it: the button and every total read decimal; the four lists are
   stacked, Customers first.
8. **No match and running.** Search "zzzz": "No entries match." Start a timer and open
   Copy-out on This month: "1 running entry left out." Stop it.
9. **Keys and look.** Tab reaches Filter, the search, every chip and option, Copy and
   Download CSV; `/` focuses the search; the sheets return focus to their openers. Both
   themes, both widths: Copy is the only blue fill besides the header's "+ New entry",
   chips read on or off without colour alone (the check), no round 1 field grid or Show
   button anywhere.

## Builder's latitude

The plan decides, within the above: the component structure and what is shared with
Entries' toolbar, filter and sheets; how the kept range, columns and options are
stored per device and their names; the address's parameter names for columns and
options; the band's widths and breakpoints; the copy status's exact strings beyond
those above. Server logic is unit-tested; the interactions are covered by browser
tests.

## Calls made in the operator's place

The stand-in's answers (`docs/questions.md` holds what it queued); its rounds are in
`.autopilot/agents/15c-standin-r1.md` and `-r2.md`.

1. **Copy-out is opened at month-end on the PC to tick the client's columns and paste
   the month, or take a CSV; quick and plain.** Source: vision, Output; operator's
   voice (2026-10-18: the PC for month-end tables; "the least concern and the easiest
   part"). Confidence: inferred.
2. **Reports is opened at month-end beside Copy-out, to see how much went where and
   spot an odd day.** Source: vision, Output; roadmap item 6b's exit; operator's voice
   (the PC for month-end tables). Confidence: inferred.
3. **Two screens, sharing the filter and the options.** Source: vision, Output (two
   outputs); roadmap item 15. Confidence: inferred.
4. **Entries' Filter control replaces round 1's form and Show.** Source: roadmap
   (item 15: the patterns of 12–14; 15c: round 1's filter bar goes); study, Filters 1–2.
   Confidence: grounded.
5. **One kept preset shared by Copy-out and Reports, apart from Entries'.** Source:
   none. Confidence: ungrounded, queued.
6. **Reports' totals stay sums of the Copy-out rows with the same options; Copy-out
   counts rows and Reports entries.** Source: roadmap item 6b; vision, The entry (split
   is an output option); the stand-in's round 2 playback. Confidence: inferred.
7. **Columns are ticked; the ticks and options are kept per device and shared with
   Reports.** Source: vision, Output (columns chosen at output time). Confidence:
   grounded for ticking; ungrounded for keeping, queued.
8. **On the PC the columns and options are a band always shown above the sheet, with
   Copy and Download CSV at its right (mockup a, over a toolbar popover and a side
   panel).** Source: vision, Output; operator's voice ("The sheets are custom and
   differ"); round 1 showed them on the page. Confidence: inferred.
9. **The columns' order stays fixed.** Source: none. Confidence: ungrounded, queued.
10. **Copy is the screen's one blue primary button; Download CSV is outline.** Source:
    DESIGN.md (one primary per form). Confidence: inferred.
11. **The whole sheet is shown on the PC, as the table that will be pasted.** Source:
    vision, Output ("a month view that pastes into Excel"); round 1's screenshot (the
    sheet cut at the right). Confidence: inferred.
12. **Nothing is cut; the panel scrolls sideways only if the columns cannot fit.**
    Source: the stand-in's round 1 (the clipped Description "has to go"). Confidence:
    inferred.
13. **The phone gets Copy-out reduced: Copy, Download CSV, the columns and options,
    no rows.** Source: operator's voice (phone for quick capture, PC for month-end
    tables); study, Phone against desktop 6. Confidence: inferred.
14. **The options' defaults stay round 1's: rounded, not split, h:mm.** Source:
    roadmap item 6a; vision, Output. Confidence: grounded.
15. **On the PC Reports' options are a line always shown; on the phone they are behind
    an Options button opening a sheet.** Source: the stand-in's round 2 (the options
    change every total); call 8. Confidence: inferred.
16. **Reports shows four lists, Days, Weeks, Customers and Projects, all at once (over
    two nested lists).** Source: vision, Output. Confidence: ungrounded, queued.
17. **Durations only; no share column.** Source: none. Confidence: ungrounded, queued.
18. **Numbers only; no bars or chart.** Source: study, Totals 3 (Kimai's dashboard
    rejected); round 1. Confidence: ungrounded, queued.
19. **A weekday with no time is left out of Days.** Source: none; round 1. Confidence:
    ungrounded, queued.
20. **A total leads nowhere.** Source: none; round 1. Confidence: ungrounded, queued.

The builder's:

21. With no column on, the chips stay clickable and the band says "Choose at least one
    column." (round 1's message), Copy and Download CSV off; a chip that refused to turn
    off would hide why.
22. The CSV route with no columns or options in its query uses the kept ones, so a
    bookmarked `/copy-out/csv?range=last-month` downloads what the screen would show.
23. Days read "Thu 2026-10-01" (Entries' day heads) and weeks "W40 · 2026-09-28 – 10-04",
    over round 1's "2026-10-01 Thu" and "W40 2026-09-28 – 2026-10-04", so the screens
    read alike.
24. The phone's Reports order stays round 1's (Customers, Projects, Weeks, Days): the
    month's split first, the days last.
25. Below `lg` Copy-out shows no sheet at any width (tablets included): the phone
    layout is one layout, and the PC's sheet needs the PC's width.

From the builder check (`.autopilot/agents/15c-builder-check.md`, nothing left for the
operator):

26. The address beats the kept values; an address that names a preset, columns or
    options writes them to what is kept, as Entries keeps a named range. The CSV route
    only reads what is kept. An empty column set is not kept (the kept columns stay as
    they were).
27. The toolbar's total and every total on both screens follow the Duration option.
28. A week whose Sunday falls in the next year writes that date in full
    ("W01 · 2026-12-28 – 2027-01-03").
29. Entries' live filter (`live.ts`) is generalised to the screen's path, so a filter
    change keeps the columns and options in the address; the search uses the core's
    existing `text` search (customer, project, activity, location, reference,
    description), so the core does not change.

Approved by the operator stand-in, revision 1, 2026-10-21.
