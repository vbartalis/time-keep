# History — design

Roadmap item 15b, the second part of item 15. Written 2026-10-21 in an autopilot design
session; the operator stand-in answered in the operator's place (see the last section).
The mockups it judged are in [`2026-10-21-history/`](2026-10-21-history/), each in light
and dark (`<name>-light.png`, `<name>-dark.png`). They are static, with invented data;
the sidebar's icons in them are a mock artefact (the shell's own icons stay). Where
this text and a mockup differ, this text wins.

## Intent

"Nothing is lost. Every change is recorded; any change, or batch of changes, can be
undone" (vision, principle 2). History is where that promise is kept after the fact:
at month-end, after an agent has bulk-added, reorganised or reworded the month, the
operator opens it to see what the agent did and undo a wrong tidy-up in one step; and
any time something looks wrong after their own change, to find it and put it back
(call 1). They are looking for **one batch**: what it touched and when, then Undo.

Round 1's History (item 5c) does all of it, but in round 1's look: a bare list whose
rows cannot be told apart (fifty rows reading `Create entry on "time-keep"` at the same
minute), an always-shown "Undo selected changes / Redo selected changes / 0 selected"
bar, Undo on a line of its own, and on the phone an 8500 px column. This part redoes it
in item 11's direction and the patterns of items 12–14: Entries' ruled table in a
surface panel with day head rows, a muted second line that says what a row touched,
the action visible on the row, a bulk bar that comes only with ticks, phone rows with a
leading control and a Select mode.

What the screen does stays round 1's: every batch newest first, 50 to a page; a batch
undone or redone whole; chosen changes of one or several batches undone or redone
together; the core's refusals shown as it gives them (decision 4; core.md, Undo and
Redo). The writes are `core.undo` and `core.redo`, unchanged. One read is added to the
core: the number of batches, for the page's "1–50 of 312" (call 20).

## The screen (`/history`)

`pc-history`, `pc-history-open`, `pc-history-selected`, `pc-history-refused`,
`pc-history-undone`, `pc-history-big`, `ph-history`, `ph-history-partly`,
`ph-history-open`, `ph-history-select`.

In the PC sidebar after Setup and under More on the phone, as now. Header title
"History"; the header's timer pill, Start and "+ New entry" as on every screen.

### The toolbar

One band above the table, 52 px tall on the PC (call 9):

- At the left the page's place in the whole: **"1–50 of 312 batches"** (the range in
  semibold figures, the rest muted; "1–7 of 7 batches" when it all fits).
- At the right **Newer** and **Older**, outline buttons; Newer is disabled on the
  newest page, Older on the oldest (call 5). Older loads the next 50; Newer the 50
  before them. The page is kept in the address.
- Under the table the same **Newer** and **Older** as links (each only when it leads
  somewhere), so the next page is reached without scrolling back up (call 5).

On the phone the band is the toolbar strip Templates has (surface, a rule under it):
"1–50 of 312" at the left and an outline **Select** at the right, clear of the "+"'s
column; Newer and Older are the links under the list.

### The table (PC, from `lg`)

Entries' ruled table in a surface panel; it never scrolls sideways. A caps header row:
Time, What, By, Changes, State, and an unlabelled actions column.

- **Day head rows**: "Wed 2026-10-21" in bold (the weekday short, the ISO date, in the
  request's zone, as Entries' day heads), and at the right the number of the day's
  batches on this page, muted ("5 batches"). When a day continues on the older page,
  its last row is followed by a muted line "Continues on the older page." (call 21).
