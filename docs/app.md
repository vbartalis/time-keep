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
| `src/routes/login`, `logout` | Sign in and out (see The sign-in page). `/login?restored=1` shows "Restored. Sign in with the backup's passwords." above the fields, after a restore. |
| `src/routes/+error.svelte`, `src/routes/(app)/+error.svelte` | The error pages (see The error pages): outside the shell on the sign-in page's card, inside it as one panel. Their words come from `errorTitle` and `errorSentence` in `src/lib/shell.ts`. |
| `src/routes/(app)/admin/users` | The Users screen (`+page.svelte`, `+page.server.ts`), admin only. |
| `src/routes/(app)/admin/backup` | The Backup screen (`+page.svelte`, `+page.server.ts`) and its download route (`download/+server.ts`), admin only. |
| `src/routes/mcp` | `POST /mcp`, the MCP endpoint, outside the signed-in screens (see [mcp.md](mcp.md)). |
| `src/routes/(app)/` | Signed-in screens: Today (`/`), `calendar`, `entries` and the entry form (`entries/new`, `entries/[id]`), `copy-out` and its CSV route (`copy-out/csv`), `reports`, `account`, `admin/users`, `admin/backup`, `setup`, `templates`, `templates/new`, `templates/[id]`, and `history` (see Screens). The layout requires a user and draws the shell (see Shell). |
| `src/lib/server/screens/` | Server logic behind the screens, unit-tested: zone resolution (`zone.ts`), today's range and the `HH:mm` / `YYYY-MM-DD` formats (`today.ts`), form input for the core (`actions.ts`; `edit.ts`: `withCurrent`, `postedValues`), the entry form's values, pickers, input and refusals (`entry-form.ts`: `valuesFromEntry`, `newValues`, `copyValues`, `templateValues`, `formPickers`, `createInput`, `updateInput`, `previousEnd`, `newEntryValues`, `coreFailure`), the bar's start and restart input (`timer-actions.ts`: `startFromTemplateInput`, `restartInput`), the flash cookie and undo lookup (`flash.ts`), the safe return path for forms (`back.ts`), the Setup tree (`setup.ts`), the template form's input and pickers (`templates.ts`), the Entries bulk change (`entries.ts`: `readBulk`, `selection`, `bulkUpdates`, `editLabel`, `deleteLabel`, `runBulk`), the timesheet's list and pickers (`timesheet.ts`: `listInput`, `timesheetFor`, `filterOptions`), the view Copy-out and Reports share (`output.ts`: `readOutput`, `keepOutput`, `outputQuery`, `outputInput`, `presetHints`, and the `output_range` and `output_choice` cookie names), the copy-out's rows (`copy-out.ts`: `outputRows`, `outputPieces`, `csvName`, `sheetFor`), the reports' totals (`reports.ts`: `isoWeek`, `weekLabel`, `reportTotals`, `reportFor`), the History screen's words and forms (`history.ts`: `namesFrom`, `describeChange`, `batchState`, `dayHeading`, `readChangeIds`, `historyPath`, `touchedLine`), the Calendar's period, pieces and totals (`calendar.ts`: `calendarFor`, `moveInput`). |
| `src/lib/filter/` | The one filter, pure and unit-tested, shared by Entries, the Calendar, Copy-out and Reports: `filter.ts` (`PRESETS`, `presetDays`, `presetHint`, `readFilter` with the kept preset, `readScope`, `filterQuery`, `scopeQuery`, `scopeCount`, `rangeLabel`, `matchesScope`), and `output.ts` for Copy-out and Reports (`DEFAULT_CHOICE`, `readChoice`: the columns and options from an address and the kept string, `choiceQuery`, `optionsLabel`). |
| `src/lib/components/timesheet/` | The Entries screen's parts, and the Filter the Calendar shares: `Toolbar` (also Copy-out's and Reports'), `FilterButton`, `FilterPanel` (the PC popover), `FilterSheet` (the phone), `ScopePicker`, `SearchField`, `FilterChips`, `DayTable` (the PC table), `PhoneList`, `RowMenu`, `BulkBar`, `BulkDialog`, `BulkForm`, `Sheet` (a bottom sheet over a native `<dialog>`); `selection.svelte.ts` (ticks, shift runs), `live.ts` (live filtering, for Entries, Copy-out and Reports, and in-place posts), `refusal.svelte.ts`, `rows.ts`, `types.ts`. |
| `src/lib/components/copy-out/` | The Copy-out screen's parts: the Copy button, Download CSV link and status (`CopyRows`) and the sheet table (`SheetTable`). |
| `src/lib/components/reports/` | The Reports screen's part: one list (`TotalsTable`, a titled section of label and duration rows with a Total row). |
| `src/lib/components/output/` | What Copy-out and Reports share: the choice's `GET` form with its no-JavaScript Apply (`ChoiceForm`), the choice as hidden fields (`ChoiceFields`), the column toggle chips (`ColumnChips`), the options (`OutputOptions`), the phone's Options button and sheet (`OptionsSheet`), the running line (`RunningLine`). |
| `src/lib/components/history/` | The History screen's parts: the PC's ruled table (`HistoryTable`), the phone's rows with their leading Undo and Redo (`PhoneHistory`), a batch's row (`BatchRow`) and its changes (`ChangeList`), the band that is the toolbar or the bulk bar, on the phone the strip with Select or its bar (`HistoryBar`, its state from `barState` in `selection.ts`), and the types its load returns. |
| `src/lib/calendar/` | The Calendar's pure logic, shared by server and browser and unit-tested: `dates.ts` (`readView`, `periodDays`, `shift`, `isoWeek`, `periodTitle`, `dayName`, `calendarHref`, `hm`), `grid.ts` (`localDate`, `localMinutes`, `instantAt`, `piecesOf`, `lanes`, `overlapping`, `dayTotals` in exact ms, `wholeMinutes` and `spanText` truncating a span to whole minutes as every screen does, `snap`, `halfHourSlot`, `dragRange`), `drag.ts` (`dropTimes`, `clampDay`, `keepIn`) and `gestures.svelte.ts` (the `swipe` attachment, `clockOf`). `drawnExtent` and `growInto` are in `src/lib/components/calendar/block.ts`. |
| `src/lib/components/calendar/` | The Calendar's parts: `CalendarToolbar`, `DatePicker`, `TimeGrid` (day and week), `EntryBlock`, `NewBlock`, `MonthGrid`, `PhoneMonth`; `block.ts` (a block's text and lines), `drag.svelte.ts` (the PC's `BlockDrag`), `now.svelte.ts` (`nowTicker`) and `types.ts`. |
| `src/lib/keys.ts` | `screenKey`: whether an unmodified key press is the screen's (outside fields, no dialog or open `data-holds-keys` details), shared by the layout and the Calendar. |
| `src/lib/components/account/` | The Account screen's Agent access parts: the token table and rows with their ⋯ (`TokenList`), the New token dialog that shows the made token once with Copy and Done (`NewToken`), and Revoke…'s confirm (`RevokeToken`). |
| `src/lib/components/admin/` | What Account, Users and Backup share: `PanelSection` (a section head over its surface panel, Setup's section), `Panel` (that surface panel alone, also the shell's error page's), `ActionMenu` (a row's ⋯: the popover from `lg`, the row sheet below, a disclosure without the script), `FormDialog` (Setup's create dialog generalised: head, body, pinned foot; `inline` the no-JavaScript panel); `items.ts` (`MenuItem`, `userItems`, `tokenItems`). |
| `src/lib/components/menu-button.svelte.ts` | `MenuButton`: a `<details>` ⋯ with the menu-button pattern, and its classes, shared by `SetupMenu` and `ActionMenu`. |
| `src/lib/components/setup/` | The Setup screen's parts: `ShowFilter` (Active, Archived, All), `SetupList` (one list's ruled rows), `SetupMenu` (a row's ⋯), `RenameRow` (rename in place), `CreateDialog` (the create dialog or sheet, on `admin/FormDialog`); `act.ts` (`setupHref`, `actionOf`, `menuButtonOf`, `act`, the `use:enhance` for its posts). |
| `src/lib/components/templates/` | The Templates screen's parts: `TemplateTable` (the PC), `TemplateList` (the phone's rows and row sheet), `TemplateMenu` (a template's ⋯); `rows.ts` (`editHref`, `whereOf`, `useLabel`, `dotOf`). |
| `src/lib/components/today/` | The Today screen's parts: the template rows and their sheet (`TemplateSheet`, usable over any screen, its fields `TemplateSheetForm`), the section head, the ticking elapsed time (the timer bar's). |
| `src/lib/components/entry/` | The entry form: `EntryForm` (the form, for a new entry and an existing one, and in its template kind the template form), `TimeRow` (Start, End and Duration), `ProjectPicker` (with `match.ts`, `matchProjects`, and `matchChoices` for a customer chosen alone), `fill.ts` (`fillValues`, a template's values into the form), `EntryOverlay` (the form over the current screen), and the types its pages load. |
| `src/lib/entry-link.ts` | `openForm` and `openInPlace`: open the entry form (or a template's, at `/templates/new` and `/templates/<id>`) over the current screen through shallow routing (`pushState`), or go to its page when it cannot be loaded in place or the form is already shown as a page. |
| `src/lib/time-input.ts` | The forgiving readers for the form's times, durations and dates (`readClock`, `readDuration`, `readDate`, `durationText`, `minutesBetween`, `endAfter`), pure and shared by the browser script and the server actions. |
| `src/lib/components/UndoStrip.svelte` | The undo strip every screen shows after an action; posts to `/undo`. |
| `src/lib/components/focus-clear.ts` | Keeps keyboard focus clear of a band pinned over the page (`scrollsWithPage`, `clearOf`): the undo strip's and the Entries bulk bar's. |
| `src/routes/(app)/undo/` | The shared `/undo` route: `core.undo`, then back to the screen it came from. |
| `src/lib/format.ts` | Formatting shared by server and browser: elapsed time, template times, warning text. |
| `src/lib/output.ts` | The copy-out's columns and writers, shared by server and browser (no server imports): `COLUMNS` and their heads, `formatDuration` (`h:mm` or decimal hours), `safeText` (the formula guard), `toTsv` and `toCsv`. |
| `src/lib/components/shell/` | The shell: `Sidebar`, `BottomBar` (with More), `TimerBar`, `StartList`, `NavIcon`, and the bar timer type; `CardPage`, a page outside the shell (the wordmark over a surface card holding the page's h1), for the sign-in page and the root error page. |
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
  control at any scroll position: the leading ⋯ leads the rows on Entries and Today,
  Copy-out's and Reports' toolbars, chips, Copy buttons and options and Today's "Manage" keep a 3.5 rem right
  margin, and the undo strip's buttons go under its message. Both link
  to `/entries/new?back=<this screen>` and carry `data-entry-form`, so the form opens over
  the screen; without JavaScript they are plain links to the page.
- **Entry form over the screen.** Any link marked `data-entry-form` is opened in place by
  the layout (`openInPlace`, a plain click only; a modified click goes to the page).
  `EntryOverlay` shows the form in a native modal `<dialog>` while `page.state.entryForm`
  holds it (its data is loaded at each open, through an address with a throwaway query so a hover preload of the same link is not reused: a form opened again shows the current minute): a centred dialog from `lg`, a sheet from under the top bar below it, ending
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
  under it, one column of content, and a fixed bottom bar of four equal cells (`BottomBar`,
  items from `barItems`): Today, Calendar (opening `/calendar?view=day`), Entries and More.
  The current screen's cell is blue and semibold. With JavaScript More is a button opening
  a `Sheet` just above the bar (`moreItems`): 48 px rows with their icons for Templates,
  Setup, Copy-out, Reports, History, Account, for an admin Users and Backup, then a rule
  and Sign out (a post to `/logout`); the current screen's row is marked, and More's cell
  is current on any of them or their sub-routes (`inMore`). A choice (a navigation),
  Escape, the scrim and Back close it. Without JavaScript More is a `<details>` over the
  page, just above the bar, with the same rows; Escape closes it and returns the focus to
  More. Every screen is within two taps.
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
  a template" (`/templates/new?back=<screen>`, opened in place over the screen). On the PC it is a popover under Start; on the phone a sheet from the
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
  `focusin` handler, `clearOf` in `#lib/components/focus-clear`, which the Entries bulk
  bar shares), so keyboard focus is never hidden (WCAG 2.4.11). A screen can turn the
  pin off (`pin={false}`): Entries does for the strip it carries inside its pinned bulk
  band. Focus in the bars
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

One column on both surfaces (`pc-today`, `ph-today`), in thumb order; no date, user or
zone lines (the date is in the entries' head, the zone is the device's):

1. **Templates** (`components/today/Templates.svelte`): the TEMPLATES head with
   "Manage templates" ("Manage" on the phone, clear of the "+") to `/templates`, then a
   row per template by name on a ruled surface: the project's dot, the name, a muted
   line of what it fills (customer › project, activity, location, reference, times; "Any
   project" when it names none), and its mark, TIMER when the result would run (no end and
   no duration) and LOG otherwise: both muted caps, TIMER with a timer icon, since blue is
   for a running timer (at the right with a chevron on the PC, leading the line on the
   phone). A row opens the template's sheet (`TemplateSheet.svelte`, a `Sheet` that is
   a centred dialog from `lg`): its name and ×, the muted line, then a field for every
   field the template leaves blank and only those: Customer › project (item 12's
   picker; from the template's customer's active projects when it has one, and with
   none "No active projects for <customer>." with Log off), Activity, Location and
   Reference; Description always, the template's own as placeholder. "Change times"
   discloses date, start, end and duration, read as the entry form reads them
   (`9`, `900`, `1.5`); blank keeps the template's. The pinned foot is Cancel and
   "Log" or "Start timer". It posts `/?/fromTemplate` with `back` (any screen may host
   the sheet) and returns there with the strip, the focus on Undo; a refusal stays in
   the sheet beside the fields. Escape, the scrim, × and Back close it, keeping
   nothing. Without JavaScript each row is a `<details>` panel holding the same form.
   No templates: "No templates yet." with "Create a template", which opens the template
   form over Today (`/templates/new?back=%2F`).
2. **Today's entries**: the head "Today · Tue 2026-10-20" (`caps`) with the day's total
   at the right, ticking: only the entries that started today count, a running one to
   now. The entries whose interval touches today, newest start first, drawn as Entries
   draws a day (`DayTable` on the PC, `PhoneList` on the phone) without tick boxes or a
   day head (`selectable`, `dayHeads` false); one started on an earlier day says
   "Since YYYY-MM-DD" under its start. A row opens the entry form over Today (`back`
   `/`); ▶ restarts a finished row (PC); ⋯ is Entries' row menu (PC popover, phone row
   sheet): Restart, Copy, Edit, Delete (at once, Undo in the strip). Overlaps carry
   the red top edge, judged against all the user's entries. Nothing today: "Nothing
   logged today."

Timers start and run in the shell's timer bar (its Start list), not on Today; a Stop
there on Today shows its Undo in Today's strip, which Today draws itself.

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

**The Calendar's filter** is the Entries screen's Filter button (`FilterButton`, with
`FilterPanel` on the PC and `FilterSheet` on the phone) without the time range, which the
calendar has in its own period: Customer › project, Activity and Location, with the chips
and "Clear filters" under the toolbar and no search. The scope is in the address
(`customer`, `project`, `activity`, `location`; read by `readScope`), carried by every
toolbar link (arrows, Today, the views, the date picker) and by the day links of the month,
and kept across moves within the visit, not between visits. `calendarFor` shows and counts
only the entries `matchesScope`; overlap marks are still judged among every entry, so a
block keeps its mark when its partner is filtered out. The toolbar's total reads
"(filtered)" while a filter is on. On the phone the filter sits in the toolbar's two rows.

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

Customers and projects, activities and locations on one screen (`pc-setup`, `ph-setup`),
reached from the sidebar and from More on the phone.

**The filter** (`ShowFilter`) is three links joined as the Calendar's view switch, **Active
| Archived | All**, Active by default, in the address (`?show=archived`, `?show=all`;
round 1's `?archived=1` reads as All, `readShow`). It takes the phone's width but for the
"+" column. The strip and every action keep the filter: a refusal and a done action return
to `/setup` under it. A create made on Archived lands on All, where the new (active) row
shows.

**The lists** are, on the PC from `lg`, two columns: CUSTOMERS AND PROJECTS at the left,
ACTIVITIES then LOCATIONS at the right; on the phone they stack in that order. Each has a
`caps` head with an outline "+ New customer" / "+ New activity" / "+ New location" (aside
on the PC, under the head on the phone), over a ruled surface panel (`SetupList`) sorted
by name, edge to edge on the phone. A customer is a 15 px semibold line; its projects are
indented beneath on hairlines with the project's colour dot (`colourOf`; the others have
none). Every row has a ⋯ at the right on the PC and leading it on the phone. Empty lists
say so: "No customers yet.", "No archived activities.". `setupTree` (`screens/setup.ts`)
shapes the lists from the core's lists read with archived rows included.

**The row menu** (`SetupMenu`, `pc-setup-menu`, `ph-setup-menu`): a customer has Rename,
Add project, a rule, Archive; a project, activity or location has Rename, a rule, Archive;
an archived row has Rename, a rule, Unarchive. Archive and Unarchive act at once with Undo
in the strip, not in red (nothing is lost). It is Entries' menu-button pattern (a PC
popover: arrows, Home and End move, Escape closes and returns the focus to ⋯) and, below
`lg` with JavaScript, the row's sheet (`Sheet`) of 48 px rows headed by the row's name over
its kind ("CompX · project", "customer"). Without JavaScript it is a `<details>` whose
Rename and Add project are links (`?rename=<id>`, `?new=project&customer=<id>`) and
Archive a post button.

