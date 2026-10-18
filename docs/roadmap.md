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

## 2. The core

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
- **2c. Templates — next.** Partial entries saved and used, a duration standing in for the
  end, saving an entry as a template.

## 3. Design direction

The look and feel, decided once before any screen is built, with impeccable: a
direction chosen, in Tailwind tokens and shadcn-svelte per decision 2, and recorded.

Exit: the chosen direction is recorded and the app shell uses it.

## 4. Phone

Quick capture, in the installable web app: start and stop timers, log an entry from a
template with only the blanks typed, fix today's entries.

Exit: on a phone, a new entry from a template is a tap and a typed description, timers
start and stop, and today's entries can be corrected.

## 5. PC

Dense work: managing customers, projects, activities, locations and templates
(archiving included), finding entries and editing them in bulk, seeing history and
undoing any batch.

Exit: a month can be reorganised from the PC alone, and any change made there is
undone in one step from the history.

## 6. Output

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
