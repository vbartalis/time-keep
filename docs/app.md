# The app

A SvelteKit 3.1 server (adapter-node 6) over SQLite through Drizzle, TypeScript
throughout (decision 1). The UI is Tailwind and shadcn-svelte (decision 2), in
Kimai's structure and skin (decision 9); [DESIGN.md](../DESIGN.md) is the visual system
and `PRODUCT.md` the product record it serves. The app owns every write to the
database.

Imports use `#lib` (the `imports` map in `package.json`, `src/lib/*`), not `$lib`.
Hook types come from `@sveltejs/kit/hooks`.

## Layout

| Path | Responsibility |
|------|----------------|
| `src/hooks.server.ts` | `init`: run migrations, ensure the first admin. `handle`: resolve the session cookie into `locals.user` and `locals.session`, renew or clear the cookie. |
| `src/lib/server/db/` | `index.ts` opens SQLite (WAL, foreign keys on) and holds the single `getDb()` instance; `schema.ts` is the Drizzle schema; `migrate.ts` applies `drizzle/` at startup. |
| `src/lib/server/auth/credentials.ts` | Username and password rules, argon2id hashing and verification. |
| `src/lib/server/auth/sessions.ts` | Create, validate, renew and invalidate sessions; the session cookie. |
| `src/lib/server/auth/throttle.ts` | In-memory sign-in throttle. |
| `src/lib/server/auth/tokens.ts` | Agents' access tokens: create (shown once, only the hash stored), list, revoke, and `authenticateToken` for a `Bearer` header (decision 6). |
| `src/lib/server/auth/bootstrap.ts` | Creates the first admin from the environment. |
| `src/lib/server/users.ts` | User operations: create, list, authenticate, set password, change own password, disable and enable. Returns `Result` values instead of throwing for expected failures. |
| `src/lib/server/backup.ts` | Backup and restore of the whole database (decision 7): `writeBackup` (a vacuumed copy without sessions and access tokens), `restoreBackup` (check, migrate, keep the before-restore copy, copy every row in one transaction), `beforeRestoreInfo`. |
| `src/lib/server/guards.ts` | `requireUser` (redirect to `/login`) and `requireAdmin` (403). |
| `src/lib/server/core/` | The only way to read and write the time data: batches, recorded changes, undo, history, reference data. Import only `core/index.ts`. See [core.md](core.md) and decision 4. |
| `src/lib/server/id.ts` | Random base32 ids. |
| `src/lib/server/mcp/` | The MCP server, a client of the core as actor `agent`: `http.ts` (the Origin check, the bearer token, one stateless exchange), `server.ts` (the 13 tools), `change.ts` (the `change` tool's operations and refs as one batch), `rows.ts` (rows as the agent reads them). See [mcp.md](mcp.md). |
| `src/routes/login`, `logout` | Sign in and out. `/login?restored=1` shows "Restored. Sign in with the backup's passwords." above the form, after a restore. |
| `src/routes/(app)/admin/backup` | The Backup screen (`+page.svelte`, `+page.server.ts`) and its download route (`download/+server.ts`), admin only. |
| `src/routes/mcp` | `POST /mcp`, the MCP endpoint, outside the signed-in screens (see [mcp.md](mcp.md)). |
| `src/routes/(app)/` | Signed-in screens: Today (`/`), `calendar`, `entries` and the entry form (`entries/new`, `entries/[id]`), `copy-out` and its CSV route (`copy-out/csv`), `reports`, `account`, `admin/users`, `admin/backup`, `setup`, `templates`, `templates/new`, `templates/[id]`, and `history` (see Screens). The layout requires a user and draws the shell (see Shell). |
| `src/lib/server/screens/` | Server logic behind the screens, unit-tested: zone resolution (`zone.ts`), today's range and the `HH:mm` / `YYYY-MM-DD` formats (`today.ts`), form input for the core (`actions.ts`; `edit.ts`: `withCurrent`, `postedValues`), the entry form's values, pickers, input and refusals (`entry-form.ts`: `valuesFromEntry`, `newValues`, `copyValues`, `templateValues`, `formPickers`, `createInput`, `updateInput`, `previousEnd`, `newEntryValues`, `coreFailure`), the bar's start and restart input (`timer-actions.ts`: `startFromTemplateInput`, `restartInput`), the flash cookie and undo lookup (`flash.ts`), the safe return path for forms (`back.ts`), the Setup tree (`setup.ts`), the template form's input and pickers (`templates.ts`), the Entries search and bulk change (`entries.ts`: `readSearch`, `searchInput`, `searchFilters`, `searchPath`, `readBulk`, `selection`, `bulkUpdates`, `editLabel`, `deleteLabel`, `runBulk`), the copy-out's rows and query (`copy-out.ts`: `outputRows`, `readCopyOut`, `copyOutQuery`, `monthRange`, `csvName`, `sheetFor`, and the pieces and options Reports shares: `outputPieces`, `readOptions`, `optionsQuery`), the reports' totals (`reports.ts`: `isoWeek`, `reportTotals`, `readReport`, `reportFor`, `reportQuery`), the History screen's words and forms (`history.ts`: `namesFrom`, `describeChange`, `batchState`, `dayHeading`, `readChangeIds`, `historyPath`), the Calendar's period, pieces and totals (`calendar.ts`: `calendarFor`, `moveInput`). |
| `src/lib/components/entries/` | The Entries screen's parts: the filter form (shared with Copy-out), the change form, the selectable table. |
| `src/lib/components/copy-out/` | The Copy-out screen's parts: the column and option pickers (`OutputFields`), the option pickers alone (`OutputOptions`, shared with Reports), the Copy button and its status (`CopyRows`), the sheet table (`SheetTable`). |
| `src/lib/components/reports/` | The Reports screen's part: one totals table (`TotalsTable`, a titled section of label and duration rows with a Total row). |
| `src/lib/components/history/` | The History screen's parts: a batch's line with its changes (`BatchLine`), and the types its load returns. |
| `src/lib/calendar/` | The Calendar's pure logic, shared by server and browser and unit-tested: `dates.ts` (`readView`, `periodDays`, `shift`, `isoWeek`, `periodTitle`, `dayName`, `calendarHref`, `hm`), `grid.ts` (`localDate`, `localMinutes`, `instantAt`, `piecesOf`, `lanes`, `overlapping`, `dayTotals` in exact ms, `wholeMinutes` and `spanText` truncating a span to whole minutes as every screen does, `snap`, `halfHourSlot`, `dragRange`), `drag.ts` (`dropTimes`, `clampDay`, `keepIn`) and `gestures.svelte.ts` (the `swipe` attachment, `clockOf`). `drawnExtent` and `growInto` are in `src/lib/components/calendar/block.ts`. |
| `src/lib/components/calendar/` | The Calendar's parts: `CalendarToolbar`, `DatePicker`, `TimeGrid` (day and week), `EntryBlock`, `NewBlock`, `MonthGrid`, `PhoneMonth`; `block.ts` (a block's text and lines), `drag.svelte.ts` (the PC's `BlockDrag`), `now.svelte.ts` (`nowTicker`) and `types.ts`. |
| `src/lib/keys.ts` | `screenKey`: whether an unmodified key press is the screen's (outside fields, no dialog or open `data-holds-keys` details), shared by the layout and the Calendar. |
| `src/lib/components/narrowing.svelte.ts` | Customer and project pickers that narrow each other with JavaScript, shared by the template form and the Entries filters. |
| `src/lib/components/templates/` | The template form shared by the new and edit screens. |
| `src/lib/components/account/` | The Account screen's Agent access parts: the token list with its revoke confirm (`TokenList`), the shown-once token with its Copy button (`NewToken`). |
| `src/lib/components/setup/` | The Setup screen's parts: a rename-in-place row, the add lines, the Add project disclosure. |
| `src/lib/components/today/` | The Today screen's parts: template sheets, today's entries, the ticking elapsed time (also the timer bar's). |
| `src/lib/components/entry/` | The entry form: `EntryForm` (the form, for a new entry and an existing one), `TimeRow` (Start, End and Duration), `ProjectPicker` (with `match.ts`, `matchProjects`), `fill.ts` (`fillValues`, a template's values into the form), `EntryOverlay` (the form over the current screen), and the types its pages load. |
| `src/lib/entry-link.ts` | `openForm` and `openInPlace`: open the entry form over the current screen through shallow routing (`pushState`), or go to its page when it cannot be loaded in place or the form is already shown as a page. |
| `src/lib/time-input.ts` | The forgiving readers for the form's times, durations and dates (`readClock`, `readDuration`, `readDate`, `durationText`, `minutesBetween`, `endAfter`), pure and shared by the browser script and the server actions. |
| `src/lib/components/UndoStrip.svelte` | The undo strip every screen shows after an action; posts to `/undo`. |
| `src/routes/(app)/undo/` | The shared `/undo` route: `core.undo`, then back to the screen it came from. |
| `src/lib/format.ts` | Formatting shared by server and browser: elapsed time, template times, warning text. |
| `src/lib/output.ts` | The copy-out's columns and writers, shared by server and browser (no server imports): `COLUMNS` and their heads, `formatDuration` (`h:mm` or decimal hours), `safeText` (the formula guard), `toTsv` and `toCsv`. |
| `src/lib/components/shell/` | The shell: `Sidebar`, `BottomBar` (with More), `TimerBar`, `StartList`, `NavIcon`, and the bar timer type. |
| `src/lib/shell.ts`, `src/lib/project-colour.ts` | The navigation items, screen titles and current item; the project colour by creation order. |
| `src/lib/server/screens/shell.ts` | `shellTimers`: the running timers for the bar. |
| `src/routes/(app)/entries/new`, `entries/[id]` | The entry form's pages and actions: a plain page without JavaScript, and the data the in-place form loads. |
| `src/routes/(app)/entries/previous-end/` | `GET /entries/previous-end`: the end of the day's latest earlier entry, for "Start at previous end". |
| `src/routes/(app)/timers/` | The bar's posts, each a page action with no screen: `start` (a timer now from a template; one without a project goes to the form in timer mode), `stop` and `restart` (a timer with a finished entry's fields). A GET of any redirects to Today. |
| `src/routes/layout.css` | Design tokens as Tailwind theme values, light and dark (see DESIGN.md). |
| `src/lib/components/ui/` | shadcn-svelte components, copied in and restyled (decision 2). |
| `static/manifest.webmanifest`, `static/icons/` | The web app manifest and icons (see Installable). |
| `src/routes/healthz` | Health check: `{"status":"ok"}`, or 503 when the database fails a query. |
| `drizzle/` | Generated SQL migrations. |
| `e2e/` | Playwright tests; `seed.ts` seeds their data through the core. |

## Shell

Every signed-in screen sits in the shell, drawn by `src/routes/(app)/+layout.svelte`.
It is the same on every screen; no screen draws its own title or navigation.

- **Sidebar (PC, from 1024 px).** Near-black in both themes (`#262626` in light,
  `#0f0f10` in dark), full height and fixed, scrolling on its own when the window is
  short. The wordmark, then Today, Calendar, Entries, Copy-out, Reports, Templates, Setup,
  History, Account, and for an admin Users and Backup; at its foot the signed-in name
  and Sign out. The current item has a blue bar. The route sets the current item; the
  entry edit screen keeps Entries current when its `back` starts with `/entries`, else
  Today.
- **Header (PC).** The screen's title at the left, the page's one `h1`, and the timer
  bar at the right. The title comes from `screenTitle` (`src/lib/shell.ts`) by route
  id, not from the screen.
- **New entry.** On the PC a primary "+ New entry" ("New entry (n)") at the header's right,
  after the timer bar; on the phone a round "+" (56 px, "New entry") fixed at the right
  just above the bottom bar, with room left for it at the foot of the content. Below `lg`
  the controls that sit at the right edge keep out of its column, so it never hides a
  control at any scroll position: the rows' ▶ lead the row on Today and sit under the
  checkbox on Entries, the filter's Clear row and "Edit templates" keep a 3.5 rem right
  margin, and the undo strip's buttons go under its message. Both link
  to `/entries/new?back=<this screen>` and carry `data-entry-form`, so the form opens over
  the screen; without JavaScript they are plain links to the page.
- **Entry form over the screen.** Any link marked `data-entry-form` is opened in place by
  the layout (`openInPlace`, a plain click only; a modified click goes to the page).
  `EntryOverlay` shows the form in a native modal `<dialog>` while `page.state.entryForm`
  holds it: a centred dialog from `lg`, a sheet from under the top bar below it, ending
  at the visual viewport so Cancel and Save stay above the phone keyboard. The address
  is the form's, so the browser's Back closes it, and so do Escape, Cancel and a click
  on the dimmed screen (PC); a saved form follows its redirect to `back` with the data
  reloaded and the strip, keeping the screen's scroll position (`reset: false`). `back` for the bar's Stop and Undo is then the screen under the
  form.
  On the form shown as a page (`/entries/new`, `/entries/[id]`) a link to the form goes
  to its page instead: a second form in the document would share the first's ids.
- **Keys.** `n` opens a new entry and `s` stops the timer the bar shows in full; both
  unmodified, outside fields and while no dialog is open. Ctrl+Enter or Cmd+Enter saves
  the form.
- **Phone (below 1024 px).** A near-black top bar with the same title, the timer strip
  under it, one column of content, and a fixed bottom bar: Today, Calendar (opening
  `/calendar?view=day`), Entries, Templates and More. More is a `<details>` sheet over the page, just above the bar, so it works
  without JavaScript; choosing an item or pressing Escape closes it (Escape returns
  the focus to More). It lists Setup, Copy-out, Reports, History, Account, for an admin
  Users and Backup, and Sign out. Every screen is within two taps.
- **Timer bar.** The layout load (`shellTimers`) lists the running timers, newest
  start first. With one running: a blue live dot, the elapsed time (ticking with
  JavaScript, the server's value without), the project colour dot, customer ›
  project, activity and description, and Stop ("Stop (s)", marked `data-shown-stop`
  for the `s` key). The time and name are a `data-entry-form` link to the timer's form,
  opened over the screen. The phone strip shows customer › project (no description),
  activity and start, the elapsed time, ▶ and Stop (a 44 px square: the live square,
  the word for screen readers only). With several running the
  newest shows in full with a "+N" `<details>` that lists the others, each with its
  elapsed time and Stop. With none it says "No timer running" in the same height.
- **Start list.** The PC's Start sits outside the pill; the phone's ▶ sits in the
  strip. Both are a `<details>` (`data-start-list`) holding `StartList`: "Start a timer",
  the templates by name (`shellTemplates`: colour dot, customer › project), then "Start
  on a project…" (`/entries/new?timer=1`). A template with a description posts
  `templateId` to `/timers/start` at once; one without opens a description line
  (focused, may stay empty, Enter starts); one without a project links to
  `/entries/new?template=<id>&timer=1`. With no templates the list also offers "Create
  a template". On the PC it is a popover under Start; on the phone a sheet from the
  bottom over a scrim that leaves the strip uncovered, so ▶ closes it without
  JavaScript (the sticky top raises over the bottom bar while it is open). With
  JavaScript, Escape, an outside click, a link in it, or a navigation close it, and
  while the phone's sheet is open main, the bottom bar and the "+" are `inert`.
- **Project colour.** `colourOf` gives each project the palette colour (1 to 8,
  `bg-project-1` to `bg-project-8`) at its place by creation order, ties by id,
  wrapping after eight. Nothing is stored. The bar's dot is its only use so far.
- **Stop.** A form posting `id` and `back` to `/timers/stop`, which calls
  `timers.stop` and returns to `back` (the same URL with its query), with the flash
  for Undo. A refused stop sets the flash's `error` and returns the same way. The
  layout re-runs on every navigation, query-only ones included, so the bar is current.
- **Undo strip.** Today, Entries, Setup, Templates and History draw their own strip
  (`ownsStrip`), and the stop's Undo or refusal shows there. On every other screen the
  shell draws the strip under the header (`UndoStrip` in the layout), so a stop's
  Undo or a refusal shows there; the layout takes the flash only for those screens.
  After a Stop (the flash's `restartId`) every strip offers Restart beside Undo, a post
  of `id` to `/timers/restart`. Undo and Restart from the strip keep the screen's scroll
  position. The strip is `position: sticky`: scrolled past its place it pins under the
  sticky bars (their height is the layout's `--bars-height`, measured with the script;
  without it the strip stays in its place) and casts the popover-down shadow. While it
  is pinned, a control in the screen's content (in `main`, not in a dialog, not sticky or
  fixed itself or inside such) focused under it is scrolled down clear of it (a
  `focusin` handler), so keyboard focus is never hidden (WCAG 2.4.11). Focus in the bars
  or the entry form leaves the page where it is. After a
  save over a long screen, the overlay scrolls the saved row out from under the pinned
  strip if it would be hidden there.
- **Light and dark** follow the device setting; there is no in-app choice.

## Screens

Every screen action is one core call (one batch) through `openCore(getDb(), user.id,
'ui')`; no rule is enforced in a screen, the core's refusals and warnings are shown
as it gives them. Forms are plain posts that work without JavaScript; `use:enhance`
enhances them. A successful action redirects (303) back to the screen it was posted
from (Today, `/setup`, `/templates`, the Entries search, the History page), with the undo strip. No browser dialogs.
Copy-out and Reports only read: they have no actions.

### Today (`/`)

In thumb order, one column; on the PC it keeps the width of a two-column layout, the side track left empty:

1. **Templates**: one row per template, opening a sheet (a `<details>` panel, so it
   works without JavaScript) that shows the template's filled fields and asks for a
   description; a reference when the template has none, and a project when it has
   none (from its customer's projects when it has a customer). The button is "Start
   timer" when the result would run, else "Log". "Change times" offers date, start,
   end or minutes. Submits `entries.fromTemplate`.
2. **Today's entries**: entries whose interval touches today in the user's zone, with
   in, out (or Running), hours, customer › project, "Since YYYY-MM-DD" when it
   started on an earlier day, and description; each row is a `data-entry-form` link
   to `/entries/<id>?back=/`, so it opens the entry form over Today. A finished row
   has a ▶ beside its link (a form posting to `/timers/restart`, named "Restart
   <customer › project>", 44 px below `lg`).

Timers start and run in the shell's timer bar (its Start list), not on Today; a Stop
there on Today shows its Undo in Today's strip.

Empty states have no dead buttons: Templates says "Templates
are set up on the PC." with a "Create a template" link to `/templates/new` when there
are none; the Templates head always links "Edit templates" to `/templates`. A refused
action re-renders the form it came from with the core's field messages beside the
fields; a message that belongs to no shown field is shown under the fields (the
template sheet, the edit form) or beside the action; the template sheet and the edit
form focus the first refused field.

### Calendar (`/calendar`)

In the sidebar after Today and in the phone's bar after Today. The address holds the view and
the date (`?view=day|week|month&date=YYYY-MM-DD`; the week and today by default). The load
returns the period from `calendarFor` in the screen's zone, with the flash and `back`. The
toolbar (`CalendarToolbar`) is links throughout: previous and next, Today, the period's title
as the `<summary>` of the date picker (`DatePicker`, a month of day links with its own month
arrows, `&pick=YYYY-MM` keeping it open; today in a text-colour circle; Escape, which returns
the focus to the title, or a click outside closes it, and the screen's keys wait while it is
open), the total and Day / Week / Month. On the PC the title is `periodTitle`'s long form
with the week beside it ("12 – 18 October 2026 Week 42") and the total sits at the right,
muted labels with semibold text-colour figures ("Week **27:45**", "Day **5:45** · Week
**27:45**", "Month **72:40**"). Below `lg` it is two rows, the second the arrows around a
one-line short title over one sub-line, both inside the 44 px row so its height never
changes: "Wed 14 October" over "Day 5:45 · Week 27:45", "12 – 18 Oct" over "Week 42 ·
27:45", "October 2026" over "Month 72:40". The default zone gets Today's note. "+ New entry" and the phone's "+" carry the date in view.

The day and week are `TimeGrid`, drawn twice to their own measures with one shown: the
phone's (hour 56 px for the day; for the week 34 px and `compact`: letter heads with "–" for
an empty day, colour-only blocks, each column a link to its day) and the PC's (52 px for
the day, 44 px for the week). The grid fills the viewport below the toolbar (measured after
hydration; the phone's ends at the bottom bar and keeps 80 px at its foot for the "+") and
its 24 hours scroll inside it under sticky day heads (weekday, date, today in a filled
circle, the day's exact total). Rules every hour, dotted at the half hour on the PC;
shading (the `shade` token, which also marks the month's outside days) before 08:00 and
from 20:00. Each entry is cut into pieces by day (`piecesOf`) and
laid side by side where their drawn blocks meet (`lanes` on `drawnExtent`: a block is at
least a line tall, one sharing its column tall enough for the lines its wrapped project
name measures, and on the phone's day each grows toward 44 px into the free time after it,
stopping at the next block so a day block stays full width, the running block excepted: it
runs to now: `growInto`); an `EntryBlock` is a link to the entry's form
(`data-entry-form`, opened in place) in its project's fill, edge and ink, with the full text
as its name and tooltip; in the week the name starts with the column's day ("Tuesday 13
October, …", `dayName`), which the screen shows only by the column's place. A block under 45 minutes is one line (alone in a day's column and
drawn two lines tall, it has its times under the name); text is clamped to the lines
its height holds and drops the description, then the times, as the block narrows (container
queries). An overlap has a red top edge; the running block a dashed blue foot (only once the
block reaches now: one drawn taller than its time has none) and "now · Running h:mm", whose
elapsed time stays whole in a narrow lane (the name, the times before it and then the word
give way); a piece without the entry's start reads "from the previous day". The line at
now (`data-now-line`), its dot (`data-now-dot`) and its gutter tag (`data-now-tag`) are in
the text colour on today's column; the line runs behind the blocks and the dot over them,
so a block drawn past now (a timer just started, one line tall) keeps its text whole;
the phone week's gutter is 40 px so the tag fits it. `nowTicker`
moves now every 30 s, so the running block, the line and the totals follow it; once the
device's date in the screen's zone passes the server's today, the page reloads its data
(`invalidateAll`, once per date), so the line, today's circle and the totals move to the
new day. Durations and totals are exact: the server sends totals in ms (`dayTotals`) and
every figure is truncated to whole minutes only to be shown (`spanText`), as Today,
Entries and the timer bar do, so a running block reads 1:40 at 1:40:31. Today is
`aria-current="date"` on its head's date, the phone week's column and the PC month's
date, and named ", today" in the phone month and the date picker (whose
`aria-current="date"` is the chosen day). After
hydration the grid scrolls to 07:00, earlier for an entry starting earlier in view, with
now in view on a period holding it; without JavaScript it starts at 00:00. Columns carry
`data-date`, blocks `data-entry-id`, `data-first` and `data-last`.

The month is `MonthGrid` (from `lg`) and `PhoneMonth` (below it), drawn twice with one shown, over
the weeks touching the month, Monday first. PC cells hold the date (today in a filled circle) and
the day's total, up to four entry lines (`data-entry-form`: project dot, start, project name
ending in an ellipsis; a red outline on an overlap, a blue start when running; named with
their day first), then "+n more";
the date, "+n more" and the cell's empty space (a stretched link) open that day's view. ISO week
numbers stand at the left and each week's total at the right; days outside the month are shaded.
The phone's cells are links choosing the day (`view=month&date=<day>`) with the total and one
dot per project; under the grid the chosen day's list, headed by its date and total (a link to
the day view), has rows in Today's look (start over end, customer › project, activity and
description, the duration, the project's bar, "Overlaps another entry"). Today's rows are a
table of columns bound to its own data, so the list draws its own. The page's foot leaves room
for the "+". The totals follow a running entry; the month's total counts only the month's own days.

Keys, outside fields and while no dialog or the date picker is open (`screenKey` in
`#lib/keys`, which the layout's `n` and `s` share; a `<details data-holds-keys>` open holds
them): `←`/`k` and `→`/`j` the previous and next period, `t` today,
`d` `w` `m` the views. A touch swipe across the view's region in all three views (the
`swipe` attachment in `#lib/calendar/gestures.svelte`: at least 60 px across and twice its
vertical travel, listened to passively) moves a period, a right swipe back; with the
phone's new block pending it drops the block instead, and while one of its handles is held
it is no swipe.

Creating from empty time (not a block, not a head) opens `/entries/new?date=&start=&end=&back=`
in place, focus in customer › project. On the PC (`create="drag"`) a press and release
under 4 px is the half hour, rounded down, for an hour (`halfHourSlot`); a mouse or pen
drag gives the range dragged in its day (`dragRange`: the press on the 5 minutes under it,
the moving end rounded to 5) and drawn as it grows
(`NewBlock`, blue-outlined with its times; `Escape` drops it). On the phone's day
(`create="tap"`; the phone's week does not create) a tap draws a `NewBlock` with round
handles at its top and bottom (44 px hit areas, `touch-action: none`) stepping 15 minutes,
keeping 15 at least and inside the day, and a fixed bar over the bottom bar
(`data-create-bar`: the times, "Drag the handles to change it" balanced over its lines,
Cancel, New entry) while
the "+" hides. New entry or a tap on the block opens the form; Cancel, a swipe, another
period or a tap anywhere else drops it (a tap on an entry, a head or outside the grid
still does what it does; one on empty time only drops it). None of this exists without JavaScript.

Moving and resizing on the PC (the `BlockDrag` attachment in
`#lib/components/calendar/drag.svelte`, on the PC's grid only, a mouse or pen only): a press
on a finished block that travels 4 px moves it, one on its top or bottom handle stretches
that end. The handles (`data-handle="start|end"`, 8 px hit strips along the edges with a
thin grip drawn on hover and focus) sit
only on the piece holding the entry's real start and the one holding its real end; the
running block has none and is not dragged. `dropTimes` (`#lib/calendar/drag`) moves by
wall-clock days and minutes in the screen's zone (`instantAt` in `grid.ts`), the moved
edge snapped to 5 minutes; a move keeps the duration, a stretch the other end with 5
minutes at least. Any piece moves the whole entry. While dragging, the block is drawn
lifted where it would land (`data-lifted`, the popover-down shadow, a 1 px ring in its project's colour), the original keeps a
dashed outline in its project's colour (`data-ghost`), and a text-colour tag says where
it lands ("Fri 14:15–15:30", `data-drag-tag`, clear above the lifted block). The pointer is clamped to the period's
first and last day and to 00:00–24:00, and the drop to the period (`keepIn`: a start from
the first day's 00:00 to the last day's 23:55, an end to its 24:00, never pushing an entry
already reaching outside further out); a middle piece of an entry longer than a day has
no handles; a release above or left of the grid (the toolbar,
the sidebar), `Escape`, or a drop where it started puts it back. A release submits the
hidden `use:enhance` form to the `move` action (`id`, `version`, `start`, `end` as ISO
instants with `Z`, so the entry's zones stay, and `back`): one `entries.update` with the
drawn version (`moveInput` reads it); done, the flash with Undo ("Done: Edit entry on
"<project>"."), refused, the flash's `error` ("This entry changed elsewhere. The calendar
shows it as it is now." for a stale version, "This entry was deleted elsewhere." for a
gone one, else the core's message), both redirecting to `back`, which the page follows
with `goto(location, { refreshAll: true, reset: false })`, keeping its scroll. Until
that returns the grid ignores every press and click, so one release is one update and
one undo. After a drag its click opens nothing; a press without movement is a click and
opens the form. Without JavaScript blocks are links only.

### Setup (`/setup`)

Customers and projects, activities and locations on one screen (a second column for
activities and locations from 1280 px). Customers are heavy lines with their projects
indented on hairlines beneath; each line has Rename and Archive (Unarchive when
archived), a customer also Add project. Rename opens in place (a `<details>` with the
name, Save and Cancel; one open at a time) and sends `rename` with the row's
`expectedVersion` (a rename to the same name stores no batch and returns without a strip). Archive and Unarchive are one press, undone from the strip. Each
region ends with an add line (Add project opens one under its customer). Archived rows
are hidden unless the "Show archived" link (`?archived=1`) is on, and then show struck
through with an `Archived` badge; an archived customer lists all its projects, an
active one with none active says "No active projects.". Every action is one core call
(`create`, `rename`, `archive`, `unarchive`, with `kind` customer, project, activity
or location) and returns to `/setup` (or `/setup?archived=1`, as posted) with the
strip. A refusal re-renders the form that was posted, open, with the posted name and
the core's message beside the field, focused; a stale version shows the message with a
Reload link on that row; any other refusal (unarchiving a project under an archived
customer) shows on the row. `setupTree` (`screens/setup.ts`) shapes the tree from the
core's lists read with archived rows included.

### Templates (`/templates`, `/templates/new`, `/templates/[id]`)

`/templates` is a ruled table sorted by name: name (a link to its edit screen),
customer › project, activity, location, times and a Timer or Log
mark as on Today; the phone keeps name, times and mark (customer › project under the
name) and the narrower PC widths drop activity and location. "New template" is the one
primary button; with no templates the page says "No templates yet." beside the same
button. The undo strip shows after a save or delete.

`/templates/new` and `/templates/[id]` share one ruled form: name, customer, project,
activity, location, start time, end time, duration in minutes, time zone (a text field
with the browser's zones as a `<datalist>` filled by script; blank means the device's
zone at use), reference, description. The pickers list active rows plus the template's
current archived ones marked "(archived)". With JavaScript, choosing a project sets its
customer and choosing a customer lists only its projects; without it both are sent as
chosen. `templateInput` (`screens/templates.ts`) shapes the post for the core: the name
as posted, every other field trimmed with blank sent as `null` (which clears it on an
update), and a project with no customer sent with the project's customer. Save sends
`templates.create`, or `templates.update` with every field and the form's
`expectedVersion`, and returns to `/templates` with the strip. Refusals re-render the
form with the posted values and the core's messages beside the fields (a message for
no shown field goes under the form), focusing the first refused field; a stale version
shows the message with a Reload link; a save that changed nothing returns without a strip. Delete asks on the page ("Yes, delete it" /
"Keep it"), then sends `templates.delete` with the version; a template deleted
elsewhere says so with a link back to the list, and a missing one is a 404. The shell's
Templates item stays current on both sub-routes.

### Entries (`/entries`)

A PC screen (in the sidebar and under More, not the phone's bar) for finding entries and changing or
deleting many at once; it stays usable at phone widths.

**Filters** are a `GET` form, so a search is a URL. From and To are dates, inclusive,
read as days in the request's zone; `readSearch` (`screens/entries.ts`) defaults to
the current month when neither is in the query, leaves a side unbound when its field
is submitted blank, and refuses a malformed date ("Use dates like 2026-10-01.") or
From after To ("From must not be after To.") with the message by the fields and no
list. Customer and Project list every row, archived included and marked
"(archived)", projects grouped by customer, "Any" first; with JavaScript a customer
narrows the projects (`narrowing.svelte.ts`). Activity and Location offer "Any",
"None", then every row. Text matches reference, description, project or customer
name as the core does. `searchInput` asks `entries.list` for entries that started
in the range (`startedIn`), oldest first, at most 501; "Clear" returns to the month.

**The list** is a ruled table of at most 500 rows: a checkbox, date (a
`data-entry-form` link to the entry form with `back` set to the search, so it opens
over Entries), in, out (or Running), hours, customer › project, activity, location,
reference, description, each time in the entry's own zone, and on a finished row a ▶
posting to `/timers/restart` ("Restart <customer › project>", back to the search). The narrower PC widths drop activity and location; the phone stacks each row.
Above it, "<n> entries, <h:mm>" ("1 entry, h:mm"), running entries counted to now;
a 501st entry adds "Showing the first 500 entries; narrow the filters."; none says
"No entries match." with Clear. A head checkbox selects all shown with JavaScript;
without it a "Select all" link reloads the search with `&all=1`, every row checked.

**Change selected** and **Delete selected** are one `POST` form with the table: each
checked row posts `id` and its loaded `version.<id>` (`selection`; a repeated id is
taken once). The change form sets, each left as it is unless set: Project ("Keep" or
an active project), Activity and Location ("Keep", "None" or an active row),
Reference (blank keeps it; "Clear the reference"), and a literal, case-sensitive Find
and Replace with in the description, taken as typed (a Find of only spaces is blank;
a description left empty becomes none). `bulkUpdates` reads each selected entry as it
is now and builds one `entries.update` per entry the form would change, only the
changed fields, with the posted `expectedVersion`, oldest start first; "Apply to
selected" sends them as one `core.batch` labelled `Edit <n> entries` (`Edit 1 entry`,
`n` counting the updates). Nothing selected says "Select at least one entry.";
nothing to change stores no batch and says "Nothing to change.". Delete selected asks
on the page ("Delete <n> entries?", "Delete 1 entry?"; "Yes, delete them" in red /
"Keep them"), then sends one batch of `entries.delete` with each version, labelled
`Delete <n> entries`. Both redirect to the search they were posted from with the
strip, and undo returns there.

**Refusals** re-render the search with the selection and the posted values kept. One
refused entry refuses the whole batch (`runBulk` tracks the input in flight, so a
rule thrown inside the batch is also traced to its entry); the message names the
entry ("2026-10-07 09:00, CompA › ProjC: <the core's message>", in the entry's start
zone), and a Reload link to the search shows only when that entry's posted version is
stale. An entry deleted elsewhere since the list loaded cannot be named: when the form
would set a field on it the core's "Not found." shows alone, with no Reload; when it
would not (a Find its text no longer has), it is skipped. Field messages show beside
the change form's fields.

### Copy-out (`/copy-out`, `/copy-out/csv`)

A PC screen (in the sidebar after Entries, under More on the phone) that writes a month's
entries out as the columns chosen, to paste into Excel or download as CSV; it stays
usable at phone widths. It only reads: nothing rounded or split is stored.

**The form** is one `GET` form, so a copy-out is a URL. The Filters are the Entries
filter bar (`EntryFilters`, read by the same `readSearch`, the same query names and
messages), with **This month** and **Last month** beside Clear: each sets From and To
to that month in the request's zone (`monthRange`) and keeps every other filter,
column and option. Below the filters, **Columns**: ten checkboxes in one fixed order,
Date, Start, End, Duration, Customer, Project, Activity, Location, Reference,
Description (`col=<column>`, repeated); and **Options**: Round to 5 minutes (`round=1`,
on by default), Split at midnight (`split=1`, off) and Duration as `h:mm` or Decimal
hours (`duration=hm|decimal`). The form sends a hidden `show=1`; `readCopyOut` takes
the columns and switches as sent when it is there and the defaults (all ten, rounded,
unsplit, `h:mm`) when it is not. An unknown column or option value is ignored. A
submitted form with no column says "Choose at least one column." by the columns and
shows no rows. Show is the screen's one primary button.

**The rows.** `sheetFor` asks `entries.list` for the entries that started in the
range, oldest first, with no row limit, and `outputRows` turns them into rows of
text: the date and start in the start zone, the end in the end zone (a time on the
row's date, `24:00` at exactly the next midnight, else `YYYY-MM-DD HH:mm`), the
duration in the chosen format, and the names, reference and description as stored.
Rounding moves both ends to the nearest 5 minutes (2.5 up) and the duration is their
difference; without it times are cut to the minute. Splitting
comes after rounding and cuts an entry at each midnight of its start zone into one
row per day, a piece of no length not written. A text value starting with `=`, `+`,
`-`, `@`, a tab or a carriage return gets a leading `'` (`safeText`); dates, times
and durations never do. Running entries are left out and counted.

**The result** sits under a "Result" head with "<n> rows, <total>" ("1 row"), the
rows' minutes summed in the chosen format; a Copy button and a Download CSV link,
both outline; "1 running entry left out." / "<n> running entries left out." when any;
then the rows as a ruled table with the chosen columns as heads, every value as it is
copied, the times and durations in figures. The table scrolls sideways at any width and
never stacks. None says "No entries match." with Clear (and the running line, when
the only matches run). A date mistake shows as on Entries, with no result.

**Copy** (`CopyRows`, shown only once the page's script runs) writes `toTsv` of the
page's rows to the clipboard: values separated by tabs, lines by `\r\n`, no header, a
tab or line break inside a value replaced by a space, and a value that starts with a
quote wrapped in quotes with its inner quotes doubled (so Excel keeps it whole). A polite status line says
"Copied <n> rows." ("Copied 1 row.") or "Copy failed; select the table and copy it."
and clears when the rows change. Without JavaScript the table is selected and copied
by hand.

**The CSV route** (`/copy-out/csv`, `+server.ts`) takes the same query (the screen
links it with `copyOutQuery`) and answers `toCsv` of the same rows: a byte-order mark,
a header row of the column heads, values comma-separated and quoted when they hold a
comma, a quote or a line break (quotes doubled, line breaks kept), lines ending
`\r\n`; `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`,
named `time-keep-<from>-<to>.csv` with a blank side written `all` (`csvName`). The
app layout's load does not cover a `+server.ts`, so the route calls `requireUser`
itself (signed out: 303 to `/login`) and reads only that user's entries. A query the
screen would refuse (a bad date, From after To, no column, a refused list) is a 400
with the screen's message as plain text.

### Reports (`/reports`)

A PC screen (in the sidebar after Copy-out, under More on the phone) that shows a month's
entries as totals per day, week, customer and project, to check a month before copying
it out; it stays usable at phone widths. It only reads: nothing rounded or split is
stored, and the totals are computed on the way out.

**The form** is Copy-out's without the columns: the Entries filter bar (`EntryFilters`,
`readSearch`) with **This month** and **Last month** beside Clear, then the **Options**
(`OutputOptions`: Round to 5 minutes, Split at midnight, Duration as `h:mm` or Decimal
hours), a hidden `show=1` and Show as the one primary button. `readReport` reads the
query with `readSearch` and `readOptions` (the reading Copy-out shares, defaults
rounded, unsplit, `h:mm`); `reportQuery` writes it back for the month links.

**The totals.** `reportFor` asks `entries.list` for the entries that started in the
range, with no row limit, and `reportTotals` sums the pieces `outputPieces` gives (the
same code that writes Copy-out's rows, so a day's total is the sum of the rows with
that date): by the piece's date (Days, `2026-10-19 Mon`), by its ISO week (`isoWeek`,
Monday first; Weeks, `W43 2026-10-19 – 2026-10-25`, the week's own Monday and
Sunday), by customer id (Customers, by name) and by project id (Projects,
`Customer › Project`, by customer then project). An entry rounding to nothing is a
piece of `0:00` and its groups are listed. Running entries are left out and counted.
Every table's Total is the same number.

**The result** sits under a "Result" head with "<n> entries, <total>" ("1 entry"),
then "1 running entry left out." / "<n> running entries left out." when any, then four
tables (`TotalsTable`, each a region named by its title, rows of label and duration,
a Total row at the foot; the heads are for screen readers only). On the PC two
columns: Days on the left, Weeks, Customers and Projects stacked on the right; on the
phone one column in the order Customers, Projects, Weeks, Days. None says "No entries
match." with Clear (and the running line, when the only matches run). A date mistake
shows as on Entries, with no result.

### The entry form (`/entries/new`, `/entries/[id]`)

One component, `components/entry/EntryForm.svelte`, for a new entry and an existing
one; both pages render it inside the shell, and it works as a plain page form without
JavaScript. With JavaScript every link to it (`data-entry-form`) opens it over the
current screen instead (see Shell). Labels sit left of the fields from `lg`, above them below it. In order:
"Fill from" (a new entry only: a link per template to `/entries/new?template=…`, which
the script turns into filling the form in place with `fillValues`, shared with the
server's `templateValues`), Date (a text field read with `readDate`; Today and Yesterday
with JavaScript), Start, End and Duration (`TimeRow.svelte`: text fields read with
`time-input.ts` on leaving them and on save, a refusal beside the field; a typed end
fills the duration and a typed duration the end; a moved start keeps whichever was
typed last, an untouched end by default; nothing is rewritten until typed, and a
duration posted as it was shown is not read again, so an entry under a minute (`0:00`)
saves; "next day",
"+N days" and the end's other zone beside End; "No end: this starts a timer." when
both are empty, "No end: the timer keeps running." on the running entry; "Start at previous end HH:MM" from `/entries/previous-end`),
Customer › project (`ProjectPicker.svelte`: a grouped select without JavaScript, a
combobox matching words of customer and project with `matchProjects`), Activity,
Location, Reference, Description. Focus starts on Start, or on the project when the
start is given; an existing entry on the phone focuses the sheet's heading instead, so
no keyboard comes up.

The footer has Cancel (`back`) and the one primary Save (Ctrl+Enter or Cmd+Enter). An
existing entry also has Delete (at once; the strip offers it back), Copy
(`/entries/new?copy=<id>`; a span under one minute, shown as `0:00`, copies as
`0:01`), Restart (a post to `/timers/restart`; disabled with
"Already running" on a running entry) and a Save as template disclosure; with
JavaScript these four are disabled with "Save or cancel your changes first" while the
form differs from what was loaded. On the PC these sit left of Cancel and Save in one
footer row; on the phone they scroll with the fields and only Cancel and Save are
pinned at the sheet's foot (a focused field scrolls clear of them). A refusal shows beside its field and the message
above the footer; a stale version offers Reload, an entry deleted elsewhere says so
with a link back. Every action returns to `back` (checked by `safeBack`, else Today)
with the strip; a refusal carries the posted `back`, so a page post without JavaScript
keeps it. With an `onDone` prop a successful action's redirect goes to it
instead of being followed.

An existing entry's untouched end is never re-sent, so its instant (seconds, days and
zone) holds; a duration only recomputed from a moved start is no change, and a typed
duration the end was linked from is sent as the duration (`updateInput`).

### History (`/history`)

A PC screen (in the sidebar after Setup, under More on the phone) listing every batch the
user's changes were recorded in, newest first, to undo or redo any batch or chosen
changes in one step; it stays usable at phone widths. Undo and redo are
`core.undo` and `core.redo` (see [core.md](core.md)).

**The list** asks `history.list` for 51 batches and shows 50, under a heading per day
in the request's zone (`dayHeading` gives "2026-10-19, Monday"; the screen shows the
date beside the weekday). Each batch is one ruled row: its time (`HH:mm`), its label
as the core stored it, an "Agent" or "System" chip when it was not made in the UI,
its state ("Undone" when every change is undone, the row muted; "Partly undone, <k>
of <n>" otherwise; nothing when it stands, from `batchState`), a disclosure "1
change" / "<n> changes" (a native `<details>`) that opens its changes, and outline
buttons: Undo when any change stands, Redo when any is undone, both when partly
undone. Undo and redo batches are listed like any other. When a 51st batch exists an
"Older" link loads `/history?before=<the 50th batch's id>`; a page reached that way
has "Newest" back to `/history`. An unknown or blank `before` redirects to
`/history`. None says "Nothing recorded yet."

**A change** is one line, in the batch's order (`describeChange`): a checkbox, then
Created, Changed, Archived, Unarchived or Deleted and the record ("Entry 2026-10-07
09:00–10:30, CompA › ProjC", "Customer CompA", "Project CompA › ProjC", "Activity
Travel", "Location Office", "Template Daily standup"; an entry named from its row
after the change, before it for a delete, its times in its own zones, a running one
"09:00–running"). An update adds a line per field that differs, "Description: old →
new", blank written "none", ids as current names (`namesFrom`: every row, archived
included; an id not found reads "(unknown)"), text cut at 80 characters with "…";
an entry's start and its zone are one "Start" line, its end and zone one "End" line,
naming the zones when the two sides differ. Bookkeeping columns and `id` never show.
An update that changes only `archived_at` reads Archived or Unarchived with no field
line. An undone change ends in a muted "Undone". A batch of more than 100 changes
shows the first 100 and "and <n> more; undo or redo the whole batch." with no
checkboxes.

**Undoing and redoing.** The list is one `POST` form. A batch's Undo and Redo post
its `batchId` to `?/undo` or `?/redo` (the ticks are then ignored). Above the list,
"Undo selected changes" and "Redo selected changes" post every ticked `changeId`
(`readChangeIds`: deduped; none says "Select at least one change.", more than 1000
"Select at most 1000 changes."); with JavaScript a line says "<n> selected" and both
are disabled at none. The core labels the new batch `Undo "<label>"` / `Redo
"<label>"` for a batch, `Undo <n> changes` / `Redo 1 change` for chosen changes. No
confirmation: success redirects (303) to the page posted from (`historyPath`, its
`before` kept) with the strip, whose Undo returns there. A refusal re-renders that
page with the core's message in a red-bordered alert above the list, the ticks kept
and their batches open.

### Account (`/account`)

In the sidebar, and under More on the phone. Two sections, each a caps head over ruled lines: **Change password** (current, new, confirm; see Accounts and
sessions) and **Agent access**, the user's tokens for agents (decision 6,
[mcp.md](mcp.md)).

**Agent access** lists the tokens newest first, each a line with its name, the date it
was made and when it was last used (date and `HH:mm` in the request's zone, or "Never
used"), and an outline Revoke button; none says "No tokens yet.". Under the list an
add line (Name, **Create token**) posts `?/createToken`; the name is trimmed, 1–100
characters ("Name must be 1–100 characters."), unique per user case-insensitively
("You already have a token with that name."). The new token is shown once, above the
list, in a read-only mono field labelled with its name that selects itself on focus,
with a Copy button once the script runs ("Copied" after) and the line "Copy it now: it
is not shown again."; the next load no longer has it. Revoke is two steps on the page:
the first press posts `?/revokeToken` and re-renders the line with "Revoke
"<name>"?", a red Yes, revoke (which takes the focus with JavaScript) and an outline
Cancel back to `/account`; the confirm deletes the token and says "Token revoked.". An
unknown id says "Token not found.". No undo: accounts are outside the history
(decision 4). The posts work without JavaScript; a refusal shows as a red alert at the
section's head.

### Backup (`/admin/backup`)

Admin only (`requireAdmin`: signed out 303 to `/login`, a non-admin 403), in the sidebar
after Users and under More on the phone (decision 7).
Three sections, each a caps head over ruled lines.

**Backup**: "A backup is the whole database: every user, their time data and history.
Keep it somewhere safe; it holds password hashes." and **Download backup**, the
primary button, a link to `GET /admin/backup/download`. The route answers
`application/vnd.sqlite3` as an attachment named `time-keep-YYYY-MM-DD-HHmm.db` (the
admin's zone, from the `tz` cookie); the file is a vacuumed copy of the database with
no `session` or `access_token` row, taken in a temporary file next to the database and
removed when the request ends.

**Restore**: "Restoring replaces every user's data with the backup's and signs
everyone out.", a file input **Backup file** (`accept=".db"`), a checkbox **Replace all
data with this backup** and a red **Restore**, in one `multipart/form-data` form posted
to `?/restore` (it works without JavaScript). The action refuses, changing nothing,
with "Choose a backup file." (none or empty), "Tick the box to confirm the restore.",
"This file is not a time-keep backup." (not SQLite, a failed integrity check, no
`__drizzle_migrations`, a table or column that differs from the running schema, or a
foreign key violation; `__drizzle_migrations` must exist but is neither compared nor
copied), "This backup is from a newer version of time-keep.", "This
backup has no admin who can sign in." and "The restore failed; nothing was changed."
(the copy rolled back, or the upload could not be written); the message shows as a red alert under the form. An older
backup is migrated first. Then the running data is written, as a backup, to
`time-keep.before-restore.db` beside the database (one file, replaced at each
restore), and every row is copied into the running database in one transaction on the
app's own connection (sessions and tokens are not copied, so everyone is signed out,
the restoring admin included, and agents need new tokens). The action redirects to
`/login?restored=1`. A restore is not recorded in the history: it replaces it.

**Before the last restore**: only when that file exists: "The data as it was just
before the last restore, <YYYY-MM-DD HH:mm>." (the file's time, in the admin's zone)
and an outline **Download**, `GET /admin/backup/download?before-restore=1`, named
`time-keep-before-restore-YYYY-MM-DD-HHmm.db`. Restoring it is an ordinary restore.

### Time zones

The request's zone is, in order: the form's hidden `timeZone` field, the `tz`
cookie, the zone of the user's newest entry of the last month, else UTC
(`screens/zone.ts`). The app layout's script fills every hidden `timeZone` field with the
browser's zone (except one marked `data-zone-fixed`: an existing entry's own zone, a copied entry's,
or a template's own zone, from the page's query or a Fill from) and writes the cookie; when the cookie was missing or stale it reloads
the screen's data once (not while a strip is showing). Today names the zone it uses,
and says when it is only the default. Times are shown in each entry's own zone, as
24-hour `HH:mm` and `YYYY-MM-DD`.

### Done and undo

After a successful action the server stores a flash in a short-lived `httpOnly`
cookie (`flash`, 60 seconds, capped in size) and redirects; the screen it lands on reads
and clears it. The strip says "Done: <batch label>." with an Undo button for that batch, the
user's newest batch right after the action (`flashAfter`), so it is the right batch
across the redirect. The strip (`UndoStrip`, shared by every screen) posts to the
one `/undo` route with the batch and a `back` path (checked by `safeBack`: a path on
this site, else Today); undo calls `core.undo({ batchId })`, and the redirect back
shows "Undone.". A refused undo (for example of "Create customer" once a project
was added under it) sets the flash's `error` to the core's message instead: the strip
is then an alert showing that message in red, with the same Undo button kept, so the
refusal is seen on the screen the user was on. A GET of `/undo` redirects to Today.
The strip lasts until the next load. The core's warnings for the action
(`overlap`: "Overlaps another entry", `long`: "Longer than 24 hours") show in the
strip and as a red mark on that entry's row, for that response only; the core does
not store them.

### Installable

`static/manifest.webmanifest` (name time-keep, `display: standalone`, start URL `/`,
rack ink theme and card stock background) and PNG icons in `static/icons/` rendered
from `icons/mark.svg` (see `icons/README.md`), linked from `src/app.html`. They are
static files, so reachable before sign-in. There is no service worker; offline is out
of scope.

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_PATH` | `./data/time-keep.db` | SQLite file. The directory is created. The image sets `/data/time-keep.db`. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | none | The first admin. Read only while no admin exists; startup fails if there is none and these are unset. |
| `PORT` | `3000` | Listen port. |
| `BODY_SIZE_LIMIT` | `512K` (adapter-node's) | The largest request body. The image and the browser tests set `100M` so a backup uploads; `/mcp` still refuses a body over 512 KB itself (see [mcp.md](mcp.md)). |
| `PROTOCOL_HEADER`, `HOST_HEADER` | unset locally | Where adapter-node builds the request origin. |
| `ADDRESS_HEADER`, `XFF_DEPTH` | unset locally | Where the client address comes from (sign-in throttle). |

There is no `ORIGIN`. adapter-node 6 builds the origin from `PROTOCOL_HEADER` and
`HOST_HEADER`, and takes the scheme as https when no protocol header is set, so form
posts over plain http are refused. Behind a proxy set the headers (the image does).
A local `node build` over plain http needs `PROTOCOL_HEADER=x-forwarded-proto` and a
client that sends `x-forwarded-proto: http`; the e2e does this.

`DATABASE_PATH`, `ADMIN_USERNAME` and `ADMIN_PASSWORD` are declared in `src/env.ts` and
read through SvelteKit's `$app/env/private`, so the dev server picks them up from `.env`
as well as from real environment variables in production. `drizzle.config.ts` reads
`process.env.DATABASE_PATH` directly (drizzle-kit runs outside SvelteKit).

`.env.example` lists the variables.

## Running

```
cp .env.example .env
npm run dev
```

Migrations run and the admin is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD` at
server start in production; the dev server does this lazily on the first request. Other scripts: `npm run build`, `check`, `lint`, `format`.

## Migrations

Change `src/lib/server/db/schema.ts`, then `npm run db:generate` (drizzle-kit
generate) and commit the SQL in `drizzle/`. The app applies pending migrations at
startup. Never use `db:push`; the schema is changed only through reviewed migration
files.

## Tests

- `npm run test:unit` runs Vitest over `src/**/*.test.ts` against in-memory SQLite.
- `npm run test:e2e` runs Playwright (`e2e/`) against a production build served on
  port 4173 with a throwaway database in `test-results/e2e`, in a phone project and a
  PC project.
  `e2e/seed.ts` opens that database on a second connection once the server has
  created and migrated it, and seeds through the core: one user per browser project
  (so the two never share timers or entries), with customers, projects, templates and
  this morning's entries. The browser runs in a fixed-offset zone where it is about
  noon (`noonZone`), so the seeded times are today and in the past whenever the suite
  runs. `phone.test.ts` covers Today, the entry form from a row, Save as template, undo and the
  no-JavaScript posts; `setup.test.ts` covers Setup (create, rename, duplicates,
  archive and unarchive, a refused undo, a stale rename), Templates (create, edit,
  delete and undo, an archived project, a stale save) and their no-JavaScript posts;
  `entries.test.ts` covers Entries with a user of its own per test (`seedMonth`:
  five entries across the month and one last month): each filter and Clear, a bulk
  change and a bulk delete with undo, an entry changed or deleted elsewhere, a
  refusal naming its entry, opening an entry and coming back to the search, the
  500-row cut (`seedMany`, one batch) and the no-JavaScript search, Select all and
  apply; `history.test.ts` covers History with a user of its own per test, who has
  no batch until seeded: a batch with its label, time and changes, undo and redo of a
  batch (checked on Setup), two of a batch's three changes undone (`seedThreeChanges`:
  Partly undone, 2 of 3), changes of two batches undone as one, a refused undo with
  the ticks kept, 51 batches paging by Older and Newest and exactly 50 with no Older
  (`seedBatches`), the Agent chip (`seedAgentCustomer`, through
  `openCore(db, userId, 'agent')`), a batch's own Undo beating a tick on another
  batch, an unknown `before` returning to the newest page, a forged batch id showing
  "Not found.", an undo on an older page landing back there, the sidebar's current item
  and the no-JavaScript undo of a ticked change; `copy-out.test.ts` covers Copy-out
  with a user of its own per test (`seedCopyOut`: four entries this month, one of
  them overnight, one with a comma, a quote and a line break in its description
  (`QUOTED`) and one starting with `-`, one last month and a running timer): the month
  with all ten columns and the running line, fewer columns and decimal hours, Last
  month and This month keeping the columns, no column ticked, Split at midnight and
  rounding off, Copy on the PC (the clipboard granted; tab-separated, no header, one
  line per row), Download CSV (its name, byte-order mark and header, every value
  read back through a small CSV reader, the line break kept), the sidebar's current
  item, the CSV route signed out, for another user and with bad queries, and the
  no-JavaScript Show, table and CSV link with no Copy button; `reports.test.ts` covers
  Reports with a user of its own per test (`seedCopyOut`): the month's four tables with
  their rows and every Total (`7:15`), Split at midnight moving the overnight entry's
  time across two days, decimal hours, Last month and This month keeping the options,
  only a running entry matching ("No entries match." and the running line, no tables),
  the sidebar's Reports after Copy-out and current (under More on the phone) and the
  no-JavaScript Show with Split ticked; `entry-form.test.ts` covers the entry form and the timer bar (a user of its own per
  test): an entry made and corrected over Reports and Entries without leaving them and
  undone, closing by Back, Escape, Cancel and the dimmed screen, the phone's sheet with
  Save above the keyboard and the "+" clear of content and bottom bar, forgiving times
  and durations linked, Fill from a template, Start at previous end, Delete, Copy and
  Save as template, a timer started from any screen and stopped and restarted from the
  bar, the start list closing on Escape and an outside click, a timer on an earlier
  project opened from the bar, a past entry restarted and a running one that cannot be,
  a refused save keeping what was typed, the keys `n`, `s` and Ctrl+Enter (not typed
  into a field), and the start list and Restart as plain posts without JavaScript;
  `shell.test.ts` covers the shell with a user of its own per test: every screen reached from the navigation and shown current (More on the phone, Users and Backup for an admin), the title as the one `h1`, More closing on a choice and on Escape, "No timer running", a stop from the bar undone where it was stopped, several timers as the newest plus a count, a refused stop, Stop and Save never hidden by the bars, the project colour in the bar, and the bar and More as plain posts and links without JavaScript; `agent.test.ts` covers Agent access and `/mcp`
  with a user of its own per test (`seedEmptyUser`): a token made and shown once
  (gone on the next load, listed as "Never used") and a duplicate name refused, a
  `change` call with that token through Playwright's request client (headers
  `authorization`, `content-type` and `accept`) showing its customer on Setup and its
  batch on History with the Agent chip, undone there in one step, and the token's
  last-used time on Account; the signed-in session cookie alone answered 401; a
  revoked token answered 401; and the no-JavaScript create and two-step revoke.
- The MCP server's unit tests: `auth/tokens.test.ts` (made, hashed, found, revoked, a
  disabled user's refused and deleted, `last_used_at`), `mcp/http.test.ts` (the
  Origin check, 401 alike for every bad token, no session cookie, a body that is not
  JSON), `mcp/server.test.ts`
  (every tool through the SDK's client over an in-memory transport, on the real core),
  `mcp/change.test.ts` (operations, refs and refusals as one batch) and
  `mcp/rows.test.ts` (the rows' times and dropped fields).
- The backup's unit tests: `backup.test.ts`, on real files in a temporary directory (a
  backup's rows without sessions or tokens and no token hash left in its bytes, a round
  trip, every refusal leaving the data and the directory unchanged, an older backup
  migrated, a forced failure rolled back, the before-restore copy), and the body limit
  tests in `mcp/http.test.ts`.
- The Calendar's unit tests: `src/lib/calendar/dates.test.ts` (views, dates, titles and day
  names from the address, weeks from Monday), `grid.test.ts` (pieces cut by day, lanes,
  overlaps, exact day totals and whole minutes truncated, the half hour, the dragged
  range), `drag.test.ts` (the drop times, keeping a drop in the period),
  `src/lib/components/calendar/block.test.ts` (drawn extents, growing into free time),
  `src/lib/server/screens/calendar.test.ts` (`calendarFor`: overlaps, midnight crossings,
  exact totals, running timers, colour, zones; `moveInput`), `src/lib/shell.test.ts` (Calendar in the
  sidebar and the bar) and `scripts/seed-month.test.ts` (the seeded month).
- `e2e/calendar.test.ts` covers the Calendar with a user of its own per test
  (`seedCalendarWeek`, `seedSpan` in `e2e/seed.ts`): the sidebar and bar entries, the toolbar's arrows, Today, views, totals and
  picker (also without JavaScript), the grids' blocks, overlaps, lanes, the running block and
  the line at now (crossing no block's text, however young the timer; the elapsed time whole
  in a narrow lane) and the reload past midnight, blocks and month lines named with their day,
  a block opening its form over the calendar, the phone's day, week and
  month, the PC's month, the keys, creating by drag, click, and on the phone by tap, handles
  and swipe, moving and resizing by drag with Undo and its refusals and limits, and the
  toolbar's layout and focus order. `touch-targets.test.ts` also checks the calendar's
  controls.
- `e2e/backup.test.ts` covers Backup with the seeded admin: a non-admin refused on the
  screen and the download with no Backup in the sidebar; a download (its name, the SQLite
  header), a customer made after it, the restore of that file landing on
  `/login?restored=1`, the customer gone after signing in again and the before-restore
  download; the two refusals (box unticked, no file) leaving the admin signed in; and
  the no-JavaScript download and restore. A restore signs out every session, so each
  test signs in again after it and restores only the backup it just downloaded, which
  leaves the other tests' seeded users in place.
- `npm test` runs both.

Chromium needs system libraries and fonts. The devcontainer image installs them, so
after rebuilding the devcontainer `npm run test:e2e` runs as is. Until the rebuild,
unpack the libraries into a user cache and run with `LD_LIBRARY_PATH` and
`FONTCONFIG_FILE` pointing at it.

## Accounts and sessions

Decision 3 is the rule; these are the details.

- Usernames are trimmed and lowercased, 3 to 32 characters of `a-z`, `0-9`, `.`, `_`,
  `-`. Passwords are 10 to 256 characters.
- Passwords are hashed with argon2id. A sign-in for an unknown username still verifies
  against a dummy hash, so timing does not reveal which usernames exist. Failures
  always read "Wrong username or password.", including for disabled accounts.
- The session token is 20 random bytes as base32, sent in an `httpOnly`,
  `sameSite=lax` cookie named `session` (`secure` over https). Only its SHA-256 is
  stored. Sessions last 30 days and are renewed to 30 days on use once under 15 days
  remain.
- Sign-out deletes the session. Changing a password invalidates the user's other
  sessions and keeps the current one; an admin setting a password invalidates all of
  that user's sessions. Disabling a user deletes their sessions, and a disabled user's
  session never validates.
- The sign-in throttle keys on username and client address: 5 failures within 15
  minutes lock the pair for 15 minutes. It is in memory and resets on restart.
- The first admin comes from the environment, only while no admin exists. The admin
  flag is set at creation and has no edit path. Admins create users, set passwords and
  disable or enable anyone except themselves. Users are never deleted. Setting a
  password or disabling an unknown id returns "User not found."
- Agents sign in with access tokens, not sessions (decision 6): `tk_` and 32 base32
  characters (20 random bytes), only the SHA-256 stored in `access_token`, made and
  revoked by the user on Account, sent as `Authorization: Bearer` to `/mcp` only.
  `last_used_at` is written at most once a minute. Disabling a user deletes their
  tokens, as it deletes their sessions; enabling does not bring them back. A password
  change, by the user or an admin, leaves tokens alone. A session cookie never opens
  `/mcp` and a token never opens a screen.

## Image

The `Dockerfile` builds with adapter-node and runs `node build` as the `node` user.
It sets `DATABASE_PATH=/data/time-keep.db`, `BODY_SIZE_LIMIT=100M` (a backup is
uploaded in one request), `PORT=3000`, `PROTOCOL_HEADER=x-forwarded-proto`,
`HOST_HEADER=x-forwarded-host`, `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1`,
which suits one reverse proxy (Coolify's). `/data` is a volume and must be persistent.
The image contains `drizzle/` for startup migrations. The healthcheck calls
`/healthz`. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the deployment environment
for the first start.
