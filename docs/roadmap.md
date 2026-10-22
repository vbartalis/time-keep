# Roadmap

The order of the work that takes time-keep from nothing to replacing Kimai. Detail
lives in the specs, plans and issues each item links to; this page only says what
comes next and why. The scope is [the vision](vision.md); round 2 adds what the
operator asked for on 2026-10-19 (the calendar and table views), and item 10 brings
the vision up to date with it.

The work runs in three rounds:

1. **Round 1, the build (phases 1–8), done 2026-10-19.** The core, the screens, the
   MCP server, backup and restore. The back end holds; the screens do not.
2. **Round 2, usable (items 17, 10–16 and 18–20).** The app redesigned and rebuilt, screen
   by screen, until it is usable: the look, the theme and the way of working, measured
   against Kimai and good calendar apps. It runs on the autopilot
   ([autopilot.md](autopilot.md)).
3. **Round 3, go-live (item 9).** Round 1's last phase, moved after round 2.

Items keep their numbers across rounds, so specs and docs that name "phase 9" still
point at go-live.

## The principle

**The core is finished and stable before anything that depends on it is built.** The
screens and the MCP server both sit on the data model, the single write path and its
history; those are settled first, so nothing is later bent to fit a dependent that
already holds it in place.

**Nothing is used until the whole thing works.** Kimai stays in use until go-live is
done (operator, 2026-10-18: "cant use it until it is working"). There is no early
release to live with; the order serves building, not adoption.

**Usable before live.** Go-live waits for round 2. An app that passes its tests but
does not do what the operator needs with a good interface is not done (operator,
2026-10-19: "the goal is … an app that does what i need with good ui/ux").

## How an item is worked

- The numbered sections are items, worked in order, one at a time. An item starts
  when the one before it meets its exit.
- Every item is worked the same way, whatever it is (a phase, a part of one, a fix,
  a cleanup, a check): its own brainstorm, spec, plan, build, review and merge. An
  item too big for one spec is split when it is brainstormed (5a, 5b, …); the parts
  are written here and each is worked as an item.
- Anything found along the way is fixed in the current item when its exit needs it,
  or when it is small and inside the item's scope. Anything else becomes a new item
  here, placed before the first item that needs it, else at the end.
- Screens are checked in a browser driven by automation, at phone and PC sizes.
- When an item lands, it gets a done note: the date, the spec, the decisions it
  recorded, and any call made in the operator's place.
- Go-live (9) is the operator's: it is never started automatically.
- Round 2 runs on the autopilot ([autopilot.md](autopilot.md)): each item is worked
  by fresh unattended sessions following the `run-item` runbook, the operator
  stand-in answers where the operator would be asked, and an item's exit is met by
  the usability gate (a screen) or the stand-in's approval (a document). The done
  note marks every call the stand-in made, with its source.

### In round 2, also

- **impeccable carries every interface item**: its context and direction first, then
  each screen shaped, built, critiqued and audited with it, and `DESIGN.md` recorded
  from what shipped.
- **Every screen is designed from references, not from the vision alone.** Item 10's
  study is the reference; a spec names which Kimai or calendar-app behaviour each
  screen follows or departs from, and why.
- **Screens are built against realistic data**: a seeded month or more in the shapes
  the operator actually logs, never an empty account.
- **The exit is judged outside the builder.** The builder's tests still run, but an
  item that changes a screen meets its exit only when the usability gate passes it:
  the exit's tasks done as a user would, on a seeded month, at phone and PC sizes, in
  light and dark. An item with nothing on screen meets its exit when the operator
  stand-in approves its document.
- Round 1's calls about the interface do not bind round 2. Its back-end calls stand
  unless a round 2 spec names one it changes.

## Round 1 — the build, done 2026-10-19

What round 1 got wrong, for round 2 to avoid: the screens were designed from the
vision's list of what Kimai lacks, without studying how Kimai, or any good time or
calendar app, is actually used; the builder made every design call; and the screens
were checked only by automation, against near-empty data. The result passes its tests
and is not usable: there is no way to add an entry for an arbitrary time, no calendar
or day-grouped list, timers live only on Today, the phone cannot reach past entries,
and the punch-card look reads as dated and heavy.

### 1. Foundation — done 2026-10-18

The app exists, runs and deploys: the SvelteKit project per decisions 1 and 2, SQLite
through Drizzle with migrations, the test setup, the app's own session login, the
admin created from environment variables on first start, the admin managing users,
and the container definition that phase 9 deploys.

Exit: on a local production build, the admin logs in, creates a user, and that user
logs in and out; the checks and tests pass.

Done 2026-10-18 (spec `docs/superpowers/specs/2026-10-18-foundation-design.md`, plan
`docs/superpowers/plans/2026-10-18-foundation.md`, decision 3, part doc `docs/app.md`).
Met by the browser test on the production build at phone and PC sizes, with check,
lint and 61 unit tests passing. Calls made in the operator's place: every **(call)**
in the spec; the admin flag fixed at creation; the sign-in throttle keyed on username
and client address, counting attempts in flight; SvelteKit 3's `#lib` imports and its
private env for configuration; times as integer milliseconds; no `ORIGIN` (adapter-node
6 has none), the image taking the origin from `x-forwarded-proto` and
`x-forwarded-host` instead. Owed to the operator: a devcontainer rebuild, which
installs Chromium's libraries and fonts for the browser tests. Deferred minors, each
for the item that touches it: dates shown in UTC (4, 5); the login form not keeping
the username after a failure (3); passwords not Unicode-normalised; the throttle's
memory only pruned on access; the image's health check without a start period and the
proxy headers to confirm against Coolify (9).

### 2. The core — done 2026-10-18

Everything the vision says about the data, enforced in one place, with no screens:
customers › projects, activities, locations, entries, templates and timers, each
user's data their own. Every write goes through one path that records old and new
values and groups a request's changes into a batch; archive instead of delete for
reference data; overlap warnings; start + duration stored as start and end; starting
an entry on a project stops that project's timer. The API the UI and the MCP server
will both call, with its validation.

Exit: every rule in the vision's entry, customers and projects, templates, timers and
history sections is enforced by the API and covered by tests, and any change or batch
can be undone as one step.

Split 2026-10-18 into three parts, worked in order:

- **2a. The write path and reference data — done 2026-10-18.** The core API's shape,
  the one write path that records every change into batches, undo, and the history;
  customers, projects, activities and locations as its first users, with archiving.
  Spec `docs/superpowers/specs/2026-10-18-core-write-path-design.md`, plan
  `docs/superpowers/plans/2026-10-18-core-write-path.md`, decision 4, part doc
  `docs/core.md`; 161 unit tests. Calls made in the operator's place: every **(call)**
  in the spec, among them no project moves between customers, undo of a batch or of
  chosen changes with a per-row conflict check, row versions refusing stale writes,
  shape versions on recorded changes, Unicode case-insensitive names, no HTTP API, and
  accounts outside the history; also restore raising a row's version, batch times kept
  strictly increasing per user, an undo of a partly undone batch reverting the rest,
  a batch inside a batch refused, and lists in English collation order. Carried into
  2b: rules need a way to return warnings (overlaps), and unique-index errors must be
  told apart once an index other than a name's exists.
- **2b. Entries and timers — done 2026-10-18.** Entries as intervals with their time
  zones, start + duration, overlap warnings, timers and the one-timer-per-project rule.
  Spec `docs/superpowers/specs/2026-10-18-entries-timers-design.md`, plan
  `docs/superpowers/plans/2026-10-18-entries-timers.md`, `docs/core.md` extended; 244
  unit tests. Calls made in the operator's place: every **(call)** in the spec, among
  them activity and location optional, archived references allowed on entries, times
  given as an instant with an offset or as a local time in a zone (a daylight-saving
  gap refused, a repeated hour read as the earlier one), checks run once at the end of
  a batch, overlap and over-24-hour warnings only for entries whose time changed and
  never for running timers, and lists as an instant primitive with day grouping left
  to phase 6; also changing only a time zone keeps the instant, a new zone on an edit
  applies to a new end too, and the one-minute future limit covers every running entry
  and a timer's stop. Deferred: paging for `entries.list` (6, 7), and one query per
  touched entry in the change check (9, if the import is slow).
- **2c. Templates — done 2026-10-18.** Partial entries saved and used, a duration
  standing in for the end, saving an entry as a template. Spec
  `docs/superpowers/specs/2026-10-18-templates-design.md`, plan
  `docs/superpowers/plans/2026-10-18-templates.md`, `docs/core.md` extended; 302 unit
  tests. Calls made in the operator's place: every **(call)** in the spec, among them
  templates deleted rather than archived, every given field winning over the
  template's (a blank text meaning not given), the zone given at use winning, a
  duration-only template ending now, an end time on the next day when not after the
  start, an end inside a daylight-saving gap refused, an overnight template used
  without a date logging the shift already started, a date without a template start
  time refused, and an entry saved as a template keeping its end time when it ends the
  next morning. Known traps for phase 4: errors from a template's times come back on
  `start`, `end` and `date`, which the phone may not show as fields.

Phase 2 exit met 2026-10-18: every rule in the vision's entry, customers and projects,
templates, timers and history sections is enforced by the core and covered by tests,
and any change or batch can be undone as one step.

### 3. Design direction — done 2026-10-18

The look and feel, decided once before any screen is built, with impeccable: a
direction chosen, in Tailwind tokens and shadcn-svelte per decision 2, and recorded.

Exit: the chosen direction is recorded and the app shell uses it.