- **A batch row**, 56 px or more:
  - **Time**, `HH:mm` in the request's zone, in figures.
  - A **chevron** (right when closed, down when open).
  - **What**: the label as the core stored it, semibold, on one line (cut with "…"
    only past the column), and under it a 12 px muted line of **what it touched**
    (below), also one line, cut with "…".
  - **By**: an **Agent** or **System** chip (Setup's caps chip); blank for a batch
    made in the UI (call 3).
  - **Changes**: "1 change" / "412 changes", never wrapping.
  - **State**: muted "Undone" when every change is undone, "Partly undone, 1 of 3"
    otherwise; blank when it stands. An undone row's label and time are muted.
  - **Actions**, right-aligned, outline 32 px buttons with their icons (Lucide `undo-2`,
    `redo-2`): **Undo** when any change stands, **Redo** when any is undone, both on a
    partly undone batch (Undo first). Their accessible names carry the label ("Undo
    Reword 5 entries").
- A click anywhere on the row but its buttons, or Enter or Space on the row's
  disclosure control, opens the batch's **changes** in place under it (call 4); several
  can be open; a second click closes it. The chevron turns.

**What it touched** is built from all the batch's changes (not only the first 100):

- one entry: its date with the weekday, its times and its customer › project, as the
  row reads after the change (before it for a delete): "Tue 2026-10-20 10:00–12:00 ·
  CompX › ClientY – ProjectZ"; a running one "Wed 2026-10-21 09:30–running";
- several entries: their date range ("2026-10-13 – 2026-10-20", one date when they
  share it) and their distinct customers › projects, newest first, up to three, then
  "+<n> more";
- reference data and templates: the record, as the change line names it ("Location
  Café", "Project CompX › CompZ – Audit", "Template Standup"); several of one kind
  "3 locations"; mixed kinds joined with " · ";
- entries and other records together: the entries' part, then " · " and the others'.

The exact strings beyond these are the builder's (call 22).

### A batch's changes

Opened under the row, on the row's surface, indented to the What column
(`pc-history-open`):

- One line per change, in the batch's order: a **tick box**, then the verb in semibold
  and the record, in sentence case: "**Changed** entry 2026-10-20 13:30–14:00, CompX ›
  CompY – Support", "**Created** customer CompZ", "**Archived** location Café" (call 6:
  round 1's "Changed Entry …" reads as two titles). The verbs and records are round 1's (`describeChange`: Created,
  Changed, Archived, Unarchived, Deleted; an entry named in its own zones; ids as
  current names, "(unknown)" when gone).
- Under it, one line per changed field: "Description: Restored a deleted mailbox →
  Restored the deleted mailbox for Contoso": the field name and the old value in
  **plain muted text**, the arrow and the new value in the foreground (call 7). An empty
  side reads a muted italic "none", never struck through or quoted. Text past 80
  characters is cut with "…", as now. A change whose fields all read the same on screen
  (an id swapped for one of the same name, a sub-minute time) still names the field and
  never reads "none → none" (call 8).
- An undone change is muted and ends with "Undone" in muted caps.
- **A batch of more than 100 changes** (`pc-history-big`) lists its first 100 without
  tick boxes and ends with the muted line "The first 100 of 412 are listed. Too many to
  choose one by one: undo or redo the whole batch." Its row's Undo and Redo work as on
  any row.

### Choosing changes

- **Ticking a change** puts the bulk bar in the toolbar's place, the same 52 px tall,
  so nothing below moves (`pc-history-selected`): "**2 selected**", then muted
  `of "Reword 5 entries"` when the ticks are in one batch, "across 2 batches" when in
  several (call 10); at the right **Undo selected**, **Redo selected** (outline, with
  their icons) and a ghost **Clear**.
- **Undo selected** is enabled when every ticked change stands, **Redo selected** when
  every ticked change is undone; otherwise each is shown **disabled**, never hidden
  (call 11). A mixed selection disables both and says why in the bar, after the count:
  "Tick only standing or only undone changes." (call 23: the core refuses a chosen
  change that cannot take the action).
- While up, the bar is sticky under the header, as Entries' bar; the screen's undo
  strip rides in it.
- **Clear**, or unticking the last box, brings the toolbar back; focus goes to the last
  toggled tick box.
- The ticks are kept while batches are opened and closed, and cleared by a page change
  or an action.

### After an undo or redo

As now: the action posts, the screen comes back on the same page with the screen's
**undo strip** under the header (`pc-history-undone`): `Done: Undo "Edit entry".` with
its Undo (which undoes that new batch and returns here) and the core's warnings. The
row it acted on now reads its new state with its buttons flipped (Undone, Redo), and
the new batch, `Undo "Edit entry"`, is the newest page's first row (call 12). Open
batches stay open where they still are on the page. No confirm before any undo or redo:
each is itself undone from the strip.

### Refusals

A refused undo or redo (a later change touched the row, a customer's creation once a
project is under it, an older shape) shows the core's message **in view at the top**,
in a red-bordered alert under the bar or toolbar, announced (`pc-history-refused`); the
ticks stay ticked and their batches open; nothing changed (call 13). A refused
whole-batch Undo shows the same alert with no ticks. The alert goes with the next
action or load.

### The phone (below `lg`)

`ph-history`, `ph-history-partly`, `ph-history-open`, `ph-history-select`.

- The toolbar strip (above), then the day heads ("Wed 2026-10-21" bold, "5 batches"
  muted, kept clear of the "+"'s column), then the rows on a surface, ruled.
- **A row**: a leading 44 px **icon button** where Entries' rows have their ⋯: ↶ Undo
  on a standing batch, ↷ Redo on an undone one, and on a partly undone one both,
  Undo over Redo (call 2), each named for screen readers ("Undo Reword 5 entries").
  Then the time (15 px figures), and the text: the label (15 px semibold, wrapping),
  the touched line (12 px muted, wrapping, never cut), and a meta line: the Agent or
  System chip, "5 changes" as an underlined disclosure, "· Undone" / "· Partly undone,
  1 of 3". The right 72 px stay clear of the "+".
- "n changes" opens the changes under the row (`ph-history-open`), indented to the
  text, as on the PC, wrapping.
- **Select** (`ph-history-select`) puts a 22 px tick box (in a 44 px target) on every
  change line of the open batches (opening a batch shows its boxes), hides the leading
  buttons and the "+", and puts the bulk bar in the toolbar's place, pinned under the
  timer strip: "2 selected", **Undo**, **Redo** (each enabled or disabled as on the PC)
  and **Done**, 44 px buttons. Done leaves selecting, clearing the ticks, focus back on
  Select.
- Refusals and the strip as on the PC.

### Without JavaScript

As now: the list is one `POST` form; a batch's changes are a native `<details>`; Undo
and Redo are submit buttons. The bulk bar's Undo selected and Redo selected show at
all times above the table, posting the ticked changes (none says "Select at least one
change.", more than 1000 "Select at most 1000 changes."). The phone's Select is a link
that reloads with the tick boxes shown. Newer and Older are links.

### Keys and focus

- Tab reaches each row's disclosure, its Undo and Redo, each tick box, the bar's
  buttons and the pager, in reading order; a disabled button is announced as disabled.
- After an undo or redo the focus goes to the strip's Undo, as on the other screens.
- After a refusal the focus goes to the alert.
- 36 px targets on the PC (the rows' 32 px buttons sit in a 56 px row: their hit area
  is padded to 36), 44 px on the phone.

## The reference each part follows

| Part | Follows | Departs from |
|------|---------|--------------|
| The batches as a ruled table with day head rows | Entries (item 14; Kimai's timesheet, Views 6) | round 1's bare list |
| A muted second line of what a row touched | Today's templates (item 15a) | round 1's label alone |
| The row's main action visible, not in a menu | Entries' ▶ Restart (Editing 2) | — |
| Ticks with a bar that comes only once something is ticked | Entries' bulk bar (Editing 5) | round 1's always-shown bar with "0 selected" |
| The page's place: "1–50 of 312" | Kimai's "Show entries 1 to 50 from 895" (study) | round 1's bare Older link |
| Phone rows with a leading control and a Select mode | Entries' phone list (item 14) | round 1's column of label, chip and Undo |
| No confirm; the strip undoes the undo | Google, Toggl, Clockify (Editing 6) | — |

The references have no screen like History (study, item 15: "the references have no
counterpart for time-keep's History"); its parts follow items 11–14.

## Goals

- At month-end, find an agent's batch on sight (its label, what it touched, the Agent
  chip) and undo it in one click or tap.
- See exactly what a batch changed, field by field, old and new, both readable.
- Undo or redo chosen changes of one or several batches together.
- The same screen on the phone, in phone rows, without a control under the "+" and
  without a page eight screens long.

## Non-goals

- Filtering or searching the history (call 14, queued).
- Links from a change to its record (call 15, queued).
- Any change to what a batch records, to `undo` or `redo`, or to the MCP's history
  tools.
- The undo strip's behaviour on other screens.
- Copy-out, Reports, Account, Users, Backup and the sign-in page (15c, 15d).

## Anti-goals

- A row that cannot be told from its neighbours.
- Undo hidden in a menu; an action that vanishes when it cannot apply.
- A confirm before an undo or redo; a refusal that changes something.
- The list jumping when the bar comes; a control under the phone's "+"; a phone page
  wider than the phone.
- Blue or red for anything but primary, running and wrong: this screen has no primary
  button (the header's "+ New entry" is the one), and red only for the refusal.

## Constraints

- SvelteKit, server-rendered; usable without JavaScript as pages (PRODUCT.md).
  Tailwind and shadcn-svelte (decision 2); item 11's tokens and shell (decision 9,
  DESIGN.md); item 14's table, day heads, bulk bar and phone list as the patterns.
- Every write is one core call through `openCore(getDb(), user.id, 'ui')`; no rule is
  enforced in the screen (the enabled state of Undo selected and Redo selected is a
  hint from the loaded state; the core decides).
- The added read (the number of batches, and the page's position) goes through the
  core like every other read, for the request's user only.
- WCAG 2.2 AA in both themes; 44 px targets on the phone, 36 px on the PC.
- English, 24-hour clock, ISO dates, Monday-first weeks.
- Round 1's History e2e tests are rewritten for the new screen; its unit tests of
  `describeChange` keep passing, changed only where calls 6 and 8 change the words.
- `DESIGN.md` is recorded from what ships (impeccable's documenter); `docs/app.md`'s
  History section and `docs/core.md` (the count read) are updated.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`: the 30 days before today, weekdays only;
its 88-odd entries are recorded as one System batch each), signed in as the seeded
user, at 390 px and 1440 px, in light and in dark.

1. **Find and undo your own change (PC).** On Entries change yesterday's Standup
   description to "Standup and planning" and save. On History the newest row reads
   "Edit entry" with yesterday's date, 09:30–09:45 and CompX › ClientY – ProjectZ
   under it, and no chip. Open it: "Description: Standup → Standup and planning". Undo
   it from the row: the strip says Done, the row reads Undone with Redo, and the entry
   on Entries reads "Standup" again. Redo it from the row.
2. **Undo chosen changes (PC).** On Entries tick three entries of one day and change
   their location to Home office (one batch). On History open "Edit 3 entries", tick
   two of its changes: the bar reads "2 selected" with the batch's label, the list does
   not move, Redo selected is disabled. Undo selected: the row reads "Partly undone, 2
   of 3" with Undo and Redo. Tick one undone and one standing change: both buttons are
   disabled and the bar says why. Clear.
3. **Choose across batches (PC).** Open two batches and tick a standing change in each:
   the bar reads "across 2 batches"; Undo selected undoes both in one step (one new
   batch, one strip).
4. **A refusal (PC).** In Setup add customer "CompZ", then project "CompZ – Audit"
   under it. On History Undo the "Create customer" batch: the core's refusal is shown
   at the top, in view, and nothing changed (CompZ is still in Setup).
5. **Pages (PC).** The toolbar reads "1–50 of <n> batches" with Newer disabled; Older
   shows "51–<…> of <n>"; the foot's Newer link returns. The seeded batches carry the
   System chip; the ones made in tasks 1–4 carry none.
6. **The phone.** From More open History. Undo the newest batch from its leading button
   and Redo it. Open a batch's changes. Select, tick a change, Undo; Done. Nothing sits
   under the "+"; no sideways scroll; each row's text is one column, with no button on a
   line of its own under it.
7. **Keys and look.** Tab reaches every row's disclosure, Undo, Redo and tick box and the
   bar; a row opens by keyboard; focus goes to the strip after an undo and to the alert
   after a refusal. Both themes, both widths: no primary fill on the screen but the
   header's "+ New entry", red only for the refusal, the disabled buttons read as
   disabled, the old and new values both readable.

## Builder's latitude

The plan decides, within the above: the component structure and what is shared with
Entries' table, bulk bar and phone list; the added read's name and exact shape
(within call 20); the touched line's exact strings; the widths and breakpoints. Server logic is
unit-tested; the interactions are covered by browser tests.

## Calls made in the operator's place

The stand-in's answers (`docs/questions.md` holds what it queued); its rounds are in
`.autopilot/agents/15b-standin-r1.md` and `-r2.md`.

1. **History is opened at month-end after an agent's tidy-up, and after a change that
   looks wrong, to find one batch and undo it.** Source: operator's voice
   (2026-10-18 discovery: the MCP is for month-end tidying, "that is why batch undo
   matters most"); vision, "Agents" ("a wrong tidy-up is one undo"). Confidence:
   inferred.
2. **On the phone a batch's Undo or Redo is a leading icon button where Entries' rows
   have their ⋯; a partly undone batch shows both, Undo over Redo.** Source: the
   stand-in's round 1 (the phone column of label, chip and Undo on separate lines does
   not pass); item 14's phone rows. Confidence: inferred.
3. **A batch made in the UI has no By mark; only Agent and System are chipped.** Source:
   round 1's chips (roadmap item 5c); operator's voice (month-end, the agent's batch is
   the one looked for). Confidence: inferred.
4. **A batch's changes open in place under its row; several can be open.** Source:
   round 1's choice of changes across batches (item 5c). Confidence: inferred.
5. **Newer and Older in the toolbar with the page's place, and the links kept at the
   foot.** Source: none. Confidence: ungrounded, queued.
6. **Change lines read in sentence case ("Changed entry …").** Source: the stand-in's
   round 2 (f). Confidence: inferred.
7. **A changed field's old value is plain muted text, not struck through.** Source:
   none. Confidence: ungrounded, queued.
8. **An empty side reads a muted "none"; a change never reads "none → none".** Source:
   item 5c's deferred minors (roadmap). Confidence: inferred.
9. **The bulk bar is the toolbar's height, so the list does not move at the first
   tick.** Source: the stand-in's round 2 (g); item 14's day-head shift recorded as a
   defect. Confidence: inferred.
10. **The bar names the batch ("of 'Reword 5 entries'") or "across 2 batches".**
    Source: the stand-in's round 2 (h). Confidence: inferred.
11. **Undo selected and Redo selected are disabled when they cannot apply, never
    hidden.** Source: study, Editing 2 (actions on every row, none vanishing).
    Confidence: inferred.
12. **After an undo or redo the strip shows, the row's state and buttons flip, and the
    new batch heads the page.** Source: the stand-in's round 2 (c); `docs/app.md`, Done
    and undo. Confidence: inferred.
13. **A refusal shows in view at the top, the ticks kept and their batches open.**
    Source: round 1 (item 5c); the stand-in's round 2 (b). Confidence: inferred.
14. **No filter or search; one list, newest first, paged.** Source: none; round 1's
    call. Confidence: ungrounded, queued.
15. **No link from a change to its record.** Source: none; round 1's call.
    Confidence: ungrounded, queued.
16. **A row says its label and, under it, what it touched.** Source: operator's voice
    ("UX seems awful"; month-end tidying); the screenshots of round 1's History.
    Confidence: inferred.
17. **Undo and Redo are visible on every row, not in a menu.** Source: vision,
    principle 2; study, Editing 2; item 14's visible ▶. Confidence: inferred.
18. **Choosing changes stays, by tick boxes on change lines and a bar that comes with
    the first tick; on the phone through Select.** Source: vision, principle 2 (grounded
    that it stays); study, Editing 5; item 14's Select. Confidence: grounded, inferred
    for how.
19. **The page's place reads "1–50 of 312 batches".** Source: study (Kimai's "Show
    entries 1 to 50 from 895"); the stand-in's round 2 (d). Confidence: inferred.

The builder's:

20. The core gains one read beside `history.list`, returning the number of the user's
    batches, the page's position, and the `before` cursor of the page 50 batches newer
    (none on the newest page). The page stays in the address as round 1's `before`.
    `history.list`, its schema and the MCP's history tool, which shares that schema,
    are unchanged (the builder check's question); nothing else in the back end changes.
21. A day head counts the day's batches on this page; a day that runs onto the older
    page says so under its last row.
22. The touched line's form for several entries (date range, up to three customers ›
    projects, "+n more") and for mixed kinds.
23. A mixed selection disables both bar actions and says why: the core refuses a
    chosen change that cannot take the action (core.md), so offering it would only
    produce a refusal.
24. The rows' buttons are 32 px tall in a 56 px row with a 36 px hit area, to keep the
    rows as dense as Entries'.
25. No primary fill on the screen: Undo and Redo are outline, as round 1's and the
    strip's.
26. The touched line names an entry's times in the entry's own zones, as its change
    line does (the builder check).
27. A change line's field is shaped as its name, its old side and its new side, so the
    screen can mute the old side; a field whose two sides read the same on screen shows
    both sides with a muted "(same as shown)" note rather than "none → none".

Approved by the operator stand-in, revision 1, 2026-10-21.
