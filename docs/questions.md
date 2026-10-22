# Questions for the operator

What the operator stand-in (`.claude/agents/operator-stand-in.md`) could not ground in
the operator's words during an autopilot run. For each, the stand-in made the
conservative call (the smaller change, the more familiar pattern, closer to Kimai and
the references) and the work went on; the entry records it so the operator can
overrule it.

Newest first. Each entry:

```
## <date> — <unit>

- Question: <what was asked>
- Call made: <the answer the stand-in gave>
- If answered differently: <what would change in the built work>
```

The operator answers whenever they like, here (under the entry) or in conversation.
An answer is added to [the operator's voice](operator-voice.md) in their words, and if
it changes built work, it becomes a roadmap item.

## 2026-10-21 — 15d

- Question: On the PC, how wide should Account, Users and Backup be: about half the
  content measure (48 rem, left-aligned), or the full 72 rem measure that Entries,
  History and Setup use?
- Call made: About 48 rem. It is the smaller change (round 1's three screens are
  42 rem wide), a password field or a three-column list stretched to 72 rem reads
  worse, and the left edge still lines up with every other screen. Nothing on record
  says how you want it.
- If answered differently: the three screens' sections take the full 72 rem measure,
  the fields keeping a narrower cap inside their panel, and the mockups and tests
  change with it.

## 2026-10-21 — 15d

- Question: Account has two parts, Change password and Agent access. Should they stay
  one page with a section each, or become two tabs (Password | Agent access), as
  Kimai's profile pages have?
- Call made: One page with two sections, as now. It is the smaller change, both parts
  are short, and Setup was kept as one screen with its lists in 15a for the same
  reason. Nothing on record says how you want it.
- If answered differently: Account gets Password | Agent access tabs (kept in the
  address), one part shown at a time; the navigation still has one Account item.

## 2026-10-21 — 15d

- Question: When do you open Users and Backup, how often, and on which device?
- Call made: Rarely, and on the PC: Users when a user is made or a password reset
  (one person uses the app; vision, Users), Backup before a risky change or a move.
  Laid out for the PC first and kept fully usable on the phone (item 15's exit); not
  a daily path, so they stay in More on the phone and at the sidebar's foot on the PC.
  No frequency is on record.
- If answered differently: if you take backups often, or from the phone, Download
  backup moves up (for example into More directly), or a scheduled backup becomes a
  new item (round 1 left scheduled backups out).

## 2026-10-21 — 15d

- Question: When do you open Account (change your password, make or revoke an agent's
  token), how often, and on which device?
- Call made: Rarely, and mostly on the PC: a token is made when an agent is set up
  (the Kimai import, month-end tidying; vision, Agents), and the PC is where the
  organising and month-end work happens (2026-10-18 discovery). Laid out for the PC
  first and kept fully usable on the phone. No frequency is on record.
- If answered differently: if you make tokens or change the password from the phone,
  the phone layout of Account is weighted first (the token shown once, with a Copy
  button that fits the phone's width).

## 2026-10-21 — 15c

- Question: On Copy-out, when the filter matches no rows ("No entries match."), what
  do Copy and Download CSV do: both off, Copy off with the CSV live (header only), or
  both live (an empty copy, "Copied 0 rows.")?
- Call made: Both off, as the no-column state already does on this screen (50 %,
  still focusable, saying why: no entries match). It reuses the screen's own off
  pattern, and a live blue "Copy 0 rows" does nothing useful. Nothing on record
  covers it. The CSV route itself still answers a header-only file if opened by
  address; only the buttons are off.
- If answered differently: Download CSV (or both) stay live on no match; Copy writes
  nothing and says "Copied 0 rows.", the CSV holds only the header row, and the
  browser tests for the empty state change with it.

## 2026-10-21 — 15c

- Question: On Reports, should a weekday with no time in the range show as a row
  reading "—", or be left out of the days?
- Call made: Left out, as round 1 does. It is the smaller change. Nothing on record
  says how you look for a missing day. A "—" row would also mark today, or a day not
  yet worked, as empty.
- If answered differently: every weekday in the range (up to today) gets a row, with
  "—" where no time was logged, on the PC and the phone; weekends stay out unless
  they hold time.

## 2026-10-21 — 15c

- Question: Should Reports show each total's share of the range (CompX 72 %) beside
  its duration, or durations only?
- Call made: Durations only. The vision asks for totals per day, week, customer and
  project. Nothing on record asks for shares, and leaving them out is the smaller
  change.
- If answered differently: the customer and project rows (and possibly weeks) gain a
  share column, with the share of the range's total.

## 2026-10-21 — 15c

- Question: Should Reports show four separate lists (days, weeks, customers,
  projects), or two nested ones (customers with their projects under them, weeks with
  their days under them)?
- Call made: Four separate lists, as round 1 has: side by side on the PC, stacked on
  the phone. It is the smaller change. Nothing on record says how you read the totals.
- If answered differently: Reports becomes two lists, customer › project and week ›
  day, each parent row carrying its subtotal.

## 2026-10-21 — 15c

- Question: Should Reports have bars or a chart beside the numbers, or numbers only?
- Call made: Numbers only, as round 1 built it. The study rejects Kimai's dashboard
  and its bar chart as a screen (Views 9, Totals 3). Nothing on record asks for a
  chart.
- If answered differently: Reports' rows gain a bar scaled to the largest total in
  their table, or a chart (for example days as columns) above the tables.

## 2026-10-21 — 15c

- Question: Should a total on Reports lead to its entries (a customer's total opening
  Entries filtered to that customer and range), or stay read-only?
- Call made: Read-only, as round 1 built it. It is the smaller change, and nothing on
  record asks for the link.
- If answered differently: each row on Reports links to Entries with the range and
  the scope filled in (a day or week as a custom range, a customer or project as the
  scope).

## 2026-10-21 — 15c

- Question: Should Reports show the four totals (days, weeks, customers, projects) all
  at once, or one at a time with a switch?
- Call made: All four at once, as round 1 does: on the PC side by side, on the phone
  stacked. It is the smaller change. Nothing on record says how you read them.
- If answered differently: Reports gets a Days | Weeks | Customers | Projects switch
  (kept in the address) and shows one table at a time.

## 2026-10-21 — 15c

- Question: On Copy-out, should the ticked columns and the output options (round to 5
  minutes, split at midnight, h:mm or decimal) be kept between visits, and should you
  be able to change the columns' order?
- Call made: Kept per device, as Entries keeps its range preset (item 14); the order
  stays fixed (Date, Start, End, Duration, Customer, Project, Activity, Location,
  Reference, Description), as round 1. Your sheets are custom and differ (2026-10-18),
  but nothing says their column order differs from that order or that you paste
  into more than one sheet layout a month.
- If answered differently: the choice lasts only for the visit (in the address), or
  several named column sets are saved; the columns gain drag or move-up/down
  ordering, kept with the set.

## 2026-10-21 — 15c

- Question: Copy-out and Reports take Entries' Filter control. Should their range
  preset be shared with Entries (one kept preset for all three), or kept per screen?
- Call made: Kept per screen, Copy-out and Reports sharing one between them, so
  choosing Last month for the month-end output does not move Entries off This month.
  Nothing on record covers it.
- If answered differently: all three screens (and the Calendar's filter, if wanted)
  share one kept preset and scope.

## 2026-10-21 — 15b

- Question: Where should History's paging go: Newer / Older buttons in the toolbar
  over the list, links at the foot of the list (as round 1 has), or both?
- Call made: Both. The toolbar holds the page's count with Newer / Older, and the foot
  keeps round 1's links, so after reading 50 rows you go on without scrolling back up.
  Nothing on record says where you want them; keeping the foot link removes nothing
  that exists.
- If answered differently: one of the two goes (the toolbar's buttons, or the foot's
  links), and the browser tests that use it change.

## 2026-10-21 — 15b

- Question: On History, how should a changed field's old value look in "Description:
  old → new": muted and struck through, plain muted text, or plain text?
- Call made: Plain muted text, not struck through. The arrow already says which is
  old; a strike makes the old wording harder to read, and reading what an agent
  rewrote is why the line is there. Nothing on record says how you want it.
- If answered differently: the old value is struck through (as in the 15b mockups), or
  drawn in the normal text colour; DESIGN.md's change-line rule follows.

## 2026-10-21 — 15b

- Question: Should a change on History open the record it touched (for example the
  entry, in its form)?
- Call made: No, as in round 1. History shows what changed and undoes it; the record
  is reached from Calendar, Entries or Setup. A record a batch touched may since be
  deleted, and nothing on record asks for the link. It is the smaller change.
- If answered differently: a change to an entry that still exists gets an "Open"
  link that opens item 12's form in place over History (and a template's or a
  customer's its own form or Setup row); deleted records show no link.

## 2026-10-21 — 15b

- Question: How should a changed field read on History: one line "Description: old →
  new", a before/after pair of columns, or something else?
- Call made: One line per field, "Field: old → new", as round 1 has. It is the smaller
  change and reads at phone width; nothing on record says how you want it shown.
- If answered differently: the opened changes become a two-column Before / After
  table on the PC (stacked on the phone), or whichever form you name.

## 2026-10-21 — 15b

- Question: Should History's list be narrowed (by who made the change, user, agent or
  system; by date range; by what it touched), or stay one list of every batch, newest
  first, paged?
- Call made: One list, newest first, paged, under a heading per day, as round 1 has.
  It is the smaller change; nothing on record asks for a filter, and an agent's batch
  is already marked by its chip.
- If answered differently: History gains Entries' Filter control (who made it, a date
  range, what kind of record), kept in the address, and the core's `history.list`
  takes the matching inputs (for the agent too).

## 2026-10-20 — 15a

- Question: In Setup's "Archived" filter, how does an active customer with archived
  projects show: as a normal heading over its archived projects, or not as a row of
  its own, with its name over those projects in muted text?
- Call made: Not as a row of its own. Its archived projects are listed under the
  customer's name in muted text, with no ⋯ menu on it. The Archived view then holds
  only archived things, the way Kimai's "Visible" filter lists only matching rows, and
  it offers no actions on an active customer. Nothing on record covers it.
- If answered differently: the Archived view shows the active customer as a normal,
  unmuted heading with its own ⋯ menu (Rename, Add project, Archive) above its
  archived projects, as the All view does.

## 2026-10-20 — 15a

- Question: How is Setup laid out: one screen with the three lists (customers ›
  projects, activities, locations), a screen per kind as Kimai has, or one screen with
  a tab per kind?
- Call made: One Setup screen with the three lists, as now, each list redrawn in
  Kimai's list style (colour dot, ⋯ row menu, Create). It is the smaller change, the
  roadmap names Setup as one screen, and nothing on record says you want the kinds
  split. The sidebar and More keep one Setup item.
- If answered differently: Setup becomes separate screens (or tabs) for customers and
  projects, activities and locations, each with its own URL; the sidebar or More gains
  an item per kind, and the docs and tests follow.

## 2026-10-20 — 15a

- Question: In what order are templates offered in the timer bar's Start list, on
  Today and in the form's "Fill from": by name, in an order you set, or most used
  first?
- Call made: By name, as now. It is the smaller change; an order you set is a stored
  field (a migration, the core, history, the MCP schemas), and "most used" is a
  recents list in another form, which your discovery words replace with templates.
- If answered differently: templates gain a position you set on the Templates screen
  (drag or move up and down), or are sorted by how often they were used; every list
  of templates follows that order.

## 2026-10-20 — 15a

- Question: On the PC, is Today a screen you use, and what should the PC open on:
  Today, the calendar's week, or Entries?
- Call made: Today stays on the PC as on the phone, in one column, and the PC still
  opens on it. It is the smaller change. Your words put quick capture on the phone and
  dense work on the PC, but nothing says where the PC should land.
- If answered differently: the PC opens on the calendar's week or on Entries, and
  Today is laid out for the phone only (or gets a two-column PC layout).

## 2026-10-20 — 15

- Question: "Templates as part of favourites" (item 15): should they stay one thing
  called Templates, become one thing called Favourites, or stay templates with some
  marked as favourites and shown first?
- Call made: One thing, still called Templates. The vision and your discovery words
  call them templates and have them replace recents; the reference study reads
  templates and favourites as one thing (Recents, favourites and templates, 1).
  Renaming them, or adding a favourite mark, is not on record, and keeping the name is
  the smaller change.
- If answered differently: the screen, the timer bar's Start list, the entry form's
  "Fill from" and the docs are renamed to Favourites; or templates gain a favourite
  flag (a migration, the core, history, the MCP schemas) and the favourites are listed
  first in the Start list and Fill from.

## 2026-10-20 — 15

- Question: Where should templates be made and changed: on their own screen, inside
  Setup, only from an entry ("Save as template"), or a mix?
- Call made: A mix, keeping what exists: "Save as template" from an entry (vision,
  Templates), and the Templates screen (`/templates`) to make, change and delete them,
  redone in the new look and reached from More on the phone and the sidebar on the PC.
  Nothing on record says templates belong inside Setup; keeping their own screen is
  the smaller change.
- If answered differently: Templates becomes a section of Setup (the sidebar and More
  lose their own item), or the screen goes and templates are only made from entries
  and changed through the entry form.

## 2026-10-20 — 15

- Question: What do you do in Setup (customers › projects, activities, locations), on
  which device, and how often?
- Call made: Only the split on record is used: Setup is organising, the PC's tedious
  work (2026-10-18 discovery), so it is laid out for the PC first and kept fully
  usable on the phone (item 15's exit). The work is adding a customer or project when
  new work starts, renaming, and archiving finished ones (vision, Customers and
  projects). No frequency is assumed; it is not made a daily path, and the phone's
  bottom bar does not hold it.
- If answered differently: if you add projects often, or on the phone in the middle of
  logging, Setup moves up the phone's navigation and the entry form's project picker
  may gain "new customer › project" in place.

## 2026-10-20 — 14

- Question: Should the table's bulk edit also move the selected entries' times
  (shift them by some minutes or days, or set the same start or end time), beside
  changing customer › project, activity, location, reference and find-and-replace in
  the description?
- Call made: No time changes in bulk. The bulk edit keeps round 1's set (customer ›
  project, activity, location, reference, find-and-replace in the description). Nothing
  on record says you move many entries' times at once from the screen; a single
  entry's time is moved in its form or by drag on the PC calendar, and bulk
  reorganising by agent goes through the MCP server.
- If answered differently: item 14's (or a later item's) bulk edit gains a shift by
  minutes or days and/or a same start or end time, applied as one batch with one undo;
  the change form and its tests grow with it.

## 2026-10-20 — 14

- Question: What should the table screen be called: "Entries" (as now), "Timesheet",
  or Kimai's "My times"?
- Call made: "Entries", at `/entries`, as now. It is the smaller change: the sidebar,
  the phone's bottom bar and the docs already use it, and you never named the screen
  (2026-10-19: "anothr view that is more like a table").
- If answered differently: the screen's title, the sidebar and bottom-bar labels, and
  the docs are renamed; the URL may stay.

## 2026-10-20 — 13

- Question: Should the calendar remember the last view you used (day, week or month)
  and open on it next time, as Google Calendar does, or always open on the same one?
- Call made: Always open on the same view, on today: the day view on the phone, the
  week view on the PC. Within a visit the URL keeps the view and the date, as Kimai's
  does, so reload and Back return to the same place. Nothing on record says you want
  it remembered, and remembering it is a stored user setting the vision does not list
  (the same call as light and dark in item 11).
- If answered differently: item 13's calendar stores the last view per user (or per
  device) and opens on it; Account (item 15) may gain the default view as a setting.