**Rename in place** (`RenameRow`): the row becomes a field holding the name, selected,
with outline Cancel and the primary Save at its right (under the field on the phone);
Enter saves, Escape cancels and returns the focus to the row's ⋯; one row at a time. It
sends `rename` with the row's `expectedVersion`; a rename to the same name stores no
batch and returns without a strip. A refusal (an empty or taken name) keeps the row in
rename with the typed name and the core's message beside the field, focused; a stale
version shows the message with a Reload link; any other refusal (unarchiving a project
under an archived customer) shows under the row. Without JavaScript the same row is
rendered by `?rename=<id>`.

**Create** (`CreateDialog`, `pc-setup-create`): "+ New …" and a customer's Add project open
a 440 px dialog on the PC and a sheet on the phone: "New customer", "New project", "New
activity", "New location", with the name only, plus the customer for a project (a select
of the active customers, set to the one it came from). The name is focused, Enter
creates, the foot is Cancel and the primary "Create". A refusal (an empty or taken
name) shows beside the field and keeps the dialog open with the typed name. Escape, the
scrim and Back close it. Without JavaScript the buttons are links to `?new=<kind>` and the
same form shows as a panel in the screen.

**Archived rows** (`pc-setup-archived`) show in Archived and All, muted with an `Archived`
chip. In All an archived customer lists all its projects and an active one its active and
archived projects. In Archived only archived rows are rows: an active customer with
archived projects is not a row of its own, its name stands over them in muted text with no
⋯. A project under an archived customer keeps its own stored state but is shown by its
effect (`underArchived`): gone from Active with its customer, muted with the chip in
Archived and All, and its ⋯ holds only Rename (the core refuses its unarchive under an
archived customer). Unarchiving the customer brings it back as it was.

