# The phone's timer strip with several timers running — design

Roadmap item 20. Written 2026-10-22 in an autopilot design session; the operator
stand-in answered in the operator's place (see the last section).

## Intent

The phone's timer strip is how the operator sees, at a glance and between tasks, what
is running and for how long. The usability check (item 16, first run, gate task 3 at
390 px) found that it no longer says which project runs: with two timers the "+1"
takes the room the name had, and the strip shows "CompX › …" or "Myself › ti…". With
one timer on CompX › ClientY – ProjectZ the name is cut too ("CompX › ClientY – Pr…"),
since the 64 px row gives the name about 105 px beside the elapsed time, ▶ and Stop.
Two CompX projects can run at once, so "CompX › …" does not say which one is billed.

This item gives the name the room it needs. It is a layout change to one component,
the phone strip, and the list its "+N" opens. Nothing about timers' behaviour changes.

## What the strip shows, after this item

The strip is **two rows** whenever a timer runs, the same layout for one, two or
three timers (with one, "+N" is absent):

- **Row 1:** the live dot, the project dot, **customer › project** in 15 px semibold,
  and the **elapsed time** in 17 px bold at the right edge. The name has the full
  width left beside the dots and the elapsed time (about 250 px at 390 px), so the
  seeded names fit on one line. A name longer than that **wraps onto further lines**,
  breaking between words, and the strip grows to hold it; it is never cut to "…". The
  elapsed time stays on the name's first line.
- **Row 2:** "activity · since HH:MM" (with the date when the timer began on an
  earlier day, as today) at the left, under the name; "+N", ▶ and Stop at the right,
  each 44 px, in today's order and look.

