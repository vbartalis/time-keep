# Today, templates and Setup — design

Roadmap item 15a, the first part of item 15. Written 2026-10-20 in an autopilot design
session; the operator stand-in answered in the operator's place (see the last section).
The mockups it judged are in
[`2026-10-20-today-templates-setup/`](2026-10-20-today-templates-setup/), each in light
and dark (`<name>-light.png`, `<name>-dark.png`). They are static, with invented data;
the sidebar's icons in them are a mock artefact (the shell's own icons stay). Where
this text and a mockup differ, this text wins.

## Intent

Item 15 redoes every screen that still has round 1's layout in item 11's Kimai
direction and the patterns items 12–14 built. It is split into four parts (roadmap
item 15); this first one takes the screens of quick capture and of keeping the
reference data: **Today**, the **Templates** screen and its form, **Setup**, and the
**phone's navigation**.

Today is the phone's front door: "quick capture: start a timer, log an entry from a
template, fix today" (vision, "Two surfaces"), where "a new entry is a template tap
and a typed description, not a form" (principle 1). Round 1's Today is a plain list of
templates with an inline panel each and a bare list of today's entries; it has none
of the row menus, sheets or totals the Calendar and Entries now have. Templates are
edited on a round 1 page form with plain selects and a minutes box, unlike item 12's
entry form. Setup is a wall of Rename, Archive and Add project buttons on every row.
On the phone, Templates takes a bottom bar cell for what is organising work.

Nothing changes in the back end: every write is an existing core command (decision 4),
and no core, database or MCP change is made.

## Today (`/`)

One column on both surfaces, inside the shell's measure on the PC (`pc-today`,
`ph-today`). The PC still opens on Today (call 4). The lines "2026-10-20", "Signed in
as …" and "Times in …" at the top go; the date is in the entries' head and the zone
is the device's (call 3).

### Templates

