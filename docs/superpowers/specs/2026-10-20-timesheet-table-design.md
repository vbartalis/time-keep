# Timesheet table — design

Roadmap item 14. Written 2026-10-20 in an autopilot design session; the operator
stand-in answered in the operator's place (see the last section). The mockups it
judged are in [`2026-10-20-timesheet-table/`](2026-10-20-timesheet-table/), each in
light and dark (`<name>-light.png`, `<name>-dark.png`). They are static, with invented
data; where this text and a mockup differ, this text wins.

## Intent

The operator named Kimai's table view, beside the calendar, as "quite important"
(2026-10-19: "anothr view that is more like a table"). Round 1's Entries screen is a
filter form, a change form and a flat list stacked on one page: reaching the rows takes
a scroll on the PC and three screens on the phone, and nothing is grouped or totalled
by day. This item rebuilds Entries as Kimai's timesheet done better: the entries newest
first, grouped by day with each day's total, one filter control with time presets that
are kept, one search, a row menu, and bulk edit and delete that appear only once rows
are ticked. It is where the month is found, read and reorganised at month-end, on the
PC first and on the phone when needed.

Every write is an existing core command (decision 4). One back-end change is made and
named here: the core's text search also matches activity and location names, for the
screen and the agent alike (call 13).

## The screen

Entries stays at `/entries`, titled "Entries" in the shell, in the sidebar and in the
phone's bottom bar where it is now. The header keeps the fixed title; the Filter button
names the range in view (call 30).

### The toolbar (PC)

One row above the table (`pc-table`):

