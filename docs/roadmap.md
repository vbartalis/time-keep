# Roadmap

The order of the work that takes time-keep from nothing to replacing Kimai. Detail
lives in the specs, plans and issues each phase links to; this page only says what
comes next and why. The scope is [the vision](vision.md); this page adds no features.

## The principle

**The core is finished and stable before anything that depends on it is built.** The
screens and the MCP server both sit on the data model, the single write path and its
history; those are settled first, so nothing is later bent to fit a dependent that
already holds it in place.

**Nothing is used until the whole thing works.** Kimai stays in use until phase 9 is
done (operator, 2026-10-18: "cant use it until it is working"). There is no early
release to live with; the order serves building, not adoption.

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
- Screens are checked in a browser driven by automation, at phone and PC sizes, not
  by the operator.
- When an item lands, it gets a done note: the date, the spec, the decisions it
  recorded, and any call made in the operator's place.
- Phase 9 is the operator's: it is never started automatically.

## 1. Foundation — done 2026-10-18

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

## 2. The core — done 2026-10-18

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

## 3. Design direction — done 2026-10-18

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

## 4. Phone — done 2026-10-19

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

## 5. PC — done 2026-10-19

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

## 6. Output — next

Reports (totals per day, week, customer and project), the month copy-out with columns
chosen at output time, CSV, rounding to 5 minutes on output only, splitting at
midnight as an output option, and the vision's formats.

Exit: a month pastes into Excel as the chosen columns and exports as CSV, and the
reports match the stored entries.

## 7. MCP server

The MCP server as a first-class client of the same API, behind authentication, for
bulk entry, reorganising and rewording. One agent request is one batch.

Exit: an authenticated agent can do through the MCP server what the UI can, and no
more, and a wrong agent change is undone in one step.

## 8. Backup and restore

Admin-only backup and restore, through the app.

Exit: a backup taken from the app restores into it, and only the admin can do either.

## 9. Go-live — the operator's

The container deployed on Coolify at its domain, the Kimai import as an agent working
through the MCP server, and the switch from Kimai.

Exit: the deployed app holds the years of Kimai data, and the operator tracks time in
time-keep instead of Kimai.
