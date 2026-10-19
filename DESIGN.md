---
name: time-keep
description: A personal time tracker dressed as a punch-clock time card.
colors:
  card-stock: "oklch(0.955 0.016 236)"
  card-face: "oklch(0.99 0.005 236)"
  card-ink: "oklch(0.255 0.04 262)"
  ribbon-violet: "oklch(0.46 0.165 308)"
  ribbon-violet-paper: "oklch(0.985 0.006 308)"
  ribbon-red: "oklch(0.52 0.19 25)"
  ink-faded: "oklch(0.45 0.035 256)"
  ink-stroke: "oklch(0.62 0.035 252)"
  ink-hairline: "oklch(0.83 0.028 245)"
  ink-shade: "oklch(0.93 0.02 238)"
  ink-wash: "oklch(0.915 0.025 240)"
  rack-ink: "oklch(0.255 0.045 262)"
  rack-ink-raised: "oklch(0.32 0.048 262)"
  rack-text: "oklch(0.9 0.018 240)"
  rack-focus: "oklch(0.8 0.11 308)"
typography:
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "0.05em"
    fontVariation: "'wdth' 72"
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0.05em"
    fontVariation: "'wdth' 72"
  punch:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0"
    fontFeature: "'tnum' 1, 'zero' 1"
    fontVariation: "'wdth' 75"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
spacing:
  cell: "12px"
  stack: "24px"
  section: "40px"
  page-phone: "16px"
  page-pc: "40px"
  row: "36px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.ribbon-violet}"
    textColor: "{colors.ribbon-violet-paper}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "color-mix(in oklch, oklch(0.46 0.165 308), oklch(0.255 0.04 262) 18%)"
  button-outline:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.ink-wash}"
  button-destructive:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.ribbon-red}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-destructive-hover:
    backgroundColor: "{colors.ribbon-red}"
    textColor: "{colors.ribbon-violet-paper}"
  input:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "44px"
  badge-mark:
    textColor: "{colors.card-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  badge-live:
    textColor: "{colors.ribbon-violet}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  badge-spent:
    textColor: "{colors.ink-faded}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  column-head:
    backgroundColor: "{colors.ink-shade}"
    textColor: "{colors.ink-faded}"
    typography: "{typography.label}"
    padding: "0 12px"
    height: "36px"
  rack:
    backgroundColor: "{colors.rack-ink}"
    textColor: "{colors.rack-text}"
    width: "15rem"
  rack-item-current:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
---

# Design System: time-keep

Every decision recorded here was an inferred call made in the operator's place. The
operator handed design over ("as for design we have impeccable, they can do it",
2026-10-18), so nothing below was chosen or approved by them. This file describes the
build as shipped on `feat/design-direction`. Where it differs from the direction
contract in `.impeccable/surfaces/src-routes-app-layout-svelte.md`, the code wins and
the difference is noted.

## Overview

**Creative North Star: "The Punch-Clock Time Card"**

The app is a time card in a rack. The ground is pale blue card stock, everything is
printed on it in blue-black card ink, and the grid shows as thin printed rules rather
than boxes. The shell is the time rack: a deep ink rail on the PC, a slim ink bar on
top and an ink navigation bar at the bottom on the phone. The current screen is the
card pulled into its slot: the active rail item is filled with card stock and runs
flush into the work area.

It is a working tool for one person, used for seconds on the phone and for long dense
sessions on the PC. Rank comes from weight, capitals and rules, not from colour,
panels or shadow. Two ribbon inks are held back for meaning: violet for what is live
and for the one primary action, red for what is irregular or destructive. Times,
dates and durations are punched in a condensed monospace on fixed columns.

It deliberately is not a grey SaaS dashboard with stat tiles and an indigo accent.
Light is the default; dark follows the device setting through
`prefers-color-scheme`, so it works without JavaScript.

