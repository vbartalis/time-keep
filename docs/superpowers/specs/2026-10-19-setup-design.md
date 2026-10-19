# Phase 5a, setup on the PC — design

Date: 2026-10-19. Roadmap item 5a. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap, decisions 1–5, `DESIGN.md` or the earlier specs is marked **(call)**.

## Intent

The PC is where the lists the phone picks from are kept (vision, "Two surfaces"). Today
the phone says "Customers and projects are set up on the PC" and "Templates are set up
on the PC", and nothing on the PC does it. This part is those screens: customers ›
projects, activities, locations and templates, each created, renamed or edited,
archived or deleted, and every change undone from its strip. The core (phase 2)
already has every command; this is screens over it, in the time card world (phase 3).

Phase 5 was split when brainstormed **(call)**: 5a setup (this), 5b finding entries and
editing them in bulk, 5c the history with undo of any batch. 5a goes first because the
phone is unusable on a fresh account without it and because it needs nothing new from
the core; 5b needs new core reads; 5c closes the phase's exit.

## Goals

- A **Setup** screen (`/setup`) with three regions: customers › projects, activities,
  locations. Create, rename, archive and unarchive each; show archived on request.
- A **Templates** screen (`/templates`) listing the user's templates, with a form to
  create (`/templates/new`) and edit (`/templates/[id]`) one, and delete it.
- **Save as template** on the entry edit screen (`templates.fromEntry`).
- The undo strip on every screen that writes, not only Today.
- The rail gains the new screens.

## Non-goals

- Finding entries beyond today, bulk edits (5b); the history screen and undo of older
  batches (5c); reports and copy-out (6).
- Deleting customers, projects, activities or locations: the vision says archived, never
  deleted. Moving a project to another customer: the core refuses it (2a).
- Counts of entries per customer or project: needs a core read and is a report (6)
  **(call)**.
- Reordering lists by hand: the core sorts by name (2a).

## Anti-goals

- A rule enforced in a screen. Uniqueness, the archived-customer rule, a template's
  project belonging to its customer, end time beside duration: the core refuses, the
  screen shows the refusal beside the field.
- A modal or browser dialog. Edits open in place; destructive steps confirm on the page.
- A screen that needs JavaScript. Every action is a plain form post, as in phase 4.

## Decided

### Shared mechanics

- Every action is one core call, one batch, through `openCore(getDb(), user.id, 'ui')`,
  as in phase 4. Forms post without JavaScript; `use:enhance` enhances them.
- **Back to where it came from (call).** A successful action redirects (303) to the
  screen it was posted from, not to Today, and that screen shows the undo strip. The
  helper `done` takes the path to return to; phase 4's actions keep returning to `/`.
- **One undo action (call).** The strip's Undo posts to a shared `/undo` route
  (`batchId`, `back`) that calls `core.undo({ batchId })`, sets the "Undone." flash
  and redirects to `back`. `back` must be a path on this app (starts with one `/`,
  not `//`), else `/`. Today's own `?/undo` is replaced by it. The strip component
  moves from `components/today/` to a shared place.
- **A refused undo (call).** Undo is refused often on these screens (undoing a
  customer's creation after a project was added under it, a template's edit after a
  later edit). The flash gains an optional `error`; on a refusal `/undo` sets a flash
  with the core's message and the same batch, and redirects to `back`, where the strip
  shows the message in red in place of "Done:", keeping the Undo button. Today's
  existing refusal in the strip behaves the same way through the route.
- **Stale writes.** Every rename, archive, unarchive, edit and delete sends the row's
  `expectedVersion`. A `conflict` for a stale version shows the core's message beside
  the row with a Reload link, as on the entry edit screen.
- **Refusals** re-render the form that was posted with the posted values and the
  core's field messages beside the fields; a message for no shown field goes under the
  form. The first refused field is focused.