## 2026-10-20 — 12

- Question: On the PC, the header's "+ New entry" is a filled blue button on every
  screen. When the start list is open (its Start is also filled blue), or a screen has
  its own primary button, two blue fills show at once. Should one of them become an
  outline button, and which?
- Call made: Leave both filled. It is the smaller change, and DESIGN.md's rule is one
  blue primary per form, which each still keeps (the critique calls it "not a per-form
  breach"). Nothing on record says how you feel about two blue buttons on one screen.
- If answered differently: either the start list's Start becomes an outline button
  (Enter still starts the timer), or "+ New entry" becomes an outline button in the
  header on every screen; DESIGN.md's button rules say which.

## 2026-10-20 — 12

- Question: The strokes around fields and outline buttons (item 11's `input` token,
  #c8cbd0 light, #43464b dark) are 1.6–1.8:1 against their surface, below the 3:1 that
  WCAG asks for. An empty field is drawn by that stroke alone. Should the strokes be
  darker (about #868c95 light, #70757d dark)?
- Call made: Leave the token as it is. It is the smaller change, and it is the light,
  thin field outline of the Kimai skin chosen in item 11; empty fields read clearly in
  the critique's screenshots. Nothing on record speaks to contrast.
- If answered differently: `--input` in `src/routes/layout.css` (light and dark) and
  DESIGN.md's `input` and `input-dark` are raised. Every field, outline button,
  unticked checkbox and table-head rule on every screen gets a darker edge.

## 2026-10-20 — 12

- Question: In a duration field, how should a bare number with no separator or unit
  read (`5`, `90`, `330`): as minutes, as Kimai, Toggl and Clockify read it (`90` is
  1:30, `330` is 5:30), or as hours (`5` is 5:00, `330` is 3:30)?
- Call made: Minutes, as Kimai reads it. Nothing on record says how you type a
  duration, and you used Kimai for years, so its reading is the familiar one. Every
  form with an hours mark still reads as hours (`5:30`, `5.5`, `5h30`, `5h`), and the
  linked end shows the result before saving, with undo after.
- If answered differently: item 12's time-input table reads a bare one- or two-digit
  number as hours and three or four digits as hours and minutes; the form's hint and
  its tests change with it.

## 2026-10-20 — 12

- Question: How does a normal working day's logging go: when do you open the app, on
  the phone or the PC, and how much is logged as it happens (timers, templates) against
  afterwards (past intervals typed in), and when do you correct?
- Call made: Only the split on record is used: the phone for quick capture through the
  day (start and stop timers, log from a template, fix the day), the PC for logging
  and correcting afterwards and for month-end (2026-10-18 discovery; vision, "Two
  surfaces"; roadmap item 16's tasks). No times of day or proportions are assumed, so
  item 12 makes both paths equally short on both surfaces.
- If answered differently: item 12 (and 13–14) weight whichever path you use most: for
  example the phone's start list first if you mostly run timers, or the past-interval
  form and the calendar's tap-to-create first if you mostly log afterwards.

## 2026-10-20 — 11

- Question: Where should a project's colour come from: worked out from the project
  with nothing stored (two projects may share one once there are more projects than
  colours), stored on the project automatically, or picked by you per customer and
  project in Setup, as Kimai lets you?
- Call made: Worked out from the project, nothing stored. It is the smallest change:
  no new field, migration, history or MCP change, and the back end stays as it is.
  Colour is presentation, applied on the way out (vision, principle 4). Nothing on
  record says you want to pick colours, and the vision gives projects no colour field.
- If answered differently: a later item adds a colour to projects (a migration, the
  core's write path and history, the MCP schemas, backup), assigned on creation or
  picked in Setup, and every screen reads the stored colour instead.

## 2026-10-20 — 11

- Question: Option A (Kimai's structure in a new skin) was chosen as the direction. Its
  skin had a green-grey ground, a bottle-green sidebar, and a double rule under every
  total. Should those stay, or should the skin keep to Kimai's own colours: a neutral
  light ground, a near-black sidebar and plain bold totals?
- Call made: Keep to Kimai. A neutral near-white ground (dark: neutral near-black), a
  neutral near-black sidebar as in Kimai and option C, and totals in plain bold with no
  double rule. Nothing on record asks for a green tint or a ledger-style rule, and
  neither Kimai nor the calendar apps have them. Everything else in A stays: the
  layout, one blue for the running timer and the primary action, red only for
  overlaps, project-colour blocks with a pale fill and a strong edge, Public Sans.
- If answered differently: item 11's tokens bring back the green ground and sidebar,
  the double rule under totals, or both, and items 12–15 inherit them.

## 2026-10-20 — 11

- Question: Light and dark: should the app only follow the device's setting, or also
  offer a light, dark or automatic choice in the app, as Kimai's skins do?
- Call made: Follow the device only, as round 1 does. It is the smaller change, and an
  in-app choice is a stored user setting the vision does not list. Both themes are
  still designed and checked.
- If answered differently: item 11's shell (or item 15's Account screen) gains a
  light, dark or automatic choice, stored per user, that wins over the device.

## 2026-10-20 — 11

- Question: Beyond "nothing like kimai", "horrendous" and "UX seems awful"
  (2026-10-19), what would make a new look feel wrong to you?
- Call made: Nothing more on record. The direction is judged against your words: close
  to Kimai's structure, the calendar apps you named (Google, Samsung) as inspiration,
  and no themed concept like round 1's punch card. No other dislikes are assumed.
- If answered differently: the direction chosen in item 11 is checked against what you
  name, and items 12–15 follow any change to it.

## 2026-10-20 — 10

- Question: Roadmap item 12 has the timer bar start "from recents, favourites and
  templates". The discovery call (2026-10-18) has user-saved templates replace
  "recent" and "repeat last entry". Should the timer bar offer recent entries (as
  Kimai's ↻ does) beside templates, or only templates and the restart of a past entry?
- Call made: Your discovery words stand over the roadmap's wording: templates replace
  recents, and restart of a past entry stays (reference study, Recents, favourites and
  templates, 2 and 3). The timer bar has no automatic recents list.
- If answered differently: item 12's timer bar gains a short list of recent customer ›
  project and activity pairs to start in one tap, beside templates, and the study's
  Recents 2 becomes follow or adapt.

## 2026-10-20 — 10

- Question: When typing a description, should time-keep suggest your earlier entries
  and copy their customer, project, activity and location when you pick one, as
  Toggl, Clockify, Samsung Calendar and Timing do, alongside templates?
- Call made: No. The discovery call (2026-10-18) has templates replace "recent" and
  "repeat last entry", and autocomplete is a recents list in another form. The
  reference study rejects it for now (Recents, favourites and templates, 4).
- If answered differently: item 12's entry form and timer bar gain description
  suggestions drawn from past entries, beside templates.

## 2026-10-20 — 10

- Question: The fast-capture principle says a new entry is "a template tap and a
  typed description, not a form". Every reference logs a past interval through a
  form, at best a short one opened by a drag on the calendar. Is a short form that
  asks only for what the template left blank what you meant?
- Call made: Yes. The study reads the principle that way (section 6), since item 12
  requires an entry form; the vision is not changed.
- If answered differently: if a past entry should need no form at all, items 12 and
  13 would find another way (for example a template dropped on the calendar saving at
  once), and the vision's principle would be reworded.

## 2026-10-20 — 10

- Question: The vision gives the phone "fix today". The calendar views and the table
  are on the phone too, and the usability check asks for "correcting yesterday" there.
  Should the phone's line read "fix recent days" (or any day)?
- Call made: The vision is left as it is; the phone reaches past entries through the
  views (reference study, section 6, and Phone against desktop, 4), and items 12–14
  build that.
- If answered differently: if the phone should stay on today only, items 13 and 14
  would leave past days to the PC, and the usability check's phone tasks would change.

## 2026-10-19 — 10

- Question: Which Kimai setup did you use: which time-tracking mode (default, duration
  only, punch-in or another), which version, and on the phone the web page or a
  third-party app?
- Call made: Nothing on record. The study takes the public demo's default setup as
  standing for your Kimai, in the browser at phone and PC widths, and notes where
  another mode or a newer version would change a finding. Third-party phone apps are
  not studied. The default mode fits the entry model (an entry is always an interval;
  duration-only was rejected, 2026-10-18 discovery).
- If answered differently: the study's findings on entry forms and the phone would
  be redone against your mode and version (or the app you used), and items 12–14
  would follow those instead.

## 2026-10-19 — 10

- Question: What do you think of Kimai's weekly hours grid (hours per project per day
  of the week, typed into cells)? Did you use it?
- Call made: No opinion of yours on record. The study decides whether item 14 builds
  it (roadmap item 14). It has to weigh the grid against the entry model: an entry is
  always an interval, and duration-only entries were rejected (2026-10-18 discovery).
  A grid cell holds a number of hours, not a start, a place or a description. Unless
  the walk-through of your real entry shapes shows a clear need, the verdict is reject
  or defer, and item 14 does not build it.
- If answered differently: if you relied on the grid, item 14 builds it (or an adapted
  version), and the study's verdict on it is changed to follow or adapt.
- Verdict (2026-10-20, [the reference study](reference-study.md), section 4): reject.
  A Kimai grid cell saves a duration with an invented start (the default start-time),
  and none of your four entry shapes fits a cell. Item 14 does not build it.

## 2026-10-19 — 10

- Question: In Kimai, which views and behaviours did you rely on day to day, beyond the
  calendar views and the table you named on 2026-10-19?
- Call made: The record names the calendar-like structure, the day, week and month
  views and the table view as "quite important". It names invoicing, no history or
  undo, fiddly entry of new and small things, and the weak phone as what annoyed you.
  Nothing more specific is on record. The study covers all of Kimai's timesheet,
  calendar and timer behaviours evenly and gives none of them priority beyond those.
- If answered differently: the study's verdicts and items 12–14 would put first
  whichever Kimai behaviours you name, and could drop ones you never used.
