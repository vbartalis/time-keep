---
version: 1
slug: "src-routes-app-layout-svelte"
primary_target: "src/routes/(app)/+layout.svelte"
related_targets: ["src/routes/(app)/+page.svelte","src/routes/login/+page.svelte","src/routes/layout.css"]
---

# App shell and screens

Scope: the signed-in shell (`src/routes/(app)/+layout.svelte`) with its navigation and
timer bar, and the tokens every screen inside it takes (round 2, roadmap item 11).
Mode: **Operate**. Items 12–15 build every screen inside this shell; they inherit it
rather than reopening the world. Spec:
`docs/superpowers/specs/2026-10-20-design-direction-design.md`.

Decisions below were made in the operator's place by the operator stand-in (autopilot,
2026-10-20), from three rendered options; sources in the spec's calls.

## Surface strategy

- **Audience and job:** one person; on the phone, see and stop what is running, log
  from a template, reach past entries; on the PC, organise entries, month-end, set up.
- **Task frequency:** many short visits a day on the phone; long sessions on the PC.
- **Constraints:** server-rendered forms that work without JavaScript; self-hosted
  fonts; standard web controls; English, 24-hour, ISO dates, Monday first.
- **What must stay untouched:** behaviour, routes, form fields, and the meaning of
  every label and message the e2e reads, except the navigation and Today's Timers
  section, which the shell replaces.
- **Physical scene:** a phone between tasks in daylight; a PC at a home-office desk,
  often in the evening at month-end. Light and dark both, following the device.
- **Brand commitment:** it looks and is laid out like Kimai (the operator's reference),
  with the calendar apps' colour by project. No themed concept over the tool.

## Direction round

The roll (`seed:b2cfa2c8473901f1`) assigned grounded candidate 4 of 7, a bound account
ledger; rendered as option A's first skin on Kimai's structure, beside option B (the
calendars' and trackers' look, the category standard) and option C (Kimai's sidebar
with the wall planner's colours and condensed capitals, the builder's top candidate).
The stand-in chose A and had its skin replaced by Kimai's own; the ledger lends
nothing. Declined challengers, each with what the direction keeps:

- digital-design-canon-dark-first-developer-console: declined. Kept: a destructive
  action stands apart from its neighbours.
- wayfinding-cartography-signage-midnight-transit-diagram: declined. Kept: each
  project its own named ink, the one strong colour.
- rw-lexicon-shoulder-and-plate: declined. Kept: the header names the span in view
  (the date range of a view).
- notation-diagram-systems-star-atlas: declined. Kept: one ring colour for what is
  selected.
- vernacular-ephemera-boarding-pass-and-gate-board: declined. Kept: a changed row
  stays marked until the undo strip goes.
- signals-instruments-split-flap-concourse: declined. Kept: columns never move; the
  running time changes in place in tabular figures.

## Direction contract

THESIS: time-keep is laid out and dressed like Kimai, the tool the operator knows,
with one colour per project carried through every view. It refuses a themed concept
over a working tool, and the grey SaaS dashboard of stat tiles.

OWN-WORLD: Kimai's skin. A near-black sidebar (#262626) with a blue bar on the current
item; near-white ground and white surfaces (dark: neutral near-black and dark grey);
one blue for the running timer and the one primary action; red only for irregular or
destructive; neutral greys; project colours as the only strong colour (dot, block
edge with pale fill, phone row bar, timer dot). Public Sans throughout, tabular
figures for times; 4 px corners, thin rules, no shadows but the phone's floating
controls; 12 px uppercase table heads.

STORY: the visitor recognises Kimai at a glance, sees what is running on every
screen and stops it in one press, and finds every screen one or two taps away on the
phone.

FIRST VIEWPORT: PC: a 232 px near-black sidebar (wordmark; Today, Entries, Copy-out,
Reports, Templates, Setup, History, Account, Users and Backup for an admin; user and
Sign out at its foot); a 60 px white header with the screen's title left and the timer
bar right (blue live dot, ticking elapsed time, project dot, customer › project,
activity and description, Stop); the screen below on the ground. Phone: a near-black
top bar with the screen's title (the page's one h1; the wordmark is the PC's), a near-black timer strip under it (project, activity and
start, elapsed, Stop), one column, and a bottom bar with Today, Entries, Templates and
More (a sheet with the rest).

FORM: Kimai's structure in Kimai's skin (option A, revised); the roll's candidate 4
of 7 (the ledger) supplied only the first skin, removed; seed:b2cfa2c8473901f1.
Signature move: a project's colour follows its time everywhere, from the timer bar's
dot to the table's dot to the calendar block's edge and fill to the phone row's bar.
Motion grammar: 150 ms ease-out colour changes on state only; the elapsed time ticks
in place; reduced motion removes transitions.

Raises from declined challengers, each its own line:
- Raise (developer console): destructive actions are separated by space from their
  neighbours.
- Raise (transit diagram): each project is one named ink, used identically wherever
  its time appears.
- Raise (lexicon page): a view's header names the span in view. Deferred to items 13-14 (the calendar and table views); item 11's titles are fixed screen names.
- Raise (star atlas): one ring colour marks what is selected.
- Raise (boarding pass and gate board): a just-changed row stays marked while its undo
  is offered.
- Raise (split-flap board): columns never move; figures are tabular so the running
  time changes in place.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- A chosen colour per project in Setup (now assigned automatically).
- Item 12 adds start, restart and templates to the timer bar, and "+ New entry".
- Item 13 adds Calendar to both navigations.
