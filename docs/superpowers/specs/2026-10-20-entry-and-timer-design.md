# The entry and the timer — design

Approved by the operator stand-in, revision 1, 2026-10-20.

Roadmap item 12. Written 2026-10-20 in an autopilot design session; the operator
stand-in answered in the operator's place (see the last section). Mockups the stand-in
chose from are in [`2026-10-20-entry-and-timer/`](2026-10-20-entry-and-timer/).

## Intent

Round 1 had no way to log an entry for an arbitrary past time, and a timer could only
be started from Today. The operator called it "unusable" (2026-10-19). This item builds
the two things used every day, once, so that every view reaches them:

- **the entry form**, for creating and editing, opened in place over whatever screen
  the user is on;
- **the timer bar**, already on every screen since item 11, which now also starts
  timers and restarts them.

Items 13 (calendar) and 14 (table) open this same form from their blocks and rows, and
item 15 rebuilds the remaining screens around it. Nothing here changes the core: every
action is one existing core command (decision 4).

## The entry form

One form for a new entry and for an existing one (reference study, Editing 1).

### Where it opens

- **PC (from 1024 px):** a centred dialog over the current screen, about 660 px wide,
  labels on the left of the fields, as Kimai's form (`pc-modal`, `pc-new`). The screen
  under it stays where it was, dimmed.
- **Phone (below 1024 px):** a tall sheet over the page, rising from the bottom to just
  under the top bar, with **Cancel and Save fixed at its foot**, so Save is always on
  screen, above the keyboard too (`phone-sheet`). No × beside Cancel: one way to close.
- Closing it (Cancel, Escape, the dimmed area on the PC) leaves the screen as it was.
  Saving closes it and shows the screen as it was, now with the change and the undo
  strip.

**Opened from:**

- **"+ New entry"**, in the PC header on every screen, right of the timer bar and its
  Start; on the phone a fixed **"+"** button at the bottom right, above the bottom bar,
  on every screen. It must never cover the last line of content or a bottom-bar item
  (the content gets room below it). On the PC the `n` key opens it too.
- **An entry's row** on Today and Entries: the row opens its form in place (round 1
  navigated to a separate page).
- **The running timer in the bar:** pressing its time or name opens its form (reference
  study, Timers 4), so a timer's start can be corrected ("I began 10 minutes ago").
- **"Start on a project…"** in the bar's start list (below): a new entry with the start
  set to now and no end.
- **Copy**, inside an existing entry's form (below).