**Key Characteristics:**
- Card stock ground, card ink text, every grey a tint of the card ink.
- Rules instead of boxes; a heavy ink rule under each section head, hairlines between lines.
- Printed condensed capitals for section and column heads.
- Condensed monospace on tabular figures for every punched time, date and duration.
- Violet for live or primary, red for irregular or destructive.
- 4 px corners, no shadows, colour-only motion at 150 ms.

## Colors

Four inks on card stock: the stock, the card ink, ribbon violet and ribbon red. All
other tones are tints of the card ink (hues 236 to 262), never neutral grey.

### Primary
- **Ribbon Violet** (`ribbon-violet`): the one primary action per form (Sign in,
  Change password, Create user) and anything live, such as a running timer (the
  `live` colour alias and `live` badge exist for this). It is also the focus colour:
  focus rings, the text caret, the selection tint (28 % violet) and checked boxes.
  Dark: oklch(0.75 0.11 306), with text on it in oklch(0.2 0.045 305).
- **Violet Paper** (`ribbon-violet-paper`): text on a violet or red fill.

### Secondary
- **Ribbon Red** (`ribbon-red`): irregular punches and destructive actions only:
  error alerts, the destructive button, invalid fields. Dark: oklch(0.73 0.15 25).

### Neutral
- **Card Stock** (`card-stock`): the page ground, and the fill of the current rack
  slot. Dark: oklch(0.225 0.04 252).
- **Card Face** (`card-face`): the fill inside controls (inputs, outline buttons,
  alerts). Dark: oklch(0.26 0.044 252).
- **Card Ink** (`card-ink`): all text, and the heavy rule under every section head.
  Dark: oklch(0.93 0.014 240).
- **Faded Ink** (`ink-faded`): secondary text, column-head text, struck-through
  spent items. Dark: oklch(0.75 0.03 248).
- **Ink Stroke** (`ink-stroke`): control borders, the rule under a column-head band,
  the scrollbar. Dark: oklch(0.56 0.035 255).
- **Hairline** (`ink-hairline`): the printed rules between lines and column
  dividers. Dark: oklch(0.36 0.045 252).
- **Ink Shade** (`ink-shade`): the column-head band. Dark: oklch(0.275 0.045 252).
- **Ink Wash** (`ink-wash`): hover fills on outline buttons and table rows.
  Dark: oklch(0.3 0.048 252).
- **Rack Ink** (`rack-ink`, `rack-ink-raised`, `rack-text`, `rack-focus`): the
  shell rail and bars, their hover fill, their text and their focus ring. Dark rack:
  oklch(0.13 0.022 262), raised oklch(0.18 0.028 262), text oklch(0.82 0.02 245),
  focus oklch(0.77 0.12 308).

### Named Rules
**The Four Inks Rule.** Stock, card ink, violet and red. Any other tone must be a
tint of the card ink at hue 236 to 262. No neutral greys.

**The Ribbon Rule.** Violet means live, the primary action, or where your input is
focused. Red means irregular or destructive. Neither colours decoration, headings
or icons.

## Typography

**Display Font:** none. The working screens have no display size.
**Body Font:** Archivo Variable, width axis included (fallback ui-sans-serif, system-ui)
**Label/Mono Font:** Martian Mono Variable, width axis included (fallback ui-monospace)

Both are self-hosted through `@fontsource-variable` and bundled by Vite.

**Character:** Archivo is a plain grotesque that condenses into the printed capitals
of a card's column heads. Martian Mono, condensed to 75 %, reads as figures stamped by
a clock.

### Hierarchy
- **Headline** (600, 22 px, 1.2, -0.01em): the one screen title per page (Today,
  Account, Users, Sign in).
- **Title** (650, 15 px, 72 % width, capitals, 0.05em): section heads, always sitting
  on a heavy card-ink rule. This is the `printed` style.
- **Body** (400, 15 px, 1.45): all running text, table cells, nav items (500), form
  labels (600, line-height 1).
- **Label** (650, 13 px, 72 % width, capitals, 0.05em): column heads and badges.
- **Punch** (Martian Mono 400, 13 px, 75 % width, tabular and slashed-zero figures):
  every time, date and duration. Dates are ISO (2026-10-18), times 24-hour.

