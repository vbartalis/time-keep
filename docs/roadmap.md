# Roadmap

The order of the work that takes time-keep from nothing to replacing Kimai. Detail
lives in the specs, plans and issues each item links to; this page only says what
comes next and why. The scope is [the vision](vision.md); round 2 adds what the
operator asked for on 2026-10-19 (the calendar and table views), and item 10 brings
the vision up to date with it.

The work runs in three rounds:

1. **Round 1, the build (phases 1–8), done 2026-10-19.** The core, the screens, the
   MCP server, backup and restore. The back end holds; the screens do not.
2. **Round 2, usable (items 17 and 10–16).** The app redesigned and rebuilt, screen
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
  refusal test pins the core's generic "The input is not valid."; the load sends an
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

### 12. The entry and the timer

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

### 13. Calendar views

Day, week and month views of the user's entries, in the manner of a good phone
calendar: entries as blocks on a time grid, the running timer shown live, a line at
now, totals per day and week, moving between dates by swipe and by buttons, and a
tap or drag on empty time opening the entry form at that time. On the PC, entries are
moved and resized by dragging. Overlaps show as overlaps.

Exit: the usability gate, on a seeded month, reads, creates and corrects a week of
entries in the calendar on phone and PC.

### 14. The timesheet table

Kimai's table view, done better: entries newest first, grouped by day with daily
totals, the columns that matter on each surface, a row opening the entry form, a row
menu with restart, copy, edit and delete, filters folded into one control with
relative date presets that are kept between visits, one search across customer,
project, activity, location, reference and description, and bulk edit and delete
appearing only once rows are ticked. Whether Kimai's weekly hours grid is built here
is decided by item 10's study.

Exit: the usability gate, on a seeded month, finds, reads and reorganises the month's
entries from the table, on PC and phone.

### 15. The rest of the screens

Every remaining screen redone in the new direction and the patterns of 12–14: Setup
(customers › projects, activities, locations), templates as part of favourites,
History, Copy-out, Reports, Account and agent access, Users, Backup and the login.
The phone's navigation reaches everything it needs. Leftovers from round 1 (the rail
that stops at the screen's height) are gone.

Exit: the usability gate passes every one of these screens on phone and PC, and none
still uses round 1's look or patterns.

### 16. Usability check

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

## Round 3 — go-live

### 9. Go-live — the operator's

The container deployed on Coolify at its domain, the Kimai import as an agent working
through the MCP server, and the switch from Kimai.

Exit: the deployed app holds the years of Kimai data, and the operator tracks time in
time-keep instead of Kimai.