- **Filter**, an outline button with a funnel, labelled with the time range ("This
  month", "Last week", "2026-09-01 – 2026-09-15" for a custom range), and "+n" when n
  other filters are on. It opens the filter popover.
- **Search**, a field ("Search entries", a magnifier, a `/` key hint). It matches the
  text in customer, project, activity, location, reference and description; results
  come as you type. `/` focuses it from anywhere on the screen (outside fields, no
  dialog open). A clear (×) button shows while it holds text.
- At the right, the shown set's count and total: "54 entries · 72:40" ("1 entry"),
  running entries counted to now.

Under it, while any filter other than the range is on, the filters as removable chips
(the project with its colour dot, "Activity: Support ticket", …) and a "Clear filters"
link (`pc-filtered`). The range has no chip: the Filter button names it.

### The filter

The Filter button opens a popover on the PC (`pc-filter`) and a sheet from the bottom
on the phone (`ph-filter`).

- **Time range:** Today, Yesterday, This week, Last week, This month, Last month, each
  with its dates beside it in short ISO form ("10-19 – 10-25", "2026-10" for a month), and Custom range with From and To (dates, read
  as days in the request's zone, both inclusive). On the phone the presets are a row of
  44 px choices and Custom shows From and To under them.
- **Customer › project:** item 12's project picker, matching on either name, with "Any"
  for none chosen; choosing a customer's heading (or typing only a customer) filters by
  the customer.
- **Activity** and **Location:** "Any", "None", then the user's rows.
- Archived customers, projects, activities and locations are offered too, marked
  "(archived)", so old months can be found.
- Every choice applies at once, on both surfaces (call 20). The phone sheet's foot holds
  a primary "Show 54 entries" with the live count, which closes it; Escape, a tap on the
  scrim or Back close it too, keeping the choices. "Clear filters" resets everything but
  the range.

**What is kept.** The chosen preset is kept in a cookie on this device, so the next
visit opens on it; phone and PC keep their own. A first visit, or one with nothing
kept, opens on This month. A custom range, the other filters and the search live only
in the address for the visit (calls 2, 21). The address holds everything shown, so
reload and Back return to the same table.

### The table (PC)

A ruled table in the shell's measure (`pc-table`):

| Column | Content |
|--------|---------|
| ☐ | Tick box. The head's box ticks every row shown (mixed when some are). |
| Start | `HH:mm`. |
| End | `HH:mm`, "+1" (or "+n") in muted text when the entry ends n days later; on a running entry "Running" in blue `caps`. |
| Hours | The duration, `h:mm`, exact and truncated to the minute; running: to now, blue, ticking. |
| Customer › project | The project's colour dot, the customer muted, the project in the text colour. |
| Activity, Location, Reference | As stored; blank when none. |
| Description | One line, cut with an ellipsis; the full text on hover (`title`) and in the row's accessible name. |
| ▶ | Restart, on a finished entry only (item 12's icon button). |
| ⋯ | The row menu. |

- **Day groups.** Newest day first; within a day, newest start first. Each day opens
  with a head row: a tick box selecting the day's rows (mixed when some are), the day
  ("Tue 2026-10-20", the weekday short and the ISO date), and the day's total under the
  Hours column. A day appears only when it has an entry; there are no empty days.
- **A row click** (anywhere but the tick box, ▶ and ⋯) opens the entry form in place
  (item 12), with `back` the table's address, so a save returns to the same table with
  the strip. The row is also reachable as a link by keyboard.
- **The row menu** (`pc-menu`), a popover under ⋯: Restart (▶), Copy, Edit, a rule,
  Delete in red. Restart on a running entry is shown disabled with "Already running".
  Copy opens the form for a new entry from this one (item 12's `copy`); Edit opens the
  form; Delete removes the entry at once, and the strip offers Undo (call 9). The menu
  follows the menu-button pattern: arrow keys move, Escape closes and returns focus to
  ⋯.
- **Overlaps** show as Kimai marks them: a 2 px red top edge on each overlapping row,
  with "Overlaps another entry" in its tooltip and accessible name. An overlap is judged
  against all the user's entries, not only those the filters let through (call 32).
- **A just-changed row** stays marked (accent) while its undo is offered, as now.
- Columns drop by width as Kimai's do: below 1280 px Location and Reference go (still
  in the row's tooltip and form); the PC table never scrolls sideways.

### Selecting and bulk changes (PC)

- Ticking any box puts the **bulk bar** in place of the toolbar (`pc-selected`): "5
  selected · 6:00" (the selection's total), Edit…, Delete (destructive outline), and
  "Clear selection" at the right. Under the count it names the set it acts on, the
  range and any search ("This month · “printer”"), and the filter chips stay under it,
  so the set being changed is in view (calls 18, 42). Clearing the last tick brings the
  toolbar back.
- Shift-click on a tick box ticks the run of rows between it and the last one ticked.
- **Edit…** opens a dialog (`pc-bulk`), "Edit 5 entries": Customer › project, Activity,
  Location ("Keep as it is" by default; Activity and Location also offer "None"),
  Reference ("Keep as it is" by default, a field to set it, "Clear it" to remove it),
  and Description's Find and Replace with (literal, case-sensitive, as round 1's).
  "Only what you set changes. One undo puts all 5 back." Cancel and the primary "Apply
  to 5 entries". It sends one batch, `Edit <n> entries` (round 1's `bulkUpdates`: only
  entries the form would change, only the changed fields, each with the version shown).
  A refusal shows in the dialog with the entry it names, as round 1's does.
- **Delete** removes the ticked entries at once as one batch, `Delete <n> entries`, and
  the strip says so with Undo (call 8).
- The ticks clear when the shown set changes (a filter, the search, the range) and after
  a successful bulk action (call 19).

### The phone

The same screen at 390 px (`ph-table`):

- **Toolbar**, scrolling with the page: the Filter button (full width but for Select)
  and **Select**; the search field under them; the count and total under that. The
  right-edge controls keep out of the "+"'s column (DESIGN.md).
- **Days** as section heads: the date in `caps` ("TUE 2026-10-20") and the day's total,
  on a text-colour rule.
- **Rows**, at least 64 px: a 4 px project-colour bar at the left edge, a leading ⋯
  (44 px), start over end ("Running" in blue `caps` under the start of a running entry),
  then customer › project in semibold, activity · location · reference and the
  description in muted 12 px lines, and the duration at the right. An overlapping row
  has a red top edge and the line "Overlaps another entry" in red. A tap on the row opens
  the entry form as a sheet.
- **The row menu** is a sheet from the bottom (`ph-menu`) headed by the row it was
  opened from (customer › project; the date, start–end, activity), then Restart, Copy,
  Edit and Delete as 48 px rows. Restart is the phone's only per-row restart (call 17).
- **Select** turns every leading ⋯ into a tick box and each day head gains one; the
  toolbar is replaced by the bulk bar (`ph-select`): "5 selected" over the total, Edit…,
  Delete, Done. Edit… opens the bulk dialog as a sheet; Done leaves selecting and clears
  the ticks. The "+" hides while selecting.

### Limits and states

- At most 500 rows; when the range holds more, the first 500 (newest) show and a line
  says "Showing the newest 500 entries; narrow the filters." The count and total are
  the shown rows'.
- No entries: "No entries in this range." with Clear filters when filters are on; with
  a search, "No entries match “<text>”." with a clear-search link.
- A custom range with From after To, or an unreadable date, shows the message by the
  fields and no list, as round 1's does.

### Without JavaScript

The screen stays usable as plain pages. The filter is a `<details>` holding a GET form
with a Show button; the search submits on Enter. The PC table shows its tick boxes and
the bulk bar's Edit and Delete at all times, posting the ticked rows (Edit goes to the
bulk form as a page); the phone's Select is a link that reloads with tick boxes. The
row menu is a `<details>` with the same items as links and post buttons. Live search,
shift-click, `/`, the ticking total and the popovers' focus handling need JavaScript.

## The Calendar's filter

The Calendar's toolbar gains the same Filter button, with Customer › project, Activity
and Location (not the time range: the calendar has its own period and date picker) and
the same chips under the toolbar (call 12). The grid, the month and the phone's lists
show only matching entries, and every total in view counts only them; the toolbar's
total reads "Week 12:30 (filtered)" while a filter is on. The filters live in the
address and are carried by the toolbar's links (‹ › Today, the views, the date picker)
and kept across moves within the visit; they are not kept between visits. No search on
the Calendar (call 22).

## The core's search

`entries.list`'s `text` matches the activity name and the location name as well as the
reference, description, project name and customer name, with the same rule (literal,
NFC, lowercased in English). The MCP server's `list_entries` uses the same core call, so
an agent's search matches the same entries (vision principle 3). `docs/core.md` and
`docs/mcp.md` are updated.

## The reference each part follows

| Part | Follows | Departs from |
|------|---------|--------------|
| Newest first, grouped by day with the day's total in the head | Toggl's and Clockify's list (Views 6) | Kimai's flat list with no totals by default |
| Columns per surface, fixed, dropping by width | Kimai (Views 7) | Kimai's phone (date and duration only) and its column chooser |
| Project colour dot | Kimai's dot, the Project Ink Rule | — |
| Row click opens the form; row menu Restart, Copy, Edit, Delete on every row | Kimai (Editing 1, 2) | Kimai's actions vanishing from some rows; its confirm before delete |
| Restart ▶ on the row beside the menu (PC) | Clockify, item 12 | — |
| Tick boxes per row and per day; bulk actions at the top only once ticked | Kimai's and Toggl's tick boxes (Editing 5) | Kimai's footer, out of sight |
| Delete at once with undo | Google, Toggl, Clockify's undo (Editing 6) | Kimai's confirm; any trash |
| One filter control, applied as chosen, counted on its button | Kimai's panel folded (Filters 1) | Kimai's Search button and page size |
| Relative presets kept between visits | Kimai's presets (Moving 6) | — |
| One search across six fields, as you type | Google's live search (Filters 2) | Kimai's search without the reference |
| Overlap's red top edge | Kimai (Views 10) | — |
| Phone rows on two or three lines with what the entry was | — | Kimai's phone table (Phone against desktop 6) |
| No sorting by column, no weekly hours grid, no inline edit | — | Kimai's sortable heads, weekly hours (study §4), Toggl's inline edit (Editing 7) |

## Goals

- Find any entry of the month in a few seconds: by range, by customer › project,
  activity or location, or by any word of it.
- Read a month as days with their totals, and the shown set's total.
- Reorganise the month: change many entries' project, activity, location, reference or
  wording at once, or delete them, every action one undo.
- Act on one entry from its row: open it, restart it, copy it, delete it.
- Do all of it on the PC, and the same on the phone with fewer controls.
- Narrow the Calendar with the same filter.

## Non-goals

- Sorting by column; a column chooser; inline editing of cells; swipe gestures.
- Moving many entries' times at once (queued).
- Week rows or week totals in the table.
- Kimai's weekly hours grid (rejected by the study, §4).
- Search on the Calendar; remembering the Calendar's filter between visits.
- Pages or "show more"; exporting from the table (Copy-out's job).
- Redoing Copy-out's or Reports' filter bars (item 15); they keep round 1's shared
  filter component.

## Anti-goals

- Bulk actions out of sight (Kimai's footer), or a bulk change that acts on rows no
  longer shown.
- A table wider than the screen on the phone, or a phone row that does not say what
  the entry was.
- A filter that needs a Search button to apply, or a search that ignores the reference.
- A confirm dialog before a delete.
- Blue or red for anything but running, primary and wrong.

## Constraints

- SvelteKit, server-rendered; the screen works without JavaScript as pages
  (PRODUCT.md). Tailwind and shadcn-svelte (decision 2); item 11's tokens and shell
  (decision 9, DESIGN.md: the ruled table, the 44/36 px controls, the "+" column);
  item 12's entry form and project picker, opened in place; item 13's Calendar.
- Every write is one core call through `openCore(getDb(), user.id, 'ui')`, a bulk change
  one `core.batch`; no rule is enforced in the screen.
- WCAG 2.2 AA in both themes; 44 px targets on the phone; the table, the menus, the
  popover and the bulk dialog work by keyboard; tick state and the overlap mark are
  announced.
- English, 24-hour clock, ISO dates, Monday-first weeks; durations `h:mm`, exact,
  truncated to the minute.
- Times show in each entry's own zone; ranges are read as days in the request's zone.
- The e2e tests of round 1's Entries screen are rewritten for the new one; Copy-out and
  Reports keep theirs.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`: the 30 days before today, weekdays only,
nothing today; support entries with `T-` references and end clients, café evenings, an
entry past midnight and an overlapping pair a week back), signed in as the seeded user,
at 390 px and 1440 px, in light and in dark.

1. **Read the month (PC).** Open Entries from the sidebar: this month's entries, newest
   day first, each day headed with its total, the count and total in the toolbar. Find
   the overlapping pair (red top edges) and the entry past midnight ("+1"), counted in
   its start day's total.
2. **Presets are kept.** Open the filter, choose Last month: last month's days only, the
   button says "Last month". Go to Today and back to Entries: still Last month. Choose
   This month again.
3. **Search.** Type `printer`: only the printer entries, live. Replace it with a `T-`
   reference from a row: that entry. Replace it with `café`: the café evenings
   (a location). Clear the search.
4. **Filter.** Filter on CompX › CompY – Support and activity Support ticket: the chips
   show, the count and total change; remove one chip; Clear filters.
5. **One row (PC).** Click a row: its form opens over the table; change the description,
   save: back on the same table with the strip. From a row's ⋯: Copy, change the date
   to today, save: it heads the table. Restart a finished entry from its ▶: the timer
   bar runs it; stop it. Delete an entry from its ⋯: it is gone; Undo: it is back.
6. **Bulk edit (PC).** Tick a whole day by its head box and one row of another day
   (shift-click a run of two more): the bulk bar shows the count and total. Edit…: set
   Location to At the client and replace `Standup` with `Daily standup`; apply: the rows
   changed, the strip says "Done: Edit n entries." Undo: all back.
7. **Bulk delete (PC).** Tick two rows, Delete: gone at once; Undo: back.
8. **The phone.** Tap Entries in the bottom bar. Open the filter sheet, choose Last
   week (the count updates at once), Show. Search `VPN`. Tap a row's ⋯: the sheet names
   that row; Copy opens the form. Tap Select, tick two rows, Edit…: set Activity to
   Research, apply; Undo. Nothing is hidden under the "+".
9. **The Calendar's filter.** In Calendar (PC week, phone day), filter on Myself ›
   time-keep: only its blocks, the totals count only them, the chip shows; move a week
   back: still filtered; Clear filters.
10. **Keys and look.** On the PC `/` focuses the search; Tab reaches every row, tick
    box and menu; the menu opens and closes by keyboard. Both themes, both widths: one
    blue primary per form, red only on overlaps, Delete and refusals, no sideways
    scroll.

## Builder's latitude

The plan decides, within the above: the address's parameter names, the cookie's name
and lifetime, how live search is debounced and navigated (keeping focus and scroll),
the component structure and what is shared with the Calendar, whether the bulk form is
a route or an action, how overlaps are computed (item 13's `overlapping` over the
range, or a core read), the exact widths and breakpoints, and the phone toolbar's exact
arrangement. Server logic is unit-tested; the interactions are covered by browser
tests.

## Calls made in the operator's place

The stand-in's answers (`docs/questions.md` holds what it queued). Rounds 1 and 2 of
the brainstorm are in `.autopilot/agents/14-standin-r1.md` and `14-standin-r2.md`.

1. **The screen stays Entries, at `/entries`.** Source: operator's voice 2026-10-19 (no
   name given); the shell's existing labels. Confidence: ungrounded, queued.
2. **The chosen preset is kept per device, in a cookie.** Source: operator's voice
   (phone for quick access, PC for month-end tables); questions for items 11 and 13 (no
   stored user settings the vision does not list); roadmap item 14 ("kept between
   visits"). Confidence: inferred.
3. **Presets: today, yesterday, this week, last week, this month, last month, and a
   custom range; a first visit opens on this month.** Source: reference study, Moving 6
   and Filters (Kimai's range picker); the exit ("the month's entries"); round 1's
   default. Confidence: inferred.
4. **Every entry in the range, grouped by day, capped at 500 with a message.** Source:
   the exit; vision ("PC: … month-end"); round 1's cap. Confidence: inferred.
5. **No column sorting; always newest first, grouped by day.** Source: roadmap item 14.
   Confidence: grounded.
6. **Fixed columns per surface; no chooser.** Source: roadmap item 14 ("the columns that
   matter on each surface"); study Views 7; vision (columns chosen at output, in
   Copy-out). Confidence: inferred.
7. **Bulk edit changes customer › project, activity, location, reference (set or clear)
   and find-and-replace in the description; no times.** Source: operator's voice (the
   MCP for bulk reorganising); round 1's bulk set. Confidence: inferred for the fields;
   ungrounded for times, queued.
8. **Bulk delete at once, with Undo.** Source: vision principle 2; study Editing 6; item
   12's delete. Confidence: inferred.
9. **A row's Delete at once, with Undo.** Source: item 12; study Editing 6. Confidence:
   inferred.
10. **No inline editing; a row opens the form.** Source: roadmap item 14; study Editing
    7; Kimai. Confidence: inferred.
11. **No swipe actions on the phone.** Source: roadmap item 14's row menu; study Phone
    against desktop 8; the Calendar's swipe. Confidence: inferred.
12. **Item 14 puts the filter on the Calendar too.** Source: item 13's spec (non-goals:
    "item 14 builds the one filter control; the calendar takes it then"); study Filters
    3. Confidence: inferred.
13. **The core's search widens to activity and location, for the agent too.** Source:
    vision principle 3 ("neither can do what the other cannot"). Confidence: grounded.
14. **The phone's row menu is a ⋯ leading each row.** Source: roadmap item 14 (a row
    menu); study Editing 2 (on every row); a long press rejected as hidden. Confidence:
    inferred.
15. **On the phone, a Select button switches the rows to tick boxes.** Source: study
    Phone against desktop 8; the exit (reorganising on the phone). Confidence: inferred.
16. **On the PC the bulk bar takes the toolbar's place, the chips staying under it.**
    Source: study Editing 5 ("at the top, in view, only once something is ticked").
    Confidence: inferred.
17. **Item 12's row ▶ Restart stays on PC rows beside ⋯; on the phone Restart is in the
    ⋯ sheet.** Source: item 12's done note (the row ▶, gated); study (Clockify's play
    and menu); Phone against desktop 8. Confidence: inferred.
18. **While the bulk bar is up, the filter chips and the search stay in view.** Source:
    study Editing 5. Confidence: inferred.
19. **Ticks clear when the shown set changes.** Source: study Editing 5; item 5b's
    deferred minor (ticks drifting from what is acted on). Confidence: inferred.
20. **The phone's filter sheet applies each choice at once;** its "Show n entries"
    closes it, and any other close keeps the choices. Source: study Filters 1 ("Filters
    apply as they change, not on a Search button"). Confidence: grounded.
21. **Only a preset is kept; a custom range lasts for the visit.** Source: roadmap item
    14 ("relative date presets that are kept"); study Moving 6. Confidence: inferred.
22. **No search on the Calendar; the filter only.** Source: study Filters 3. Confidence:
    inferred.
23. **No week rows in the table.** Source: roadmap item 14 ("grouped by day with daily
    totals"); study Totals 2; the This week preset. Confidence: inferred.
24. **"Running" on both surfaces, never "now".** Source: DESIGN.md (the ruled table:
    "Running" in blue `caps`). Confidence: inferred.
25. **The phone's menu sheet names the row it was opened from.** Source: the stand-in's
    review of `ph-menu`. Confidence: inferred.

The builder's:

26. **Days are the entry's start date in its own start zone, and times show in the
    entry's own zone,** as round 1's list and item 12's form do; the range is read in the
    request's zone. An entry belongs to the day it started (vision).
27. **The day head shows the weekday short and the ISO date** ("Tue 2026-10-20"): ISO
    dates are the vision's format, the weekday makes a month scannable.
28. **Totals are exact, truncated to the minute,** as everywhere else; a running entry
    counts to now and ticks.
29. **Archived reference data is offered in the filter, marked,** so earlier months are
    found as round 1's filter allowed.
30. **The header keeps "Entries"; the Filter button names the range.** This settles
    item 11's deferred raise (a view's header names the span) for this screen, as item
    13 settled it for the Calendar.
31. **Shift-click ticks a run of rows** on the PC: month-end selections are runs, and it
    is the convention of mail and file lists. Without it every row is one click.
32. **An overlap is judged against all the user's entries,** not only the filtered set:
    it is the core's rule, and a row should not lose its mark because its partner is
    filtered out.
33. **Location and Reference drop below 1280 px** rather than the table scrolling
    sideways; they stay in the row's tooltip and form.
34. **The calendar's totals count only filtered entries while a filter is on, marked
    "(filtered)",** so a total never disagrees with the blocks shown.
35. **Copy-out and Reports keep round 1's filter bar** until item 15; the new filter is
    a new component, shared by Entries and the Calendar.
36. **The cap's message says "the newest 500",** since the list is newest first.

From the builder check, settled by the builder:

37. **The preset cookie is written whenever an address names a preset,** the GET form
    without JavaScript included; a bare `/entries` reads it, and the table's own links
    always carry the range, so reload and Back show the same table.
38. **The Calendar's overlap marks stay judged against all entries while it is
    filtered,** as call 32 has it for the table.
39. **Without JavaScript the day head's tick box is hidden;** the row boxes and the head
    box's "Select all" link (round 1's) do the work.
40. **A custom range with one side blank is open on that side,** as round 1 allowed.
41. **The presets' date hints are short ISO forms,** not the mockup's "19–25 Oct": ISO
    dates are the vision's format.

Approved by the operator stand-in, revision 2, 2026-10-20.