Text inputs use 16 px on the phone so the browser does not zoom, dropping to 15 px
on the PC. The wordmark is the printed style at 16 px with 0.08em tracking.

### Named Rules
**The Three Sizes Rule.** Working screens use 13, 15 and 22 px. Rank is made with
weight, capitals and rules, not new sizes. The only exceptions are 16 px phone inputs
and the wordmark.

**The Punch Rule.** If it is a time, date or duration, it is punched in the condensed
mono. Nothing else is.

## Layout

The PC layout is two columns: a 15 rem rack on the left at full height, and the work
area to its right (max 72 rem, 40 px side padding). Below 1024 px the rack becomes a
56 px sticky top bar (wordmark, Sign out) and the navigation moves to a fixed bottom
bar inside thumb reach; the page keeps 6 rem plus the safe area clear underneath it,
where the phone capture action will dock later.

Inside the work area, content stacks with 24 px between the title block and sections,
and 40 px between sections. On the Today screen a second 19 rem column appears from
1280 px.

Tables and forms snap to visible column grids. Ruled lines are 36 px tall with 12 px
cell padding and hairline column dividers. Forms are ruled lines too: one field per
line, 12 px above and below, with a 12 rem label column on the PC and the label
stacked above the field on the phone. The submit button lines up with the field
column.

Touch targets are 44 px on the phone and shrink to 36 px on the PC.

## Elevation & Depth

Flat. There are no shadows anywhere. Depth is shown by ink weight: the rack is the
darkest surface, the card stock is the ground, and controls sit on the slightly
lighter card face. The only box-shadow in the build is the focus ring.

### Named Rules
**The Rules-Not-Boxes Rule.** A screen region is a heading on a heavy ink rule
followed by hairline-ruled lines. Do not wrap regions in bordered or filled panels.
Bordered boxes are for controls and messages only.

## Shapes

Corners are 4 px on controls, alerts and rack items, 2 px on badges and checkboxes.
Rack items on the PC are rounded on the left only, so the current slot runs straight
into the work area. Rules are 1 px: card ink under section heads, ink stroke under
column-head bands, hairline elsewhere.

## Components

### Buttons
Firm, flat and quiet until pressed.
- **Shape:** 4 px corners, 44 px tall on the phone, 36 px on the PC, semibold 15 px.
- **Primary:** violet fill, violet-paper text. One per form. Full width on the phone.
- **Hover / Focus:** primary darkens by mixing in 18 % card ink. Focus is a 2 px
  violet ring with a 2 px gap. Press moves the button down 1 px. 150 ms ease-out.
- **Outline:** card-face fill, ink-stroke border, card-ink text; hover darkens the
  border and fills with ink wash. Used for every secondary action (Set password,
  Enable, Disable).
- **Destructive:** card-face fill, red border and text; fills red on hover.

### Chips (badges)
- **Style:** printed 13 px capitals, 20 px tall, 2 px corners, a 1 px outline and no
  fill. They read as printed marks.
- **State:** mark (card-ink outline, e.g. Admin), outline (ink-stroke outline,
  e.g. Not built yet), live (violet), spent (faded and struck through, e.g. Disabled),
  destructive (red). A spent item's own text is struck through as well.

### Inputs / Fields
- **Style:** card-face fill, 1 px ink-stroke border, 4 px corners, 44 px on the
  phone, 36 px on the PC.
- **Focus:** the border turns violet with a 2 px violet ring at 35 %.
- **Error / Disabled:** invalid fields take a red border and a 2 px red ring at 25 %;
  disabled drops to 50 % opacity.

### Messages (alerts)
Card-face fill, 4 px corners, 1 px border, 15 px text. Errors use a red border and
red text.

### In-page links
Text links inside a page (Reload, Show archived, a template name, a pointer to Setup)
are card ink, underlined, with the focus ring; never violet. Violet stays with the
primary action and focus (the Ribbon Rule).