- **Archived** rows are struck through with a spent `Archived` badge (DESIGN.md, Do's).

### Setup (`/setup`)

One screen, three regions under printed section heads, one column on the phone;
customers › projects first and widest, then activities and locations in a second
column from 1280 px **(call)**.

- **Customers › projects.** A ruled list: each customer a heavy line, its projects
  indented hairline lines beneath it. A customer line has Rename, Archive (or
  Unarchive) and "Add project"; a project line has Rename and Archive (or Unarchive).
- **Activities**, **Locations**: a ruled list of names, each with Rename and Archive
  (or Unarchive).
- **Adding.** Each region ends with an add line: one name field and an outline Add
  button (customers, activities, locations). "Add project" on a customer opens an add
  line under that customer **(call)**.
- **Renaming** opens the line in place as a name field with Save and Cancel, a native
  disclosure (`<details>`) so it works without JavaScript, one open at a time with
  JavaScript **(call, as the template sheet)**.
- **Archiving** is one press, no confirmation: it is undone from the strip and nothing
  is lost **(call)**. Archiving a customer leaves its projects as they are (2a); they
  show under it, struck through with it.
- **Show archived.** A link toggles `?archived=1`; archived rows are hidden by
  default. A customer with only archived projects shows "No active projects." under
  it; an archived customer shows its projects whatever their state **(call)**.
- **Unarchiving a project under an archived customer** is refused by the core
  (`archived`); the message shows on the project's line.
- Empty states: "No customers yet." above the add line; the same for activities and
  locations. No dead buttons.

### Templates (`/templates`, `/templates/new`, `/templates/[id]`)

- **List**: a ruled table, sorted by name (the core's order): name, customer ›
  project, activity, location, times (start–end, or start + duration, punched), and
  a printed Timer or Log mark as on Today. Each row opens its edit screen. "New
  template" is the one primary button above the table **(call)**.
- **Form** (new and edit share it): name; customer; project; activity; location;
  start time, end time and duration in minutes (`time` inputs and a whole number,
  as phase 4's "Change times"); time zone; reference; description. Every field but
  the name may be blank, as the vision says.
  - The project picker lists active projects grouped by customer (optgroups) and the
    customer picker active customers. Without JavaScript both are sent as chosen and
    the core refuses a mismatch; with JavaScript picking a project sets its customer
    and choosing a customer narrows the projects **(call)**. A project posted with
    the customer blank is sent with the project's customer, so a template made
    without JavaScript is stored as one from `templates.fromEntry` is; the core still
    checks the pair **(call: this shapes the form's input, as phase 4's template sheet
    does, and enforces no rule)**.
  - Archived references appear only when they are the template's current ones, marked
    "(archived)", as on the entry edit screen.
  - Time zone: a text field with the browser's zones as suggestions
    (`Intl.supportedValuesOf('timeZone')` in a `<datalist>`), blank meaning the
    device's zone at use **(call)**.
  - Save sends `templates.create`, or `templates.update` with every field and
    `expectedVersion` (a blank field sent as `null`, clearing it) **(call)**.
- **Delete** on the edit screen asks on the page ("Yes, delete it" / "Keep it"), as
  the entry edit screen, then sends `templates.delete` with the version, and returns to
  `/templates` with the strip. Undo restores it.
- After create or edit the screen returns to `/templates` with the strip **(call)**.

### Save as template (`/entries/[id]`)

The entry edit screen gains a "Save as template" disclosure under the form: a name
field and an outline Save button, sending `templates.fromEntry({ entryId, name })`. On
success it returns to `/templates` with the strip, so the new template is in view
**(call)**. A duplicate name shows beside the field.

### Navigation

- The rail (PC) gains, in order after Today: **Templates**, **Setup**, then Account
  and Users as now **(call)**. Icons are Lucide line icons at 16 px.
- The phone's bottom bar gains **Setup** between Today and Account; Templates is
  reached from an "Edit templates" link at the head of Today's templates region
  **(call: a fifth bottom item crowds 390 px; templates are edited rarely)**. The
  screens are responsive: one column on the phone, rows stacking as DESIGN.md's ruled
  table allows.
- Today's empty states change: "Customers and projects are set up on the PC." becomes
  a link to Setup, "Templates are set up on the PC." a link to New template **(call:
  the screens now exist, on both sizes)**.

### Carried minors fixed here

From phase 3, kept open through 4: the default alert's violet border becomes the ink
stroke, and the unchecked checkbox's border in dark mode becomes the ink stroke
(DESIGN.md: violet is live, primary or focus only). From phase 1: Users shows creation
dates in UTC; it shows them in the request's zone **(call: small, and the last screen
with a UTC date)**.

### Tests

- Unit: the `back` path check, the template form's input to the core (blank to null,
  minutes, the zone), and any other server helper added.
- Browser, at phone and PC sizes, seeded through the core as in phase 4:
  - create a customer, a project under it, an activity and a location; rename one;
    archive a customer and see it and its projects struck through under Show archived;
    unarchive it; a duplicate name refused beside the field; undo from the strip.
  - undo of a customer's creation after a project was added under it, refused in the
    strip.
  - unarchive a project under an archived customer, refused on its line.
  - create a template with a project and a duration; it appears on Today; edit it;
    delete it and undo the delete.
  - save an entry as a template.
  - a stale rename (version changed underneath) shows the message and Reload.
  - the Setup and Templates screens work with JavaScript off.

### Documentation

`docs/app.md` gains the screens and the shared undo route; `DESIGN.md` gains any new
component (the indented customer › project list, the in-place rename line) through
impeccable's document step. No decision record: nothing here is a real choice between
stacks or rules **(call)**.

## Exit

From the PC alone, on an account with nothing set up, the user creates customers,
projects, activities, locations and templates, renames and archives them, and the
phone's Today then offers those templates and projects; every one of those changes is
undone from its strip. Check, lint, unit and browser tests pass, at phone and PC sizes.

## Left to the builder

Component structure, the exact copy beyond the strings above, icon choice within
Lucide, how the one-open-disclosure behaviour is scripted, and the layout of the
template form's time fields within the ruled-form grid.
