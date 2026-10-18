---
version: 1
slug: "src-routes-app-layout-svelte"
primary_target: "src/routes/(app)/+layout.svelte"
related_targets: ["src/routes/(app)/+page.svelte","src/routes/login/+page.svelte","src/routes/(app)/account/+page.svelte","src/routes/(app)/admin/users/+page.svelte"]
---

# App shell and screens

Scope: the signed-in shell (`src/routes/(app)/+layout.svelte`) and every screen it
holds today (home, account, admin/users), plus the sign-in page. Mode: **Operate**.
Phases 4–6 build inside this shell; they inherit it rather than reopening the world.

Decisions below were made in the operator's place (operator, 2026-10-18: "as for
design we have impeccable, they can do it"). Every one is an **inferred call**.

## Surface strategy

- **Audience and job:** one person; on the phone, start a timer or log from a template
  in seconds; on the PC, organise reference data, correct entries in bulk, month-end.
- **Task frequency:** many short visits a day on the phone; long sessions on the PC.
- **Constraints:** server-rendered forms that work without JavaScript; self-hosted
  fonts; standard web controls; English, 24-hour, ISO dates, Monday first.
- **What must stay untouched:** behaviour, routes, form fields and the meaning of every
  label and message (the e2e reads them).
- **Physical scene:** one person logging time on a phone between tasks, at a client's
  desk or in a café, usually in daylight; and on a PC at a home-office desk, often in
  the evening at month-end. Light is the default for daylight glances; dark follows
  the device setting for evening desk work.

## Direction round (inferred calls, no human gate)

Grounded list, ordered by resonance before the roll: 1 bound accountant's ledger,
2 European rail timetable, 3 pilot's logbook, 4 carbon duplicate book, 5 Swiss
typographic style, 6 surveyor's field book, 7 punch-clock time card. The roll
assigned 7. Pick (not built): the ledger, the most familiar reading of "nothing is
lost". Verdicts on the dealt challengers, fused and weighed on audience
identification and product clarity:

- ikeda-datamatics: declined. Kept: total palette economy.
- digital-design-canon-metro-typographic-tiles: declined (phone-only clarity, fails
  PC density). Kept: type, not chrome, carries rank.
- rw-timetable-slide-rack: declined (the rake obscures the task). Kept: a short
  type scale, rank by weight, case and rule.
- rw-centre-rail-reference-setting: declined. Kept: states as printed marks.
- wayfinding-cartography-signage-terminal-yellow-wayfinding: declined. Kept: one
  colour reserved for one job.
- crouwel-grid-specimen: declined. Kept: the grid stays visible as rules.

## Direction contract

THESIS: time-keep is a punch-clock time card: every time is a punch in a fixed column,
the week runs Monday first down the card, and an irregular punch prints red. It refuses
the category default of a grey SaaS dashboard with stat tiles and an indigo accent.

OWN-WORLD: blue time-card stock as the ground (alternate pay-period cards were blue),
printed in blue-black card ink with hairline rules; the shell is the time rack, a
deep card-ink rail; clock-ribbon violet marks only what is live or the one primary
action; clock-ribbon red marks only what is irregular or destructive. Archivo for all
UI, its condensed width for printed column heads; Martian Mono, condensed, only for
punched times, dates and durations. Corners 4 px, no shadows, rules not boxes.

STORY: the visitor sees where they are and what is next at a glance, trusts that
nothing is hidden, acts with one thumb on the phone and reads dense ruled tables on
the PC.

FIRST VIEWPORT: PC: a 15 rem card-ink rack on the left (wordmark, Today, Account,
Users for admins, then the signed-in user and Sign out at its foot); the work area on
the card ground with "Today" and the timers and today's entries as ruled sections,
and a second column naming the PC work still to come (entries, reference data,
history), each marked not built yet. Phone: a slim top bar (wordmark, Sign out), one
column, and a bottom navigation bar inside thumb reach; phase 4's capture action
docks directly above it.

FORM: punch-clock time card, candidate 7 of 7; seed:533bf091bc99726f. Signature
move: punched times, every time, date and duration set in the condensed mono on the
card's column rhythm, violet while running, red when irregular, ink when settled; and
the current screen is the card in the rack (the active rail item is a filled card
slot). Motion grammar: 150 ms ease-out colour and position changes on state only;
no entrance choreography; reduced motion removes it.

Raises from declined challengers, each its own line:
- Raise (ikeda-datamatics): four inks only, card ground, card ink, violet, red; greys
  are tints of the card ink, never neutral grey.
- Raise (metro tiles): no decorative chrome; a rule replaces a box wherever a rule
  suffices.
- Raise (timetable slide rack): three text sizes on the working screens; rank is weight,
  case and rule.
- Raise (centre-rail reference): state vocabulary as printed marks; spent or archived
  is struck through, irregular is red, live is violet.
- Raise (terminal yellow wayfinding): violet means live or primary, nothing else.
- Raise (Crouwel grid): tables and forms snap to one column grid whose rules are
  visible.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Where today's date comes from (the deferred UTC issue in the roadmap) before a
  header date or week strip can be shown.
- Phase 4 decides the capture action's exact form above the bottom bar.