### Undo strip
A message line under the screen title after every successful action: card-face fill,
1 px hairline border, 4 px corners. "Done:" in semibold, the action's label, any
warnings below it in red, and an outline Undo button on the right. It stays until
the next load; nothing auto-dismisses. One strip serves every screen (Today, Setup,
Templates, Entries, History). After a refused undo it is the error state: a red border at 60 % and the
core's message in red in place of "Done:", announced as an alert, with the Undo
button kept so the press can be tried again.

### Setup list
Customers and projects as one ruled list under a section head. A customer is a line
of 44 px (36 px on the PC) in semibold, a card-ink rule above each customer after
the first; its projects sit beneath indented 16 px (24 px from 640 px) on a hairline
at the left, each on its own hairline-divided line in regular weight, or "No active
projects." in faded ink. Archived and spent rows, and projects of an archived
customer, are struck through in faded ink with an Archived chip. Each line ends in
outline buttons (Rename, Archive or Unarchive; a customer also Add project). Activities
and locations are the same lines without the indent, in a second column from 1280 px.
An add line closes each region: a field and an outline Add button.

### In-place rename
A line's name is a native disclosure: closed it shows the name and an outline Rename
button; opened it takes the whole line as a field, Save (primary) and Cancel, and
focuses the field. Only one is open at a time. A refused rename reopens it with the
posted name, the field red and focused, the core's message beneath in red; a stale
row shows its message with an ink underlined Reload link instead. It needs no
JavaScript.