With **no timer running** the strip stays as today: one 64 px row, "No timer running"
and the ▶ alone (builder's call 6).

The **"+N" list** of the other running timers keeps its place (dropping from under
the strip over the page) and its rows (project dot, name over "activity · since",
the elapsed time, Stop), with one change: each row's name is **customer › project**,
not the project alone, and it wraps rather than being cut, as in row 1.

Nothing else changes: what the name and elapsed time link to (the running entry's
form, opened over the screen), Stop's form and the `s` key's target
(`data-shown-stop`), the start sheet, the strip's colours, the newest running timer
being the one shown, and the screen reader text. The PC header pill is not touched.

Mockups at 390 px, light and dark, on a seeded month with three timers:
`.autopilot/screenshots/20/design/optA-three-390-{light,dark}.png` and, with the "+2"
list open, `optA-three-open-390-{light,dark}.png`. Today's strip for comparison:
`now-one-390-light.png`, `now-two-390-light.png`, `now-three-390-{light,dark}.png`.
The mockups were made by rearranging the live page; the build fixes spacing to the
4 px grid (see Builder's latitude).

## The reference each part follows

- **Follows** Kimai, Toggl and Clockify (study, Timers 1): the running timer is always
  on screen with its elapsed time and stops in one tap.
- **Follows** the study's adaptation of Kimai's above-one display (Timers 2): one
  running timer shown in full and a count that opens the rest. The rest now read as
  fully as the shown one.
- **Departs** from Clockify's phone, which pins the running timer at the bottom: the
  strip stays under the top bar, as items 11 and 12 placed it.
- **Departs** from today's DESIGN.md "Phone strip" (one 64 px row): the strip is two
  rows while a timer runs. DESIGN.md is updated with the build.

## Goals

- At 390 px, in light and dark, with one, two or three timers on the seeded projects,
  the strip shows the shown timer's customer › project in full, and the "+N" list
  shows each other timer's customer › project in full.
- The strip reads as today's strip with the name given room: the same order, colours
  and controls.

## Non-goals

- The PC header pill and its list (its name has 28 rem; the usability check found no
  fault there).
- Any change to which timer is shown, to starting, stopping or the start sheet.
- Showing the description in the strip.

## Anti-goals

- A name cut to "…" anywhere in the strip or its list.
- A strip that jumps between layouts when a second timer starts.
- A control smaller than 44 px, or "+N", ▶ and Stop moving out of thumb reach.
- Content under the strip hidden by it: the sticky band, the bands pinned under it
  (`--bars-height`) and focus scrolling (`scroll-margin-top`) all clear the taller
  strip.

## Constraints

- Works without JavaScript, as today: the layout is CSS; the "+N" list and the start
  sheet stay `<details>`.
- The name and elapsed time stay one link to the running entry's form, a target at
  least 44 px tall (PRODUCT.md's touch floor), as today's link is.
- `main * { scroll-margin-top }` in `src/routes/layout.css` is a measured constant of
  the phone's sticky top (top bar plus strip, 120 px today). It must clear the strip's
  new height, a wrapped name included (builder's call 8); the comment's measurement is
  updated with it.
- The phone start sheet's height (`max-h-[calc(100dvh-8rem)]`, sized to today's top
  band) must keep the ▶ that closes it uncovered under the taller strip (builder's
  call 7).
- Tests first (TDD): the component's unit tests for the full names in the strip and
  the list; an e2e at 390 px for one, two and three timers asserting no name is cut
  (the name's box is not narrower than its text: `scrollWidth <= clientWidth`; no
  ellipsis, no line clamp, not clipped in height: builder's call 9) and that the
  controls stay 44 px.
- `docs/app.md` (Timer bar) and DESIGN.md ("Phone strip", and the strip-phone size
  token) are updated with the build.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`), signed in as the seeded user, at 390 px
in light and in dark; task 7 also at 1440 px. Each sequence starts with no timer
running.

1. **One timer.** From the strip's ▶ › "Start on a project…", start a timer on
   CompX › ClientY – ProjectZ, Research. The strip shows "CompX › ClientY – ProjectZ"
   in full, the elapsed time ticking, "Research · since HH:MM", ▶ and Stop.
2. **Two timers.** Start a second on CompX › CompY – Support, Support ticket. The strip
   shows "CompX › CompY – Support" in full and "+1". Open "+1": the list shows
   "CompX › ClientY – ProjectZ" in full, with its elapsed time and Stop.
3. **Three timers.** Start a third on Myself › time-keep, Development. The strip shows
   "Myself › time-keep" and "+2"; the list shows both others in full. Close it.
4. **Stop and Undo.** Stop the shown timer from the strip: the strip shows the next
   newest timer's customer › project in full. Undo: the stopped one is shown again.
5. **The form.** Tap the strip's name: the running timer's form opens over the screen;
   Cancel closes it.
6. **A long name.** In Setup, rename ClientY – ProjectZ to
   "ClientY – ProjectZ – Phase 2 data migration and reporting". With its timer shown
   (stop the newer ones, or start a new one on it), the strip shows the whole name,
   wrapped, nothing cut, the elapsed time beside its first line; in the "+N" list too
   when another timer is newer.
7. **Nothing hidden.** With two timers running, on Entries, scroll down: the bands
   pinned under the strip sit under it, not behind it; tab to a row's control: it is
   not hidden under the strip. At 1440 px the PC header pill still shows the timers as
   before.

## Builder's latitude

- The exact spacing (on the 4 px grid: about 8 px padding above and below, a small gap
  between the rows) and how row 1 and row 2 are built (grid or flex), as long as row 2's
  text sits under the name and the controls are at the right.
- How the link covers a 44 px target (for example spanning the name and the
  "activity · since" line), as long as tapping the name or the elapsed time opens the
  form and the controls stay separate targets.
- Whether `scroll-margin-top` becomes a measured variable (like `--bars-height`) or a
  new constant, as long as it clears the strip.
- The impeccable pass for this item: build to this layout, then critique and audit the
  strip at 390 px in both themes; no new direction work.

## Calls made in the operator's place

The stand-in's answers (`.autopilot/agents/20-standin-q1.md`):

1. **The strip must say which project each timer is on (customer › project, readable)
   and how long it has run;** "CompX › …" is the wince, since two CompX projects can
   run. Source: roadmap item 20; operator's voice (the phone for quick capture; the
   chain in the project name); DESIGN.md, Phone strip. Confidence: inferred.
2. **Two rows (option A):** name and elapsed time on top, "activity · since" and the
   controls below. Option B (the name wrapping beside the controls, the elapsed time
   under it) looked messy; keeping 64 px and cutting fails the exit. Source: roadmap
   item 20's exit; operator's voice ("horrendous" round 1 look); the mockups.
   Confidence: ungrounded; queued in `docs/questions.md`.
3. **The "+N" list shows customer › project,** not the project alone. Source:
   operator's voice (customer › project naming); DESIGN.md, Phone strip; item 20's
   exit ("each shown timer"). Confidence: inferred.
4. **The same layout for one timer as for several,** "+N" absent, so the strip does not
   jump when a second timer starts. Source: item 20's exit (one, two and three
   timers). Confidence: ungrounded; queued with call 2.
5. **A name too long for the full width wraps onto further lines;** the strip grows;
   it is never cut. Source: item 20's exit ("not cut to '…'"). Confidence: inferred;
   queued with call 2.

The builder's calls:

6. **With no timer running the strip stays one 64 px row** ("No timer running" and
   ▶): there is no name to give room to, and a two-row strip with an empty row would
   take height for nothing. The strip changes height when the first timer starts, as
   it changes content today. (Builder's call.)
7. **The start sheet's maximum height follows the measured top band**
   (`--bars-height`), with a constant for the two-row strip as the fallback without
   JavaScript, so a long template list never covers the ▶ in row 2. It keeps today's
   behaviour under the new height; it is not a design change. (Builder's call, from
   the builder check.)
8. **Focus scrolling clears the measured band** (`--bars-height`) where it is known,
   with a constant for the two-row strip with a one-line name as the fallback, so a
   wrapped name does not hide a focused control. (Builder's call, from the builder
   check.)
9. **"Not cut" is tested in both directions:** the name's element has no ellipsis or
   line clamp, and is neither narrower nor shorter than its content. (Builder's call,
   from the builder check.)

Approved by the operator stand-in, revision 1, 2026-10-22.