- A section head, **TEMPLATES**, with an aside link "Manage templates" ("Manage" on
  the phone, kept out of the "+"'s column) to `/templates`.
- One row per template, sorted by name (call 13), on a ruled surface: the project's
  colour dot (none without a project), the name in 15 px semibold, and under it a 12 px
  muted line of what it fills: customer › project · activity · location · times (start–
  end, a duration, or nothing). The mark says what a tap does: **TIMER** in blue `caps`
  when the result would run (no end and no duration), **LOG** in muted `caps` otherwise.
  On the PC the mark and a chevron sit at the right; on the phone the mark leads the
  muted line, so nothing sits in the "+"'s column.
- **A tap on a row** opens the template's sheet (`ph-template-sheet`), a centred dialog
  on the PC (`pc-template-sheet`): the template's name (17 px bold) with a close ×, a
  muted line of what it fills, then a field for **every field the template leaves
  blank**, and only those (call 5): Customer › project (item 12's picker, from the
  customer's projects when the template has a customer), Activity, Location,
  Reference, Description, each optional except the project. Description is always
  asked, with the template's own description as its placeholder when it has one.
  "Change times" is a disclosure for the date, start, end and duration, read with item
  12's time input. The foot is pinned: outline Cancel and the one primary, "Log" or
  "Start timer". The first field takes the focus. Submitting sends
  `entries.fromTemplate` with what was typed; the core fills the rest, as now.
  Escape, the scrim and Back close it, keeping nothing.
- No templates: "No templates yet." with a "Create a template" link that opens the
  template form over Today.

### Today's entries

- A section head **TODAY · TUE 2026-10-20** (the weekday short, the ISO date, in the
  user's zone) with the day's total at the right in semibold figures: the entries
  that started today, a running one counted to now and ticking (call 6). An entry that
  started yesterday and runs into today is listed, marked as it is now ("Since
  2026-10-19"), and counted in its own day, not here.
- The entries whose interval touches today, newest start first, drawn as Entries draws
  a day: on the PC the timesheet table's columns (Start, End, Hours, Customer ›
  project, Activity, Location and Reference from 1280 px, Description, ▶, ⋯) without
  tick boxes or a day head row; on the phone Entries' rows (the 4 px project bar, the
  leading ⋯, start over end, customer › project, the details and description
  wrapping, the duration clear of the "+").
- A row click opens the entry form in place, `back` Today. ▶ Restart on a finished
  row (PC). The ⋯ opens Entries' row menu (PC popover, phone row sheet): Restart, Copy,
  Edit, Delete (at once, Undo in the strip). Overlaps carry Entries' red top edge,
  judged against all the user's entries.
- Nothing today: "Nothing logged today."
- Today keeps its own undo strip, under the shell's header.

## The Templates screen (`/templates`)

`pc-templates`, `pc-templates-menu`, `ph-templates`.

- **Toolbar:** an outline **New template** (+ icon) at the left; the header's "+ New
  entry" stays the screen's one primary. At the right the count, "3 templates".
- **The table (PC):** Entries' ruled table in a surface panel, sorted by name: Name
  (the dot, the name in semibold), Customer › project (customer muted › project),
  Activity, Location, Times ("09:30–09:45", "0:30", or "—"), Mark (TIMER blue, LOG
  muted), ⋯. Activity and Location drop under 1280 px, as Entries' columns do. A row
  click opens the template form in place.
- **The row menu:** Edit, Log… (opens the template's sheet over this screen, as a tap
  on Today does; "Start timer…" for a TIMER template), a rule, Delete in red. Delete
  is at once with Undo in the strip (call 7). Entries' menu-button pattern and focus
  returns.
- **The phone:** rows with a leading ⋯, the dot and name (15 px semibold), the customer
  › project (14 px), then activity · location · times · the mark (12 px muted),
  wrapping, never cut; the toolbar's button keeps out of the "+"'s column.
- No templates: "No templates yet." beside the New template button.
- Templates is reached from the sidebar (as now) and from More on the phone.

## The template form

`pc-template-form`, `ph-template-form`. Round 1's template form goes. A template is
edited in **item 12's entry form** with a template mode (call 8): the same layout,
pickers, time input and pinned foot, opened in place over the screen (a centred
660 px dialog on the PC, the sheet from under the top bar on the phone), and a plain
page without JavaScript at `/templates/new` and `/templates/[id]`.

- Title "New template" or "Edit template".
- Fields, in order: **Name** (required, first, focused); **Start**, **End** and
  **Duration** as item 12's linked time row, but times of day with no date (a typed end
  fills the duration and a duration the end; an end not after the start reads as the
  next day, shown "next day"); **Customer › project**, where a customer alone may be
  picked (its heading in the picker), leaving the project to be asked when the template
  is used; **Activity**; **Location**; **Reference**; **Description**; **Time zone** (a
  text field with the zone list; blank uses the device's zone when the template is
  used, said in a muted hint).
- A muted note under the time row: "Any field may stay blank; only the blanks are asked
  when it is used."
- Every field but Name may be blank; a template holds an end time or a duration, not
  both (the core's rule), so the form sends whichever was typed last.
- The foot: on an existing template **Delete** (at once, with Undo; the form closes),
  then outline Cancel and primary Save (Ctrl+Enter). Save sends `templates.create` or
  `templates.update` with the version shown; a save that changed nothing returns
  without a strip. Refusals show beside their fields, a stale version with Reload, a
  template deleted elsewhere with a link back, as the entry form does.
- Opened from: the Templates screen (New template, a row, Edit), Today's "Create a
  template", and the timer bar's Start list ("Create a template"). A save or delete
  returns to the screen it was opened over, with the strip.
- **Save as template** in the entry form stays as it is (a name, then
  `templates.fromEntry`).
- **The timer bar's Start list** keeps item 12's behaviour (a template with a
  description starts at once, one without asks for a description, one without a
  project opens the entry form); only its "Create a template" link changes, opening the
  template form in place (call 22).

## Setup (`/setup`)

`pc-setup`, `pc-setup-menu`, `pc-setup-rename`, `pc-setup-create`, `pc-setup-archived`,
`ph-setup`, `ph-setup-menu`. One screen (call 9).

- **The filter:** a segmented control **Active | Archived | All** at the top, Active
  by default, kept in the address (`?show=archived`, `?show=all`; round 1's
  `?archived=1` reads as All). On the phone it takes the width but for the "+"'s
  column.
- **The lists:** on the PC two columns: **CUSTOMERS AND PROJECTS** at the left;
  **ACTIVITIES** then **LOCATIONS** at the right. On the phone they stack in that order.
  Each list is a section head with an outline "+ New customer" / "+ New activity" /
  "+ New location" button as its aside (on the phone under the head at the left), over
  a ruled surface panel sorted by name.
- **Rows:** a customer is a 15 px semibold line; its projects are indented beneath on
  hairlines, each with its colour dot (customers, activities and locations have none;
  the palette is the projects'). Every row has a ⋯ at its right on the PC and leading
  it on the phone.
- **The row menu** (PC popover, phone row sheet headed by the row's name and kind, e.g.
  "CompY – Support" over "CompX · project"): a customer has Rename, Add project, a
  rule, Archive; a project, activity or location has Rename, a rule, Archive; an
  archived row has Rename and Unarchive. Archive and Unarchive act at once with Undo in
  the strip; neither is red (nothing is lost). Unarchiving a project under an archived
  customer is refused by the core, shown on the row as now.
- **Rename in place:** the row becomes a text field holding the name (selected), with
  outline Cancel and Save at its right (on the phone under the field). Enter saves,
  Escape cancels and returns focus to the row's ⋯; one row at a time. It sends
  `rename` with the row's version; a rename to the same name stores nothing.
- **Create:** "+ New …" and a customer's "Add project" open a small dialog on the PC
  (440 px) and a sheet on the phone: "New customer", "New project", "New activity",
  "New location", with the name only, plus the customer for a project (a select of the
  active customers, set to the customer it came from). The name field is focused; Enter
  creates; Cancel and the primary "Create" in its foot. A refusal (an empty or duplicate
  name) shows beside the field and keeps the dialog open.
- **Archived rows** (`pc-setup-archived`) show in Archived and All: muted text with an
  "Archived" chip. In **All** an archived customer lists all its projects; an active
  one lists its active and archived projects. In **Archived** only archived rows are
  rows: an active customer with archived projects is not a row of its own; its name
  stands over them in muted text with no ⋯ (call 10).
- **Projects under an archived customer.** The core archives a customer alone; its
  projects keep their own state but leave the pickers with it. The screen shows them by
  that effect (call 21): gone from Active with their customer; in Archived and All
  listed under it, muted, with the "Archived" chip; their ⋯ holds only Rename (the
  core refuses a project's unarchive under an archived customer, and archiving one
  changes nothing seen). Unarchiving the customer brings them back as they were.
- Empty lists say so ("No customers yet.", "No archived activities.").
- Setup keeps its own undo strip.

## The phone's navigation

`ph-more`.

- The bottom bar becomes four equal cells: **Today**, **Calendar** (the day view, as
  now), **Entries**, **More** (call 11).
- **More** opens Entries' bottom sheet over the scrim, just above the bar: 48 px rows
  with their icons for Templates, Setup, Copy-out, Reports, History, Account, and for
  an admin Users and Backup, then a rule and Sign out. The current screen is marked;
  More's cell is current while on any of them. Choosing an item, Escape, the scrim or
  Back close it. Without JavaScript it stays a disclosure over the page, as now.
- Every screen is within two taps.
- The PC sidebar does not change.

## Round 1's rail

The PC sidebar already fills the window's height on long screens (checked on Entries,
History and Copy-out scrolled to the bottom, 2026-10-20); nothing is left of round 1's
rail that stops at the screen's height. The gate checks it on this part's screens.

## Without JavaScript

Every screen stays usable as plain pages, as now. Today's template sheet is a
`<details>` panel posting `fromTemplate`; the template form is its page; Setup's row
menu is a `<details>` with the same items as links and post buttons, rename and create
are forms rendered in place by a query (`?rename=<id>`, `?new=<kind>`), and the filter
is three links. More stays a `<details>`.

## The reference each part follows

| Part | Follows | Departs from |
|------|---------|--------------|
| Today opens the phone with creation one tap away | Google and Toggl (Phone against desktop 1) | — |
| Templates as the quick path, one tap and the blanks | Toggl's and Clockify's favourites (Recents 1) | an automatic recents list (Recents 2) |
| Today's entries in Entries' rows and menu | items 12–14 (Editing 1, 2) | round 1's bare list |
| A template edited in the entry form | one form for create and edit (Editing 1) | round 1's own template form |
| Templates listed in a ruled table with a row menu and Create | Kimai's lists (dot, ⋯, Create; 2026-10-20 recon) | — |
| Delete at once with Undo | Google, Toggl, Clockify (Editing 6) | Kimai's confirm, round 1's confirm |
| Setup's lists: name, colour dot on projects, ⋯ menu, Create in a dialog | Kimai's Customers, Projects and Activities (2026-10-20 recon) | Kimai's separate screens per kind and its long create form |
| Archived rows behind a filter | Kimai's "Visible" filter | round 1's "Show archived" link |
| Bottom navigation with the rest behind More | Toggl (Phone against desktop 5) | Kimai's ☰ pushing the page down |

The 2026-10-20 recon looked at Kimai's demo (Administration › Customers, Projects,
Activities, signed in as the demo's published admin, read only): one list screen per
kind with a colour dot, a search, a filter whose "Visible" flag hides finished rows, a
⋯ row menu, and Create opening a modal of many fields (name, colour, account,
language, currency, contact, budget, team, address, invoice settings).

## Goals

- Log from a template on the phone in one tap plus the blanks, and see today's entries
  and total under it.
- Fix today from Today: open, restart, copy, delete an entry, every change one undo.
- Keep templates in one place, edited in the same form as entries, on PC and phone.
- Add, rename, archive and unarchive customers, projects, activities and locations
  with one or two clicks each, without a wall of buttons.
- Reach every screen from the phone in two taps.

## Non-goals

- A favourite mark, a manual order or usage ordering for templates (queued).
- Separate screens per kind of reference data (queued).
- Deleting reference data (archived, never deleted: vision).
- Colours stored or picked for projects or customers (item 11's call).
- Search or sort on Setup or Templates.
- History, Copy-out, Reports, Account, Users, Backup and the sign-in page (15b–15d).
- Any core, database or MCP change.

## Anti-goals

- A template tap that opens a full form, or asks for what the template already holds.
- Two forms for an entry and a template that read times differently.
- A row of buttons on every Setup line; a confirm before an undoable change.
- A control under the phone's "+"; a phone screen wider than the phone.
- Blue or red for anything but running, primary and wrong.

## Constraints

- SvelteKit, server-rendered; the screens work without JavaScript as pages
  (PRODUCT.md). Tailwind and shadcn-svelte (decision 2); item 11's tokens and shell
  (decision 9, DESIGN.md); item 12's entry form, picker and time input; item 14's
  rows, row menu and bottom sheet.
- Every write is one core call through `openCore(getDb(), user.id, 'ui')`; no rule is
  enforced in a screen.
- WCAG 2.2 AA in both themes; 44 px targets on the phone, 36 px on the PC; menus,
  sheets, dialogs and rename work by keyboard, with focus returned as DESIGN.md says.
- English, 24-hour clock, ISO dates, Monday-first weeks; durations `h:mm`.
- The e2e tests of round 1's Today, Templates and Setup are rewritten for the new
  screens.
- `DESIGN.md` is recorded from what ships (impeccable's documenter); `docs/app.md`'s
  Shell, Today, Setup and Templates sections are updated.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`: the 30 days before today, weekdays only,
nothing today; customers CompX and Myself; templates Standup and Ticket), signed in as
the seeded user, at 390 px and 1440 px, in light and in dark.

1. **Log from a template (phone).** On Today tap Standup: the sheet asks only for what
   Standup leaves blank; type a description and Log. It is listed under today's head,
   whose total reads 0:15, and the strip offers Undo. Tap Ticket: it asks for the
   location, the reference and the description; enter `T-1234` and log it.
2. **Fix today (PC).** On Today click the Standup entry: its form opens over Today;
   change the description and save. From a row's ⋯: Copy, save; then Delete the copy
   and Undo it. Restart a finished row from its ▶; the timer bar runs it; stop it.
3. **Make a template (PC).** On Templates, New template: "Café evening", Myself ›
   time-keep, Development, Café, no times; save: it is listed with TIMER. Start it from
   the timer bar's Start list; stop it. Edit Standup's end to 09:50 (its duration reads
   0:20). Delete Ticket from its ⋯; Undo: it is back.
4. **Save an entry as a template.** Open an entry from Entries, Save as template as
   "Printer"; it is on Templates and on Today.
5. **Templates on the phone.** Reach Templates from More; open Café evening from its
   ⋯ → Edit, set Location to Home office, save. Nothing sits under the "+".
6. **Setup (PC).** Add customer "CompZ"; from its ⋯ add project "CompZ – Audit"; rename
   activity Research to "Research and reading"; archive location Café and Undo it;
   archive it again. Switch to Archived: Café is there, muted; unarchive it from its ⋯.
   Archive project "CompY – Support"; in Archived it stands under "CompX" in muted text.
   A duplicate name ("CompX") is refused in the dialog.
7. **Setup (phone).** From More open Setup; add a location "Coworking" from its sheet;
   rename it from its row's ⋯; nothing hides under the "+".
8. **Navigation.** On the phone every screen (Today, Calendar, Entries, Templates,
   Setup, Copy-out, Reports, History, Account) is reached in at most two taps from the
   bottom bar and More; More closes by Escape, a tap on the scrim and Back. On the PC
   the sidebar fills the window's height on Today, Templates and Setup scrolled to the
   bottom.
9. **Keys and look.** Tab reaches every row, ⋯ and button; menus, sheets, dialogs and
   rename work by keyboard and return focus. Both themes, both widths: one blue primary
   per form, red only for Delete and refusals, no sideways scroll, the empty states
   say what to do (seen by deleting every template and Undo).

## Builder's latitude

The plan decides, within the above: the component structure and what is shared with
Entries' rows, menu and sheets; how the entry form takes a template mode (a prop, a
wrapper); whether rename and create are actions on `/setup` or routes; the address's
parameter names; the exact widths and breakpoints; how Today's rows reuse the
timesheet shaper. Server logic is unit-tested; the interactions are covered by browser
tests.

## Calls made in the operator's place

The stand-in's answers (`docs/questions.md` holds what it queued); its rounds are in
`.autopilot/agents/15a-standin-r1.md`, `-r2.md` and `-r3.md`.

1. **Item 15 is split into 15a Today, templates and Setup (with the phone's
   navigation), 15b History, 15c Copy-out and Reports, 15d Account and agent access,
   Users, Backup and the sign-in.** Source: roadmap item 15's list and order; item 14's
   done note (`components/entries/` stays until item 15). Confidence: inferred.
2. **Today is one of item 15's screens.** Source: roadmap item 15 ("every remaining
   screen", its exit). Confidence: inferred.
3. **Today keeps its order, templates then today's entries, in 12–14's patterns, with
   the day's total in the entries' head and no "Signed in as" or zone lines.** Source:
   vision ("Phone: quick capture … log an entry from a template, fix today"; principle
   1). Confidence: inferred.
4. **Today is one column on the PC too, and the PC still opens on it.** Source: none.
   Confidence: ungrounded, queued.
5. **A template tap opens a sheet asking only for what the template leaves blank,
   location and activity included.** Source: vision, "Templates" ("only what the
   template left blank is typed"); operator's voice (the sheets need "place").
   Confidence: grounded for the sheet, inferred for every blank field.
6. **Today's total counts only the entries that started today.** Source: vision ("An
   entry belongs to the day it started"); item 13's spec. Confidence: grounded.
7. **A template is deleted at once, with Undo; no confirm.** Source: item 12's delete,
   item 5c's "deleted, undoably", item 15's "patterns of 12–14". Confidence: inferred.
8. **A template is edited in item 12's entry form with a Name field, in place.**
   Source: roadmap items 12 and 15; study Editing 1; vision, "Templates". Confidence:
   inferred.
9. **Setup stays one screen, its lists drawn in Kimai's list style.** Source: roadmap
   item 15 ("Setup (customers › projects, activities, locations)"). Confidence:
   ungrounded between one screen and one per kind, queued.
10. **In Archived, an active customer is not a row; its name stands over its archived
    projects, muted, without a menu.** Source: Kimai's "Visible" filter (closest).
    Confidence: ungrounded, queued.
11. **The phone's bottom bar is Today, Calendar, Entries, More; Templates moves into
    More.** Source: study, Phone against desktop 5; vision, "Two surfaces". Confidence:
    inferred.
12. **Templates stay one thing called Templates, with no favourite mark, made on the
    Templates screen or from an entry.** Source: operator's voice 2026-10-18 (templates
    replace recents); vision, "Templates"; study, Recents 1. Confidence: inferred that
    they are one thing; ungrounded for the name and where they are managed, queued.
13. **Templates are offered by name.** Source: none. Confidence: ungrounded, queued.
14. **Setup's rows get a ⋯ menu; rename in place; create in a small dialog with the name
    only; archived rows behind an Active | Archived | All filter.** Source: Kimai's
    lists (recon); items 12–14's patterns; operator's voice ("managing new entries and
    small things is fiddly" in Kimai). Confidence: inferred.
15. **The Ticket sheet asks for its missing location too** (the stand-in's playback
    correction). Source: vision, "Templates". Confidence: inferred.

The builder's:

16. Archive and Unarchive are not red: nothing is lost (DESIGN.md's red is for the
    destructive and the wrong).
17. The rename row's Save is primary beside the header's "+ New entry", as item 12's
    queued question on two blue fills left both.
18. Templates' toolbar button is outline, the header's "+ New entry" staying the
    primary.
19. Round 1's `?archived=1` reads as All.
20. The rail needs no change (checked 2026-10-20).
21. Projects under an archived customer show by their effect, not their stored state:
    gone from Active, muted with the chip in Archived and All, Rename only (the builder
    check's first question).
22. The timer bar's Start list keeps item 12's behaviour; it is the timer's fast path,
    and a timer is started before its details are known (the builder check's second
    question).

Approved by the operator stand-in, revision 1, 2026-10-20.