### Template form
The ruled form of the template screens (new and edit): a label column of 10 rem (the
entry edit screen's, not the 12 rem of the other forms) beside the field on the PC,
stacked on the phone; name, customer, project, activity, location, times, duration,
time zone with its hint, reference and description, one primary Save and an outline
Cancel. Archived current choices read "(archived)". Messages sit beneath their
fields in red; a stale save shows a red-bordered message strip with a Reload button
above the form, and Delete is a separate section with a two-step confirm.

### Template sheet
A ruled row per template (56 px, name over customer › project and punched times, a
printed Timer or Log mark, violet only for Timer) that opens in place into its form:
the template's filled fields as a two-column list, then ruled form lines and one
primary button. Only one sheet is open at a time. Works as a native disclosure
without JavaScript.

### Filter bar
The Entries screen's search, a `GET` form under a "Filters" section head, closed by
a hairline. Labels sit over their fields in a grid: one column on the phone, two from
640 px, four from 1280 px. From and To are punched date fields; Customer and Project
(grouped by customer, narrowed by the customer with JavaScript), Activity and Location
are native pickers that start with "Any" (Activity and Location then "None"), archived
rows marked "(archived)"; Text spans two columns. An outline Search button (full width
on the phone) and an ink underlined Clear link close it. A date mistake shows beneath
the dates in red, announced as an alert, and no list is shown. Copy-out uses the same
bar with its pickers inside it, a primary Show in place of Search (the screen's only
button that submits), and ink underlined "This month" and "Last month" links after
Clear.

### Selectable ruled table
The ruled table with a 44 px checkbox column first. The head checkbox selects every
row shown (indeterminate when some are) and exists only with JavaScript; without it an
ink underlined "Select all" link in the section head reloads the search with every row
checked. The section head ("Found") carries "<n> entries, <h:mm>" ("1 entry"), the
hours punched. The date is an ink underlined, punched link to the entry; a running
entry shows a printed violet "Running" and violet hours. Activity and location drop
below 1280 px; below 1024 px each row stacks beside a 20 px checkbox: date, punched
in–out and hours, then customer › project in semibold, then reference and description
in faded ink. Warnings are red chips under customer › project. Over 500 rows a faded
line says "Showing the first 500 entries; narrow the filters."; none shows "No entries
match." in faded ink with a Clear link.

### Change form
Bulk change, under a "Change selected" section head that shows "<n> selected" on the
right once the script runs. Ruled form lines with the template form's 10 rem label
column: Project ("Keep" or an active project, grouped by customer), Activity and
Location ("Keep", "None" or an active row), Reference (a field whose placeholder reads
"Blank keeps it", with a "Clear the reference" checkbox beside it, beneath it on the
phone) and Description (Find and Replace with side by side from 640 px, their labels
in regular faded ink). Then one primary "Apply to selected" and an outline "Delete
selected", lined up with the field column on the PC and sharing the width on the
phone; with JavaScript both are disabled while nothing is selected. Field messages
sit beneath their fields in red. A refusal is a red-bordered message under the form:
the entry it came from ("2026-10-07 09:00, CompA › ProjC: ") then the core's message,
with an ink underlined Reload link only when that entry was changed elsewhere. The
selection and the posted values are kept.

### Delete confirm
The first press of Delete selected asks on the page, beneath the change form between
hairlines: "Delete 2 entries?" ("Delete 1 entry?"), a red "Yes, delete them", which
takes the focus, and an outline "Keep them" that returns to the search. Delete
selected itself stays outline; only the confirming button is red.

### History list
The History screen's batches as one ruled list, grouped by day. A day head is the
date punched beside the weekday printed, on a card-ink rule. Each batch is a
hairline-divided line: a 3.5 rem column with the punched `HH:mm`, then the label in
semibold with, after it, a mark chip "Agent" or "System" when the batch was not made
in the UI and its state in faded ink ("Undone", "Partly undone, 2 of 3"); beneath
the label an underlined disclosure "3 changes" ("1 change"). Outline Undo and Redo
buttons (whichever apply, both when partly undone) sit at the line's right from
640 px, beneath the label on the phone. A fully undone batch mutes its whole line to
faded ink. Below the list, ink underlined "Newest" and "Older" links page it. None
shows "Nothing recorded yet." in faded ink on a hairline.

### Change lines
A batch's disclosure opens into its changes, each a line on a hairline above it: a
checkbox (18 px, 20 px below 1024 px) beside the change in words, the verb in
semibold (Created, Changed, Archived, Unarchived, Deleted) then the record, and for
a change one line per differing field ("Name: Acme → Acme Ltd"), long values
wrapping. An undone change is faded with a faded "Undone" after it. A batch over 100
changes drops the checkboxes and ends in a faded "and <n> more; undo or redo the
whole batch." The whole line is the checkbox's label. A native disclosure; a refusal
reopens the batches it ticked.

### Selected-changes bar
Above the History list, closed by a hairline: outline "Undo selected changes" and
"Redo selected changes", sharing the width on the phone and at their own width from
640 px, then "<n> selected" once the script runs; with JavaScript both are disabled
while nothing is ticked. A refusal shows beneath it as a red-bordered message in red,
announced as an alert, with the ticks kept.

### Column and option pickers
Copy-out's choices, inside its filter bar after the filters: two fieldsets, each a
semibold 14 px legend over one wrapping row of native checkboxes and radios (18 px,
20 px below 1024 px, violet when ticked), each choice a 44 px line on the phone and
36 px on the PC with its label beside it, 20 px apart. **Columns** lists the ten in
their fixed order; **Options** holds Round to 5 minutes, Split at midnight, then
"Duration as" with its two radios, `h:mm` and Decimal hours. No column ticked shows
"Choose at least one column." beneath the columns in red, announced as an alert.

### Result bar
Copy-out's result under a "Result" section head carrying "<n> rows, <total>" ("1
row"), the total punched. Beneath it, closed by a hairline: an outline Copy button
(only once the script runs) and an outline Download CSV link styled as a button,
sharing the width on the phone and at their own width from 640 px; Show keeps the
one primary. The copy's outcome follows on its own line in 14 px ink, announced
politely ("Copied 4 rows.", or "Copy failed; select the table and copy it."). A
faded line, closed by a hairline, says "1 running entry left out." when any were.
None shows "No entries match." in faded ink with a Clear link, as on Entries.

### Totals tables
Reports' result under a "Result" section head carrying "<n> entries, <total>" ("1
entry"), the total punched; a faded line, closed by a hairline, says "1 running entry
left out." when any were. Four tables, each under its own section head (Days, Weeks,
Customers, Projects): ruled lines of a label and a right-aligned punched duration, each
on a hairline, then a Total row at the foot under a 1 px ink rule, in semibold. The
column heads are for screen readers only. Labels wrap; Days and Weeks label their rows with dates, so those are punched (Days
reads the date beside its weekday), while Customers and Projects are plain names. The result is two columns from 1024 px, Days on the left and Weeks,
Customers and Projects stacked on the right, 40 px apart; below that one column in the
order Customers, Projects, Weeks, Days, so the short answers come first.