Done 2026-10-18: the punch-clock time card (decision 5; `PRODUCT.md`, `DESIGN.md` with
`.impeccable/design.json`, and the shell's surface brief under `.impeccable/surfaces/`):
blue card stock, blue-black ink, hairline rules, violet only for what is live or
primary, red only for what is irregular or destructive; a dark rail on the PC, a top
bar and bottom navigation on the phone; Archivo and Martian Mono, self-hosted. The
shell and the phase 1 screens use it, with labelled placeholders for phases 4 and 5.
Calls made in the operator's place: the product record's inferred facts, the
direction (impeccable's roll, its six challengers declined), and every visual choice.
Checked at 390 and 1440 px in light and dark; impeccable's detector found nothing and
its finish reviewer's seven fixes were all scored resolved. Deferred to 4 and 5: the
default alert's violet border and the unchecked checkbox's grey in dark mode.

### 4. Phone — done 2026-10-19

Quick capture, in the installable web app: start and stop timers, log an entry from a
template with only the blanks typed, fix today's entries.

Exit: on a phone, a new entry from a template is a tap and a typed description, timers
start and stop, and today's entries can be corrected.

Done 2026-10-19: Today with running timers, templates, starting a timer and today's
entries; the entry edit screen with a two-step delete; one-tap undo through a flash
strip that survives the redirect; core warnings on the strip and the row; installable
from a manifest and icons, no service worker (spec
`docs/superpowers/specs/2026-10-18-phone-design.md`; the screens in `docs/app.md`, their
components in `DESIGN.md`; no new decision record). Calls made in the operator's place:
the spec's marked calls; no undo on the edit screen, since every write there returns to
Today and its strip; a stale save keeps refusing without JavaScript until a reload; the
iOS status bar left opaque rather than drawn under; and the icon mark. Checked by 20
browser tests at phone and PC sizes, JavaScript off included, with check, lint and 363
unit tests; impeccable's detector found nothing. Deferred: native date and time pickers
show 12-hour on an en-US phone; the browser tests run in a fixed-offset zone, so DST is
covered by unit tests only. Still open from 3, carried to 5: the default alert's violet
border and the unchecked checkbox's grey in dark mode.

### 5. PC — done 2026-10-19

Dense work: managing customers, projects, activities and locations (archiving
included) and templates (deleted, undoably), finding entries and editing them in bulk, seeing history and
undoing any batch.

Exit: a month can be reorganised from the PC alone, and any change made there is
undone in one step from the history.

Done 2026-10-19 with its three parts below: from the PC the user reorganises a month
on Setup and Entries and undoes any batch, or chosen changes, in one step from History.

Split 2026-10-19 into three parts, worked in order:

- **5a. Setup — done 2026-10-19.** Customers › projects, activities, locations and templates
  managed on the PC, archiving included, each change undone from its strip; save an
  entry as a template. Spec `docs/superpowers/specs/2026-10-19-setup-design.md`, plan
  `docs/superpowers/plans/2026-10-19-setup.md`; `docs/app.md` (Setup, Templates, Save
  as template, the shared `/undo` route, the flash `error`, the navigation) and
  `DESIGN.md` (setup list, in-place rename, template form, the strip's error state)
  extended; 391 unit tests and 44 browser tests (24 of them new, phone and PC sizes,
  JavaScript off included), check and lint clean. impeccable's detector ran over the
  18 changed .svelte and .css files with its regex rules, and over the rendered
  `/setup` (with `?archived=1`), `/templates` and `/templates/new` at 390 and 1440 px
  with its element rules, and found nothing. Calls made in the operator's place:
  every **(call)** in the spec, among them the split of phase 5 into 5a, 5b and 5c, a
  successful action returning to the screen it came from, one shared `/undo` route, a
  refused undo shown in red in the strip with Undo kept, archiving a customer leaving
  its projects as they are, and the PC-only Templates item; and, made during the
  build, the layout's zone script filling only hidden `timeZone` fields, and the
  template form's label column following the entry edit screen (10 rem) rather than
  DESIGN.md's 12 rem. A save or rename that changes nothing stores no batch and shows
  no strip. Deferred minors: `safeBack` accepts tab, CR and LF; no unit test for the
  `/undo` route; the `Flash` type still under `components/today`; the global checkbox
  rule has no default size; in-page links use violet text; the archived view's empty
  states ("No active projects.", "No customers yet." when all are archived); a second
  identical refusal on Setup does not refocus the field; a message for a field not
  shown appears above the form rather than under it (also on the entry edit screen);
  the picker blanks read "Any customer/project" against "None"; the browser tests
  assert that a message shows rather than its text, and a few use implementation-detail
  selectors.
- **5b. Finding and bulk editing entries — done 2026-10-19.** An Entries screen (`/entries`,
  in the PC rail after Today) finds entries by range, customer, project, activity,
  location and text and changes or deletes the selected ones as one batch, undone from
  its strip; an entry opened from the list returns to the search. Spec
  `docs/superpowers/specs/2026-10-19-entries-design.md`, plan
  `docs/superpowers/plans/2026-10-19-entries.md`; `docs/core.md` (the list's new
  inputs), `docs/app.md` (the Entries screen, `back` on the edit screen, the
  navigation, the layout rows for `screens/entries.ts`, `components/entries/` and
  `components/narrowing.svelte.ts`) and `DESIGN.md` (filter bar, selectable ruled
  table, change form, delete confirm, the navigation's items) extended; 423 unit tests
  and 64 browser tests (20 of them new, phone and PC sizes, JavaScript off included),
  check and lint clean. impeccable's detector ran over the 7 changed .svelte files with
  its regex rules, and over the rendered `/entries` (the month, `&all=1`, an empty
  search, From after To) and an entry opened from it at 390 and 1440 px with its
  element rules, and found nothing. Calls made in the operator's place: every
  **(call)** in the spec, among them the list's new inputs (activity and location ids
  or none, text over reference, description, project and customer names, `startedIn`,
  `order`, `limit`), the search as a `GET` URL defaulting to the current month with a
  blank date unbound, customer narrowing projects, a 500-row cut with no paging or
  saved searches, a count and summed hours rather than totals, a version posted per
  row, a "Select all" link (`&all=1`) without JavaScript, the change form above the
  table with every field kept unless set, a literal Find and Replace taken as typed,
  updates sent oldest start first and labelled by the entries they change, the delete
  confirmed on the page, a refusal naming its entry, the edit screen returning to
  `back`, Entries in the rail but not the phone's bar (current on an entry only when
  opened from the list), no bulk time shifts or pattern rewording, and no decision
  record; and, made during the build, the Reload link only when the refused entry's
  posted version is stale, an unknown activity or location id listing nothing as the
  existing filters do, the confirm's "Yes, delete them" red while Delete selected
  stays outline, Cancel and the deleted-elsewhere link on the edit screen following
  `back` too, a repeated posted id taken once, the selected entries read one by one to
  build the change, and the singular copy ("Edit 1 entry", "Delete 1 entry?", "1
  entry, h:mm"). An entry deleted elsewhere in the selection refuses with the core's
  "Not found." alone (no entry named, no Reload) when the form would set a field on
  it, and is skipped otherwise. Deferred minors: the `startedIn` test passes on an
  empty list; no test that an unknown activity or location id lists nothing; core.md
  not spelling out `startedIn` with only `to`; an awkward `orderBy` spread in
  `entries.list`; `searchInput` throwing on invalid dates if ever called after a
  `readSearch` error; `failedId` naming the last input if a batch-end check refuses;
  no December-rollover test for the default month; an entry deleted elsewhere in a
  selection shows "Not found." with no entry named and no Reload; no unit tests for
  the refusal prefix, the stale rule or dedupe; no action-level test for `back` on the
  edit screen; the loose `/entries` prefix check for the rail and labels; a refused
  no-JavaScript save or delete on the edit screen loses `back`, so the rail shows
  Today current; Review Focus 5's other half (exactly 500 matches show no message)
  untested; ticking rows during the delete confirm does not change what is deleted;
  `limit` applied in memory, so a search with both dates blank loads every entry; a
  Customer or Project chosen before the page's script loads is reset on hydration, on
  the Entries filters and the template form; DESIGN.md's Navigation bullet line
  breaks; a `.last()` Clear link in the browser test.
- **5c. History — done 2026-10-19.** A History screen (`/history`, in the PC rail after
  Setup) lists every batch newest first, 50 to a page under a heading per day, each with
  its time, label, an Agent or System chip, its state and its changes in words on
  demand, and undoes or redoes any batch, or changes chosen across batches, in one
  step; a new core command `redo` undoes the undo by name. Spec
  `docs/superpowers/specs/2026-10-19-history-design.md`, plan
  `docs/superpowers/plans/2026-10-19-history.md`; `docs/core.md` (Redo), `docs/app.md`
  (the History screen, the navigation, the layout rows for `screens/history.ts` and
  `components/history/`, the browser tests) and `DESIGN.md` (history list, change
  lines, selected-changes bar, the navigation's items) extended; 455 unit tests and 92
  browser tests (28 of them new, phone and PC sizes, JavaScript off included), check
  and lint clean. impeccable's detector ran over the 2 new .svelte files with its
  regex rules and found nothing; over the rendered `/history` at 390 and 1440 px (a
  signed-in page, so scanned in the browser by its injected script and as a saved
  page by its HTML engine) it reported a glow on `body` that no element of the page
  has (its own overlay) and "cramped padding" on the ruled lines, which its HTML
  engine reports for any `padding-block` (Tailwind's `py-*`); nothing to fix. Calls
  made in the operator's place: every **(call)** in the spec, namely a named `redo`
  command labelled `Redo "<label>"` / `Redo <n> changes`, no search or filter (paging
  is enough), no links from a change to its record, History in the rail but not the
  phone's bar, 50 batches to a page, a heading per day, the Agent and System chips,
  the changes behind a native disclosure, "Undone" and "Partly undone, <k> of <n>",
  Undo and Redo both on a partly undone batch, undo and redo batches listed like any
  other, an unknown `before` redirecting to `/history`, values cut at 80 characters,
  bookkeeping columns never shown, an entry's start or end and its zone as one line,
  an archive's undo reading Unarchived, a batch over 100 changes without checkboxes,
  one form for the whole list, the selected-changes buttons above it with the
  screen's own messages for none and over 1000, no confirmation, a refusal keeping
  the ticks and opening their batches, and no decision record; and, made during the
  build, a posted `batchId` winning over the ticks, the strip hidden while a refusal
  shows, the batches to open derived from the posted ticks, and the day heading
  as the punched date beside the printed weekday ("2026-10-19 Monday").
  Deferred minors: `redo`'s unreachable second `not_found` branch and its redundant
  `undoneBy` query; no test mixing standing and undone `changeIds` in `redo`;
  `archivedAt` set→set reads Unarchived; `''` against `null` reads "none → none"; an
  update with nothing visible reads a bare "Changed"; `namesFrom` drops list failures
  silently and is untested; a `history.list` failure without `before` shows "Nothing
  recorded yet."; the page rebuilds its query by splitting `back`; the changes
  disclosure is not tied to its batch label for screen readers; a `form as
  HistoryFailure` cast; on the phone the selected-changes bar wraps unevenly (Undo
  selected full width, Redo selected beside the count); on the phone History is
  reachable only by its URL.

### 6. Output — done 2026-10-19

Reports (totals per day, week, customer and project), the month copy-out with columns
chosen at output time, CSV, rounding to 5 minutes on output only, splitting at
midnight as an output option, and the vision's formats.

Exit: a month pastes into Excel as the chosen columns and exports as CSV, and the
reports match the stored entries.

Split 2026-10-19 into two parts, worked in order:

- **6a. Copy-out — done 2026-10-19.** A Copy-out screen (`/copy-out`, in the PC rail
  after Entries) writes the entries the Entries filters find as the columns chosen
  (Date, Start, End, Duration, Customer, Project, Activity, Location, Reference,
  Description, in that order), rounded to 5 minutes and split at midnight when asked,
  durations as `h:mm` or decimal hours; Copy puts the rows on the clipboard to paste
  into Excel and Download CSV (`/copy-out/csv`) gives the same rows as a file. Nothing
  rounded or split is stored; the output rules live in `src/lib/output.ts` and
  `screens/copy-out.ts` for 6b to reuse. Spec
  `docs/superpowers/specs/2026-10-19-copy-out-design.md`, plan
  `docs/superpowers/plans/2026-10-19-copy-out.md`; `docs/app.md` (the Copy-out screen
  and the CSV route, the navigation, the layout rows for `output.ts`,
  `screens/copy-out.ts` and `components/copy-out/`, the browser tests) and
  `DESIGN.md` (the filter bar's Copy-out use, column and option pickers, result bar,
  sheet table, the navigation's items) extended; 497 unit tests and 110 browser tests
  (18 of them new, phone and PC sizes, JavaScript off included; Copy runs on the PC
  only, so 109 pass and one is skipped), check and lint clean. impeccable's detector
  ran over the 6 changed .svelte files with its regex rules and found nothing; over
  the rendered `/copy-out` (the month, split with decimal hours and fewer columns, no
  column ticked, nothing matching, a bad date) at 390 and 1440 px, saved from a
  signed-in browser and scanned by its browser engine, it found nothing; its HTML
  engine reported "cramped padding" on the section heads' and ruled lines' bottom
  inset, as in 5c; nothing to fix. Calls made in the operator's place: every
  **(call)** in the spec, namely the split of phase 6 into 6a and 6b, the columns in
  one fixed order, the choice remembered only in the URL, no change to the core, no
  `.xlsx`, other delimiters, number formats or zones, This month and Last month
  links, no row limit, running entries left out with a faded line, start and end
  each split into a date and a time, `24:00` for an end at the next midnight and
  date and time for an unsplit overnight end, "Choose at least one column." for none,
  the options' defaults (rounded, unsplit, `h:mm`), rounding both ends rather than
  only the duration, an entry rounding to nothing kept as a `0:00` row, a split
  entry's pieces in its start zone, decimal hours to two decimals rounded half up,
  unrounded times cut to the minute with the duration from those minutes, every
  column of a row from the same rounded times with no clamp to the month, ISO dates,
  24-hour times, a dot as decimal mark and a comma between CSV values, Show as the
  one primary, the count in rows summed from minutes, Copy and Download CSV outline,
  no header in the copy, its status copy, a tab or line break in a copied value
  becoming a space, the CSV's byte-order mark, header row and file name
  (`time-keep-<from>-<to>.csv`, a blank side `all`), the leading apostrophe against
  formulas, one output module shared by server and browser, Copy-out in the rail
  after Entries with the sheet icon but not the phone's bar, and no decision record;
  and, made during the build, the query names (`show=1`, `col`, `round=1`,
  `split=1`, `duration=hm|decimal`) with the hidden `show=1` telling a submitted form
  from the defaults, an unknown column or option value ignored, the Entries filter
  bar shared as `EntryFilters` with the screen's pickers and month links inside it,
  `searchFilters` moved to `screens/entries.ts`, an unknown project id listing
  nothing (as Entries does) rather than a refusal, and `readSearch` refusing an
  impossible date such as 2026-13-01 with "Use dates like 2026-10-01." instead of
  throwing, which also fixes a 500 on Entries. Deferred minors (the final branch
  review may add more): the CSV CRLF test checks one row only; `formatDuration`
  assumes whole non-negative minutes; Task 2 recorded no failing run before its code;
  an unrequested clamp of the end to the start in `outputRows`; the "never prefixed"
  test is weak and Customer and Project `safeText` untested; no test splitting an
  entry with differing start and end zones;
  `monthRange` repeats `readSearch`'s month arithmetic; a partial `Search` cast in
  the `csvName` test and the 600-row test data built in a `describe` body; the
  load sends an
  unused `heads`; the section head reads "Result" with the count beside it, as
  Entries' "Found"; the duration choice is a `role=radiogroup` div rather than a
  fieldset; the copy-out form keeps `role=search`; the running line shows under "No
  entries match." when only running entries match; the browser tests run in a
  fixed-offset zone, so an entry crossing the month's end and daylight-saving days
  are covered by unit tests only; the detector's rendered pass scanned saved pages,
  not the live one.
- **6b. Reports — done 2026-10-19.** A Reports screen (`/reports`, in the PC rail after
  Copy-out) shows the entries the Entries filters find as totals per day, week,
  customer and project, rounded to 5 minutes and split at midnight when asked, as
  `h:mm` or decimal hours, with "<n> entries, <total>" and the running entries left
  out with their line; the four tables' Totals are one number and every total is the
  sum of the Copy-out rows it covers. Nothing is stored. Spec
  `docs/superpowers/specs/2026-10-19-reports-design.md`, plan
  `docs/superpowers/plans/2026-10-19-reports.md`; `docs/app.md` (the Reports screen,
  the navigation, the layout rows for `screens/reports.ts`, `components/reports/` and
  `OutputOptions`, the browser tests) and `DESIGN.md` (the totals tables, the
  two-column result, the navigation's items) extended; 524 unit tests and 122 browser
  tests (12 of them new, phone and PC sizes, JavaScript off included; Copy runs and the
  right column's stacking is asserted on the PC only, so 120 pass and two are skipped), check and lint clean. Calls made in the
  operator's place: every **(call)** in the spec, namely no charts, no totals per
  activity or location, no copy button or CSV for the reports, no budgets, targets or
  overtime, days with no time not listed as zero rows, a week the range cuts counting
  only the days in the range with the whole week as its label, the pieces split out of
  6a's `outputRows` into `outputPieces` (the copy-out output unchanged), an entry
  rounding to nothing kept as a `0:00` piece with its groups listed, an entry rounding
  across the month's end counting on the day its Copy-out row says, durations summed
  from minutes and written once in the chosen format, the labels (`2026-10-19 Mon`,
  `W43 2026-10-19 – 2026-10-25`, the customer's name, `Customer › Project`) and
  their orders, ISO week-year numbering (2026-12-31 and 2027-01-01 both `W53`),
  customers and projects not nested, the count in entries rather than rows, the layout
  (Days left and the rest stacked right on the PC; Customers, Projects, Weeks, Days on
  the phone), "No entries match." with the running line under it when only running
  entries matched, Reports in the rail after Copy-out with Lucide `chart-column` and
  not in the phone's bar, and no decision record. Deferred minors (the final branch
  review may add more): `OutputOptions` re-declares `OutputFields`' class strings; the
  `optionsQuery` test asserts only show and round; `outputRows` recomputes
  `localParts` though `piece.date` is stored; the project order compares the combined
  `Customer › Project` label; the tie-break in the tally duplicates the plain helper;
  the `reportFor` test asserts entries and customers, not minutes; the running line is
  written twice on the page; the table heads are h2 inside the h2 Result section; the
  tables have no caption; hover on non-interactive rows, as `SheetTable`; the `NONE`
  constant restates the `Report` shape. Added by the final branch review (the running
  line and `NONE` since fixed): the Weeks table is asserted in the browser by its Total
  and row count only; the rail test branches on the project inside one test; DESIGN.md
  was edited directly rather than through impeccable's document step, so its sidecar
  was not refreshed; on the PC the tables' reading order (Customers, Projects, Weeks,
  Days) differs from their placement.

### 7. MCP server — done 2026-10-19

The MCP server as a first-class client of the same API, behind authentication, for
bulk entry, reorganising and rewording. One agent request is one batch.

Exit: an authenticated agent can do through the MCP server what the UI can, and no
more, and a wrong agent change is undone in one step.

Done 2026-10-19: `POST /mcp` serves stateless Streamable HTTP to an agent holding a
user's access token, made and revoked on Account under Agent access; thirteen tools
read the time data and change it through the core as actor `agent`, `change` running
up to 1000 of the 26 batch commands (with refs between them) as one batch, shown on
History with the Agent chip and undone there or through `undo` in one step. Spec
`docs/superpowers/specs/2026-10-19-mcp-server-design.md`, plan
`docs/superpowers/plans/2026-10-19-mcp-server.md`, decision 6 (agents sign in with
bearer tokens over Streamable HTTP); a new contract doc `docs/mcp.md`; `docs/core.md`
(the exported schemas, `history.get`, `BatchCore.batchId`), `docs/app.md` (the layout
rows for `routes/mcp`, `server/mcp/`, `auth/tokens.ts` and `components/account/`, the
Account screen, tokens under Accounts and sessions, the tests) and `DESIGN.md` (the
token list, the shown-once token) extended; 583 unit tests and 132 browser tests (10
of them new, phone and PC sizes, JavaScript off included; 130 pass and two are
skipped, as in 6b), check and lint clean. `DESIGN.md` was edited directly rather than
through impeccable's document step, so `.impeccable/design.json` is stale for the two
new components, as in 6b. Calls made in the operator's place: every **(call)** in the
spec, namely no OAuth, no account or token tools through the MCP, no copy-out, CSV or
report tools, no token scopes, expiry or rate limit, tools as the whole surface (no
resources, prompts, sampling, notifications or sessions), stateless Streamable HTTP
with JSON responses and 405 for `GET` and `DELETE`, the official SDK as a runtime
dependency, a foreign `Origin` refused with 403 and none allowed, the whole access
token design (`tk_` and 32 base32 characters, only the SHA-256 stored, named 1–100
characters unique per user, Agent access on Account with a shown-once token and a
two-step revoke and no undo, one 401 for every bad token, `last_used_at` at most once
a minute, disabling deleting tokens and a password change keeping them, no limit on
their number, the admin's tokens acting on the admin's own data, no throttle), the core's
schemas exported for the tools, snake_case tool names, `list_entries` capped at 999
with `truncated` and no cursor, `list_history` as summaries with `get_batch` and the
core's new `history.get` for the changes, one `change` tool rather than one per
command with `undo` and `redo` their own, refs in id fields only, the result shapes,
the rows' times (an entry's in its own zone's offset, every other instant in UTC) and
dropped fields with history's `before` and `after` as stored (camelCase; the spec's "snake_case columns" line was wrong), and 1000 operations per
call under the default 512 KB body limit, raising it left to phase 9; and, made
during the build, the plan's "22 commands" read as the 26 it lists; an input the
SDK's own schema rejects (a read's input, `change`'s envelope) answered as `isError`
with the SDK's text and no `structuredContent`, while every core refusal keeps `{
code, message, fields?, operation? }`; a refusal of the batch as a whole (the label,
the batch-end running check) naming no `operation`; `undo` and `redo` answering the
user's newest batch as their `batchId`, since the core's undo returns none; the global
hook still validating and renewing a session cookie on `/mcp` responses, which
authorises nothing; `as` names of letters, digits, `_` and `-`, 1–40 characters;
`list_history` defaulting to 20 against the core's 50; Task 6's Account section
shipping without tests of its own, pinned by the browser tests; and the token lines'
hidden "Created" and "Last used" prefixes kept for screen readers, ending in a
no-break space (Svelte trimmed the plain one, so they read "Last used2026-…"; fixed
when the browser test found it). Deferred minors (the final branch review may add
more): a weak `toBeTruthy` in the `history.get` test; the `commandSchemas` test
exercises only `customers.create`; Task 1's code written before its tests (its RED
verified by stashing); `tokens.ts` duplicates `users.ts`' `isUniqueViolation`; a
`token_hash` unique violation would read as a duplicate name (negligible odds); no
tests for the NFC half of a token name's key or `listTokens`' id tie-break; the token
pattern written twice in `tokens.ts`; a missing blank line in `users.test.ts`; the
server tests never close their client and server; `list_history`'s description reads
awkwardly; `isoAt` assumes `±HH:MM` offsets (local mean time offsets carry seconds);
`package-lock.json` lost dev flags and gained an orphan `find-up@5` on install; two
types named `Refusal` (`change.ts`, `server.ts`); a ref'd result's id stored unchecked
(no command returns a row without one today); activities, locations and templates
commands not exercised through `change`; no undo test with both `batchId` and
`changeIds`; `"$schema"` repeated 26 times in `change`'s description; a caught write
failure or commit-time error after every operation also names no operation; no
HTTP-path test of `now` and `last_used_at`; `hooks.server.ts` may set a cookie on
`/mcp` responses; Revoke's confirm step accepts any id (a stale one shows nothing until
confirmed); a refused create without JavaScript clears the typed name and shows its
message at the section's head, not on the field; without JavaScript the focus does not
move to Yes, revoke (as on the entry delete).

### 8. Backup and restore — done 2026-10-19

Admin-only backup and restore, through the app.

Exit: a backup taken from the app restores into it, and only the admin can do either.

Done 2026-10-19: a Backup screen (`/admin/backup`, in the PC rail after Users, admins
only) downloads the whole database as a SQLite file without sessions or access tokens
and restores an uploaded one, with the data as it was just before the last restore
kept for download. Spec `docs/superpowers/specs/2026-10-19-backup-restore-design.md`,
plan `docs/superpowers/plans/2026-10-19-backup-restore.md`, decision 7 (backups are the
whole database, restored in one transaction); `docs/app.md` (the layout rows for
`backup.ts` and `routes/(app)/admin/backup`, the Backup screen, the navigation, the
login screen's `restored`, `BODY_SIZE_LIMIT` in the environment table and the image, the
tests), `docs/mcp.md` (Limits) and `DESIGN.md` (the file input and the confirm
checkbox) extended; 600 unit tests and 140 browser tests (8 of them new, phone and PC
sizes, JavaScript off included; 138 pass and two are skipped, as in 6b), check and lint
clean. `DESIGN.md` was edited directly rather than through impeccable's document step,
so `.impeccable/design.json` is stale for the backup screen, as in 6b and 7. Calls made
in the operator's place: every **(call)** in the spec, namely the database as the
format with no JSON export, sessions and access tokens left out of a backup and never
restored, `VACUUM INTO` a temporary file beside the database, the download's name and
type in the admin's zone, a confirm checkbox in the same form rather than a second
step, the restore's order (check, migrate an older backup, keep the before-restore
copy, copy every row in one transaction on the app's own connection rather than swap
the file, sign everyone out and redirect to `/login?restored=1`), one before-restore
copy replaced at each restore and downloadable, no scheduled, kept, per-user or
merged backups, none through the MCP server, no encryption, no history record of a
restore, no maintenance mode, `BODY_SIZE_LIMIT=100M` in the image and the browser
tests with adapter-node's own 413 above it, `/mcp` keeping its 512 KB cap by counting
bytes itself, `backup.ts` as the home of the logic, and the screen on the PC rail only;
and, made during the build, the plan's round trip creating a session with
`createSession`, "restore twice, then the before-restore file brings the later data
back" read as restoring a copy of the before-restore file taken after the first
restore (as a download and upload would, since the second restore's own copy holds
nothing later), and `docs/mcp.md`'s Limits left stale on the branch until this step
rather than fixed with the cap. Deferred minors (the final branch review may add
more): `writeBackup`'s catch can remove a file already at its target (no caller does
that); `DEFAULT_FOLDER` is resolved at import, not per call; a table missing from a
backup is skipped silently (only `sqlite_sequence` can be) with no comment; the
failed-restore test does not assert that sessions and tokens survive; the exactly
512 KB `/mcp` test asserts only a status other than 413, not a 200; a missing blank
line before `describe('body limit')` in `http.test.ts`; the `/mcp` body copied twice
(`Buffer.concat`, then `new Uint8Array`); the
download links lack `data-sveltekit-reload`; an upload held in memory twice
(`formData`, then `arrayBuffer`); the Backup sections lack `aria-labelledby` (Users has
it); and no test of the download's failure path surfacing the real error.

Final branch review, fixed 2026-10-19: the schema comparison and the row copy no longer
include `__drizzle_migrations` (its DDL text belongs to drizzle-orm, so a drizzle
upgrade would have refused every old backup; after the migration step both sides hold
the same set, so the live journal is already right, and the table must still exist in
the upload); the upload's connection no longer sets `foreign_keys` (a future
table-rebuilding migration would fail under it); a failed upload write answers "The
restore failed; nothing was changed." rather than a 500; downloads carry `Cache-Control:
no-store` and `nosniff`; the browser tests now open the before-restore file and check
its data (the JS-off test checks its own change is gone). `DESIGN.md`'s "an 18 px" and
`docs/app.md`'s long Image line were fixed. Accepted: a failed copy has already
replaced the previous before-restore file (nothing is lost: the new one holds the
unchanged current data). Still deferred: the refusal browser test implies rather than
asserts that the admin is still signed in and nothing changed; the JS-off test's
original run asserted only the before-restore section (now also the data).

## Round 2 — usable

Items are worked in page order and keep their numbers, so 17 comes first. Each
item's exit is met by the usability gate (screens) or the operator stand-in
(documents); see "In round 2, also".

### 17. Autopilot dry run — Today's placeholder panel — done 2026-10-19

Remove the "At the desk — not built yet" panel from Today, on phone and PC. A small
real screen unit that proves the autopilot end to end before the round's real work.

Exit: the usability gate passes Today with the panel gone and nothing else changed.

Done 2026-10-19: Today no longer shows the "At the desk" panel (its heading, its "Not
built yet" badge and its four rows), on the phone or the PC; the PC keeps the
two-column grid with the side track empty, so the main column keeps its width and
position. Spec `docs/superpowers/specs/2026-10-19-today-placeholder-panel-design.md`,
plan `docs/superpowers/plans/2026-10-19-today-placeholder-panel.md`; no decision
record. `docs/app.md` (Today) updated; one new browser test (phone and PC sizes) in
`e2e/phone.test.ts`. Calls made in the operator's place, the stand-in's: the PC keeps
the two-column grid with the side track empty, not a single column filling or capped
at the width (source: item 17's text and exit, plus the smaller-change rule;
inferred); nothing takes the panel's place (item 17; grounded); nothing else on Today
changes, the phone's bottom bar over the form left to the round 2 items that rebuild
Today (item 17, "How an item is worked"; grounded). The builder's: a written design
and plan despite the size, since every roadmap item is a project; `docs/app.md`
updated in the same change; the now-unused `SectionHead` import dropped along with
`Badge` (an unused import fails lint; both still used elsewhere); the `docs/app.md`
line keeps the doc's term "PC" though the side track starts at 1280 px; the new test
does not pin the PC's empty side track (the wrapper is unchanged; the gate checks it);
`DESIGN.md`'s "Not built yet" chip example stays until item 11. No questions queued.

### 10. Reference study — done 2026-10-20

How Kimai, Google Calendar, Samsung Calendar and a few dedicated time trackers
(Toggl, Clockify, Timing or similar) handle what time-keep does: their views (day,
week and month calendars, agenda lists, Kimai's timesheet table and weekly hours
grid), creating and editing an entry, running and restarting timers, recents and
favourites, navigation between dates, totals, filters, and the phone versus the
desktop. The study may use Playwright's Chromium to look at Kimai's public demo and
the references themselves, not only their docs (reading only: a public demo's sign-in
is the one form submitted). Each finding is recorded with its source and a verdict
for time-keep: follow, adapt, or reject. The operator's real entry shapes (three
companies deep for support, two for development, start plus duration) are walked
through each reference. The vision's two surfaces and fast-capture principle are
revisited against the findings, and the vision is amended with the views the
operator asked for (the calendar views and the table) and nothing else; anything
more the study suggests for the charter goes to `docs/questions.md`.

Exit: a reference document in `docs/`, and the amended vision, both approved by the
operator stand-in.

Done 2026-10-20: [the reference study](reference-study.md), with 33 screenshots in
`docs/reference-study/`: Kimai 2.70 used live through its public demo at phone and PC
widths (read only; nothing saved), Google Calendar, Samsung Calendar, Toggl Track,
Clockify and Timing from their public pages. Findings by subject with follow, adapt
or reject verdicts; the operator's four entry shapes walked through each reference;
the vision revisited; round 1's failures answered; a summary for each of items 11–15.
The vision gains a Views section (the day, week and month calendar views and the
table, on both surfaces) and nothing else. Spec
`docs/superpowers/specs/2026-10-19-reference-study-design.md`; no plan (a document
unit); no decision record. Calls made in the operator's place, the stand-in's: the
seventeen in the spec's "Calls made in the operator's place", among them the study's
form and readers (inferred), the demo's default Kimai setup standing for the
operator's (ungrounded, queued), the weekly grid decided by the study with reject or
defer as the default (grounded that the study decides; the operator's view
ungrounded, queued), Kimai's demo read only (grounded) and the views going into a new
vision section (inferred). The builder's: the eight in the study's section 9, among
them the weekly hours grid rejected, so item 14 does not build it; templates, not
description autocomplete or a recents list, as the fast path; a bare number in a
duration read as hours; undo after every change instead of confirm dialogs or a
trash; drag to move and resize on the PC only; and the six in the spec's builder list
(writes without a form treated as writes; captures of public pages as the study's own
screenshots; docs-only counts marked estimated; the paths; account-only references
from public material; verdict words defined once). Questions queued in
`docs/questions.md`: the Kimai setup used; the weekly grid (now with the verdict
noted); what in Kimai was relied on; recents in the timer bar beside templates
(the stand-in's, at the review of revision 1); description autocomplete beside
templates; the fast-capture principle for past entries; the phone's "fix today".
Revision 2 followed the stand-in's review of revision 1: the look is given as options
for item 11 to render, with Kimai's structure kept as one, not as verdicts; the
departure from item 12's "recents" is named; restart copies the description as
Kimai's does. Approved by the stand-in at revision 2, with one note left open, not
blocking: a bare number in a duration read as hours goes against every tracker
studied; item 12 settles it.

### 11. Design direction, round 2 — done 2026-10-20

A new look and theme with impeccable, replacing decision 5's punch-clock time card:
the direction, its tokens in Tailwind and shadcn-svelte, light and dark themes, type,
density for the PC and touch sizes for the phone, and the shell: navigation on both
surfaces and a timer bar always on screen. The operator stand-in chooses between
rendered options, not descriptions. A decision record supersedes decision 5;
`PRODUCT.md`, `DESIGN.md` and its sidecar are rewritten.

Exit: the stand-in has chosen the direction from rendered options, and the usability
gate passes the app shell in the new direction on phone and PC, in light and dark.

Done 2026-10-20: Kimai's structure in Kimai's skin (decision 9, superseding decision
5). The stand-in chose it from three rendered options (`A`, `B`, `C`), and its skin
was pulled back to Kimai's own (`A2`). The renders are beside the spec. What was built:

- Tokens in `src/routes/layout.css`:
  - neutral near-white and near-black grounds;
  - the sidebar `#262626`, `#0f0f10` in dark, and the phone timer strip a step off it;
  - one blue for running and the primary action, red only for irregular or destructive;
  - eight project colours with fill and ink;
  - Public Sans self-hosted, on a five-step type ramp;
  - `punch` and `printed` renamed `figures` and `caps`.
- A project's colour comes from its place in the user's projects by creation order
  (`src/lib/project-colour.ts`), with nothing stored.
- The shell:
  - on the PC, a sticky sidebar (Today, Entries, Copy-out, Reports, Templates, Setup,
    History, Account; Users and Backup for an admin; the user and Sign out at its foot)
    and a 60 px header with the screen's title as the page's one `h1` and the timer bar;
  - on the phone, a top bar with the title, the timer strip, and a bottom bar (Today,
    Entries, Templates, More) whose More is a sheet over the page;
  - everything works without JavaScript.
- The timer bar is on every screen. It shows the newest running timer in full (elapsed,
  the project's colour dot, customer › project, activity and description, Stop) and a
  "+N" list of the others, or "No timer running". Stop posts to `/timers/stop`, returns
  to the same URL with its query, and offers Undo there.
- Today's Timers section is gone.
- Scroll padding keeps a focused field clear of the sticky bars.

Records: spec `docs/superpowers/specs/2026-10-20-design-direction-design.md`, plan
`docs/superpowers/plans/2026-10-20-design-direction.md`, decision 9. `PRODUCT.md`,
`DESIGN.md` and `.impeccable/design.json` are rewritten by impeccable's documenter.
`docs/app.md` gains a Shell section, and the shell's surface brief in
`.impeccable/surfaces/` is updated.

Checks:

- 662 unit tests and 168 browser tests (10 skipped: the PC runs of the phone-only
  tests); check and lint clean.
- impeccable's detector reported three advisory font-size findings, measured against
  round 1's type ramp, all resolved by the new ramp.
- Its finish reviewer returned fix (four items), then ship after one fix round.

Calls made in the operator's place, the stand-in's (spec, "Calls made in the
operator's place", 1–11):

- **The direction is option A, Kimai's structure.** Source: operator's voice,
  2026-10-19, and the reference study. Confidence: inferred.
- **A's skin is Kimai's, not the ledger's.** Source: reference study. Confidence:
  ungrounded, queued.
- **The timer bar shows and stops; starting is item 12's.** Confidence: inferred.
- **The navigation lists only screens that exist.** Confidence: inferred.
- **The phone's split is the builder's, from the study.** Confidence: inferred.
- **Light and dark follow the device only.** Confidence: ungrounded, queued.
- **The screens keep their layouts until item 15.** Confidence: inferred.
- **The sign-in page is item 15's.** Confidence: grounded.
- **What makes a look feel wrong.** Confidence: grounded for the quotes, ungrounded
  beyond, queued.
- **Project colour shows only in the shell in this item.** Confidence: inferred.
- **A project's colour is derived, with nothing stored.** Confidence: ungrounded,
  queued.

The builder's, from the design session (spec calls 12–22):

- impeccable's direction roll bounded by the brief;
- Calendar and "+ New entry" rendered but not built;
- the bottom bar's four items;
- Today's Timers section removed;
- several timers shown as the newest plus a count;
- Undo after a stop on every screen;
- the utility rename;
- the colour's position rule;
- the 1024 px breakpoint;
- the title moved into the shell;
- the approval's notes.

The builder's, from the build:

- A refused stop shows in the alert strip directly under the bar, not inside the bar.
- On screens that own an undo strip (Today, Entries, Setup, Templates, History), a
  stop's Undo or refusal shows in that screen's own strip, where round 1 put it.
- impeccable's finish reviewer and documenter were dispatched by the controller, not
  by an implementer.
- The header's inner row takes `main`'s measure (`max-w-6xl`), so the timer bar ends
  at the content's edge.
- The header naming the span in view (e.g. "Entries · October 2026") is deferred to
  items 13–14; the surface brief records it.
- The phone timer strip got its own tone (`--sidebar-strip`).
- The type ramp gained a 17 px step, and `caps` reads `--text-xs`.
- The phone title is 21 px.
- Escape in More returns focus to its summary.
- An earlier-day timer in the "+N" list shows its start date.
- The browser bar's `theme-color` is the near-black of the bar.
- Round 1's `punched` and `PUNCHED` names were dropped from the code.
- After gate attempt 1 failed on phone touch targets inside round 1's screens, every
  tappable control's own box on the phone (below `lg`) became at least 44×44 px: links
  and buttons by minimum sizes, checkboxes and radios by a 44 px box around the same
  20 px square. Layouts and the PC's density are unchanged, and a phone browser test
  sweeps every screen.

Questions queued in `docs/questions.md`:

- where a project's colour comes from;
- the skin;
- light and dark;
- what makes a look feel wrong.

Deferred minors:

- More has no tap-outside close.
- The "+N" panel has no Escape or outside close, and can be open together with More.
- After a Stop with JavaScript, focus falls to the page body.
- Today's "Running" label is not in caps, as Entries' is.
- The long-text truncation of the PC timer pill is untested at about 1024 px.
- An earlier-day timer in the "+N" list is checked by a unit test only; the seed has
  none.
- Overlaps show red only in the warnings after a save.
- The shell's `NavRoute` cast.
- The theme test checks variable names, not their Tailwind exposure.
- The PC scroll padding is untested.
- The touch-target sweep has no guard against finding nothing.
- The phone's drawn checkboxes are untested in forced-colours mode.
- Select-all's mixed state draws nothing (as before).

### 12. The entry and the timer — done 2026-10-20

The two things used every day, built once and reached from everywhere:

- **The entry form**, for creating and editing, opened in place over whatever view
  the user is on: a date with start and end or duration, forgiving time input,
  customer › project picked by typing, activity, location, reference and description,
  and keyboard save. A new entry for any day and time is one action from every view.
- **The timer bar**, always on screen: the running timers with their elapsed time,
  stop in one tap, start from recents, favourites and templates, and restart of a
  past entry.

Undo stays one step after every save, stop and delete.

Exit: the usability gate passes these tasks on phone and PC: an entry for any past
time is made and corrected without leaving the current view, and a timer is started,
stopped and restarted from any screen.

Done 2026-10-20: one entry form for new and existing entries, opened in place over
every screen, and a timer bar that starts and restarts timers. No core, MCP or database
change. What was built:

- A forgiving time parser shared by browser and server (`src/lib/time-input.ts`):
  - times as `9`, `900`, `9:00`, `1330` and `9pm`;
  - durations as `5:30`, `5.5`, `5h30` and `90` (a bare number is minutes);
  - dates as `2026-10-18`, `20261018` and `10.18` (month, then day);
  - `17.5` and `9:5` are refused with a reason.
- The entry form (`src/lib/components/entry/`):
  - fields: the date with Today and Yesterday; start, end and duration linked;
    "Start at previous end"; a typed customer › project combobox grouped by customer
    (a grouped `<select>` without JavaScript); activity, location, reference and
    description;
  - on a new entry, "Fill from" templates;
  - on an existing one, Delete (at once, with Undo), Copy, Restart and Save as
    template, disabled with the reason while the form has unsaved changes;
  - Ctrl/Cmd+Enter saves;
  - an untouched end keeps its exact instant, with "+N days" or its own zone shown;
  - an empty end and duration start a timer.
- Pages `/entries/new` and `/entries/[id]` work without JavaScript; with it, the same
  form opens over the current screen through shallow routing:
  - on the PC, a 660 px dialog;
  - on the phone, a sheet whose Cancel and Save stay above the keyboard.
- "+ New entry" sits in the PC header and a fixed "+" on the phone; `n` opens the form
  and `s` stops the shown timer. Rows on Today and Entries open the form in place and
  carry a ▶ Restart.
- The timer bar:
  - Start opens a list (a PC popover, a phone sheet) of templates and "Start on a
    project…";
  - the running timer opens its form;
  - the phone strip shows customer › project with ▶ and a 44 px Stop;
  - the strip offers Restart after a Stop.
- Routes `/timers/start`, `/timers/restart` and `/entries/previous-end`. Today's "Start
  a timer" section, round 1's edit page and `StartTimer` are gone.

Records: spec `docs/superpowers/specs/2026-10-20-entry-and-timer-design.md`, plan
`docs/superpowers/plans/2026-10-20-entry-and-timer.md`. `docs/app.md` and `PRODUCT.md`
are updated. `DESIGN.md`, `.impeccable/design.json` and the shell's surface brief were
updated by impeccable's documenter. No new decision record.

Checks:

- 834 unit tests and 218 browser tests (20 skipped); check and lint clean.
- impeccable's detector was clean. Its critique and audit found 0 P0, 2 P1, 6 P2 and
  3 P3; nine were fixed, two went to the stand-in.
- The final whole-branch review found 2 Important; both were fixed and re-reviewed.

Calls made in the operator's place, the stand-in's: spec calls 1–13, as recorded in the
spec (sources and confidence there). From the build's critique:

- **The phone "+" is always shown, and right-edge controls move out of its column.**
  Source: operator's voice (Kimai "fiddly"), reference study. Confidence: inferred.
- **The `input` stroke token stays as it is**, though it is below 3:1. Confidence:
  ungrounded, queued. Item 11's token touches every screen, so it is tracked as
  vbartalis/time-keep#1.
- **Both blue fills in the PC header stay.** Confidence: ungrounded, queued.

The builder's, from the design session: spec calls 14–28.

The builder's, from the build:

- `createInput` reads the date through `readDate`.
- `edit.ts` keeps `withCurrent` and `postedValues`, which other screens use.
- A template filled into the form keeps its own zone, as Today's sheets do. A template
  started as a timer uses the device zone.
- Changing only an entry's date moves the whole entry; its end loses its seconds.
- The layout's zone filling never overwrites an edit's, a copy's or a template's zone.
  The linking never rewrites a field on load.
- Restarting an entry deleted elsewhere flashes "This entry was deleted elsewhere."
- The server's form reading learned the linking's "typed" and "followed" states, so a
  multi-day duration and a moved start save correctly.
- The form gained an `onFailure` hook, so refusals stay in the overlay. Copy opens in
  place there.
- The phone start sheet's scrim leaves the strip undimmed, so ▶ closes it without
  JavaScript.
- Rows' Restart posts only `id` and `back`; a restart uses the entry's start zone.
- Nine critique findings were fixed:
  - the phone strip's Stop became a square;
  - the phone sheet pins only Cancel and Save;
  - the ▶ icons are no longer blue;
  - a focused field scrolls clear of the footer;
  - opening an existing entry on the phone focuses the sheet's heading, not the picker;
  - a running entry reads "No end: the timer keeps running.";
  - "Start at previous end" is a full-height control on the PC;
  - the page behind the phone start sheet is inert;
  - right-edge controls stay out of the "+" column. On the phone, Today's ▶ leads its
    row, Entries' ▶ sits under the checkbox, and the undo strip's buttons wrap under
    the message.
- The "+" guard counts a control as covered only when less than 44 px of it stays
  beside the "+".
- An entry under a minute long saves and copies.
- On a form page, opening another form navigates to its page instead of stacking an
  overlay.
- The e2e seed has no Myself › time-keep, so gate 8's test uses Acme › Operations.
- After gate attempt 1 failed, three fixes, all reviewed:
  - On the phone, Today's "Overlaps another entry" badge widened the page. Badges now
    wrap inside their row.
  - Saving from a row jumped the list to the top. Save, Undo and Restart now keep the
    scroll position.
  - The undo strip pins under the sticky bars once the page scrolls past it. An edited
    row is scrolled clear of it, and keyboard focus in the screen's content stays clear
    of it.
  - The page-wide top scroll padding became a top scroll margin on the content in
    `main`, so focus in the bars never scrolls the page.

Questions queued in `docs/questions.md`:

- the working day;
- a bare number in a duration;
- the `input` stroke contrast;
- two blue fills in the PC header.

Deferred minors:

- The refusal hint for a decimal time always suggests `:30` first.
- A duration's `H:M` minutes are not bounded.
- The server reads `Date.now()` for a short date's year.
- Fill from offers templates whose project is archived.
- A delete or race refusal's wording: "Not found." on a save that races a delete.
- The routes read the clock live, not a pinned `now`.
- Linking is wall-clock only across a DST change or two zones.
- Colour dot tables are duplicated in three components, the Activity and Location
  selects are duplicated, and the row Restart is duplicated.
- A drag that ends on the backdrop closes the form.
- The gone entry's Back link leaves the form in history.
- After a save, history holds the screen twice.
- The history state holds the whole preload data.
- The phone sheet's focus scroll also fires in the footer.
- The PC scroll padding.
- `main` stays inert if the viewport crosses 1024 px with the sheet open.
- The "+N" list's Stops are icon-only.
- Same-project Restart buttons share an accessible name.
- The bar link's name starts with the ticking time.
- `n` on `/entries/new` reloads the blank form.
- A new entry, or a Restart from the form, is not scrolled clear of the pinned strip.
- The content's scroll margin also applies inside the project listbox on the full-page
  form.
- Test gaps:
  - focus return, modifier keys and the no-JavaScript row ▶;
  - templates with a description or without a project;
  - leap days;
  - route tests for `/entries/new` and `/entries/previous-end`;
  - waits on `networkidle` and hard-coded click points.

### 13. Calendar views — done 2026-10-20

Day, week and month views of the user's entries, in the manner of a good phone
calendar: entries as blocks on a time grid, the running timer shown live, a line at
now, totals per day and week, moving between dates by swipe and by buttons, and a
tap or drag on empty time opening the entry form at that time. On the PC, entries are
moved and resized by dragging. Overlaps show as overlaps.

Exit: the usability gate, on a seeded month, reads, creates and corrects a week of
entries in the calendar on phone and PC.

Done 2026-10-20: a Calendar screen (`/calendar?view=day|week|month&date=`) with day,
week and month views on the PC and the phone. No core, MCP or database change. What
was built:

- Pure, browser-safe modules in `src/lib/calendar/`: dates and periods (`dates.ts`),
  the grid's geometry (`grid.ts`: pieces per day cut at local midnight, lanes,
  overlaps by the core's rule, day totals, snapping, the half-hour slot, the drag
  range), and the drag's arithmetic (`drag.ts`: moves by wall-clock days, a 5-minute
  floor, a move kept inside the period shown).
- The server shaper `src/lib/server/screens/calendar.ts` (`calendarFor` over
  `entries.list`, `moveInput`) and the page's `?/move` action: one `entries.update`
  per drag, the strip's Undo, a stale version refused with "This entry changed
  elsewhere. The calendar shows it as it is now."
- Navigation: Calendar after Today in the sidebar; the phone's bottom bar is Today,
  Calendar (`view=day`), Entries, Templates, More. "+ New entry" and the phone's "+"
  carry the day in view.
- The toolbar: ‹ Today ›, the period's title opening a date picker (a month of day
  links, no JavaScript needed), the totals and Day / Week / Month. One arrangement per
  layout, each in its visual order; on the phone a short one-line title and one
  totals line.
- The day and week grid: all 24 hours, shading before 08:00 and from 20:00, opened at
  07:00 (earlier for an earlier start, now in view on a period holding now); blocks in
  their project's colours, text ending on whole lines; overlaps side by side with a
  red top edge, names wrapped whole; a midnight crossing on every day it covers, "from
  the previous day" on the next, counted on its start day; the running block growing to
  now with "now · Running h:mm" and a dashed blue foot; the line at now in the text
  colour; today in a filled text-colour circle. The phone's week is seven colour-only
  columns, each a link to its day.
- The month: on the PC, cells with the day's total, up to four entry lines and "+n
  more", the ISO week and its total, outside days shaded; on the phone, cells with the
  total and a dot per project, then the chosen day's list.
- Keys `←`/`k`, `→`/`j`, `t`, `d`, `w`, `m`; a horizontal swipe in all three views.
- Creating: on the PC a click makes the hour from the half hour, a drag the range
  snapped to 5 minutes; on the phone's day a tap makes a block with round handles
  stepping 15 minutes and a bar with Cancel and New entry. All open item 12's form.
- Moving and resizing by drag on the PC, snapped to 5 minutes, with a lifted block, a
  dashed outline where it was and a landing tag; handles only where an entry really
  starts and ends; Escape cancels; one release is one update and one undo.
- Durations are exact and truncated to the minute, as everywhere else. Blocks and month
  lines name their day for assistive technology; today carries `aria-current="date"`.
  The page refetches when the date rolls over with it open.
- The seed (`scripts/seed-month.ts`) gains a second overlap and a second midnight
  crossing in last week; `e2e/seed.ts` gains `seedCalendarWeek`.

Records: spec `docs/superpowers/specs/2026-10-20-calendar-views-design.md`, plan
`docs/superpowers/plans/2026-10-20-calendar-views.md`. `docs/app.md` and `PRODUCT.md`
are updated. `DESIGN.md`, `.impeccable/design.json` (the new `shade` token, the
Calendar components, the Text-Colour Marks rule) were updated by impeccable's
documenter; the shell's surface brief is resolved. No new decision record.

Checks:

- 924 unit tests and 280 browser tests (56 skipped); check and lint clean.
- impeccable's critique and audit found 0 P0, 1 P1, 4 P2 and 6 P3; all were fixed (one
  in part: see the builder's calls), reviewed and re-reviewed.
- The final whole-branch review found 2 Important (rounded durations; blocks not naming
  their day); both were fixed with five of its Minors and re-reviewed.

Calls made in the operator's place, the stand-in's: spec calls 1–14a and 30–31, as
recorded in the spec (sources and confidence there). From the build's critique:

- **The phone month's chosen day is ringed in the text colour, not blue.** Source: the
  spec ("Red or blue used for anything but …" rejected), DESIGN.md's One Blue Rule.
  Confidence: inferred.
- **The phone toolbar follows `ph-day`:** a short one-line title, one totals line, no
  week-number line on the phone. Source: the spec's toolbar, the `ph-day` mockup,
  operator's voice 2026-10-18 (the phone for quick access). Confidence: inferred.
- **The critique's fix pass took every finding.** Source: the roadmap (small and in
  scope is fixed in the item), operator's voice 2026-10-19. Confidence: inferred.

The builder's, from the design session: spec calls 15–29.

The builder's, from the build:

- The scroll on open counts only pieces that hold an entry's real start; a
  continuation from 00:00 does not pull the grid to midnight.
- The toolbar renders its controls once per layout, each in its visual order, since
  one DOM order cannot match both and CSS order breaks the focus order.
- While a new block is pending on the phone, a swipe drops it and does not change the
  day; any tap elsewhere drops it too.
- Short blocks are laid out by their drawn height, so back-to-back short entries sit
  side by side; a block sharing its column is drawn tall enough for its whole name.
- On the phone's day, a block grows toward 44 px only into free time before the next
  one (a running block never); a short block right before another stays shorter, and
  WCAG 2.5.8 holds by its spacing exception. A hard 44 px floor would push full-width
  day blocks side by side.
- The lifted block has the popover-down shadow and a project-colour edge, not a blue
  ring.
- A drag-create floors its start to the 5 minutes under the press.
- A new `shade` token (light `#f2f3f5`, dark `#323438`) shades the grid's off hours and
  the month's outside days, a step away from the border in both themes.
- The single-character keys (`j k t d w m`, and item 12's `n s`) have no off switch, a
  known exception to WCAG 2.1.4 (level A), kept because the spec asks for them.
- Tasks 1 and 2 were built and reviewed together.
- After gate attempt 1 failed (the line at now struck through a young running
  block's text and a neighbour's, and a narrow lane cut "Running …"), the line runs
  behind the blocks, whose fills are opaque, with the dot and the gutter tag on top;
  inside the lane that covers now the line is hidden. In the narrowest lanes the name,
  then the word give way, so the elapsed time always reads ("R… 0:10").

Questions queued in `docs/questions.md`:

- whether the calendar remembers the last view.

Deferred minors:

- A three-lane PC week at 1440 px breaks names mid-word; they show whole.
- A grown phone-day block next to another reads longer than its time; its times are in
  its name and tooltip.
- The `short` one-line exception also applies on the PC day.
- The drag tag covers the lifted block near the top of the day.
- While a move saves, a toolbar navigation goes through and the save returns to the
  original period.
- A swallowed click can stay pending if a drag ends with no click event.
- A press on a block does not focus its link.
- A PC create drag released over the toolbar or sidebar still opens the form.
- No auto-scroll at the grid's edges during a drag.
- `screenKey` treats only `dialog[open]` as a dialog.
- The toolbar's week total stops ticking when the running entry's day is not in view.
- A grid newly shown after crossing 1024 px is not scrolled on open.
- The grid's fit is tied to the shell's bottom bar and a fixed margin.
- The picker's 44 px cells overflow its panel slightly; `lg:left-24` places it.
- The phone's tap on an outside-month cell moves to that month.
- A seconds-only day shows "0:00" rather than "–".
- The midnight refetch may disturb a pending block or a drag at exactly midnight.
- Both layouts' DOM is rendered and hydrated.
- Test gaps: Escape on a create drag, a create drag over another column, swipe in the
  week and month, the dashed foot and red edge, scroll after an invalidate, a DST day
  and an end with a template in `calendarFor`, Saturday and Sunday as the seed's
  today, the Sunday-below-grid drop.

### 14. The timesheet table — done 2026-10-20

Kimai's table view, done better: entries newest first, grouped by day with daily
totals, the columns that matter on each surface, a row opening the entry form, a row
menu with restart, copy, edit and delete, filters folded into one control with
relative date presets that are kept between visits, one search across customer,
project, activity, location, reference and description, and bulk edit and delete
appearing only once rows are ticked. Whether Kimai's weekly hours grid is built here
is decided by item 10's study.

Exit: the usability gate, on a seeded month, finds, reads and reorganises the month's
entries from the table, on PC and phone.

Done 2026-10-20: Entries (`/entries`) rebuilt as the timesheet table, and the
Calendar given the same filter. The core's search widened to activity and location
names (for the agent too); no MCP or database change. What was built:

- A browser-safe filter model in `src/lib/filter/filter.ts`: presets (Today,
  Yesterday, This week, Last week, This month, Last month, Custom range), their short
  ISO hints, the scope (customer › project, activity, location, `none`), the address
  (`range`, `from`, `to`, `customer`, `project`, `activity`, `location`, `q`; `select=1`
  and `all=1` without JavaScript) and the chips' count.
- The server shaper `src/lib/server/screens/timesheet.ts`: the range's entries grouped
  by day (the start date in the entry's start zone), newest first, with day and range
  totals (exact, truncated to the minute, a running entry ticking to now), capped at
  the newest 500 with a message, overlaps judged against all entries, a refused read
  (a search over 200 characters) shown as an error, and the filter's options with
  archived ones marked.
- The preset is kept per device in the `entries_range` cookie (400 days); a custom
  range lasts for the visit.
- The PC table: a ruled table of day heads ("Tue 2026-10-20", the day's total) and rows
  (tick box, start, end, hours, Customer › project at a fixed 224 px with its dot,
  activity, location and reference from 1280 px, description, ▶ Restart and ⋯); "+1"
  on an entry past midnight; red top edges on overlaps; "Running" in blue. A row click
  opens item 12's form over the table.
- The toolbar: Filter (a popover naming the range, with the presets, the scope and
  a "+n" badge), one live search across customer, project, activity, location,
  reference and description (`/` focuses it), the count and total; chips under it with
  Clear filters.
- The row menu: Restart (disabled with "Already running" on a running row, still
  reachable by keyboard), Copy, Edit, Delete at once with Undo.
- Ticking: row boxes, day-head boxes (mixed when some are), shift-click runs; the bulk
  bar takes the toolbar's place with "n selected · h:mm", the set it acts on, Edit…,
  Delete, Clear selection. "Edit n entries" sets customer › project, activity,
  location, reference (or clears it) and finds and replaces in the description, as one
  batch with one undo; a stale entry is refused in the dialog by name. Ticks clear when
  the shown set changes and after a done action; ticked rows take the accent fill;
  focus goes to Undo after an action and back to the head box or Select after a clear.
- The phone: a list of 64 px rows with the 4 px project bar, a leading ⋯, start over
  end, the project wrapping to two lines and the duration clear of the "+"; bottom
  sheets on native `<dialog>` (scrim, Escape, Back) for the filter (each choice applied
  at once, "Show n entries" closing it), the row menu (headed by its row) and the bulk
  edit (Cancel and Apply pinned); Select switches ⋯ to tick boxes and hides the "+".
- Without JavaScript the screen is plain pages: the filter a GET form, row boxes and
  the bulk bar always shown, Select a link, the row menu a `<details>`. A `js` class set
  before first paint hides the no-JS-only parts, so nothing moves on hydration.
- The Calendar's filter (`calendarFor` takes a scope): only matching blocks, every
  total counting only them with "(filtered)", overlaps still judged against all, the
  chips under the toolbar, the filter kept by ‹ › Today, the views and the date picker.
  On the phone Filter is a 44 px icon button and the title has its own row.
- A `--checkbox` stroke (≥3:1, both themes) for every checkbox in the app; `--input`
  is unchanged.
- `e2e/seed.ts` gains `seedMonthEdges`.

Records: spec `docs/superpowers/specs/2026-10-20-timesheet-table-design.md`, plan
`docs/superpowers/plans/2026-10-20-timesheet-table.md`. `docs/app.md`, `docs/core.md`
and `docs/mcp.md` are updated; `DESIGN.md` and `.impeccable/design.json` were updated
by impeccable's documenter. No new decision record. Kimai's weekly hours grid is not
built (the study rejected it, §4).

Checks:

- 980 unit tests and 317 browser tests; check and lint clean.
- impeccable's critique and audit found 0 P0, 3 P1, 6 P2 and 3 P3 (and two detector
  hits on the 4 px project bar, false positives); all were fixed, reviewed and
  re-reviewed.
- The final whole-branch review found 1 Important (the no-JS bulk bar shown until
  hydration, then the table jumping); it was fixed with five of its Minors and
  re-reviewed.

Calls made in the operator's place, the stand-in's: spec calls 1–25, as recorded in
the spec (sources and confidence there). From the build's critique:

- **The phone Calendar toolbar:** views, Filter as a 44 px icon button with its count
  badge, Today in the first row; ‹ title › in their own row. Source: item 13's done
  note, operator's voice 2026-10-19. Confidence: inferred.
- **The phone bulk edit sheet pins Cancel and Apply** to its foot, as the filter
  sheet's foot. Source: spec call 20, the spec's anti-goal (bulk actions out of sight).
  Confidence: inferred.
- **Project names read in full:** on the PC a fixed, wider Customer › project column
  inside the shell's measure; on the phone the project line wraps to two lines.
  Source: operator's voice 2026-10-18 (the chain lives in the project name), the
  `pc-table` mockup. Confidence: inferred.
- **Checkboxes alone get a stroke of at least 3:1;** `--input` stays. Source: the
  roadmap's deferral of the unchecked box's grey (item 3), `docs/questions.md` (item
  12). Confidence: inferred.
- **Ticked rows take the accent fill.** Source: the `pc-selected` and `ph-select`
  mockups, DESIGN.md's Accent. Confidence: inferred.
- **Focus after a done action goes to Undo; after a clear to the head box or Select.**
  Source: vision principle 2, operator's voice 2026-10-18, the spec's menu focus
  return. Confidence: inferred.
- **The critique's fix pass took every finding.** Source: item 13's done note, the
  roadmap, operator's voice 2026-10-19. Confidence: inferred.

The builder's, from the design session: spec calls 26–41.

The builder's, from the build:

- `searchPath` and its test were dropped in task 4, when Entries stopped using it,
  not in task 3.
- Round 1's `ChangeForm.svelte` was reshaped into the bulk form from `main`, since an
  earlier task had deleted it; task 4 deleted it and `EntryTable.svelte` early.
- An unknown `range` reads as no range (the kept preset, then This month).
- `any` reads as not set in the scope; the no-JS `scope=` select applies only when
  neither customer nor project is given; a kept `custom` falls back to This month.
- The cookie is written on a first visit with no range too (This month).
- Clear filters keeps the search and the range; the search has its own clear.
- Live navigation uses SvelteKit's `reset: false` and `replace`, the repo's
  SvelteKit having deprecated the plan's options.
- While ticks are up, the bulk bar's set line ("This month · “printer”") stands in
  for the search (call 18).
- The page swaps the toolbar for the bulk bar; the bulk form keeps its refusal in the
  dialog; singular copy "Edit 1 entry", "Apply to 1 entry", "One undo puts it back.";
  without JavaScript the bulk bar sits under the toolbar and is left out with no rows.
- Back closes a sheet by cancelling the navigation; with JavaScript only one of the
  table and the phone list is rendered, by width; the phone's toolbar and row links
  keep a 56 px right margin clear of the "+".
- The phone bulk bar's Edit… and Delete are off until a row is ticked.
- The date picker's browser-test locators were narrowed, since Filter is a `summary`
  too.
- The project column is 224 px (Activity and Location each 16 px narrower); the phone
  presets' hints sit under their names; the phone Calendar's Filter is named "Filter
  +1 more filters" when on; the no-JS phone Calendar's filter panel hangs under the
  toolbar over the page; the bulk form's pinned foot applies on the PC dialog too.
- `components/entries/` stays (Copy-out and Reports still use its filter bar until
  item 15).
- The final fix wave took the review's Important and Minors 1, 3, 5, 6 and 7.
- After gate attempt 1 failed (the bulk bar scrolled out of sight with the toolbar;
  phone rows cut the activity · location · reference line, hiding every reference),
  the bulk bar and the chips stay pinned under the header while rows are ticked (PC)
  or Select is on (phone), with the undo strip inside that band above the bar; the
  phone row's lines, its description and the bar's set line wrap instead of being
  cut, and the phone list runs edge to edge. Clear selection and Done focus the head
  box or Select only when it is in view, else the last-ticked row's control, so the
  page never jumps.

Questions queued in `docs/questions.md`:

- whether the bulk edit should also move times;
- whether the screen is called Entries, Timesheet or My times.

Deferred minors:

- The overlap read is unbounded for an open range and compares every pair; a partner
  lasting past the range's end plus two days can lose a mark.
- Projects are read three times per Entries load.
- The project-dot table, the Filter trigger and PhoneList's helpers are duplicated.
- The Calendar month's "Show n entries" counts the neighbouring months' days.
- Undo brings a deleted ticked row back ticked.
- The aria-live count announces every tick change.
- Without JavaScript `select=1` keeps the toolbar above the bulk bar, and select mode
  ends after a bulk Delete; a JavaScript user on such an address sees a swap on
  hydration; with the bundle failing, the no-JS bulk controls are hidden.
- A tap on a sheet's uncovered background (the safe-area strip) closes it.
- "01:00+1" on a phone row against "01:00 +1" in its sheet.
- A phone row's right margin and ⋯ cell do not open the form.
- Description is about 100 px wide between 1024 and 1279 px.
- On a refused list read the toolbar still shows "0 entries · 0:00".
- Focus drops when the last row is unticked while on Edit… or Delete.
- DESIGN.md's `project-column`, `phone-entry-row` and `sheet-row` tokens have no CSS
  variable.
- Test gaps: a refused no-JS Apply and a refused bulk Delete, a stale `delete` and
  `range=bogus` route tests, the overlap edge's colour, the phone Filter in the focus
  order, `calendarFor` with an activity, location or `none` scope, and the tick
  lookup's reuse, the clear focus's fallbacks, the pinned strip on the phone. One
  flaky run of the phone Calendar's focus-order test was seen.
- Phone day heads are about 13 px taller in Select, so rows shift slightly at Done.

### 15. The rest of the screens — done 2026-10-22

Every remaining screen redone in the new direction and the patterns of 12–14: Setup
(customers › projects, activities, locations), templates as part of favourites,
History, Copy-out, Reports, Account and agent access, Users, Backup and the login.
The phone's navigation reaches everything it needs. Leftovers from round 1 (the rail
that stops at the screen's height) are gone.

Exit: the usability gate passes every one of these screens on phone and PC, and none
still uses round 1's look or patterns.

Split when it was brainstormed (2026-10-20) into four parts, worked in this order.
Today is in the item too: it still had round 1's layout, and the exit cannot be met
while it does (the stand-in's call, inferred). Each part's exit is the item's, for its
screens.

- **15a. Today, templates and Setup — done 2026-10-21.** Today, the Templates screen
  and the template form, Setup (customers › projects, activities, locations), and the
  phone's bottom bar and More, so the navigation reaches every screen, and what is
  left of round 1's rail that stops at the screen's height.

  Done 2026-10-21: the four screens redone in item 11's direction and the patterns of
  12–14; no core, database or MCP change. What was built:

  - The phone's bottom bar is four cells, Today, Calendar, Entries, More; More is a
    bottom sheet above the bar (Templates, Setup, Copy-out, Reports, History, Account,
    and Users and Backup for an admin, a rule, Sign out), closed by a choice, Escape,
    the scrim or Back; a `<details>` without JavaScript. Every screen is within two
    taps. `Sheet` gained `above` and `narrow`.
  - Today: TEMPLATES (by name, the project dot, a muted line of what each fills, the
    TIMER or LOG mark, Manage) over "Today · Tue 2026-10-20" with the ticking total of
    the entries that started today, and today's entries in Entries' rows and menus
    (`todayFor`, `tableRow` shared with `timesheetFor`; no tick boxes or day heads; an
    entry still running from yesterday marked "Since <date>" and not counted). A
    template tap opens a sheet (a dialog on the PC) asking only for what the template
    leaves blank, the project from its customer's active projects ("No active projects
    for <customer>." and Log off when there are none), Description always, "Change
    times" folded; `fromTemplate` takes activity, location and `back`. The date,
    "Signed in as" and zone lines are gone.
  - The template form is item 12's entry form in a template kind (`templateFormData`,
    `templateFromForm`): Name first, times of day with "next day", a customer alone as
    a choice in the picker, Time zone with the zone list, Delete at once with Undo,
    opened in place from Templates, Today and the Start list, back where it was opened;
    a page without JavaScript, where a changed duration or an unchanged duration-only
    template keeps its duration. Round 1's template form and its confirm are gone.
  - Templates: an outline New template and the count; the ruled table on the PC
    (Activity and Location from 1280 px) and wrapping rows on the phone, a row menu
    (Edit, Log… or Start timer… opening the sheet over Templates, Delete at once).
  - Setup: Active | Archived | All in the address (`?archived=1` reads as All); two
    columns from `lg`, stacked on the phone; ⋯ row menus (Rename, Add project,
    Archive or Unarchive; Rename only under an archived customer), rename in place,
    create in a 440 px dialog or a phone sheet, refusals beside the field with the
    typed name kept; archived rows muted with a chip; an active customer stands over
    its archived projects in Archived without a menu. Without JavaScript, `?rename=`
    and `?new=` forms and a `<details>` menu.
  - Phone rows' meta lines wrap between parts, a part breaking only when wider than the
    column (Entries too). The PC sidebar fills the window's height (checked; no change).
  - Round 1's e2e for Today, Templates and Setup were rewritten; the History, Backup
    and agent suites drive the new Setup through `e2e/setup.ts`; an Entries test that
    failed on some dates (a row gone after the delete) was made date-proof.

  Records: spec `docs/superpowers/specs/2026-10-20-today-templates-setup-design.md`,
  plan `docs/superpowers/plans/2026-10-20-today-templates-setup.md`. `docs/app.md` is
  updated; `DESIGN.md` and `.impeccable/design.json` were updated by impeccable's
  documenter. No new decision record.

  Checks: 1042 unit tests and the browser suite; check and lint clean. impeccable's
  critique and audit found 0 P0, 0 P1, 2 P2 and 4 P3 (the detector's one hit the 4 px
  project bar, a false positive); all six were fixed and reviewed. The final
  whole-branch review found 1 Important (a no-JS template save dropping a changed
  duration); it was fixed with four Minors, its own regression (a duration-only
  template losing its duration) was caught in re-review and fixed.

  Calls made in the operator's place, the stand-in's: spec calls 1–15, as recorded in
  the spec (sources and confidence there), and from the build:

  - **The TIMER mark is muted caps with a muted timer icon, not blue;** LOG stays
    muted. Departs from the spec's "TIMER in blue `caps`". Source: DESIGN.md's One
    Blue Rule, the spec's anti-goal, the build's screenshots (a blue TIMER read as
    running). Confidence: inferred.
  - Today's overlaps are judged against all the user's entries; an unchanged template
    save shows no strip; Back closes More (tested); the template form's Time zone
    keeps the zone list. Source: the spec. Confidence: inferred, grounded, grounded,
    grounded (the plan's approval).

  The builder's, from the design session: spec calls 16–22. From the build:

  - Each task left the build green: Tasks 4 and 7 kept round 1's template and Setup
    pages compiling until Tasks 5 and 8 replaced them.
  - Gate task 1 reads "asks only for what Standup leaves blank" (the seeded Standup has
    no location or reference); the "only the description" case is tested with a fully
    filled template.
  - A create made on Setup's Archived lands on All, so the new row is seen.
  - Without JavaScript, the Templates menu's Log… goes to Today's template panel.
  - The final review's residual (the duration-only regression) took one more fix round
    than the process's single fix wave, since it lost data.
  - DESIGN.md's One Blue Rule and its Don'ts allow the current bottom-bar cell's blue
    icon, which had already shipped.

  Questions queued in `docs/questions.md`: how Archived shows an active customer with
  archived projects; one Setup screen or one per kind; the order templates are offered
  in; what the PC opens on and whether Today is used there; whether templates stay one
  thing called Templates; where templates are made and changed; what is done in Setup
  and on which device.

  Deferred minors:

  - Today: the overlap read has no upper bound; "Since" and the total use the start
    zone's date (untested across zones); the sheet's Change times does not link End and
    Duration; a refused project does not take focus; Today's load builds unused
    templates.
  - The template form: on a template with no start and a duration, typing an end leaves
    the old duration shown (only the end is sent); with no stored end, a typed end and
    a changed duration keep the duration without JavaScript; one `aria-describedby`
    for the project and customer refusals; the picker's group label is announced twice.
  - Setup: the filter's address is written in four places; after a dismissed refusal
    the previous strip comes back.
  - More: the sheet sits about 1 px over the bar and can clip on a short landscape
    screen; a tap before hydration is lost; the scrim dims the bar.
  - The project-dot classes, the TIMER/LOG mark and the customer › project text are
    each written in several places; `today.ts` and `timesheet.ts` import each other.
  - Test gaps: the zone and midnight edges of `todayFor`, Archived without archived
    projects, a stable colour across filters, Setup's refusal shape as a route test, the
    delete refusal's `back`, clearing a template's start, the phone menu by keyboard,
    the round 1 "clearing the description stays cleared" case; the Entries Undo-in-view
    test measures the row above the deletion.
- **15b. History — done 2026-10-21.**

  Done 2026-10-21: History redone in item 11's direction and the patterns of 12–14.
  The core gained one read; `history.list`, its schema and the MCP are unchanged. What
  was built:

  - `core.history.page` gives the number of the user's batches, the page's place and
    the Newer page's `before` (not an MCP tool). The toolbar reads "1–50 of 312
    batches" (phone "1–50 of 312") with Newer and Older, and the links stay at the foot.
  - The shaper (`screens/history.ts`) gains the touched line (one entry "Tue 2026-10-20
    10:00–12:00 · CompX › ClientY – ProjectZ"; several as a date range and up to three
    customers › projects then "+n more"; other records capitalised), field lines split
    into name, old and new with a `same` flag, sentence-case subjects, and Entries' day
    heads with the day's batch count and "Continues on the older page."
  - PC, from `lg`: Entries' ruled table (Time, What, By, Changes, State) with day head
    rows; a batch row opens its changes in place; outline 32 px Undo and Redo with a
    36 px hit area on every row, no primary button; tick boxes on change lines; the
    52 px toolbar turns into the bulk bar at the first tick ("n selected", of
    "<label>" or across n batches, Undo selected, Redo selected, Clear), so the list
    does not move; a mixed selection disables both with "Tick only standing or only
    undone changes."; the strip rides in the band; a refusal shows under it, focused,
    the ticks kept. A batch over 100 changes lists its first 100 without boxes.
  - Phone, below `lg`: Entries-style rows with a leading 44 px Undo or Redo (both on a
    partly undone batch), the touched line wrapping, a meta line, the 72 px gutter;
    Select shows tick boxes on open batches and pins the bar ("n selected", Undo, Redo,
    Done).
  - Without JavaScript: `<details>` for changes, the bar's buttons always shown, pager
    links, Select as `?select=1`; the phone's ticks post in their own form, so a hidden
    layout's ticks never post.
  - Round 1's `e2e/history.test.ts` rewritten (PC and a 390 px describe), round 1's
    behaviours kept; `BatchLine.svelte` removed.

  Records: spec `docs/superpowers/specs/2026-10-21-history-design.md`, plan
  `docs/superpowers/plans/2026-10-21-history.md`. `docs/core.md` and `docs/app.md`
  updated; `DESIGN.md` and `.impeccable/design.json` recorded by impeccable's
  documenter (History dropped from round 1's carry-overs). No new decision record.

  Checks: 1082 unit tests and the browser suite (334 passed, the rest skipped by
  project); check and lint clean. impeccable's critique and audit found 0 P0, 0 P1, 4
  P2 and 6 P3 (the detector found nothing); the P2s and four P3s were fixed and
  reviewed. The docs review's one Important (the phone tick box's size) was fixed. The
  final whole-branch review found 1 Important (without JavaScript, a retry after a
  refusal on the phone reposted the hidden PC ticks); fixed and re-reviewed.

  Calls made in the operator's place, the stand-in's: spec calls 1–19, as recorded in
  the spec (sources and confidence there), and from the build:

  - **From 1024 to 1279 px the touched line may wrap to a second line before any cut,
    and Changes and State share one column; one line cut with "…" from 1280 px.**
    Departs from the spec's "one line, cut". Source: the spec's goal (find a batch on
    sight), its anti-goal (a row that cannot be told from its neighbours), the phone's
    "wrapping, never cut"; the build's 1024 px screenshots. Confidence: inferred.

  The builder's: spec calls 20–27. From the build:

  - Several entries sharing one date show the date without the weekday; a running
    entry's touched line keeps " · customer › project" after "–running"; an entry
    changed twice in one batch counts once, as the batch left it; date ranges use each
    entry's start date in its own zone.
  - A `same` field whose sides are both null reads "<Field>: none (same as shown)", one
    side, no arrow (call 8 against call 27).
  - After an undo on an older page the range shifts by one ("52–101 of 142"), since the
    undo is itself the newest batch and the page keeps its `before`.
  - Rows are grid rows in lists styled as Entries' table, not a `<table>`; the bar's
    disabled actions stay focusable; "1–1 of 1 batch" takes the singular.
  - Phone tick boxes are 20 px in a 44 px target (the app's phone checkbox rule), not
    the spec's 22 px.
  - The page stays 50 batches; the phone rows were trimmed instead (76–113 px).
  - A refusal does not name its batch and Select with nothing open has no hint: the
    core's refusal carries no batch and the spec gives no copy.
  - The phone's no-JS ticks have their own form rather than hiding the PC boxes, which
    broke the PC with `?select=1`.
  - The page-load cases (a split day, 50 and 51 batches) are tested in
    `src/routes/(app)/history/history-routes.test.ts`.

  Questions queued in `docs/questions.md`: where paging goes; how a changed field's old
  value looks; whether a change opens its record; one line per field or a Before /
  After table; whether the list is filtered; and the rest of 15b's design session.

  Issues: #4 (undo and redo labels nest their quotes, a core matter), #5 (History's
  tracked minors).

  Deferred minors:

  - In #5: the first "1 selected" is not announced; the strip remounts with the bar;
    ticks survive narrowing below `lg`; without JavaScript paging drops `select=1`; a
    hand-made `before` with nothing older reads "Nothing recorded yet.".
  - Look: at 1024 px a wrapped touched line can start with "– ProjectZ"; the ticked
    line's accent is an indented band; the phone page is 5760 px for 50 batches; the
    What head sits 20–28 px left of the labels; dead `max-lg:` classes.
  - Code: `history.page` and `history.list` each look up `before`; `screens/history.ts`
    imports `screens/timesheet.ts` for `labelOf`; an import out of order in the core's
    index.
  - Test gaps: day heads and "Continues…" unasserted in e2e (route tests cover them);
    gate e2e seed through the core; the sticky band and the "…" cut; opening a batch in
    Select; the no-JS phone gutter; a tight row-height bound (≤116 px against 113); a
    createdAt tie in `history.page`; an edited-then-deleted entry; the "changed twice"
    test passes whichever change wins.
- **15c. Copy-out and Reports — done 2026-10-21.** They share round 1's filter bar
  (`components/entries/`), which goes with them.

  Done 2026-10-21: Copy-out and Reports redone in item 11's direction and the
  patterns of 12–14; round 1's filter bar and readers removed. The rows, the writers,
  the CSV format and the totals' arithmetic are unchanged; nothing in the core, the
  database or the MCP changed. What was built:

  - An output model (`filter/output.ts`: columns and options in the address as `cols`,
    `round`, `split`, `duration`) and one server reader (`screens/output.ts`) for both
    screens and the CSV route. Kept per device: `output_range` (the preset, shared by
    the two screens, apart from Entries' `entries_range`; never a custom range) and
    `output_choice` (columns and options); the address beats them, an address naming
    the choice writes it unless it names no column, the CSV route reads both and
    writes neither. Rows oldest first, no row limit.
  - Entries' toolbar, Filter popover and sheet, chips and live search generalised to
    the screen's path (`Toolbar` `action`, `noun`, `hidden`; `applyForm` carries the
    choice, and leaves it out when a form names none). "56 rows · 68:30" on Copy-out,
    "56 entries · 68:30" on Reports; every total follows Duration.
  - Copy-out, PC: the output band (ten `aria-pressed` toggle chips, the options with a
    segmented Duration, Copy the one primary, Download CSV outline, the polite status;
    one column with the actions under the options from 1024 to 1279 px, two from
    1280), and the sheet as a ruled table whose short columns stay on one line while
    Description wraps, scrolling sideways only when the columns cannot fit, with a
    Total row. With no column on or no match, Copy and Download CSV are off (focusable,
    saying why); with no column the toolbar still counts and totals the rows. Phone:
    Copy and Download CSV first, then COLUMNS and OPTIONS, no sheet.
  - Reports: the options line, then Days at the left and Weeks, Customers, Projects
    (with dots) at the right, each a ruled list with a Total; days "Thu 2026-10-01",
    weeks "W40 · 2026-09-28 – 10-04". Phone: an Options button opening a bottom sheet
    (outline Done), then Customers, Projects, Weeks, Days.
  - Without JavaScript both are `GET` pages: checkboxes, radios and Apply; Reports'
    phone Options a `<details>`. A new `data-js` rule mirrors `data-nojs`.
  - Fixed in passing: an impossible date (`2026-13-01`) was a 500 on every filtered
    screen and the CSV route; it is now refused with "Use dates like 2026-10-01.". A
    search over 200 characters reads "Use 1–200 characters." on both screens and the
    CSV's 400, as on Entries. The phone's "Clear filters" (Entries too) keeps out of
    the "+"'s column.
  - Round 1's `e2e/copy-out.test.ts` and `e2e/reports.test.ts` rewritten (PC, 390 px,
    no JavaScript), round 1's behaviours kept; `components/entries/`,
    `narrowing.svelte.ts`, `readSearch`, `searchInput`, `searchFilters`, `searchPath`,
    `groupProjects` and round 1's copy-out and reports readers removed.

  Records: spec `docs/superpowers/specs/2026-10-21-copy-out-and-reports-design.md`, plan
  `docs/superpowers/plans/2026-10-21-copy-out-and-reports.md`. `docs/app.md` updated;
  `DESIGN.md` and `.impeccable/design.json` recorded by impeccable's documenter (Copy-out,
  Reports and the filter bar dropped from round 1's carry-overs). No new decision record.

  Checks: 1094 unit tests and the browser suite (336 passed, the rest skipped by
  project); check and lint clean. impeccable's critique and audit found 0 P0, 0 P1, 5
  P2 and 5 P3 (the detector found nothing); the P2s and two P3s were fixed and
  reviewed. Task reviews: one Important (the phone sheet's Done was a third blue
  fill), fixed. The docs review's two Importants (a week label's dash, "Copy is not
  drawn") fixed. The final whole-branch review found no Critical or Important; its
  minors were fixed but one, parked below.

  Calls made in the operator's place, the stand-in's: spec calls 1–20, as recorded in
  the spec (sources and confidence there), and from the build:

  - **With no matching rows, Copy and Download CSV are both off (50 %, focusable,
    saying "No entries match."); the CSV address itself still answers a header-only
    file.** Source: none on record; the spec's no-column state by analogy.
    Confidence: ungrounded, queued.

  The builder's: spec calls 21–29. From the build (ledger rulings):

  - A week holding 2026-12-31 reads "W53 · 2026-12-28 – 2027-01-03", not the spec's
    and plan's "W01 · …": 2026 starts on a Thursday, so ISO weeks make it week 53;
    call 28's substance (the Sunday in full across the year) holds.
  - `csvName` keeps its output; its parameter is `{ from, to }` so it survives the
    removal of round 1's `Search` type.
  - `applyForm` leaves the choice out when a form names none, and Reports' forms carry
    the choice as hidden fields, so a filter change on Reports never resets the kept
    columns.
  - With no column on, the toolbar and Copy still count and total the matching rows
    (critique P2-1), as the spec has the toolbar still say the total without Duration.
  - The phone's "Clear filters" is kept clear of the "+" in the shared `FilterChips`,
    so Entries gets it too (the spec's anti-goal).
  - P3s fixed: the chip outline takes the `checkbox` stroke (3:1); the last Reports
    total clears the "+" (already true; now tested). Left: the phone checkboxes' indent
    against the mockup, the PC "Columns" label not in caps (as the mockup), unticking
    every chip keeps the last single column (call 26).
  - Interim: between Tasks 3 and 4 the Reports placeholder failed one touch-target
    case; Task 4 replaced it and the suite is green.
  - Parked: a round 1 bookmark with `from`/`to` and no `range` opens the kept preset
    with no sign the dates were ignored (the plan's Review Focus 1 rules it so);
    reading a bare `from`/`to` as a custom range is a later improvement.

  Questions queued in `docs/questions.md`: what the two actions do with no matching
  rows; whether a weekday with no time shows on Reports; shares beside totals; four
  lists or nested ones; bars or a chart; whether a total leads to its entries; all
  four totals at once; whether the ticked columns and options are kept; whether the
  two screens share a kept range.

  Deferred minors:

  - Look: on the phone "No entries match." sits below the band, out of first view,
    and the off button reads "Copy 0 rows"; all ten columns fit at 1440 px with 7 px
    to spare on the gate month (longer names scroll the panel, as call 12 allows); the
    Total label is hidden when Duration is the first column on; without JavaScript a
    chip label's fill and weight follow different states, and Apply hovers with
    `bg-primary/90`; "Columns" is named twice to assistive technology; Reports'
    options line hides on a refusal (as Copy-out's band).
  - Code: Copy-out's and Reports' buttons hand-roll the primary and outline classes;
    the project dot lookup exists three times; the Reports load's `entries` repeats
    `count`; `formFailure(…, []).error` is repeated in three readers; the route tests
    repeat their cookie and entry helpers.
  - Test gaps: `keepOutput` has no unit test; `outputQuery`'s round trip covers only a
    preset; "rounded and not" never asserts the two totals differ; `applyForm`'s
    unnamed choice is covered by e2e only; the phone Clear-filters loop asserts no
    count; the band's 1280 px boundary; "Copy failed" untested; hydration waits on
    `networkidle`; the Gate 5 sheet-total locator is positional.
- **15d. Account and agent access, Users, Backup and the sign-in page — done
  2026-10-22.** The last part also checks that no screen still uses round 1's look or
  patterns.

  Done 2026-10-22: Account, Users, Backup, the sign-in page and the error pages redone
  in item 11's direction and the patterns of 12–14; a sweep of every screen found no
  round 1 layout left. The users, tokens, auth and backup modules, the core, the
  database and the MCP are unchanged; the routes only add the field, dialog and values
  a refusal needs. What was built:

  - Shared parts in `components/admin/`: `Panel` and `PanelSection` (a caps head on a
    rule over a surface panel, edge to edge on the phone), `ActionMenu` (a ⋯ row menu:
    a 208 px popover on the PC, a row sheet on the phone; `menu-button.svelte.ts`
    lifted from Setup's menu), `FormDialog` (440 px dialog on the PC, bottom sheet on
    the phone; Setup's create dialog now runs on it) and the dialogs' closing and focus
    helpers.
  - Account: Change password and Agent access as two sections; "+ New token" opens a
    dialog that shows the token once with Copy (announced) and Done, every way of
    leaving it (Done, Escape, ×, scrim, Back, the bfcache) forgetting it; a token's ⋯
    has Revoke… with a confirm.
  - Users: a list with Admin and Disabled chips, "+ New user" in a dialog, a row ⋯ with
    Set password…, Disable or Enable (none on the actor's own row; its Set password
    says it signs them out everywhere else).
  - Backup: Download backup; Restore… opens a confirm naming the file (with no file,
    "Choose a backup file." and nothing posted); Before the last restore with its
    Download when that copy exists. Destructive buttons are the red outline.
  - The sign-in page as Kimai's card (`shell/CardPage.svelte`): the wordmark, the card,
    the alerts above the fields, the username kept after a refusal and the focus on
    Password, an eye to show the password. The root error page in the same card
    ("Not found", or the error's words, and "Back to Today"); the shell's error page a
    panel inside the shell, its header titled the same. Status codes unchanged.
  - Without JavaScript every dialog is an in-page panel at its section's head
    (`?new=token`, `?revoke=<id>`, `?new=user`, `?password=<id>`), refusals come back
    there, Revoke keeps its two-step confirm and Restore its checkbox.
  - Refusals are placed beside the field they name (`fieldOf`, `dialogOf` in
    `screens/accounts.ts`); one naming no field shows at the dialog's top. Passwords are
    never echoed.
  - The sweep's look-only fixes: the no-script template form's project selects kept in
    the field column; the no-script restore box aligned with the file field; Account,
    Users and Backup titled "<Screen> · Time Keep"; the shell's error page titled as
    the root one; one `Panel` shared by `PanelSection` and the error page. No behaviour
    leftover found, so no issue filed.

  Records: spec `docs/superpowers/specs/2026-10-21-account-users-backup-design.md`, plan
  `docs/superpowers/plans/2026-10-21-account-users-backup.md`. `docs/app.md` (Account,
  a new Users section, Backup, the sign-in and error pages) and `PRODUCT.md` updated;
  `DESIGN.md` and `.impeccable/design.json` recorded by impeccable's documenter (round
  1's carry-overs dropped, the shared parts named, a 13 px `hint` step added). No new
  decision record.

  Checks: 1119 unit tests and the browser suite (367 passed, the rest skipped by
  project); check and lint clean. impeccable's critique scored 35/40 and the audit
  19/20, both run in one context (the implementer may not dispatch agents); the one
  material finding (the made token's underscore hidden at 14 px) fixed by showing it at
  15 px. Task reviews: no Critical or Important; Tasks 2–4 each had a fix round (a
  popover post dropped focus, a lone foot button at half width, the made token back on
  a cross-document Back, the mismatch's field, the dialog closing copied between pages,
  an unknown user's Set password refusal shown nowhere). The final whole-branch review
  found one Important ("Copied" no longer announced), fixed with two of its minors.
  Before the gate the phone Calendar's focus-order test (#3) failed twice under the
  full suite: it read the toolbar before hydration, while Filter was still a
  `<summary>`; it now waits for the hydrated Filter button. A phone Templates
  stale-save flake seen once is filed as #6.

  Calls made in the operator's place, the stand-in's: spec calls 1–12, as recorded in
  the spec (sources and confidence there). The builder's: spec calls 13–21, and from
  the build (ledger rulings):

  - impeccable's critique and audit ran inside the implementer, not as their own
    agents, and DESIGN.md was recorded by the documenter as its own reviewed step.
  - Vitest paths with `(app)` are quoted.
  - `FormDialog`'s body keeps Setup's 20 px padding from `lg`, not the brief's 16 px,
    so Setup's look is unchanged.
  - `PanelSection` copies Setup's head and panel classes rather than Setup using it
    (Setup's page was not to change); parked.
  - "Passwords do not match." sits under Confirm new password (a `confirm` field), not
    under New password as Task 1's plan text had it.
  - A disabled admin shows both the Admin and the Disabled chip on the phone.
  - The shell's error page uses `Panel`, not `PanelSection`, which always draws a head
    the spec gives no words for.
  - Without JavaScript Restore… keeps its ellipsis (the checkbox is the further step).
  - The phone's full-width panel feet (Change password, Download backup, Restore…) pass
    under the "+" at rest, as the spec and mockup set them; the page scrolls them clear.
  - The success result handed to `applyAction` keeps its `location` (SvelteKit's type
    requires it).
  - From the sweep: error pages titled bare ("Not found", "Admins only"), as "Sign in";
    the made token at 15 px rather than another font.

  Questions queued in `docs/questions.md`: how wide Account, Users and Backup are on the
  PC; Account as one page or two tabs; when and on which device Users and Backup are
  opened; when and on which device Account is opened.

  Deferred minors:

  - Look: a server refusal on Restore stays shown after another file is chosen, until
    the next post; long unbroken token names wrap with a one-letter tail; the phone's
    admin row reads "Admin" twice to assistive technology; a dialog briefly shows after
    success from a reloaded `?new=` or `?password=` address; the no-script password
    field keeps the eye's padding; a failed revoke focuses "+ New token", not the
    alert; DESIGN.md's ramp leaves out the sign-in wordmark's 24 px.
  - Code: Users' table markup copies TokenList's; Users' dialogs are page snippets,
    Account's components; every row mounts its closed dialog; Account's page has an
    `eslint-disable` with no matching enable; `fieldOf` matches on a message prefix;
    `iconOf` casts; pages send no `Cache-Control`, so a cross-document Forward shows a
    stale token list (as before).
  - Test gaps: no unit test of `ActionMenu` or `FormDialog` (the e2e covers focus);
    closing the made dialog by scrim or ×; the bfcache test passes without its fix in
    headless Chromium; the 404 only signed out; focus back to the admin's own ⋯; a
    32-character username on the PC; the no-script eye; a 0-byte backup file; the
    no-file refusal's precedence; the phone red-outline check (fill against text
    only); setPassword's unknown user and Account's short new password at route level;
    a weak password-echo guard.

### 18. Starting a timer on a project that has one running — done 2026-10-22

Starting a timer on a project whose timer is running stops the running one, whatever
the minute: the usability check (item 16, first run, 2026-10-22) found that a second
start in the same minute as the first was refused in the form with "The running timer
on this project started later; stop it first.", because the form fills Start with the
current minute, before the running timer's start within it. On the PC the form, opened
again a minute later, still showed the old Start and was refused again. The references
stop the running timer when a new one starts (study, Timers). Gate task 3 of
`docs/superpowers/specs/2026-10-22-usability-check-design.md`; screenshots
`.autopilot/screenshots/16/t3-third-refused-*.png` and `t3-third-next-minute-*.png`.

Exit: the usability gate passes gate task 3 of the usability check's spec (start a
timer on a project, a second on another, then another on the first project at once
and a minute later: that project's first timer stops each time, never refused), on
phone and PC, in light and dark.

Done 2026-10-22: a new running entry on a project whose timer runs now stops that timer
whatever the minute. A start after the running timer's start stops it there. A start in
the same local minute (read in the new entry's zone), at or before it, starts one
millisecond after it and stops it there. Only a start typed in an earlier minute is
refused, on Start, keeping what was typed: "This project's timer has been running since
HH:MM. Start at HH:MM or later, or stop that timer first." (the date goes before the time
when the local days differ). An edit that makes an entry running keeps its saved start
and gets rules 1 and 3 only. The start and the stop are one batch. The rule lives in the
core (`beforeRunning`), so the MCP server gets it too. The form marks a Start it filled
with now (timer mode, a hidden `startNow` that survives a refusal); saved untouched, with
no end or duration, the timer starts at Save's moment. On the PC the in-place form no
longer reuses a hover preload, so a reopened form shows the current minute. Spec
`docs/superpowers/specs/2026-10-22-timer-start-same-project-design.md`, plan
`docs/superpowers/plans/2026-10-22-timer-start-same-project.md`; `docs/core.md` and
`docs/app.md` updated. No decision record.

- **An untouched Start means the moment Save is pressed;** a typed Start is taken as
  typed. The stand-in's call. Source: vision, Timers; study, Timers (Kimai's "begin
  now"); this item. Confidence: ungrounded; queued in `docs/questions.md`.
- **A typed Start earlier than the running timer's is refused,** naming its start; the
  running timer is not removed. The stand-in's call. Source: vision, Timers; this item.
  Confidence: ungrounded; queued in `docs/questions.md`.
- **A typed Start in the running timer's minute is the same time,** never refused. The
  stand-in's call. Source: this item and its exit. Confidence: grounded.
- **A reopened form shows the current minute;** Cancel discards what was typed. The
  stand-in's call. Source: this item; study, Timers. Confidence: inferred.
- **Nothing beyond the exit.** The stand-in's call. Source: this item; operator's voice;
  study, Timers 2. Confidence: inferred.
- **The refusal says "Start at HH:MM or later",** not "Start after HH:MM", since the
  running minute itself is accepted. The stand-in's call, in the impeccable clarify
  pass. Source: rule 2; the spec's anti-goal on a message the screen contradicts;
  operator's voice. Confidence: inferred.
- **The refusal shows under Start and in the form's alert by Save,** as every refusal on
  this form does. The stand-in's call. Source: the spec, The form. Confidence: inferred.
- Builder's calls (spec): "same minute" read in the new entry's zone, the new start one
  millisecond after the running one; edits keep their saved start (no rule 2), the
  refusal on Start only when the edit changed Start; "untouched" needs the filled date
  and Start saved as filled with no end or duration; the running timer's date shown
  when its local day differs.
- Builder's rulings (build): the plain non-timer form, whose Start is blank, gets no
  now-marker; the old "started later" copy stays only where it records history (this
  item's text, round 1's plans, this item's spec and plan); the zone test uses a
  half-hour-offset zone and a still-running Tokyo timer so it can fail; a hand-typed
  Start equal to the filled minute counts as untouched (indistinguishable, same minute);
  the impeccable pass was run by the controller, not the implementer; parked at the final
  review: the e2e refusal test does not re-check the running timer (a core test does),
  the spec's "plain new entry" sentence (see the first ruling), and two cases outside the
  spec (a timer started up to a minute in the future refuses the plain path; a date-only
  edit's refusal shows under Start).
- Questions queued in `docs/questions.md`: whether an earlier typed Start should be
  refused or remove the running timer; whether an untouched Start means Save's moment or
  the shown minute.

### 19. Overlaps in the Calendar's week view — done 2026-10-22

The PC week view splits a whole day into lanes as narrow as its busiest overlap: the
usability check (item 16, first run, 2026-10-22) found today's column cut into 23 px
lanes, block titles broken letter by letter ("Co/mp/Y –/Su/pp/ort") and an entry
overlapping nothing drawn as "C…", where the day view draws the same day at readable
widths. The study asks for overlaps side by side at a readable width (Views 10).
Screenshots `.autopilot/screenshots/16/t12-screen-calendar-1440-*.png` and
`defect-calendar-day-today-1440-light.png`.

Exit: the usability gate passes the Calendar's week view at 1440 px, in light and
dark, on a seeded month with a day of several overlapping entries (the usability
check's tasks 2, 3, 7 and 8 done first): only entries that overlap share a column,
each at a readable width, and an entry overlapping nothing takes its day's full width.

Done 2026-10-22: the week and day grids group a day's blocks once, from their one-line
boxes (`layoutDay` in `src/lib/calendar/grid.ts`); only blocks drawn into each other
share a column, a block in no group takes the day's full width, lanes in a group are
equal, and a shared block grows for its name only into free time (`growShared`). A
lane's readable floor is `LANE_FLOOR`, 68 px ("time-keep" in semibold 12 px, the 3 px
edge, the 2 px padding a lane that narrow draws, the 2 px gap). The PC week draws as
many lanes as its column fits at the floor and never fewer than two; where a stretch
needs more, the last lane holds a "+n" chip (`MoreChip.svelte`) per run of hidden
blocks, spanning the run's time and opening the day, and only that stretch is hidden.
Running blocks take a group's first lanes, then the longest blocks, so the shortest go
into the chip and a running block is drawn wherever two lanes are. Names wrap only between
words; in a shared one-line block the start time gives way first; the running time is
never cut. The day views hide nothing: past the floor the day's grid scrolls sideways
with the hour gutter held, and on the phone a swipe scrolls it first and changes the
day only from the edge. Spec `docs/superpowers/specs/2026-10-22-week-overlaps-design.md`,
plan `docs/superpowers/plans/2026-10-22-week-overlaps.md`; `docs/app.md`, `DESIGN.md`
and `.impeccable/design.json` updated. No decision record.

- The stand-in's calls from the design, as recorded in the spec (calls 1–8, 17): blocks
  share a column when drawn into each other (inferred); more than fit gives a "+n" chip
  opening the day (inferred); lanes stay equal (ungrounded, queued); a very short entry
  and the next sit side by side (inferred); day and week alike (inferred); readable
  means whole words (inferred); the chip is a one-line "+n" on the surface with an
  `input` stroke (inferred); the day view hides nothing and scrolls sideways (ungrounded,
  queued); on the phone day the scroll goes first and the swipe changes the day from
  the edge (ungrounded, queued). Sources in the spec.
- **The PC week always draws at least two lanes;** below two floors' width a lane's
  first word may end in an ellipsis ("time-ke…"), and the chip serves groups needing
  more than fit. The stand-in's call in the build, replacing the spec's one-lane
  minimum after the critique showed every overlap a bare chip below about 1350 px.
  Source: study, Views 10; the spec's anti-goal on hidden overlaps and call 16; the
  item's exit at 1440 px (`.autopilot/agents/19-narrow-week.md`). Confidence: inferred.
- **Where a stretch needs more lanes than fit, running blocks are drawn first, then the
  longest;** the shortest go into the chip. The stand-in's call after gate attempt 1,
  where a dragged 5.5 h block vanished into a chip. Source: study, Views (Samsung's
  "+3" where short events crowd), Views 10; the spec's anti-goal; the gate's finding
  (`.autopilot/agents/19-gate-1-calls.md`). Confidence: inferred.
- **The "+n" chip spans its hidden run's time,** "+n" at its top, call 7's look
  otherwise; it replaces call 7's one-line chip. The stand-in's call after gate attempt
  1, where a one-line "+7" left hidden 2 h and 1.5 h entries reading as free time.
  Source: the gate's finding; study, Views 10; the spec's anti-goals (same file).
  Confidence: inferred.
- Builder's calls (spec, 9–16): the grouping done once from one-line boxes; one chip
  per run of hidden blocks; the floor measured from the seeded names' first words, two
  lanes as the week's fallback without JavaScript; the phone week unchanged; the gate
  checks the day view too; a cut name's ellipsis where CSS puts it; the floor a fixed
  constant; a running block never behind a chip (at a fit of two or more).
- Builder's rulings (build): the floor measured with the 2 px padding a block that
  narrow draws, not 6 px (76 px fitted one lane in the 148 px column at 1440); rule 10
  read locally, so only blocks in lanes past the fit and chip-lane blocks meeting them
  are hidden; at a fit of one a running block would hide behind its chip (moot under
  the two-lane minimum); `growShared` also stops at a chip still on screen at a block's
  end; the crowded-day e2e fixture runs in an early-morning zone so its running timer
  has not run into later blocks; the word-wrap e2e checks a word's boxes share one line;
  a shared one-line block drops its start time whenever the full name does not fit;
  times and descriptions hide only below a 63 px block (the floor's content width); the
  day column's minimum is lanes × floor + 1 px for its border, and the day grid takes
  `min-w-max` so its rules follow a sideways scroll; descriptions keep in-word wrapping
  and the day view's now dot clears the held gutter (final review). Deferred minors: the
  opening scroll ignores hidden blocks and chips (with longest-first, a group's
  earliest block can be hidden); chips come after a column's blocks in
  tab order; the chip's accessible name says "4 more entries" beside a visible "+4"; a
  chip's focus ring near the top is clipped under the day head; near midnight a chip
  names its drawn, not its real, start; PC drag and create untested under a sideways
  scroll.
- Questions queued in `docs/questions.md`: whether lanes in a group should widen into
  free room; whether the day view should scroll sideways or hide past the floor;
  whether the phone day's swipe should scroll first or change the day.

### 20. The phone's timer strip with several timers running — done 2026-10-22

With two timers running, the phone's timer strip cuts the running timer's customer ›
project to "CompX › …" or "Myself › ti…", so it no longer says which project runs: the
usability check (item 16, first run, 2026-10-22), gate task 3 at 390 px. DESIGN.md
gives customer › project as the strip's main line. Screenshots
`.autopilot/screenshots/16/t3-third-next-minute-390-*.png` and
`t3-two-timers-390-light.png`.

Exit: the usability gate passes the phone's timer strip at 390 px, in light and dark,
with one, two and three timers running on the seeded projects: the strip says which
project each shown timer is on (the project's name readable, not cut to "…").

Done 2026-10-22: while a timer runs, the phone's strip has two rows. Row 1 holds the
live dot, the project dot, customer › project in full and the bold elapsed time at the
right of the name's first line. Row 2 holds "activity · since" at the left and "+N", ▶
and Stop at the right, 44 px each. The layout is the same for one, two or three timers.
A long name or since line wraps and the strip grows; nothing is cut to "…". With no
timer, the strip is still one 64 px row. The form link (name, elapsed time and since
line) spans both rows, and the controls sit over its right end as separate targets.
The "+N" list's rows show customer › project, wrapping, and in dark the list ends on a
20 % white rule so it reads apart from the page. The phone's focus `scroll-margin-top`
and the start sheet's maximum height now follow the measured `--bars-height`. The
fallback without JavaScript is 9rem: the band measures 141 px with a one-line name and
164 px with two. Spec `docs/superpowers/specs/2026-10-22-phone-timer-strip-design.md`,
plan `docs/superpowers/plans/2026-10-22-phone-timer-strip.md`; DESIGN.md (Phone strip,
`strip-phone-running` 85 px), `.impeccable/design.json` and `docs/app.md` updated. No
decision record.

- **The strip must say which project each timer is on and how long it has run.** The
  stand-in's call. Source: roadmap item 20; operator's voice; DESIGN.md, Phone strip.
  Confidence: inferred.
- **Two rows (option A).** The stand-in's call. Source: item 20's exit; operator's
  voice; the mockups. Confidence: ungrounded; queued in `docs/questions.md`.
- **The "+N" list shows customer › project.** The stand-in's call. Source: operator's
  voice; DESIGN.md, Phone strip; item 20's exit. Confidence: inferred.
- **One layout for one timer and for several,** with "+N" absent when only one runs.
  The stand-in's call. Source: item 20's exit. Confidence: ungrounded; queued with the
  call above.
- **A name too long for the full width wraps; the strip grows.** The stand-in's call.
  Source: item 20's exit. Confidence: inferred; queued with the call above.
- **No timer: one 64 px row; the start sheet and focus scrolling follow
  `--bars-height` with a constant fallback; "not cut" is tested in both width and
  height.** The builder's calls 6–9, in the spec.
- **The start-sheet e2e seeds 20 templates, not the plan's 12,** because with 12 the
  sheet never reached the strip and the test could not fail. The builder's ruling.
- **Critique and audit ran in one implementer's context,** with no separate assessor;
  the task review checked the result. The builder's ruling.
- **The final review's minors are deferred:** the 8 px gaps between the controls fall
  on the link, so a tap just off Stop opens the form; a duplicate `describe` name in
  `TimerBar.test.ts`; the `pr-37`/`pr-24` arithmetic is not commented; one DESIGN.md
  line runs past the wrap width. The builder's ruling. Also deferred: the controls hide
  the bottom-right corner of the link's focus ring; a "+N" of ten or more would overlap
  the since text; the "+N" list's dot column does not line up with the strip's;
  without JavaScript a two-line name or a wrapped since line leaves the 9rem fallback a
  little short of the band.
- **The strip draws the start sheet once,** in one controls wrapper shared by both
  states. The checks found that starting a first timer from the open sheet left
  `<main>` inert, because a second copy of the sheet replaced the open one. The
  builder's fix, pinned by an e2e.
- Questions queued in `docs/questions.md`: the strip's layout (two rows, one layout
  for any count, wrapping names).

### 21. Crowded runs in the phone's day view — done 2026-10-22

The usability check's second run (item 16, 2026-10-22) failed one finding: at 390 px
the Calendar's day view scrolls sideways when a run of short entries overlaps (seven
timers around 18:00 gave a 529 px grid, blocks cut at the right edge, the day's total
off screen). On the phone, the day view keeps to the screen's width, as Kimai, Google
and Samsung do: a run too crowded for item 19's lane floor folds into a "+n" chip, as
the week view does, and nothing is hidden for good (the chip reaches the folded
entries). The PC's day view is unchanged.

Exit: the usability gate passes the Calendar's day view at 390 px, light and dark,
with the second run's crowded day, and no other screen changes.

Done 2026-10-22: the phone's day view keeps to the screen's width. It fits as many
lanes as its column holds at the 68 px floor (four at 390 px, five at 412 px; four
before measuring and without JavaScript; two at least), and a run that needs more folds
into a "+n" chip by the week's rule, running blocks drawn first. The chip grows toward
44 px into the free time under it, and no block grows into that time. Its name is "n
more entries from HH:mm; show them". A tap or Enter opens a bottom sheet with that
title, listing exactly the folded entries in start order in the phone month's day-list
look. Each row opens its entry's form and closes the sheet. Escape, the scrim, Back
and Close return focus to the chip. The sheet follows the current layout and closes
when its chip goes. Without JavaScript the chip links to Entries on that day, carrying
the filter's scope. The phone's day has no sideways scroller, so a swipe anywhere on
it changes the day. A tap on the chip with a new block pending drops the block and
opens nothing. The PC's day keeps every lane and its sideways scroll; both weeks and
the months are unchanged. Spec
`docs/superpowers/specs/2026-10-22-crowded-phone-day-design.md`, plan
`docs/superpowers/plans/2026-10-22-crowded-phone-day.md`; DESIGN.md (the day view's
crowding, the chip on the phone's day, the More sheet, `calendar-more-chip`) and
`docs/app.md` (Calendar, `MoreSheet`) updated. No decision record.

- **Tapping the chip opens a sheet with exactly the folded entries,** each row opening
  its form; Entries on that day is the fallback without JavaScript. The stand-in's
  call. Source: roadmap item 21; item 12's exit; study, Phone against desktop; the
  phone's other sheets; operator's voice. Confidence: inferred.
- **The phone's day fits as many lanes as its column holds at the 68 px floor.** The
  stand-in's call. Source: roadmap items 19 and 21; study, Views 10. Confidence:
  grounded.
- **The chip grows toward 44 px into free time.** The stand-in's call. Source:
  DESIGN.md (the phone day's 44 px growth and targets); roadmap item 11. Confidence:
  inferred.
- **The swipe keeps its direction** (left forward, right back). The stand-in's call.
  Source: docs/app.md (Calendar, the swipe); item 21's exit. Confidence: grounded.
- **Focus after a delete from the Calendar stays as it is** (the page body, as from a
  drawn block); a later item sends it to the strip's Undo, as item 14's call does
  elsewhere. The stand-in's call. Source: item 21's exit; item 14's call; roadmap, How
  an item is worked. Confidence: inferred.
- **A day-list row's name may still break inside "time-keep" at 200 % text,** as the
  phone month's does, since the sheet shares that row look; a later item keeps words
  whole in both. The stand-in's call. Source: spec rule 5; DESIGN.md (names break only
  between words); item 21's exit. Confidence: inferred.
- **The PC's day keeps item 19's sideways scroll; the fit falls back to four and is two
  at least; the sheet closes when a row's form opens; the sheet's title names the count
  and the run's first start; the swipe changes the day anywhere on the phone's grid;
  the chip keeps its place in the tab order.** The builder's calls 3–9, in the spec.
- **The fold-order unit test uses its own fixture** (a running box and seven meeting
  boxes, 3 drawn and 5 folded at a fit of 4); the plan's fixture gives 6 drawn and a
  chip of 2. The plan is left as approved. The builder's ruling.
- **The 412 px test pins five lanes** (4 crowded drawn with the running one, "+4"),
  beyond the plan's sum-only check, as its Review Focus asks. The builder's ruling.
- **Test details:** the day's total is checked on the head's box; the chip-swipe test
  swipes left, since 200 px right of the rightmost lane is off screen; the scoped
  no-JavaScript test seeds ten crowded entries so the scoped day still folds; the tap
  with a block pending is stopped by the grid's existing capture listener. The
  builder's rulings.
- **Critique and audit ran in one implementer's context;** their one in-scope finding
  gave the More sheet the other sheets' head spacing, pinned by an e2e. The builder's
  ruling.
- **Deferred minors:** no e2e is left for the PC day's sideways scroll past the view
  (a crowd wider than a 1024 px column); the focus fallback to the grid's scroller when
  the chip goes relies on Chromium (no `tabindex="-1"`); the sheet's key (group and
  start) can close the sheet when the run's first folded entry changes though a chip
  remains; the "n more entries" phrase is built twice; untested: a folded running
  row's "now", focus after Back or Close, scoped rows with JavaScript; a leftover seed
  name in a test; DESIGN.md's no-JavaScript chip line omits the scope; a stale comment
  in `MoreChip.svelte`; a few long prose lines; near the grid's foot, the focused chip
  after Save can sit partly under the "+" while the Undo strip pushes the grid. The
  builder's ruling.
- **Gate attempt 1 failed one finding:** with the run in the day's last minutes, the
  chip was 34 px, capped by midnight. **Gate fix 1: a chip short of 44 px under it (the
  day's end, or a block right under it) also grows up into the free time above it,** by
  what it lacks, never past 00:00 and only into time other chips left; only its drawn
  top moves (`Chip.top`), and its `from` and the sheet's key are unchanged. The name and
  the sheet's title now give the earliest folded entry's start, not the chip's drawn
  `from`, which a run near midnight lifts to fit a line (23:56 read "23:38"); this also
  corrects the week chip's name near midnight. The builder's rulings. Deferred: the
  late-run seed copies `startElsewhere`'s body; no test of the week chip's name near
  midnight; the sheet's key is the drawn `from`, not the run's start.
- Questions queued in `docs/questions.md`: none.

### 16. Usability check — done 2026-10-22

The usability gate run over every task in the app, on a seeded month, on phone and
PC: logging the day as it happens, correcting yesterday, reorganising the month and
copying it out for Excel. Nothing is fixed in this item. What the gate fails becomes
new round 2 items, numbered from the next free number and placed before this one (so
before go-live), worked by the autopilot; this item then runs once more. If that
second run still fails, the round stops as failed. Either way the round ends with a
report for the operator in `docs/round-2-report.md`: what round 2 built, the calls
made in the operator's place, and the open questions in `docs/questions.md`.

Exit: the usability gate passes every task in the app on phone and PC, and
`docs/round-2-report.md` is written.

First run 2026-10-22 failed; its findings became items 18–20.

Second run 2026-10-22 failed; the round stopped as failed. Its first attempt failed a
builder check (a test's fixed clock, #9); rerun with the operator's approval after the
fix, the gate failed one finding: Calendar's day view at 390 px scrolls sideways
when a run of short entries overlaps. Not run again until the operator decides what
follows. See [the round 2 report](round-2-report.md).

Operator approved run 3 (2026-10-22), after item 21.

Done 2026-10-22, third run: the usability gate ran the second run's twelve tasks again
over the whole app (signing in, logging the day as it happens, timers, correcting
yesterday, reorganising the month, copying it out for Excel, Setup, Templates,
Account, Users, Backup and restore, getting around and the look) on a seeded month,
each at 390 px and 1440 px in light and dark, with task 12 also doing item 21's exit
(the phone's day view on a crowded day), and passed them; nothing was fixed in this
item. [The round 2 report](round-2-report.md) is written. Spec
`docs/superpowers/specs/2026-10-22-usability-check-3-design.md` (the second run's
`2026-10-22-usability-check-2-design.md` carried over); no plan (nothing to build); no
decision record. The second run's screenshots moved, and its verdict was copied, to
`.autopilot/screenshots/16-run-2/` and `.autopilot/verdicts/16-run-2.json`.

- The first and second runs' calls 1–21 stand; they are in that spec. Call 22 (an
  issue to keep a later launch from another run) is dropped: the runbook now holds
  that rule. The stand-in's call. Source: run-item, Item 16. Confidence: grounded.
- **Task 12 also does item 21's exit, on a day crowded like the second run's** (the
  gate adds short same-minute timers if the earlier tasks leave it less crowded);
  nothing else is added. The stand-in's call. Source: roadmap item 21's exit; the
  spec's calls 10 and 14. Confidence: inferred.
- **The second run's screenshots moved, and its verdict copied, to `16-run-2` before
  the gate.** The stand-in's call. Source: the spec's call 19. Confidence: inferred.
- **The second run's three observations (a long project name cut in PC tables, the
  New user dialog's password cleared after a refused username, an edited Start
  keeping End) are named as already seen; item 21's deferred minors fail only when
  they hit a rule.** The stand-in's call. Source: the second run's verdict; the
  spec's calls 15 and 16; `.claude/rules/merges-on-good-enough-defers-defects.md`.
  Confidence: grounded for the minors, inferred for the observations.
- **The report gives item 21 one line and item 16 one line on its three runs, and
  carries item 21's calls and item 19's call reworded (sideways scroll on the PC
  only) on either verdict.** The stand-in's call. Source: roadmap item 16; the
  spec's call 17; operator's voice, 2026-10-19. Confidence: inferred.
- **Before the gate this heading gains "— done" and the three lines above stay as
  history; on a fail the marker comes off and this note becomes a third-run failure
  line after the run 3 approval.** The stand-in's call. Source: run-item, stage 8
  and Item 16; the spec's call 20. Confidence: inferred.
- **Otherwise the second run's spec stands; a failing third run spawns no items.**
  The stand-in's call. Source: roadmap, item 16; run-item, Item 16. Confidence:
  inferred.
- **The branch is `docs/16-usability-check-3`, from `main`.** The stand-in's call.
  Source: run-item, Item 16. Confidence: grounded.
- Builder's calls: the report and this note written as passing before the gate,
  rewritten on a fail; two wording fixes to the spec after its approval (the call
  range, the marker on a fail), as the stand-in's approval noted.
- No questions queued.

## Round 3 — go-live

### 9. Go-live — the operator's

The container deployed on Coolify at its domain, the Kimai import as an agent working
through the MCP server, and the switch from Kimai.

Exit: the deployed app holds the years of Kimai data, and the operator tracks time in
time-keep instead of Kimai.
