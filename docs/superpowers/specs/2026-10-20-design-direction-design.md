# Design direction, round 2 — design

Approved by the operator stand-in, revision 1, 2026-10-20.

Roadmap item 11. Written 2026-10-20 in an autopilot design session; the operator
stand-in answered in the operator's place (see the last section).

## Intent

Round 1's look, decision 5's punch-clock time card, was judged by the operator
"horrendous" in "ui and theaming", and its layout "nothing like kimai"
([operator's voice](../../operator-voice.md), 2026-10-19). This item replaces the look
and the shell: a new direction chosen from rendered options, its tokens in Tailwind
and shadcn-svelte, light and dark, type, density on the PC and touch sizes on the
phone, navigation on both surfaces, and a timer bar always on screen. Items 12–15 build
every screen inside this shell and in this direction, so this item sets what they
inherit.

## The direction: Kimai's structure in Kimai's skin

Three options were rendered and the stand-in chose **option A**, Kimai's structure, and
had its skin pulled back to Kimai's own: neutral grounds, a near-black sidebar, one blue,
plain bold totals. The renders are in
[`2026-10-20-design-direction/`](2026-10-20-design-direction/): `A-*`, `B-*`, `C-*`
are the three options as shown, `A2-*` is the chosen one as revised; each in `table`
(the PC Entries table, 1440×900), `week` (the PC week calendar, 1440×900) and `phone`
(the phone's Today, 390×844), `light` and `dark`.

- **Option A**, Kimai's structure in a new skin (a ledger's green-grey stock, bottle-green
  sidebar, double-ruled totals). **Chosen, revised to Kimai's skin.**
- **Option B**, the calendars' and trackers' look played straight (white chrome, a light
  sidebar, solid saturated blocks, the timer bar across the top of the content, Roboto).
  Not chosen: it leaves Kimai's sidebar and header, and its blocks are loud.
- **Option C**, a mix (Kimai's sidebar, pastel blocks with a strong edge, condensed
  capitals, a red-tinted timer strip). Not chosen: its capitals are a theme over Kimai,
  and its running timer is the red that means an overlap.

What the direction is, as built (the `A2-*` renders are the composition the build
matches):

- **Palette.** Restrained, Kimai's: a near-white ground and white surfaces in light; a
  neutral near-black ground and dark-grey surfaces in dark. The sidebar is near-black
  (Kimai's `#262626`) in both themes, with a blue bar on the current item. **One blue**
  carries the running timer and the one primary action on a screen. **Red** means only
  what is irregular or destructive (an overlap, a refusal, a delete). Greys are
  neutral.
- **Project colour is the one strong colour**, and it follows the project's time
  everywhere: the dot beside its name, the edge and pale fill of its calendar block,
  the bar at the left of its phone row, the dot in the timer bar. A fixed palette of
  project colours, each a strong edge, a pale fill and a readable text colour, in light
  and dark. This is the direction's signature: the time of one project reads as one
  colour from the bar to the table to the calendar. In this item it shows only in the
  timer bar; the palette is a set of tokens that items 12–15 use as they rebuild each
  screen. The colour is derived, not stored: a project takes the palette colour at its
  position among the user's projects in the order they were created (projects are
  never deleted, so the position never changes), which keeps a user's projects distinct
  until the palette runs out, then repeats.
- **Type.** Public Sans, self-hosted (`@fontsource-variable/public-sans`), for
  everything; times, dates and durations in its tabular figures. Archivo and Martian
  Mono go. Page titles about 21 px semibold; body 14 px on the PC, 15 px on the phone;
  table heads 12 px uppercase, as Kimai's.
- **Density.** PC: table rows about 40 px (Kimai's are 46), a 232 px sidebar, a 60 px
  header. Phone: every control at least 44 px, rows about 60 px. No density setting.
- **Shape.** 4 px corners, thin rules, no shadows except the phone's floating controls.
- **Light and dark** follow the device setting; there is no in-app choice.

The renders also show the calendar views and a "+ New entry" action; those are items
12 and 13 and are not built here (see Non-goals).

## The shell

### PC (from 1024 px, round 1's `lg` breakpoint)

- **Sidebar, left, full height, fixed width.** The wordmark at the top, then the
  screens in this order: Today, Entries, Copy-out, Reports, Templates, Setup, History,
  Account, and for an admin Users and Backup. The current one has the blue bar and a
  darker fill. At its foot: the signed-in user's name and Sign out. The sidebar stays
  in place while the content scrolls, and scrolls on its own if the window is shorter
  than its list (round 1's rail that stops at the screen's height is gone).
- **Header, across the top of the content.** The screen's title at the left, as the
  page's one `h1`; the **timer bar** at the right (where Kimai has its ▶ 0:00). The
  title moves out of each screen into the shell: each screen's own `h1` goes, and the
  shell names the screen (from the route).
- **Content** below the header, on the ground, in the screen's own layout.

### Phone (below 1024 px)

- **Top bar**, near-black like the sidebar: the screen's title (the same `h1`), as
  Kimai's phone bar shows the page title. The wordmark is not repeated on the phone.
- **Timer strip** directly under it, near-black, full width: the timer bar's phone form.
- **Content**, one column.
- **Bottom bar**, fixed, inside thumb reach: Today, Entries, Templates, More. "More"
  opens the rest (Setup, Copy-out, Reports, History, Account, Users and Backup for an
  admin, Sign out) as a sheet over the page, never a menu that pushes the page down.
  Every screen is reachable within two taps.
- Calendar joins the bottom bar when item 13 builds it (between Today and Entries).

### The timer bar

On every signed-in screen, on both surfaces:

- **One running timer:** a blue live dot, the elapsed time (ticking each second with
  JavaScript, the server's value without), the project's colour dot, customer ›
  project, activity and description (truncated to fit), and **Stop**. On the phone
  the strip shows project, activity and start time, the elapsed time and Stop.
- **Several running:** the most recently started one in full, and a "+N" control that
  opens the others (each with its elapsed time and Stop). Works without JavaScript.
- **None running:** the bar says "No timer running" and takes no more room than with
  one. (Starting is item 12's.)
- **Stop** stops that timer in one press, returns to the same screen, and offers Undo
  there, on every screen, including those that have no undo strip of their own today
  (Copy-out, Reports, Account). A refused stop shows its message in the bar.
- Today's **Timers** section goes: the bar is where running timers live. The rest of
  Today stays as it is.

Every control in the shell works without JavaScript, as round 1's screens do.

## The screens inside the shell

They take the new tokens (colours, type, corners) and keep round 1's layouts until
item 15. Only what the new tokens or the new shell break is fixed here: unreadable
contrast, something hidden behind the bar or the bottom bar, a control the new shell
covers. No screen is redesigned. The sign-in page takes the tokens too and is redone in
item 15. Round 1's punch-card marks (blue card stock, violet, condensed mono, printed
condensed capitals) are gone from every screen.

The two round 1 utility classes are renamed for what they now are: `punch` (a time,
date or duration) becomes `figures`, Public Sans tabular figures; `printed` (a column
head) becomes `caps`, the 12 px uppercase label. `text-live` stays, now the blue;
`text-irregular` stays the red.

## The reference each part follows

From [the reference study](../../reference-study.md):

- **Kimai's structure** (Look and layout, option 1): the dark sidebar, the header with
  the title and the timer at its right, the near-white ground, one blue. Follow.
- **The timer always on screen** (Timers 1: Kimai, Toggl, Clockify). Follow.
- **Several timers as one plus a count** (Timers 2). Adapt: Kimai shows one, Toggl
  one at a time; time-keep runs several.
- **Bottom navigation on the phone** (Phone against desktop 5, Toggl). Adapt: the main
  views at the bottom, the rest behind More. **Reject** Kimai's ☰ that pushes the page
  down.
- **No floating help button** (Phone against desktop 7). Reject.
- **Colour by project, not one grey** (Views 3; Look and layout 4). Follow the
  calendars; Kimai's dots.
- **A PC density and a touch density, no setting; light and dark** (Look and layout 4).
  Follow.
- **The phone opens on Today** (Phone against desktop 1). Follow.

## Goals

- The direction, recorded: a decision record that supersedes decision 5; `PRODUCT.md`
  and `DESIGN.md` with its sidecar (`.impeccable/design.json`) rewritten from what
  ships; the shell's surface brief (`.impeccable/surfaces/`) with the new direction
  contract.
- The tokens in `src/routes/layout.css` (Tailwind theme and shadcn variables), light
  and dark, and the project colour palette.
- The shell above, on phone and PC, with the timer bar.
- `docs/app.md` updated for the shell, the timer bar and Today.

## Non-goals

- Starting, restarting, templates or recents in the timer bar; the "+ New entry"
  action and the entry form (item 12).
- The calendar views and their navigation item (item 13); the table (item 14).
- Redesigning any screen, the sign-in page included (item 15).
- An in-app light, dark or automatic choice.
- Project colour on the screens' rows (items 12–15 add it as they rebuild them).
- A colour stored on a project or chosen in Setup.

## Anti-goals

- A themed concept laid over the working tool (round 1's punch card; option C's
  capitals). The world lends nothing but Kimai's skin and the project colours.
- Red for anything that is merely running.
- A placeholder: no "not built yet", no link to a screen that does not exist, no dead
  button.
- A phone that cannot reach a screen the PC can.

## Constraints

- SvelteKit with server-rendered forms; everything works without JavaScript where
  round 1 does (PRODUCT.md).
- Tailwind and shadcn-svelte, components in the repo (decision 2). Fonts self-hosted,
  from npm.
- WCAG 2.2 AA contrast in both themes; keyboard access with a visible focus; 44 px
  touch targets on the phone.
- English, 24-hour clock, ISO dates, Monday first.
- The e2e suite reads labels and roles; tests that pin round 1's navigation (the phone
  bar without Copy-out, Reports or History; the Timers section on Today) change with
  the shell, the rest keep passing.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`; nothing seeded today), signed in as the
seeded user, at 390 px and 1440 px, in light and in dark:

1. From Today, open every screen from the navigation: on the PC, Today, Entries,
   Copy-out, Reports, Templates, Setup, History and Account from the sidebar, each shown
   as current when open; on the phone, Today, Entries and Templates from the bottom bar
   and Setup, Copy-out, Reports, History and Account through More, each within two taps.
   Sign out is reachable on both. Signed in as the admin, Users and Backup are there
   too (the sidebar on the PC, More on the phone).
2. With no timer running, every screen's timer bar says no timer is running.
3. On Today, start a timer on CompX › ClientY - ProjectZ (Today's "Start a timer"). Open
   Reports: the bar shows it with its elapsed time counting up. Stop it from the bar on
   Reports: the screen stays Reports and offers Undo; undo it, and the bar shows it
   running again. Stop it again.
4. Start two timers, on CompX › ClientY - ProjectZ and on Myself › time-keep. On Entries,
   the bar shows the newer one and that one more is running; open the other from the bar
   and stop it there, leaving the newer one running. Stop that one too.
5. Read the seeded month on Entries and open one entry's edit screen: everything is
   readable in both themes, nothing is covered by the timer bar or the phone's bottom
   bar, and the save button is reachable.
6. On the PC, with the keyboard only, Tab from the top of Today to the sidebar's links
   and to the timer bar's Stop (with a timer running): the focus is visible on each.
7. Look at every screen in both themes: the look is Kimai's (near-black sidebar,
   near-white or near-black ground, one blue), with none of round 1's blue card stock,
   violet or condensed mono; running is blue, never red; overlaps are red; the timer
   bar shows the running project's colour, and two running timers on different
   projects show different colours.

## Builder's latitude

The plan decides, within the above: the exact token values (from the `A2` renders,
checked for contrast), the project palette's hues and how many, the Stop action's
route and how the shell carries the undo strip, the More sheet's mechanism, and the
component structure of the shell.

## Calls made in the operator's place

The stand-in's answers, each settling a choice:

1. **The direction is option A, Kimai's structure.** Source: operator's voice,
   2026-10-19 ("nothing like kimai"; the calendars as "good inspiration materials …
   in terms of design"; "ui and theaming … horrendous"); reference study, Look and
   layout. Confidence: inferred.
2. **A's skin is Kimai's, not the ledger's:** neutral grounds, a near-black sidebar,
   plain bold totals; nothing taken from B, and nothing else from C. Source: reference
   study, Look and layout (Kimai's colours). Confidence: ungrounded, queued.
3. **Item 11's timer bar shows and stops the running timers;** starting and restarting
   are item 12's. Not an empty slot (the placeholder item 17 removed). Source: roadmap
   items 11, 12, 17; reference study, Timers 1. Confidence: inferred.
4. **The navigation lists only screens that exist,** with room for Calendar and the
   table later; no dead links and no "not built" marks. Source: roadmap items 13, 14,
   17. Confidence: inferred.
5. **The phone's split is the builder's, from the study:** main views at the bottom,
   the rest behind More, the phone opening on Today, everything reachable, no ☰ that
   pushes the page down. Source: reference study, Phone against desktop 1 and 5;
   operator's voice, discovery 2026-10-18. Confidence: inferred.
6. **Light and dark follow the device only.** Source: none on record; the smaller
   change. Confidence: ungrounded, queued.
7. **The screens take the new tokens and keep their layouts until item 15;** only what
   the tokens or the shell break is fixed. Source: roadmap items 11, 15, "How an item is
   worked". Confidence: inferred.
8. **The sign-in page is item 15's.** Source: roadmap item 15 ("and the login").
   Confidence: grounded.
9. **What makes a look feel wrong:** "nothing like kimai", round 1's punch card, unlike
   the calendars named, a weak phone; a themed concept over a working tool. Nothing more
   on record. Confidence: grounded for the quotes, ungrounded beyond, queued.

10. **Project colour shows only in the shell in this item** (the timer bar's dot); the
    palette is tokens for items 12–15. Source: roadmap items 11, 14, 15; this spec's
    "The screens inside the shell". Confidence: inferred.
11. **A project's colour is derived, nothing stored;** two projects may share one once
    the palette runs out; the assignment stable and spread across the palette, not a
    hash. Source: vision, principle 4 and "Customers and projects"; operator's voice,
    2026-10-19 ("about the backend. i believe that should be mostly ok").
    Confidence: ungrounded, queued.

The builder's:

12. **Impeccable's direction roll ran; the brief bounded it.** The roll
    (`seed:b2cfa2c8473901f1`) assigned the fourth of seven grounded candidates, a bound
    account ledger, which became option A's first skin; its six catalog challengers
    (developer console, transit diagram, lexicon page, star atlas, boarding pass and gate
    board, split-flap board) were declined on audience identification and product
    clarity against an operator who asked for Kimai and the calendar apps. The study's
    three options were the rendered set: A carried the roll's world on Kimai's
    structure, C the builder's top candidate (an office wall planner's sticker colours),
    B the category standard. The stand-in's revision removed the ledger's skin, so the
    world lends only Kimai's skin and the project colours. Impeccable's decision page
    was not used (no live browser in an unattended run); screenshots went to the
    stand-in.
13. **The mockups showed Calendar in the navigation and "+ New entry";** neither is
    built here (call 4, Non-goals).
14. **The bottom bar is Today, Entries, Templates, More,** as rendered; Calendar joins
    in item 13. Templates stays one tap away because it is the fast path to capture.
15. **Today's Timers section is removed;** the bar replaces it (call 3: the bar "moves
    what Today's Timers section does now").
16. **Several timers show as the newest plus a count** (Timers 2), built here, since
    the bar must show every running timer and item 12 starts them.
17. **Stop offers Undo on every screen,** including those without their own strip.
18. **`punch` and `printed` are renamed** `figures` and `caps`, so the new
    `DESIGN.md` does not carry the old world's words.
19. **The colour's position rule:** a project's place in the user's projects by
    creation order picks its palette colour (call 11 asks for stable and spread).
20. **Breakpoint:** the PC shell from 1024 px, as round 1's `lg`.
21. **The title moves into the shell** (the PC header, the phone's top bar), as the
    page's one `h1`; each screen's own `h1` goes (builder check, question 3). Kimai
    shows the page title in its header and its phone bar. On the phone this departs
    from the `A2` render, which kept the wordmark in the bar and the title in the content.

22. **The approval's notes, applied after it:** the surface brief's phone top bar names
    the title, not the wordmark; gate task 1 adds Users and Backup, signed in as the
    admin. The running timer stays blue, against Kimai's red stop, under call 2.

Questions queued in `docs/questions.md` this session: the skin (call 2), light and
dark (call 6), what makes a look feel wrong (call 9), where a project's colour comes
from (call 11).