### Sheet table
The ruled table as the sheet it pastes into: the chosen columns as the head band, in
their fixed order, every cell exactly the value copied. Date, Start, End and Duration
are punched and never wrap; the text columns wrap, at least 7 rem wide, the
description at least 12 rem. It never stacks: at any width it scrolls sideways inside
its own box, so the phone shows the first columns and the rest are a swipe away.

### Token list
Account's Agent access, under its own section head below Change password, in the
same ruled lines and 12 rem label column on the PC. Each token is a line on a
hairline: its name in semibold in the label column, then the date it was made and its
last use punched in 12 px faded ink ("Never used", unpunched, until then),
and an outline Revoke at the right. On the phone the dates go under the name and
Revoke stays at the right of both. The first press of Revoke turns the line into the
question, as the delete confirm does: "Revoke "Laptop"?", a red "Yes, revoke", which
takes the focus, and an outline Cancel; only the confirming button is red. None shows
"No tokens yet." in faded ink on a hairline. The add line closes the section: Name in
the label column, the field, and Create token, the section's one violet primary.

### Shown-once token
A token just made sits above the list on its own ruled line: its name as the label,
the token punched (mono) in a read-only field that selects itself on focus, an
outline Copy beside it once the script runs, and under it "Copy it now: it is not
shown again." in medium 14 px ink; "Copied" follows in 14 px ink, announced politely.
No card around it and no colour: the punched token is the mark. Without JavaScript there is no
Copy button and the field is copied by hand. It is gone on the next load.

### Navigation
- **PC:** the rack. Wordmark at the top, then Today, Entries, Copy-out (a sheet
  icon), Reports (a column chart icon), Templates, Setup, History, Account (and Users for an admin), items of 40 px with a 16 px line icon and
  15 px text, the signed-in user and Sign out at the foot. Hover fills with
  rack-ink-raised. The current item is filled with card stock and card-ink text; an
  entry opened from the Entries list keeps Entries current, from Today keeps Today.
- **Phone:** a 56 px top bar with the wordmark and Sign out, and a fixed bottom bar
  (Today, Setup, Account and, for an admin, Users; the PC screens Entries,
  Copy-out, Reports, Templates and History left out) of
  equal 56 px items (20 px icon above 13 px text). The current item uses the same
  card-stock fill.

### Ruled Table (signature)
A column-head band (ink-shade fill, printed 13 px faded capitals, ink-stroke rule
below), then 36 px lines divided by hairlines. Rows wash on hover. Times and dates
in cells are punched. On the phone a table may stack each row: name and date on one
line, actions full width below.

## Do's and Don'ts

### Do:
- **Do** put every screen region under a printed section head on a 1 px card-ink rule.
- **Do** set every time, date and duration in the punch style.
- **Do** keep one violet primary button per form; use outline buttons for the rest.
- **Do** strike through spent or archived items and mark them with a spent badge.
- **Do** keep 44 px targets on the phone and the bottom bar inside thumb reach.
- **Do** keep motion to 150 ms ease-out colour changes on state, removed under reduced motion.

### Don't:
- **Don't** use neutral greys; tint the card ink instead.
- **Don't** use violet or red for decoration, headings or icons.
- **Don't** wrap screen regions in cards, panels or shadows.
- **Don't** add text sizes beyond 13, 15 and 22 px on working screens.
- **Don't** add entrance animations.