Every action is one core call (`create`, `rename`, `archive`, `unarchive`, with `kind`
customer, project, activity or location), posted with the filter (`show`), and returns
to `/setup` under it with the strip, the focus going to Undo (`act`). Setup draws its own
undo strip.

### Templates (`/templates`, `/templates/new`, `/templates/[id]`)

`/templates` (`pc-templates`, `ph-templates`) is reached from the sidebar and from More on
the phone. Above the list, an outline "New template" (a plus; the header's "+ New entry"
stays the one primary; full width and clear of the "+" on the phone) opens the template
form in place (`data-entry-form`, `back` `/templates`), and at the right the count ("3
templates", "1 template"). With none: "No templates yet." beside the button. The undo strip
(drawn by the screen) shows after a save, a delete or a stop; a refused Delete shows its
message above the list, with Reload when stale.

**The PC** (`TemplateTable`, from `lg`) is Entries' ruled table in a surface panel, sorted
by name: Name (the project's dot, the name in semibold, a link for the keyboard),
Customer › project (customer muted), Activity and Location (dropped under 1280 px), Times
("09:30–09:45", "0:30", or "—"), the mark (TIMER with a timer icon, LOG, both muted) and
⋯. A click on a row off its controls opens the template form in place. **The phone**
(`TemplateList`) has ruled rows to the screen's edges, a leading ⋯, the dot and name (15 px
semibold), customer › project, then activity · location · times · the mark in a muted
wrapping line; a tap opens the form, ⋯ opens the row's sheet (`Sheet`, headed by the
name over customer › project; without JavaScript the menu's `<details>`).

**The row menu** (`TemplateMenu`, `pc-templates-menu`): Edit (the form in place), Log…
("Start timer…" for a TIMER template), a rule, Delete in red. Log… opens the template's
sheet over the screen (`TemplateSheet`, as a tap on a Today row does, returning to
`/templates`); without JavaScript it links to Today. Delete posts `templates.delete` at once
with the version shown, and the strip offers it back. Entries' menu-button pattern:
arrows, Home and End move, Escape closes and returns the focus to ⋯.

**The template form** is the entry form in its template kind (`EntryFormData.kind`
`'template'`, loaded by `templateFormData`): opened in place over the screen by
`openForm` and `EntryOverlay` ("New template", "Edit template"), from Templates, Today's
"Create a template" and the Start list's; a page at `/templates/new` and
`/templates/[id]` without JavaScript. Fields in order: Name (required, focused first);
Start, End and Duration as times of day with no date (`TimeRow` with `template`: the
start may stay blank, an end not after the start reads "next day", the note "Any field
may stay blank; only the blanks are asked when it is used." in place of the hint line);
Customer › project, where a customer heading is a choice of its own (`ProjectPicker`
with `customers`: it posts `customerId` with an empty `projectId`; without JavaScript a
Customer select above the project's); Activity; Location; Reference; Description; Time
zone (a text field with the browser's zones as a `<datalist>`, hint "Blank uses the
device's zone"). The pickers list active rows plus the template's current archived ones
marked "(archived)". A template holds an end or a duration: with JavaScript the form
posts `linked` naming the one typed last (else the one it was loaded with), and
`templateFromForm` (`screens/templates.ts`) sends only that one; without it a typed end
wins. The name goes as posted, every other field trimmed with blank sent as `null`
(which clears it on an update), and a project with no customer with the project's
customer. Save sends `templates.create`, or `templates.update` with the form's
`expectedVersion`; a save that changed nothing returns without a strip. Delete (an
existing template; no Copy, Restart or Save as template) sends `templates.delete` at
once with the version; the strip offers it back. Both return to `back`, the screen the
form was opened over. Refusals show beside their fields, a stale version offers Reload,
a template deleted elsewhere says so with a link back ("Back to Templates" from
there); a missing one is a 404.
The shell's Templates item stays current on both sub-routes.

### Entries (`/entries`)

The timesheet: the entries newest first, grouped by day with each day's total, for
finding them, reading a month and reorganising it. It is in the sidebar and the phone's
bottom bar, titled "Entries" in the header; the Filter button names the range in view. The
address holds everything shown, so reload and Back return to the same table. Every write is
an existing core call; the screen enforces no rule.

**The toolbar** (`Toolbar`) is one row above the table: **Filter**, an outline button with
a funnel, labelled with the range ("This month", "2026-09-01 – 2026-09-15" for a custom
one) and "+n" for the other filters on; **Search entries** (`SearchField`, a `/` hint, a
× while it holds text); and at the right "<n> entries, <h:mm>" ("1 entry"), running entries
counted to now. While any filter other than the range is on, **chips** (`FilterChips`: the
project with its colour dot, "Activity: …") and "Clear filters" stand under it; each chip
removes its filter. The range has no chip.

**The filter** (`readFilter`, `filter.ts`) opens as a popover on the PC (`FilterPanel`) and a
sheet from the bottom on the phone (`FilterSheet`). Time range: Today, Yesterday, This week,
Last week, This month, Last month, each with its short ISO dates beside it (`presetHint`),
and Custom range with From and To (dates, inclusive, read as days in the request's zone;
one side blank is open). Customer › project (`ScopePicker`, matching either name; a
customer's heading or only a customer filters by the customer), Activity and Location
("Any", "None", then the rows). Archived rows are offered, marked "(archived)". Every
choice applies at once, with JavaScript (`live.ts`); the phone sheet's foot is a primary
"Show n entries" with the live count, which closes it, and Escape, the scrim and Back close
it keeping the choices. "Clear filters" resets all but the range. A bad date ("Use dates
like 2026-10-01.") or From after To ("From must not be after To.") shows by the fields with
no list.

**What is kept.** A preset is kept per device in the `entries_range` cookie (`httpOnly`,
400 days), written whenever the address names a preset and on a first visit; a bare
`/entries` reads it, a first visit with nothing kept opens on This month. A custom range,
the other filters and the search live only in the address. **Address parameters:**
`range` (a preset or `custom`), `from`, `to`, `customer`, `project`, `activity`,
`location` (`none` or an id; `scope=customer:<id>` or `project:<id>` is the no-JavaScript
picker's one field), `q` (the search), and `select=1` and `all=1` for the no-JavaScript
selecting below. The table's own links always carry the range.

**One search** matches reference, description, project, customer, activity and location
names (the core's `text`, literal, NFC, lowercased in English; the agent's `list_entries`
matches the same), as you type, keeping focus and scroll. `/` focuses it outside fields
and while no dialog is open.

**The table** (`DayTable`, from `lg`) is ruled and never scrolls sideways. Columns: a tick
box, Start, End (`HH:mm`, "+1" or "+n" in muted text when it ends later, "Running" in blue
`caps`), Hours (exact, truncated to the minute; a running entry to now), Customer › project
(colour dot, customer muted), Activity, Location, Reference, Description (one line, the
full text as the `title`), ▶ Restart on a finished entry, and ⋯. Below 1280 px Location and
Reference drop. Each day opens with a head row: a tick box for its rows (mixed when some
are), "Tue 2026-10-20", and the day's total under Hours. A row belongs to the day it
started in its own start zone and times show in its own zones; newest day first, newest
start first within it. Overlapping rows have a 2 px red top edge and "Overlaps another
entry" in their name, judged among all the user's entries, not only the shown. A row click
(not the tick box, ▶ or ⋯) opens the entry form in place with `back` the table's address.
A just-changed row stays marked while its undo is offered. At most 500 rows, the newest:
the 501st adds "Showing the newest 500 entries; narrow the filters."; none says "No entries
in this range." with Clear filters when filters are on, or "No entries match “<text>”."
with a link clearing the search. A read the core refuses (a search over 200 characters;
the field stops at 200) shows the core's message in red in that place, with the same link.
Each row's ▶ is named "Restart <date> <start>, <customer › project>".

**The row menu** (`RowMenu`) is a ⋯ popover: Restart (`aria-disabled` with "Already
running" on a running entry, still met by the arrow keys, its activation ignored), Copy (`/entries/new?copy=<id>`), Edit, then Delete in red. Arrow keys move,
Escape closes and returns the focus to ⋯. Delete removes the entry at once through the
entry form's delete; the strip offers Undo, and focus moves to Undo.

**Ticking and the bulk bar.** Ticking any box puts the bulk bar (`BulkBar`) in the
toolbar's place, the chips staying under it: "n selected, h:mm" over the set it acts on (wrapping, never cut)
(the range and any search), **Edit…**, **Delete** (destructive outline) and Clear
selection; clearing the last tick brings the toolbar back, focus going to the head box
when it is in view, else to the last toggled row's tick box (or the control in view
nearest it), so clearing a month down never scrolls the page.
While the bar is up, its band (the bar and the chips) is `position: sticky` under the
header (`top: var(--bars-height)`), opaque, its padding taken back by negative margins so
nothing below it moves; however far down the ticked row is, the count and the actions are
in view. A row focused under the band is scrolled clear of it (`clearOf`). While the band
is up the screen's undo strip rides inside it, over the bar, so a row's Delete, Copy or
Restart (or a Stop) shows its Undo in view and focusing it scrolls nothing. Without the
script the bar stays in its place. Shift-click ticks the run between this box and the last ticked. The ticks clear when the
shown set changes (range, filter, search) and after a successful bulk action. **Edit…**
opens the bulk dialog (`BulkDialog`, `BulkForm`, "Edit n entries"; a sheet on the phone,
its Cancel and Apply pinned): each field left as it is unless set: Project ("Keep" or an
active project), Activity and Location ("Keep", "None" or an active row), Reference (blank
keeps it; "Clear the reference"), and a literal, case-sensitive Find and Replace with in
the description (a Find of only spaces is blank; a description left empty becomes none).
`bulkUpdates` reads each selected entry as it is now and builds one `entries.update` per
entry the form would change, only the changed fields, with the posted `expectedVersion`,
oldest start first; Apply sends them as one `core.batch` labelled `Edit <n> entries`
(`Edit 1 entry`, `n` counting the updates). **Delete** removes the ticked entries at once,
one batch of `entries.delete` with each version, labelled `Delete <n> entries`; there is
no confirm, the strip offers Undo. Each ticked row posts `id` and its loaded
`version.<id>` (`selection`; a repeated id is taken once). Nothing selected says "Select at
least one entry."; nothing to change stores no batch and says "Nothing to change.". Both
actions redirect to the table they were posted from with the strip, and undo returns there.

**Refusals** show in the dialog (or, for Delete, above the table) with the selection and the
posted values kept. One refused entry refuses the whole batch (`runBulk` tracks the input in
flight, so a rule thrown inside the batch is also traced to its entry); the message names
the entry ("2026-10-07 09:00, CompA › ProjC: <the core's message>", in the entry's start
zone), and a Reload link shows only when that entry's posted version is stale. An entry
deleted elsewhere cannot be named: when the form would set a field on it the core's "Not
found." shows alone, with no Reload; when it would not (a Find its text no longer has), it
is skipped. Field messages show beside the dialog's fields.

**The phone** (below `lg`) takes `PhoneList` in the table's place: the toolbar scrolls with
the page: Filter (full width but for Select) and **Select**, the search under them, the
count and total under that. Each day is a `caps` head ("TUE 2026-10-20") with its total on
a text-colour rule; the rows run to the screen's edges, at least 64 px with the project's
4 px bar, a leading ⋯ (44 px), start over end ("Running" in blue under a running entry's
start), customer › project in semibold (wrapping to a second line), activity · location ·
reference and the description in muted lines that wrap, never cut (the row grows), and the
duration at the right, kept out of the "+"'s column (72 px
right margin). An
overlap has a red top edge and "Overlaps another entry" in red. A tap opens the entry form
as a sheet; ⋯ opens the row's sheet (`Sheet`, a bottom sheet over a native `<dialog>`;
Escape, the scrim and Back close it), headed by the row it came from, with Restart, Copy,
Edit and Delete as 48 px rows (Delete red; Restart is the phone's only per-row restart).
**Select** swaps every ⋯ for a tick box, gives each day head one, hides the "+" and puts the
bulk bar ("n selected" over the total, Edit…, Delete, Done) in the toolbar's place, pinned
under the timer strip as an edge-to-edge surface band on a rule while selecting; Edit…
opens the bulk form as a sheet, and Done leaves selecting, clearing the ticks and returning
the focus to Select when it is in view (else to the last toggled row's ⋯, the page staying
where it is).

**Without JavaScript** the screen works as pages. The filter is a `<details>` holding a GET
form with a Show button; the search submits on Enter; the PC table shows its tick boxes and
the bulk bar's Edit and Delete at all times, posting the ticked rows (`?/edit` shows the
bulk form as a page, `?/apply` and `?/delete` act); a "Select all" link reloads with
`&all=1`, every row checked, and the day heads' boxes are hidden; the phone's Select is a
link to `select=1` that reloads with tick boxes; the row menu is a `<details>` of links and
post buttons. The parts only these pages have carry `data-nojs`: an inline script in
`src/app.html` puts `js` on `<html>` before the first paint and `layout.css` hides them
under it, so with JavaScript they never show and nothing moves when the page hydrates. Live search and filtering, shift-click, `/`, the ticking total and the
popovers' focus handling need JavaScript.

### Copy-out (`/copy-out`, `/copy-out/csv`)

A PC screen (in the sidebar after Entries, under More on the phone) that writes a month's
entries out as the columns chosen, to paste into Excel or download as CSV; the phone gets
it reduced, with no sheet. It only reads: nothing rounded or split is stored. It is
Entries' toolbar and filter over an output band and a sheet, and there is no Show: every
choice applies at once.

**The address** says the whole view, so a copy-out is a URL: the range (`range=<preset>`,
or `range=custom` with `from` and `to`), the scope (`customer`, `project`, `activity`,
`location`, as on Entries), `q` (Entries' one search), `cols` (the columns on, comma
separated, in the fixed order Date, Start, End, Duration, Customer, Project, Activity,
Location, Reference, Description whatever order they are named in), `round` (`1`/`0`),
`split` (`1`/`0`) and `duration` (`hm` or `decimal`). The no-JavaScript form repeats `cols`
once per ticked box and sends each switch as a hidden `0` then its `1` (the last counts);
`readChoice` (`filter/output.ts`) reads both. An unknown column or value is ignored; a bad
date ("Use dates like 2026-10-01.", impossible ones such as 2026-13-01 included: `isDate`
refuses them rather than failing) or From after To shows by the filter's fields, with no
rows.

**What is kept.** Two `httpOnly` cookies, 400 days, written by `keepOutput`:
`output_range` is the preset, shared by Copy-out and Reports and apart from Entries'
`entries_range` (choosing Last month here does not move Entries); a custom range is never
kept and lasts for the visit, a first visit with nothing kept opens on This month.
`output_choice` is the columns and options as one query (`choiceQuery`). **The address
beats them:** a name the address lacks comes from the cookie, then the default (all ten
columns, rounded, unsplit, `h:mm`). An address that names a preset writes `output_range`
(as Entries does); one that names any of `cols`, `round`, `split`, `duration` writes
`output_choice`, unless it names no column: an empty column set is not kept, so the kept
columns stay as they were (`readOutput` returns `keepRange` and `keepChoice`). The CSV
route reads both and writes neither.

**The toolbar** is Entries' `Toolbar` (`action`, `noun` and a `hidden` snippet are its
parameters now: the screen's path, what the count counts, and the fields the filter's form
carries along, here the four choice names via `ChoiceFields`, so a filter change keeps the
columns and options), with `FilterChips` under it and the running line
(`output/RunningLine`). `live.ts`'s `applyForm` goes to the form's path and, for `/copy-out`
and `/reports`, adds the form's choice names to the address; a form naming none leaves the
kept choice to apply. The count reads "<n> rows · <total>" ("1 row"); the filter sheet's
foot reads "Show n rows". The count and total are of the rows even with no column on, and
the total follows the Duration option.

**The output band** (from `lg`, `ChoiceForm` over `ColumnChips`, `OutputOptions` and
`CopyRows`) is a surface panel above the sheet. **Columns**: the ten as toggle chips in
the fixed order, 36 px, each a `button` with `aria-pressed`; on, an `accent` fill, semibold
and a check before the name; off, the surface, muted text, the `checkbox` stroke (3:1). A
chip never refuses a click. Under a rule the **options** line: Round to 5 minutes and Split
at midnight as checkboxes and Duration as a two-button segmented `radiogroup` (`h:mm` |
Decimal). **Copy n rows** (the screen's one blue primary, a copy icon) and **Download CSV**
(outline, `csvHref`) sit at the band's right from `xl`, below it in a row under the
options; a polite status line under them. Each change posts `applyForm` at once.

**The rows.** `sheetFor` asks `entries.list` (`outputInput`: `listInput` with `order: 'asc'`
and no `limit`) for the entries that started in the range, **oldest first with no row
limit**, and `outputRows` turns them into rows of text: the date and start in the start
zone, the end in the end zone (a time on the row's date, `24:00` at exactly the next
midnight, else `YYYY-MM-DD HH:mm`), the duration in the chosen format, and the names,
reference and description as stored. Rounding moves both ends to the nearest 5 minutes (2.5
up) and the duration is their difference; without it times are cut to the minute. Splitting
comes after rounding and cuts an entry at each midnight of its start zone into one row per
day, a piece of no length not written. A text value starting with `=`, `+`, `-`, `@`, a tab
or a carriage return gets a leading `'` (`safeText`); dates, times and durations never do.
Running entries are left out and counted: "1 running entry left out." / "<n> running
entries left out." in muted text under the toolbar (under the chips).

**The sheet** (`SheetTable`, from `lg`) is Entries' ruled table in a surface panel: a muted
`caps` head band, one column per chip on, rows divided by hairlines, dates, times and
durations in figures, Duration right-aligned, every value exactly as Copy writes it. Nothing
is cut with "…": text columns wrap and Description takes the rest of the width and wraps;
all ten fit the 72 rem measure at 1440 px, and below that the panel (never the band)
scrolls sideways inside itself. With the Duration column a Total row ends the panel, on a
text-colour rule; without it the toolbar alone says the total. Rows are not links and have
no menu.

**No column, no match.** With no column on, the band says "Choose at least one column." in
red under the chips (`columnsError`), no sheet shows, and Copy and Download CSV are off:
`aria-disabled`, 50 %, still focusable and described by the reason. With no entry matching,
"No entries match." takes the sheet's place with Clear filters when a filter other than the
range is on (and the running line, when the only matches run), and both actions are off the
same way. The core's refusal of the read (a search over 200 characters) shows in red in
that place.

**The phone** (below `lg`, at any width, tablets included) has no sheet: the toolbar as
Entries' (Filter taking the width, the search under it, the count and total under that),
then Copy n rows and Download CSV, full width, stacked, 44 px, with the status; a
**COLUMNS** section (a `caps` head on a rule, the ten chips at 44 px, wrapping); an
**OPTIONS** section (the checkboxes and the segmented Duration at 44 px). Everything keeps
out of the "+"'s column (a 3.5 rem right margin). The screen renders both layouts on the
server and a media query (`MediaQuery` at 1024 px) keeps one once the script runs.

**Copy** (`CopyRows`, `data-js`) writes `toTsv` of the page's rows to the clipboard: values
separated by tabs, lines by `\r\n`, no header, a tab or line break inside a value replaced by
a space, and a value that starts with a quote wrapped in quotes with its inner quotes
doubled (so Excel keeps it whole). A polite status line says "Copied <n> rows." ("Copied 1
row.") or "Copy failed; select the table and copy it." and clears when the rows change. The
focus stays on Copy.

**The CSV route** (`/copy-out/csv`, `+server.ts`) reads the same address through
`readOutput` (a preset resolves as on the screen; the screen links it with `outputQuery`,
all four choice names) and the kept cookies for what the address lacks, so a bookmarked
`/copy-out/csv?range=last-month` downloads what the screen would show; it writes no cookie.
It answers `toCsv` of the same rows: a byte-order mark, a header row of the column heads,
values comma-separated and quoted when they hold a comma, a quote or a line break (quotes
doubled, line breaks kept), lines ending `\r\n`; `Content-Type: text/csv; charset=utf-8`,
`Content-Disposition: attachment`, named `time-keep-<from>-<to>.csv` with a blank side
written `all` (`csvName`). The app layout's load does not cover a `+server.ts`, so the route
calls `requireUser` itself (signed out: 303 to `/login`) and reads only that user's
entries. A query the screen would refuse (a bad date, From after To, no column, a refused
list) is a 400 with the screen's message as plain text.

**Without JavaScript** the page is a plain `GET` page, as Entries is. The filter is
Entries' form with its own submit; the columns are checkboxes (`data-nojs` labels, repeated
`cols`) and the options a checkbox pair and a radio pair in the `output` form with an
**Apply** submit (`ChoiceForm`); the chips and Copy are `data-js` and hidden, so there is no
Copy (the sheet is selected and copied by hand; the CSV works everywhere). **The
convention:** a part only the no-script page has carries `data-nojs` and `layout.css` hides
it under `.js`; a control that needs the script carries `data-js` and is hidden under
`html:not(.js)`. The inline script in `src/app.html` sets `js` before the first paint, so
nothing moves on hydration.

### Reports (`/reports`)

A PC screen (in the sidebar after Copy-out, under More on the phone) that shows a month's
entries as totals per day, week, customer and project, to check a month before copying it
out; the phone gets the same lists stacked. It only reads: nothing rounded or split is
stored, and the totals are computed on the way out.

**The address, the kept cookies and the toolbar** are Copy-out's, read by the same
`readOutput`: the range, scope, `q` and the choice names (`cols` is carried through
`ChoiceFields` or `ChoiceForm` so Reports never changes the kept columns; a missing column
does not stop a report), the same `output_range` and `output_choice` cookies, so Reports
opens on the range Copy-out was left on with the same options. The count reads
"<n> entries · <total>" ("1 entry"): split at midnight can make more Copy-out rows than
entries. The total follows Duration, and every total on the screen is the sum of the
Copy-out rows it covers for the same address.

**The options** are always shown on the PC as a line under the toolbar (`ChoiceForm` over
`OutputOptions`, applied at once). On the phone an outline **Options** button, labelled with
the options ("Options · h:mm, rounded", "Options · decimal, exact, split": `optionsLabel`),
sits clear of the "+"'s column and opens a bottom sheet (`OptionsSheet` over `Sheet`: the
head "Options", the options at 44 px, each change applied at once, a pinned full-width
"Done" closing it and returning the focus to the button).

**The totals.** `reportFor` asks `entries.list` (`outputInput`) for the entries that started
in the range, with no row limit, and `reportTotals` sums the pieces `outputPieces` gives
(the same code that writes Copy-out's rows, so a day's total is the sum of the rows with that
date): by the piece's date (Days, "Thu 2026-10-01", `labelOf`, oldest first; only days with
time), by its ISO week (`isoWeek`, Monday first; Weeks, `weekLabel`: "W40 · 2026-09-28 –
10-04", the week's Monday and its Sunday without the year, or the Sunday in full when its
year differs: "W53 · 2026-12-28 – 2027-01-03"; weeks are ISO, so 2026-12-31 is W53), by
customer id (Customers, by name) and by project id (Projects, the project's 8 px dot, the
customer muted, "›", the project, by customer then project). An entry rounding to nothing
is a piece of `0:00` and its groups are listed. Running entries are left out and counted.
Every list's Total is the same number, and it equals the toolbar's. The lists are numbers
only (no share, bar or chart) and read-only: a row leads nowhere.

**The lists** (`TotalsTable`, each a section named by its `caps` head on a text-colour rule
over a surface panel of ruled rows, label at the left and duration at the right in figures,
a semibold Total row at the foot on a text-colour rule; the table's own heads are for screen
readers). On the PC two columns: Days on the left, Weeks, Customers and Projects stacked
at the right. On the phone one column, the panels edge to edge with the heads keeping the
16 px margin, in the order Customers, Projects, Weeks, Days. Nothing matching says "No
entries match." with Clear filters when a filter other than the range is on (and the
running line, when the only matches run), with no lists. A date mistake shows by the
filter's fields, other refusals as on Copy-out.

**Without JavaScript** the PC options line is a form with its own **Apply**, and the phone's
Options is a `<details>` holding the same form; the filter is Entries' form. Both layouts are
rendered and CSS shows one.

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
both are empty, "No end: the timer keeps running." on the running entry; in timer mode (`?timer=1`) the form fills date and Start with now and posts them with a hidden `startNow` (`date` + `T` + start), so an untouched Start (still that value, no end, no duration) starts the timer at Save, via `timers.start`, not at the minute the form opened; "Start at previous end HH:MM" from `/entries/previous-end`),
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
user's changes were recorded in, newest first, to find one batch (what it touched, when,
who made it) and undo or redo it, or chosen changes, in one step; it has phone rows
below 1024 px. Undo and redo are `core.undo` and `core.redo` (see [core.md](core.md));
no rule is enforced in the screen.