**Without JavaScript** the same form is a page of its own: `/entries/new` for a new
entry and `/entries/[id]` for an existing one, each with a `back` that returns to the
screen it came from (round 1's edit route, kept). Every link and button above is a real
link or form to those pages; JavaScript turns them into the dialog or sheet over the
current screen, and the address bar may show the form's URL while it is open, so the
browser's Back closes it. The form's markup and its server actions are the same in
both cases.

### Fields, in order

Focus starts on the first field the user has not been given: the start, or customer ›
project when the start is already set (Start on a project…, Copy).

1. **Date**: an ISO date field (`2026-10-19`) with **Today** and **Yesterday** beside
   it. A new entry defaults to today.
2. **Start, End, Duration** in one row, linked (reference study, Creating 3): typing an
   end fills the duration, typing a duration fills the end. When the start changes, the
   one of end and duration typed last holds; on an existing entry where neither was
   typed, the end holds (09:00–14:30 moved to start 09:30 reads 09:30–14:30). A typed
   end at or before the start is on the next day, marked "next day" beside it (an entry
   may cross midnight); longer spans are typed as a duration. An existing entry's end
   keeps its exact instant until End or Duration is typed: an end on a later date shows
   "+N days" beside it, an end in another zone than the start shows that zone, and an
   end that was not changed is never re-sent (round 1's rule, which keeps its seconds).
   An empty end and an empty duration mean a **running timer** from the start
   (stand-in, call 7); the form says so under the times when both are empty ("No end:
   this starts a timer.").
   Under the row: **"Start at previous end HH:MM"**, which sets the start to the end of
   the latest finished entry that ends on the form's date, before the typed start if
   there is one (reference study, Creating 10); absent when there is none.
3. **Customer › project**: one field, typed into. It matches the customer's name, the
   project's name, or words from both ("compx support" finds `CompX › CompY - Support`),
   case- and accent-insensitive, and lists matches grouped under their customer, each
   with its project colour dot. Arrow keys and Enter pick; picking a project sets its
   customer. Archived projects are not offered, except an existing entry's own, marked
   "(archived)". (Reference study, Creating 5.)
4. **Activity** and **Location**: picked from the user's lists (active ones, plus an
   existing entry's archived one, marked), each with an empty choice.
5. **Reference**: one line of free text (a ticket number).
6. **Description**: a few lines of free text.

On a new entry only, a **"Fill from"** row of the user's templates sits above the
fields (stand-in, call 12): a tap fills every field the template holds (its times on
the form's date) and leaves the rest as typed; focus moves to the first field still
empty that the entry needs, else the description. The vision's "a template tap and a
typed description".

### Forgiving time input

Typed values are read on leaving the field (or on save) and shown back in their
normal form (`09:00`, `5:30`), so the user sees what was understood before saving
(reference study, Creating 4). A value that cannot be read keeps what was typed and
shows the reason beside the field; nothing is saved until it reads.

| Field | Typed | Read as |
|-------|-------|---------|
| Start, End | `9`, `09`, `9h` | 09:00 |
| | `13` | 13:00 |
| | `900`, `0900` | 09:00 |
| | `1330` | 13:30 |
| | `9:00`, `9.00`, `9,00` | 09:00 |
| | `9:5` | refused: minutes take two digits |
| | `17.5` | refused (not 17:05, Kimai's trap): "Type 17:30 or 17:05" |
| | `9am`, `9 am`, `9:30pm`, `12am`, `12pm` | 09:00, 09:00, 21:30, 00:00, 12:00 |
| | `24`, `2400`, `960`, `25:00` | refused: not a time of day |
| Duration | `5:30`, `5h30`, `5h 30m`, `5h30m` | 5:30 |
| | `5.5`, `5,5` | 5:30 (decimal hours) |
| | `0.25`, `1.30` | 0:15, 1:18: after a dot or comma, always decimal hours |
| | `5h` | 5:00 |
| | `90m`, `:90` | 1:30 |
| | `1h30m` | 1:30 |
| | `90` (a bare number) | 1:30: **a bare number is minutes**, as Kimai reads it (stand-in, call 6) |
| | `330` | 5:30 |
| | `0`, `0:00` | refused: a duration is more than zero |

The field's hint says it in one line: "Times: 9, 900, 9:00, 1330 · Duration: 5:30, 5.5,
5h30, 90 (minutes)". Seconds are never typed; an existing entry's seconds are kept
when its time is not changed (as round 1's edit form does).

### Actions

- **Save** (the one blue button; Ctrl+Enter or Cmd+Enter anywhere in the form; Enter
  in a one-line field). A new entry is `entries.create`; an existing one
  `entries.update` with the form's version. A save that changed nothing closes the form
  with no batch and no strip. Refusals show beside their fields, the form staying open
  with what was typed; a stale version shows the core's message with Reload, as round
  1's edit screen does.
- **Cancel** (and Escape) closes without saving.

On an existing entry only, on the left of the footer, apart from Save. These act on the
entry as stored: while the form has unsaved changes they are disabled with the reason
("Save or cancel your changes first"), so nothing typed is lost and each press is one
batch. (Without JavaScript the change cannot be seen; they act on the stored entry.)

- **Delete**, in red, at once, with no question first; the undo strip offers it back
  (stand-in, call 8).
- **Copy**: opens a new-entry form holding every field of this one, the date and times
  included, for the user to change (Kimai's "Create copy").
- **Restart**: starts a timer now with this entry's customer › project, activity,
  location, reference and description (Kimai's "Start again"; reference study, Timers 3
  and its call 7) and closes the form. On a running entry it is shown disabled with the
  reason ("Already running").
- **Save as template**: a name, then `templates.fromEntry` (round 1's disclosure,
  kept); it returns to the screen the form was opened over, with the strip.

## The timer bar

Item 11's bar keeps everything it does (the newest running timer in full, "+N" for the
others, Stop on each, "No timer running" when none), and gains:

### Start

- **PC:** a **Start** button with a ▶ outside the running timer's pill, between it and
  "+ New entry", so it does not read as acting on the shown timer (stand-in, call 9).
  It opens a list under it (`pc-start`).
- **Phone:** a **▶** button in the timer strip, beside Stop (or alone when nothing
  runs), opening the same list as a sheet from the bottom (`phone-start`).
- **The list:** "Start a timer", then the user's templates by name, each with its
  project colour dot and customer › project; then **"Start on a project…"**, which opens
  the entry form with the start set to now and no end.
- **A template** in the list starts a timer **now**, with the template's customer ›
  project, activity, location, reference and description; its times are ignored (a
  start from the bar is always a timer). When the template has no description, tapping
  it opens a description line under it with a Start button, focused, that may be left
  empty; Enter starts. A template with its own description starts at once. A template
  with no project opens the entry form in timer mode, filled from it. (Vision,
  principle 1: "a template tap and a typed description".)
- With no templates the list holds only "Start on a project…" and a "Create a
  template" link.
- Starting on a project that already runs stops that one first (the core's rule).

### Restart

A stopped timer is restarted in one press from any screen: after a **Stop** in the bar,
the undo strip offers **Restart** beside Undo (stand-in, call 10). Restart starts a new
timer now with the stopped entry's fields, as the form's Restart does. A past entry is
restarted from its row on Today and Entries (a ▶ button on each finished row, labelled
"Restart" for screen readers) and from its form. There is no list of recent entries in
the bar (stand-in, call 2; queued in item 10).

### The phone strip

It shows **customer › project** (the customer is the first of a three-deep chain),
truncated from the end, over "activity · since HH:MM", then the elapsed time, ▶ and
Stop (stand-in, call 9). The description is not shown on the phone.

## Today

- Round 1's **"Start a timer"** section is removed: the bar starts timers from every
  screen (stand-in, call 5).
- The **template sheets stay** as they are until the item that rebuilds Today decides
  their place.
- Today's entry rows open the form in place and carry the row's Restart.

## Entries

Its rows open the form in place and carry Restart. The rest of the screen is item 14's.

## Undo

Every save, delete, start, stop and restart is one batch and shows the undo strip on
the screen the user is on, as item 11 does for Stop (round 1's flash). The strip after
a stop offers Restart as well. Warnings (overlap, longer than 24 hours) show in the
strip as now.

## Keys (PC)

`n` opens a new entry and `s` stops the timer shown in full in the bar, when focus is
not in a field (reference study, Timers 5); Ctrl+Enter or Cmd+Enter saves the form;
Escape closes the form or the start list. The keys are named in the buttons' titles
("New entry (n)", "Stop (s)").

## The reference each part follows

From [the reference study](../../reference-study.md):

- One form for create and edit, opened from a row or a block, prefilled (Editing 1).
  **Follow** Kimai.
- The PC dialog with labels on the left. **Follow** Kimai's form (Creating, Kimai).
- Linked end and duration; the field order date, start, end or duration, then customer ›
  project, activity, location, reference, description; focus on the first field not
  given (Creating 3). **Adapt** Kimai: its focus in Duration with the begin last in the
  tab order is **rejected**.
- Forgiving time input with its hint (Creating 4). **Follow** Kimai and Clockify;
  **reject** `17.5` as 17:05. The bare number is read as minutes as Kimai reads it,
  departing from the study's builder call (hours) on the stand-in's answer.
- One customer › project picker matched on either name or both (Creating 5). **Adapt**
  Kimai's: picking a project sets its customer; no separate customer field.
- Activity and location as picked lists (Creating 6). **Adapt**: alphabetical, not
  ranked by use (the builder's call, below).
- Save always on screen on the phone (Creating 9). **Follow** Google's bottom sheet.
- Start at the previous end (Creating 10). **Adapt** Timing's "prev".
- Delete, copy and restart inside the form (Editing 3). **Adapt**: Kimai's form has
  none of them.
- Undo after every change, no confirm, no trash (Editing 6). **Adapt** the undo toasts
  of Google, Toggl and Clockify, lasting until the next action.
- The running timers always on screen with one-press stop (Timers 1); several shown as
  one plus a count (Timers 2). Built in item 11; kept.
- Restart copying every field, the description included (Timers 3). **Follow** Kimai.
- Correcting a running timer by pressing it (Timers 4). **Adapt** Clockify.
- `n` and `s` (Timers 5). **Follow** Kimai and Toggl.
- Templates as the favourites, started in one tap from the bar and filling the form
  (Recents 1). **Adapt** Toggl's and Clockify's favourites.
- No recents list, no description autocomplete (Recents 2, 4), no `@`/`#` shortcuts
  (Creating 7), no natural-language quick add (Creating 11): **rejected**.
- A fixed add action in thumb reach on the phone (Phone against desktop 2). **Follow**
  Google's "+".

## Goals

- The entry form above, on phone and PC, opened in place from every screen, working
  without JavaScript as a page.
- The forgiving time input, as a tested pure function shared by the form's script and
  the server (the server reads the same forms when JavaScript is off).
- The timer bar's Start and its list, the strip's Restart after a stop, Restart on
  Today's and Entries' rows and in the form.
- Today without "Start a timer".
- `docs/app.md` updated (Shell, Today, Entries, the entry form replacing "Edit entry");
  `DESIGN.md`, its sidecar and the shell's surface brief updated by impeccable's
  documenter from what ships.

## Non-goals

- The calendar views and opening the form from a tap or drag on the grid (item 13).
- The table's row menu, filters and bulk actions (item 14).
- Redesigning Today, Templates, Setup and the other screens (item 15; Today's place is
  decided there or in item 13).
- Recents, favourites other than templates, description autocomplete (queued in item
  10's questions).
- Activities and locations ranked by use; any change to the core, the MCP server or the
  database.

## Anti-goals

- A form that hides Save below the fold on the phone (Kimai's phone form).
- A confirm question before a delete.
- A dead button or a placeholder: every control does what it says, or is disabled with
  its reason.
- An action that leaves the screen the user was on.
- A time silently read as something other than what the user meant: what is read is
  always shown before it is saved.

## Constraints

- SvelteKit, server-rendered forms; everything works without JavaScript as pages
  (PRODUCT.md). Tailwind and shadcn-svelte (decision 2); item 11's tokens and shell
  (decision 9, DESIGN.md).
- Every write is one core call through `openCore(getDb(), user.id, 'ui')` (decision 4);
  no rule is enforced in a screen.
- WCAG 2.2 AA in both themes; the dialog and sheet trap focus while open and return it
  to what opened them; 44 px targets on the phone; keyboard access throughout.
- English, 24-hour clock, ISO dates, Monday first; times in the entry's own zones, new
  entries in the device's zone (the hidden `timeZone` field, as now).
- The e2e suite's tests that pin Today's "Start a timer" and the edit page's flow change
  with this item; the rest keep passing.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`; nothing seeded today), signed in as the
seeded user, at 390 px and 1440 px, in light and in dark. Templates Standup and Ticket
are seeded.

1. **A past entry, made without leaving the view.** On the PC, on Reports, press "+ New
   entry". Log yesterday 9:00–14:30 on CompX › ClientY - ProjectZ (found by typing
   "clienty"), activity Development, location Home office, description "Gate task 1".
   Save: the screen is still Reports, and the strip offers Undo.
2. **Corrected without leaving the view.** On Entries, open that entry from its row (the
   form opens over Entries). Change its start to `930` and save: still on Entries, the
   row now reads 09:30–14:30. Undo it: back to 09:00.
3. **Start plus duration, on the phone.** On Today at 390 px, press "+". Set the date to
   two days ago, start `13`, duration `5.5`, on CompX › CompY - Support (typed as "compx
   support"), reference `#4711`: before saving the end shows 18:30. Save; the form's Save
   stayed on screen throughout. Undo it.
4. **Forgiving input.** In a new entry's form, type `900` in Start, `1330` in End: they
   read 09:00 and 13:30 and the duration 4:30. Type `90` in Duration: it reads 1:30 and
   the end 10:30. Type `17.5` in End: it is refused with its reason.
5. **From a template.** In a new entry's form, tap "Ticket" under Fill from: only the
   description and what Ticket leaves blank remain to be typed. Save.
6. **Start at the previous end.** On a day with entries, open a new entry for that date:
   "Start at previous end" sets the start to the end of that day's latest entry.
7. **A timer from any screen.** On the PC, on Setup, press Start and pick Standup; type
   a description and press Enter: the bar shows it running. Go to Account and stop it
   from the bar: the strip offers Undo and Restart. Press Restart: the bar shows it
   running again, still on Account. Stop it. On the phone, do the same from Templates
   and Copy-out with the strip's ▶.
8. **Start on a project, started earlier.** From the bar's list choose "Start on a
   project…", pick Myself › time-keep, set the start 10 minutes back, save: the bar shows
   about 0:10 elapsed. Press the running time in the bar: its form opens; stop it from
   the bar.
9. **Restart a past entry.** On Entries, restart a past entry from its row: a timer runs
   with its project, activity and description. Open a running entry's form: Restart is
   disabled and says why. Stop the timer.
10. **Delete, copy, save as template.** Open a past entry's form and Delete it: it is
    gone at once, with Undo in the strip; undo it. Open it again and Copy: a new-entry
    form holds its fields; change the date to today and save. Save an entry as a template
    named "Gate template": it appears in the bar's start list.
11. **Keyboard on the PC.** On Entries with no field focused, press `n`: the form opens
    with focus in Start. Fill it with the keyboard only and press Ctrl+Enter: saved.
    Press `n` again and Escape: it closes. With a timer running, press `s`: it stops.
12. **Look.** In both themes and both widths, the form, the start list and the strip
    read cleanly; the phone's "+" covers no content or bottom-bar item; nothing is covered
    by the timer bar or the bottom bar; one blue primary per form; Delete in red.

## Builder's latitude

The plan decides, within the above: the dialog and sheet's mechanism (shadcn-svelte's
dialog or a native `<dialog>`; SvelteKit's shallow routing or another way of loading
the form over the screen), the combobox's implementation and its no-JavaScript
fallback (a `<select>` grouped by customer), the time parser's module and names, the
routes' shape beyond `/entries/new` and `/entries/[id]`, the start list's no-JavaScript
mechanism, how the strip carries Restart, and the component structure. The exact
spacing and type follow DESIGN.md.

## Calls made in the operator's place

The stand-in's answers, each settling a choice:

1. **The working day** is not on record beyond the split: the phone for quick capture
   through the day, the PC for logging afterwards, correcting and month-end; both paths
   are made equally short. Source: operator's voice, discovery 2026-10-18; vision, "Two
   surfaces"; roadmap item 16. Confidence: inferred for the split, ungrounded for times
   and proportions, queued.
2. **Restart is from the entry itself** (its form, its row) and, through call 10, after
   a stop from the bar; no last-stopped item and no recents in the bar. The exit's
   "restarted from any screen" is read as: start and stop from any screen, restart of
   the stopped timer from any screen, restart of a past entry wherever the entry shows.
   Source: operator's voice, discovery 2026-10-18 ("templates … replace 'recent' and
   'repeat last entry'"); questions, 2026-10-20 — 10. Confidence: inferred.
3. **Start from the bar is a short list:** the templates and "Start on a project…"
   opening the form with the start now. Not inline fields, not a full form on every
   start. Source: vision, principle 1 and "Two surfaces". Confidence: inferred.
4. **Templates are the favourites; nothing else is.** No star on a project or entry.
   Source: vision, "Templates"; operator's voice, discovery 2026-10-18; roadmap item 15.
   Confidence: inferred.
5. **Today loses "Start a timer"; its template sheets stay** until Today is rebuilt.
   Source: roadmap item 11's done note (Today's Timers section went the same way); vision,
   "Two surfaces". Confidence: inferred.
6. **A bare number in a duration is minutes** (`90` is 1:30, `330` is 5:30), as Kimai
   reads it; anything with an hours mark is hours. This settles the note left open at
   item 10's approval, against the study's builder call. Source: none; the familiar
   reading. Confidence: ungrounded, queued.
7. **A form saved with no end and no duration starts a running timer** from its start,
   as Kimai's does. Source: vision, "Timers" ("An entry without an end is running").
   Confidence: grounded on the vision, inferred for the form.
8. **Delete from the form is at once, with Undo after, no confirm.** Source: vision,
   principle 2; roadmap item 12 ("Undo stays one step after every save, stop and
   delete"); operator's voice (Kimai "fiddly"). Confidence: inferred.
9. **The PC form is a centred dialog with labels on the left (Kimai's), the phone form
   a tall sheet with Save fixed at its foot.** On the mockups: Start moves outside the
   running timer's pill; the phone strip shows customer › project, not the project
   alone. Source: operator's voice, 2026-10-19 ("nothing like kimai"); reference study,
   Creating 9; discovery's three-deep entry shapes. Confidence: inferred.
10. **Restart beside Undo after a stop from the bar.** Source: roadmap item 12's exit.
    Confidence: inferred.
11. **"+ New entry" in the PC header on every screen, a fixed "+" on the phone,** not
    covering content or the bottom bar. Source: roadmap item 12 ("one action from every
    view"); reference study, Phone against desktop 1–2. Confidence: inferred.
12. **"Fill from" templates on a new entry's form.** Source: vision, principle 1 and
    "Templates". Confidence: grounded.
13. **The form's footer adds Save as template; Restart on a running entry is disabled
    with its reason.** Source: vision, "Templates" ("An entry can be saved as a
    template"); reference study, Editing 2. Confidence: grounded (Save as template),
    inferred (disabled Restart).

The builder's:

14. **A template started from the bar ignores its times:** a start from the bar is
    always a timer now, through `timers.start` with the template's fields (a template's
    start and duration would otherwise log a finished entry). Logging a template's times
    is the form's "Fill from" or Today's sheets.
15. **A template without a description asks for one line before it starts,** which may
    be left empty; one with a description starts at once (the stand-in's answer 3: "a
    tap asks only for what the template left blank").
16. **Activities and locations are alphabetical,** not ranked by use on the project:
    ranking needs a usage read the core does not have, and templates carry the usual
    pairs.
17. **An end at or before the start is the next day**, marked; longer than a day is
    typed as a duration.
18. **`17.5`, `9:5` and other half-read times are refused with a reason,** never
    guessed.
19. **The date is an ISO field with Today and Yesterday;** no natural-language dates.
20. **Copy keeps the date and times;** the user changes what differs.
21. **Pressing the running timer in the bar opens its form** (reference study, Timers 4).
22. **`/entries/new` joins round 1's `/entries/[id]`** as the form's page without
    JavaScript; the dialog loads the same page's data.
23. **A ▶ Restart on every finished row of Today and Entries;** item 14's row menu
    replaces it on the table.
24. **The phone strip drops the description** to fit customer › project.
25. **After a dot or comma a duration is always decimal hours** (`1.30` is 1:18, shown
    back before saving), as Kimai and the copy-out's decimal hours read it; `0.25` and
    `0.75` stay quarter hours (builder check, question 1).
26. **Delete, Copy, Restart and Save as template act on the stored entry** and are
    disabled while the form has unsaved changes, with the reason (builder check,
    question 2).
27. **An existing entry's end keeps its exact instant** until End or Duration is typed,
    shown with "+N days" or its own zone when they differ from the start's; an
    unchanged end is never re-sent (builder check, question 3).
28. **The approval's notes:** the phone sheet has no × (the mockup's is not built);
    the phone strip shows customer › project (the `phone-start` mockup shows the project
    alone); the strip's ▶ and Stop are each a 44 px target.

Questions queued in `docs/questions.md` this session: the working day (call 1), a bare
number in a duration (call 6).
