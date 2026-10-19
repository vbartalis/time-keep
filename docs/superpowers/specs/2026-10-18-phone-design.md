# Phase 4, the phone — design

Date: 2026-10-18. Roadmap item 4. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap, decisions 1–5 or `DESIGN.md` is marked **(call)**.

## Intent

The phone is quick capture: start a timer, log an entry from a template, fix today
(vision, "Two surfaces"). The core (phase 2) already enforces every rule; this phase is
the screens that put three actions under a thumb in the time card world (phase 3):
tapping a template plus a typed description makes an entry, a timer starts and stops in
one tap, and today's entries can be corrected, with every change undoable at once.

## Goals

- The Today screen at `/` becomes real: running timers with Stop, the user's templates
  as tap targets, starting a timer on any active project, today's entries, each opening
  an edit screen.
- An entry edit screen: change times, project, activity, location, reference,
  description; delete.
- Undo of the action just taken, one tap, from every screen that wrote.
- Warnings from the core shown where they arise (overlap, longer than 24 hours).
- The app installable to the phone's home screen.

## Non-goals

- Managing customers, projects, activities, locations and templates, finding entries
  beyond today, bulk edits, the history view (phase 5). The phone shows what exists; when
  nothing exists it says the PC sets it up, honestly, not as a fake feature.
- Offline mode (out of scope), reports and copy-out (phase 6), GPS (later).

## Anti-goals

- Any rule enforced in the screens instead of the core; the screens show what the core
  says.
- A form where a tap would do: a template with everything but a description is one tap
  and one text field.

## Decided

### How screens talk to the core

- SvelteKit form actions call `openCore(getDb(), user.id, 'ui')`; every action is one
  core call (one batch). Forms work without JavaScript; JavaScript enhances them
  (`use:enhance`) **(call, as phase 1)**.
- Time zone: the browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
  goes in a hidden `timeZone` field filled by a small script, and is remembered in a
  `tz` cookie; without JavaScript the cookie is used, else the zone of the user's latest
  entry, else `UTC`, shown on the screen so it is never silent **(call)**.
- Times are shown in the entry's own zone: 24-hour `HH:mm`, dates `YYYY-MM-DD`, Monday
  first (vision formats). A running timer's elapsed time ticks every second with
  JavaScript and shows the server's value without it **(call)**.

### Today (`/`)

In the order the thumb needs them **(call)**:
1. **Running timers**: each with project, customer, description, start and elapsed
   time, and a Stop button.
2. **Templates**: the user's templates as large tap targets. Tapping opens a sheet
   (a details panel without JavaScript) with the template's filled fields shown, a
   description field (the template's description as its placeholder), a reference
   field when the template has none, a project picker when the template has no project
   (limited to the template customer's projects when it has one), and the one button the template implies: "Start
   timer" when it would run, "Log" otherwise; a "Change times" disclosure offers
   `start`, `end`/duration and `date` for the rare case. Submits `entries.fromTemplate`.
3. **Start a timer**: a project picker (active projects grouped by customer) and an
   optional description; submits `timers.start`.
4. **Today's entries**: entries whose interval touches today in the user's zone, newest
   first, each a row with in, out (or "running"), hours, customer › project and
   description, linking to the edit screen.
- Empty states: no projects → "Customers and projects are set up on the PC." with no
  dead buttons; no templates → the templates section says the same for templates.

### Edit an entry (`/entries/[id]`)

- Fields: start and end as `datetime-local` in the entry's zones (end empty = running),
  project, activity, location (active ones plus the entry's current, even if archived),
  reference, description; Save calls `entries.update` with `expectedVersion`; Delete
  calls `entries.delete` after a confirmation step (a second button, no browser dialog)
  **(call)**.
- A stale version shows the core's message with a reload link.
- Field errors from the core appear beside their fields; errors on fields the screen
  does not show appear as a general message (the 2c trap).

### Undo

- After any successful action, the screen shows a strip "Done: <label>. Undo" for that
  batch; Undo calls `undo({ batchId })` and shows "Undone". The batch id is the newest
  batch in `history.list({ limit: 1 })` right after the action **(call: the core returns
  results, not batch ids; the user's newest batch is the one just written)**.
- The strip lasts until the next action or navigation; nothing auto-dismisses before it
  can be read. It survives the redirect after an action through a short-lived flash
  cookie **(call)**.

### Warnings

- Core warnings come back with the action result and appear in the undo strip and on the
  row of the entry just written, for that response only (`overlap`: "Overlaps another
  entry"; `long`: "Longer than 24 hours"); the core does not store warnings, so a
  reloaded list shows none **(call)**.

### Installable

- A web app manifest (`name` time-keep, `display: standalone`, theme and background
  from `DESIGN.md`'s rack ink and card stock, start URL `/`), PNG icons at 192 and 512
  and a maskable one, an `apple-touch-icon`, generated from one SVG mark drawn in the
  time card world **(call)**. No service worker: offline is out of scope **(call)**.

### Tests

- Browser tests at the phone size (and the PC size, which must still work) seed data
  directly through the core on a second SQLite connection once the server is up (the
  server creates and migrates the database first), with one seeded user per browser
  project so their timers and entries never mix **(call)**, then cover: log from a template with only
  a description; start a timer, see it running, stop it; start a second timer on the
  same project and see the first stopped; edit an entry's end and description; delete
  an entry and undo the delete; an overlapping entry shows its warning; the no-projects
  empty state.
- Server logic behind the screens (zone resolution, today's range, the undo lookup) is
  unit-tested.

### Documentation

- `docs/app.md` gains the screens; `DESIGN.md` gains any component added (via
  impeccable's document step if components change materially).

## Exit

On a phone-sized browser, a new entry from a template is a tap and a typed description,
timers start and stop, today's entries can be corrected and deleted, and every one of
those changes can be undone from the screen; check, lint, unit and browser tests pass.

## Left to the builder

Component structure, the sheet's mechanics, the exact copy beyond the strings above, how
the elapsed time ticks, the icon artwork within the time card world.