**The page** asks `history.list` for 51 batches and shows 50, and `history.page` (see
[core.md](core.md)) for the page's place: the number of the user's batches, the place of
the page's first, and the `before` of the page 50 newer. An unknown or blank `before`
redirects to `/history`. None says "Nothing recorded yet."

**The toolbar** is one 52 px band above the table. At the left "1–50 of 312 batches" (the
range in semibold figures, "1–7 of 7 batches" when it all fits; "batch" for one); at the
right outline **Newer** and **Older** with chevrons, each disabled where it leads
nowhere. Older loads `/history?before=<the 50th batch's id>`; Newer the `before` from
`history.page`, `/history` on the second page. The same two as links under the table
(each only when it leads somewhere). A page change clears the ticks and closes the
batches.

**The table** (from 1024 px) is Entries' ruled table in a surface panel, never scrolling
sideways: a caps header (Time, What, By, Changes, State, and the actions), then per day
a head row, "Wed 2026-10-21" in semibold (`dayHeading`, in the request's zone) with "<n>
batches" muted at the right (that day's on this page), and its batch rows. A day that
runs onto the older page ends in "Continues on the older page.". A row, 56 px or more:
its time (`HH:mm`), a chevron, the label as the core stored it (semibold, cut with "…"),
under it the **touched line** (`touchedLine`, 12 px muted, from all the batch's changes,
not only the first 100: an entry's date, times and customer › project, several entries'
date range and up to three customers › projects then "+<n> more", other records as the
change lines name them, "3 locations", kinds joined with " · "), an "Agent" or "System"
chip (none for a batch made in the UI), "1 change" / "<n> changes", the state ("Undone"
when every change is undone, with the label and time muted; "Partly undone, <k> of
<n>"; blank when it stands, from `batchState`), and outline 32 px buttons with icons:
Undo when any change stands, Redo when any is undone, both on a partly undone batch,
named "Undo <label>" / "Redo <label>". Undo and redo batches are listed like any other.
The touched line takes one line from 1280 px; from 1024 to 1279 px it may take two, and
Changes and State share one column, the state under the count in 12 px, so What keeps
room for the customer › project. A `›` never starts a line.

**Opening a batch.** A click anywhere on the row but its buttons (not while text is
selected), or Enter or Space on the row's disclosure button (`aria-expanded`), opens its
changes under it, indented to the What column; several can be open, a second click
closes it, and the chevron turns. The ticks and open batches survive opening and closing.

**A change** is one line, in the batch's order (`describeChange`): a tick box, the verb
in semibold (Created, Changed, Archived, Unarchived, Deleted) and the record in sentence
case ("Changed entry 2026-10-07 09:00–10:30, CompA › ProjC", "Created customer CompA",
"Archived location Office"; an entry named from its row after the change, before it for
a delete, its times in its own zones, a running one "09:00–running"). An update adds a
line per field that differs, "Description: old → new", the field and old value in muted
text, blank written as a muted italic "none", ids as current names (`namesFrom`: every
row, archived included; an id not found reads "(unknown)"), text cut at 80 characters
with "…"; an entry's start and its zone are one "Start" line, its end and zone one "End"
line. A field whose two sides read the same shows both with a muted "(same as shown)",
never "none → none". Bookkeeping columns and `id` never show. An update that changes
only `archived_at` reads Archived or Unarchived with no field line. An undone change is
muted and ends in a muted caps "Undone". A ticked line fills with the accent. A batch of
more than 100 changes lists the first 100 without tick boxes and ends "The first 100 of
<n> are listed. Too many to choose one by one: undo or redo the whole batch."; its row's
Undo and Redo work as on any row.

**Choosing changes.** Ticking a change puts the bulk bar in the toolbar's place, the same
52 px band, so nothing below moves; while up the band is sticky under the header and the
undo strip rides in it, and focus landing on a row is scrolled clear of it. The bar: "<n>
selected", then muted `of “<label>”` when the ticks are in one batch or "across <k>
batches" (`barState`), outline **Undo selected** and **Redo selected** with icons, and a
ghost **Clear**. Undo selected is enabled when every ticked change stands, Redo selected
when every one is undone; otherwise each stays, disabled (`aria-disabled`, kept in the
tab order). A mixed selection disables both and the bar says "Tick only standing or only
undone changes." instead of the scope. The enabled state is a hint; the core decides.
Clear, or unticking the last box, brings the toolbar back with focus on the last toggled
tick box.

**Undoing and redoing.** The list is one `POST` form. A batch's Undo and Redo post its
`batchId` to `?/undo` or `?/redo` (the ticks are then ignored); the bar's buttons post
every ticked `changeId` (`readChangeIds`: deduped; none says "Select at least one
change.", more than 1000 "Select at most 1000 changes."). The core labels the new batch
`Undo "<label>"` / `Redo "<label>"` for a batch, `Undo <n> changes` / `Redo 1 change` for
chosen changes. No confirmation: success redirects (303) to the page posted from
(`historyPath`, its `before` kept) with the **strip** (`Done: Undo
"<label>".`, its Undo, the core's warnings), and focus goes to the strip's Undo. The row
acted on reads its new state with its buttons flipped, and the new batch heads the
newest page.

**Refusals.** A refused undo or redo re-renders the page posted from with the core's
message in a red-bordered alert above the list (`role="alert"`, focus on it, the page
kept at the top if it was), no strip, the ticks kept and their batches open; nothing
changed. A refused whole-batch Undo shows the same alert with no ticks. The alert goes
with the next action or load.

**The phone** (below 1024 px) has the toolbar as a surface strip: "1–50 of 312" at the
left and an outline **Select** at the right, clear of the "+"'s column; Newer and Older
are the links under the list. Per day a head ("Wed 2026-10-21", "<n> batches") and
ruled rows on a surface edge to edge, the right 72 px clear of the "+". A row leads with
a 44 px icon button where Entries' rows have their ⋯: Undo on a standing batch, Redo on
an undone one, both on a partly undone one (Undo over Redo), each named for screen
readers. Then the time, and the text: the label (15 px semibold, wrapping), the touched
line (12 px, wrapping, never cut) and a meta line with the chip, "<n> changes" as an
underlined disclosure (44 px target, `aria-expanded`) and "· Undone" / "· Partly undone,
<k> of <n>". It opens the changes under the row, indented to the text. **Select** puts
the bar in the strip's place, pinned under the timer strip: "<n> selected" (the scope
or the mixed reason under it), **Undo**, **Redo** (enabled as on the PC) and **Done**;
tick boxes (a 20 px box in a 44 px target) appear on the open batches' change lines, the
leading buttons and the "+" go. Done clears the ticks and returns focus to Select.

**Without JavaScript** the same page: a batch's changes are a native `<details>`, the
actions are submit buttons (over the summary's actions column on the PC, under it on the
phone), and Undo selected and Redo selected show at all times above the table, posting
the ticks. The phone's Select is a link to `?select=1` (the same page with tick boxes,
kept through a refusal and a redirect back), its bar Undo, Redo and a Done link back.
Both layouts render, CSS showing one, so the phone's tick boxes and its bar's Undo and
Redo are in a form of their own (`history-phone`): each layout's buttons post only the
boxes it shows, and after a refusal an untick and a retry post the new ticks. Newer and
Older are links.

**Keys and focus.** Tab reaches each row's disclosure, its Undo and Redo, each tick box,
the bar's buttons and the pager in reading order; a disabled bar action is announced
disabled. Focus goes to the strip's Undo after an undo or redo, to the alert after a
refusal, to the last toggled tick box after Clear and to Select after Done. Targets are
36 px on the PC (the 32 px buttons padded), 44 px on the phone. No button but the header's
"+ New entry" is primary (a ticked box takes the primary fill); red is only the refusal.

### Account (`/account`)

In the sidebar, and under More on the phone. A 48 rem column of two `PanelSection`s 32 px
apart: **Change password** (see Accounts and sessions) and **Agent access**, the user's
tokens for agents (decision 6, [mcp.md](mcp.md)).

**Change password** is a panel of three ruled rows (Current password, New password,
Confirm new password; a 12 rem label column from `lg`, the label over the field below)
and a foot with the primary **Change password**, at the right on the PC and full width
on the phone. It posts `?/password`. A refusal shows under its field ("Passwords do not
match." under Confirm new password, the length rule under New password, a wrong current
password under Current password), described by it, and with the script the field takes
the focus; "Password changed." is a Messages alert at the section's head.

**Agent access** has the outline **+ New token** at its head and lists the tokens newest
first: from `lg` a ruled table in the panel (Name semibold and wrapping, Made, Last used
as date and `HH:mm` in the request's zone or "Never used" muted, ⋯), below it one row
each with the leading ⋯, the name and "Made <date> · Last used <date> <time>" (a date and
time never break); none says "No tokens yet.". Under the panel a muted line says what a
token is for. **+ New token** opens the dialog "New token" (`FormDialog`, a sheet on the
phone; `components/account/NewToken.svelte`): Name with its hint, Cancel and **Create
token**, posting `?/createToken`; the name is trimmed, 1–100 characters ("Name must be
1–100 characters."), unique per user case-insensitively ("You already have a token with
that name."). A refusal stays in the dialog under Name, the name kept, and Name takes the
focus. Made, the dialog becomes "Token made: <name>": the token once, in a read-only mono
field on the muted fill that selects itself on focus, "Copy it now: it is not shown
again.", a primary **Copy** (it takes the focus; "Copied" once the clipboard has it) and
an outline **Done**. However it closes (Done, ×, Escape, the scrim, Back) the page
forgets the post's answer (`applyAction` of nothing), so no reload, Back or reopen shows
the token again; the focus returns to **+ New token**. Leaving the document with it open
(`pagehide`), or coming back from the back/forward cache with it (`pageshow`), forgets it
too. A line's ⋯ (`ActionMenu`) holds
**Revoke…** (red), which opens the confirm "Revoke "<name>"?" with "Agents using it lose
access at once. This cannot be undone.", Cancel and a destructive **Revoke** posting
`?/revokeToken` with `id` and `confirm=yes` (`RevokeToken.svelte`; Revoke takes the
focus, Escape returns it to ⋯). Done, the line leaves, "Token revoked." shows at the
section's head and the focus goes to **+ New token**. An unknown id says "Token not
found." there. No undo: accounts are outside the history (decision 4).

Without JavaScript **+ New token** is the link `?new=token` and the dialog's form shows
as a panel at the section's head (Cancel a link back to `/account`); a refusal comes
back in it, the name kept. The made token shows in that panel with Done, a link back to
`/account`, and no Copy. Revoke… is the ⋯ disclosure's link `?revoke=<id>`, and the
confirm (also round 1's `confirmRevoke`, a post without `confirm`) shows as a panel there.

### Users (`/admin/users`)

Admin only (`requireAdmin`: signed out 303 to `/login`, a non-admin 403), in the sidebar
after Account and under More on the phone. A 48 rem column with one `PanelSection`,
**Users**, with the outline **+ New user** at its head.

The users are listed by username: from `lg` a ruled table in the panel (Username
semibold with "(you)" muted after your own, Role "Admin" or "User", Created as the date
in figures, ⋯), below it one row each with the leading ⋯, the username (15 px semibold)
with the Admin chip, and "Created <date>" muted under it ("· you" on your own). A disabled
user's name is muted and struck through, with the spent chip "Disabled" after it. A
32-character username wraps inside its cell; nothing sits in the phone "+"'s column.

A row's ⋯ (`ActionMenu`, the popover from `lg`, the row sheet below headed by the username
over "<Role> · created <date>") holds **Set password…** and, after a rule, **Disable** or
**Enable**; your own row has no Disable (the server refuses it anyway). Neither is red.

- **+ New user** opens "New user" (`FormDialog`, a sheet on the phone): Username (hint "3
  to 32 characters: a–z, 0–9, dot, underscore, hyphen."), Password (hint "10 to 256
  characters."), the Admin checkbox, Cancel and **Create user**, posting `?/create`. A
  refusal stays in the dialog under the field it names (`fieldOf` in
  `screens/accounts.ts`), the username and Admin kept, the password empty, and that field
  takes the focus. Done, the dialog closes onto **+ New user** and "Created <username>."
  shows at the section's head.
- **Set password…** opens "Set password for <username>": New password with the hint "10
  to 256 characters. Signs <username> out everywhere; their agent tokens keep working."
  (on your own row "10 to 256 characters. Signs you out everywhere else; your agent
  tokens keep working."), Cancel and **Set password**, posting `?/setPassword` with
  `userId`. It ends that user's sessions (on your own row the others, keeping yours) and
  leaves their tokens. A refusal stays under New password; done, the focus returns to the
  row's ⋯ and "Password set." shows. A Set password for a user no longer in the list
  says "User not found." at the section's head.
- **Disable** and **Enable** post `?/disable` and `?/enable` at once and say "User
  disabled." or "User enabled."; the focus stays on the row's ⋯. Disabling ends the
  user's sessions and deletes their tokens; enabling brings back sign-in, not tokens.

No undo: accounts are outside the history (decision 4). Without JavaScript **+ New
user** is the link `?new=user` and Set password… the ⋯ disclosure's link
`?password=<id>`: the dialog's form shows as a panel at the section's head (Cancel a
link back to `/admin/users`), and a refusal comes back in it. Disable and Enable are the
disclosure's plain posts.

### Backup (`/admin/backup`)

Admin only (`requireAdmin`: signed out 303 to `/login`, a non-admin 403), in the sidebar
after Users and under More on the phone (decision 7). A 48 rem column of `PanelSection`s
32 px apart, each a panel of ruled lines whose foot holds its button, at the right from
`lg` and full width below.

**Backup**: "A backup is the whole database: every user, their time data and history.
Keep it somewhere safe; it holds password hashes." and the primary **Download backup**,
a link to `GET /admin/backup/download`. The route answers
`application/vnd.sqlite3` as an attachment named `time-keep-YYYY-MM-DD-HHmm.db` (the
admin's zone, from the `tz` cookie); the file is a vacuumed copy of the database with
no `session` or `access_token` row, taken in a temporary file next to the database and
removed when the request ends.

**Restore**: "Restoring replaces every user's data with the backup's and signs
everyone out.", a row **Backup file** (a file input, `accept=".db"`, its button dressed
as an outline button and the chosen name muted beside it) and the foot's destructive
**Restore…** (DESIGN.md's red outline), in one `multipart/form-data` form posted to
`?/restore`. With the script, Restore… with no file chosen says "Choose a backup file."
in the panel and opens nothing; with one it opens the confirm "Restore this backup?"
(`FormDialog`): "Restoring <file name, mono> replaces every user's data with the
backup's and signs everyone out, you included." and the muted "The data as it is now is
kept, and can be downloaded under Before the last restore.", Cancel and a destructive
**Restore** (it takes the focus), which posts the form with `confirm=on`. Without
JavaScript there is no confirm: the form keeps round 1's checkbox **Replace all data with
this backup** above the foot, and Restore… posts at once.

The action refuses, changing nothing,
with "Choose a backup file." (none or empty), "Tick the box to confirm the restore." (without JavaScript),
"This file is not a time-keep backup." (not SQLite, a failed integrity check, no
`__drizzle_migrations`, a table or column that differs from the running schema, or a
foreign key violation; `__drizzle_migrations` must exist but is neither compared nor
copied), "This backup is from a newer version of time-keep.", "This
backup has no admin who can sign in." and "The restore failed; nothing was changed."
(the copy rolled back, or the upload could not be written); the message shows as a red alert in the Restore panel, above its foot, and describes the file input. An older
backup is migrated first. Then the running data is written, as a backup, to
`time-keep.before-restore.db` beside the database (one file, replaced at each
restore), and every row is copied into the running database in one transaction on the
app's own connection (sessions and tokens are not copied, so everyone is signed out,
the restoring admin included, and agents need new tokens). The action redirects to
`/login?restored=1`. A restore is not recorded in the history: it replaces it.

**Before the last restore**: only when that file exists: "The data as it was just
before the last restore, <YYYY-MM-DD HH:mm>." (the file's time, in the admin's zone,
never wrapping) and the foot's outline **Download**, `GET /admin/backup/download?before-restore=1`, named
`time-keep-before-restore-YYYY-MM-DD-HHmm.db`. Restoring it is an ordinary restore.

### The sign-in page (`/login`)

Outside the shell, on `CardPage`: no dark bar. On the ground, centred from `sm` (56 px
from the top below), the wordmark (the sidebar's blue ring and "time-keep", 24 px bold)
and 24 px under it a surface card (`border` stroke, 4 px corners, at most 400 px wide,
32 px padding; 20 px on the phone): the h1 "Sign in" centred, Username, Password and a
full-width primary **Sign in**. The page's title is "Sign in". Signed in already, it
redirects to Today.

The password field has the eye at its right end (a ghost icon button, script-only,
`data-js`): "Show password" or "Hide password" with `aria-pressed`, switching the field
between hidden and shown and keeping the focus where it was. "Wrong username or
password." and "Restored. Sign in with the backup's passwords." are Messages alerts in
the card above the fields; a refused sign-in keeps the username and focuses the
password. There is no "forgot password": the admin sets passwords on Users.

### The error pages

The status codes stay (404, 403, 500). The title is "Not found" for a 404, else the
error's own message ("Admins only"); one sentence goes under it ("There is nothing at
this address.", "Only an admin can open this page.", "Something went wrong on this
page."), and an outline **Back to Today**. Inside the signed-in shell (a non-admin on
`/admin/…`, a missing entry) the header's title is the error's and the page is one
surface panel (`Panel`) with the sentence and the link. Outside it (an unknown address,
signed in or not) the sign-in page's wordmark and card hold the title as the h1, the
sentence and a full-width Back to Today. The document title is the error's title.

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
  `entries.test.ts` covers Entries with a user of its own per test (`seedMonth`):
the PC table (newest day first with day totals, overlaps, the count; a preset
applying at once and kept; the search by any field and `/`; chips; a row opening its form
in place; the row menu by mouse and keyboard; Restart; the narrower widths; the empty,
unmatched and refused states; the 500-row cut; ticking by day and by shift-click;
Edit… and Delete in one batch with Undo; ticks clearing; a ticked entry changed elsewhere
refused by name; the checkbox, accent and focus rules) and the phone list (the toolbar,
the filter sheet, the row sheet, Select with the bulk sheet and Undo), each with its
no-JavaScript posts; `history.test.ts` covers History with a user of its own per test, who has
  no batch until seeded: finding an edit by what it touched, undoing it from the row and
  redoing it, a batch's three changes partly undone with a mixed tick saying why, the
  touched line keeping its customer › project at 1024 px, the last untick bringing the
  toolbar back with the focus kept, changes of two batches undone as one, a refused undo
  in view with the focus on it and nothing changed, 51 batches paging by the toolbar and
  the foot links (System chips on the seeded ones) and exactly 50 with both disabled, an
  undo on an older page landing back there, a batch of more than 100 changes without
  tick boxes, a batch's own Undo beating a tick on another batch, a rename's field line,
  an unknown `before` returning to the newest page, a forged batch id showing "Not
  found.", the Agent chip, the phone (leading buttons, opening, Select, tick, Undo, Done;
  short rows; long labels wrapping; a refusal), the phone and PC without JavaScript
  (`select=1`, ticks posted, a mixed selection refused by the core, an untick and a
  retry after a refusal, paging by links)
  and the sidebar's current item; `copy-out.test.ts` covers Copy-out
  with a user of its own per test (`seedCopyOut`: four entries this month, one of
  them overnight, one with a comma, a quote and a line break in its description
  and one starting with `-`, one last month and a running timer): the month as
  written with its Total and the running line, Last month and the chips kept between
  visits, Copy (the clipboard granted; tab-separated, no header, one line per row),
  a project chip and the CSV of the columns on, exact minutes, decimal hours and Split
  at midnight, the live search and no match with both actions off, no column on (the
  kept columns unchanged), nothing cut at 1440 px and the band at 1024 px, the phone
  (no sheet, nothing under the "+", no sideways scroll), the CSV route signed out, for
  another user and with bad queries, and the no-JavaScript chips, Apply and CSV link
  with no Copy button; `reports.test.ts` covers Reports with a user of its own per test
  (`seedCopyOut`): the four lists each totalling the toolbar's, Days at the left and the
  rest stacked, the options applying at once and Last month keeping them, the range and
  options Copy-out kept, Reports leaving Copy-out's kept columns alone, totals equal to
  Copy-out's rounded and not, the live search, only a running entry matching, a project
  chip, the phone's Options sheet and Customers first, and the no-JavaScript Apply and
  `<details>`; `filter/output.test.ts`, `screens/output.test.ts` and the two screens'
  route tests (`copy-out-routes.test.ts`, `reports-routes.test.ts`) cover the address,
  the kept cookies and the CSV route's reading; `entry-form.test.ts` covers the entry form and the timer bar (a user of its own per
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
  with a user of its own per test (`seedEmptyUser`), at both widths: "+ New token" in
  its dialog, the token shown once with Copy (focused; "Copied", the clipboard holding
  it) and Done, the list's "Never used", no `tk_` in the page's text or fields after
  Done, a reload, Back and Forward, Escape or Back while it shows, and an empty Name on
  reopening; a duplicate name refused under Name, kept and focused; a 100-character
  name with no sideways scroll and its ⋯ in view; ⋯ → Revoke… → the confirm (Revoke
  focused; Escape back to ⋯), Revoke gone with "Token revoked." and the focus on "+ New
  token", the token then answering 401 on `/mcp` after 200 before; a `change` call with a
  token through Playwright's request client (headers `authorization`, `content-type` and
  `accept`) showing its customer on Setup and its batch on History with the Agent chip,
  undone there in one step, and the token's last-used time on Account; the signed-in
  session cookie alone answered 401; and without JavaScript the `?new=token` panel, its
  refusal, the made token with Done and no Copy, and the two-step revoke.
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
  header), a customer made after it, the restore of that file through the confirm landing
  on `/login?restored=1`, the customer gone after signing in again and the before-restore
  download; Restore… with no file saying so and opening nothing; the confirm naming the
  file, cancelling and returning the focus; a file that is not a backup refused in the
  Restore panel; Restore… a red outline, not a red fill; and without JavaScript the
  download and a full restore, and the refusals without the box or without a file. A restore signs out every session, so each
  test signs in again after it and restores only the backup it just downloaded, which
  leaves the other tests' seeded users in place.
- `e2e/accounts.test.ts` covers sign-in, Users and Change password: a messy username
  signing in; "+ New user" in its dialog, Escape back onto it, a short username refused
  under Username (kept, the password empty) and a duplicate refused in the dialog; the
  new user refused on `/admin/…` ("Admins only"); a mismatched confirm refused under
  Confirm new password and the password changed; Set password… from the row's ⋯ (Escape
  back onto ⋯, a short password refused under New password, the user signed out
  everywhere); Disable and Enable from the ⋯, also by keys; the admin's own row with no
  Disable and a password set keeping them signed in; a 32-character username wrapping at
  390 px with nothing on the "+"; a Set password for a user not in the list shown at the
  section's head; and without JavaScript the dialogs as forms in the page with their
  refusals. `shell.test.ts` also covers the sign-in card (no dark bar), a refused sign-in
  keeping the username and focusing the password, the eye, the refused page in the shell
  and the unknown address on the card, each with Back to Today.
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
