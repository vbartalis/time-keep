# Item 17, Today's placeholder panel — design

Approved by the operator stand-in, revision 1, 2026-10-19.

Date: 2026-10-19. Roadmap item 17, the autopilot's dry run. Written in an autopilot
design session; the operator stand-in answered in the operator's place.

## Intent

Today still shows "At the desk" with a "Not built yet" badge: a list of four regions
(Entries, Customers/projects/activities/locations, Templates, History) that round 1
planned for later phases. All four have since been built as their own screens, so the
panel now describes features as missing when they are there. Removing it is a small,
real screen change. It proves the autopilot end to end (design session, build
session, gate, finish) before round 2's real work.

Roadmap exit: the usability gate passes Today with the panel gone and nothing else
changed.

## Goals

- The "At the desk" panel (its heading, its "Not built yet" badge and its four rows)
  is no longer on Today, on the phone or the PC.
- Everything else on Today looks and works as before, on both surfaces and in both
  themes: the heading block, the undo strip, Timers, Templates, Start a timer and
  Today's entries.

## Non-goals

- No other change to Today or to any other screen. The phone's bottom bar, the look,
  and the layout of the remaining sections all stay as they are; items 11, 12 and 15
  redo Today.
- Nothing takes the panel's place.

## Anti-goals

- The main column getting wider or moving on the PC. That would change more than the
  panel and fail the exit.

## The change

- `src/routes/(app)/+page.svelte`: delete the `<section aria-labelledby="desk-heading">`,
  the `desk` array and its comment, and the `Badge` import that only the panel used.
- **PC layout:** the two-column grid wrapper
  (`grid gap-10 xl:grid-cols-[minmax(0,1fr)_19rem]`) stays as it is, so on wide
  screens the main column keeps its width and position and the side track is left
  empty. (Stand-in call 1.)
- **Phone:** the panel was the last block of the single column; the column now ends
  with Today's entries.
- `docs/app.md`, Today: "one column on the phone (the PC adds a side column)" becomes
  an accurate description of the layout: one column, with the PC keeping it at the
  width it had beside the removed side column.

## Reference behaviour

Item 10's study does not exist yet. Kimai's dashboard and the calendar apps the vision
names show no "coming soon" placeholders for features, and Today now does the same.
Nothing else on the screen departs from or follows a new reference; the redesign
against references is items 11–15.

## Tests

- An end-to-end assertion on Today (phone and PC widths, in `e2e/phone.test.ts` or
  beside the existing Today coverage) that no "At the desk" heading and no "Not built
  yet" text is shown, and that Timers, Templates, Start a timer and Today's entries
  still are.
- The existing unit and end-to-end suites stay green unchanged.

## Gate tasks

On the seeded month, signed in as the seeded user, at 390 px and 1440 px, in light and
dark:

1. Open Today and confirm there is no "At the desk" panel and no "Not built yet"
   badge anywhere on the page.
2. Confirm the rest of Today is unchanged and still works: start a timer on
   CompX › ClientY – ProjectZ with the description "Reviewing the ticket queue", see
   it under Timers and under Today's entries, then stop it.
3. Log the Standup template from Today's Templates and see the entry under Today's
   entries; undo it from the undo strip.
4. On the PC, confirm the main column has the width and position it had before (it
   does not stretch into the space the panel used); see
   `.autopilot/screenshots/17/design/current-1440.png` (before) and
   `option-a-1440.png` (after).

## Calls made in the operator's place

1. **PC layout once the panel is gone: keep the two-column grid with the side track
   empty** (option A; rejected: a single column filling the width (B), and a single
   column capped at the old width (C)). B widens the timers, templates, form and
   entries and so changes more than the panel; A and C render the same and A touches
   no layout code. Source: `docs/roadmap.md` item 17 ("Remove the 'At the desk — not
   built yet' panel from Today, on phone and PC." / "Exit: … with the panel gone and
   nothing else changed."), plus the stand-in's smaller-change rule. Confidence:
   inferred. Stand-in.
2. **Nothing takes the panel's place.** Source: `docs/roadmap.md` item 17 ("Remove the
   … panel", "nothing else changed"). Confidence: grounded. Stand-in.
3. **Nothing else on Today changes, on either surface.** Things noticed along the way
   (for example the phone's fixed bottom bar over the form in full-page captures) are
   left to the round 2 items that rebuild Today. Source: `docs/roadmap.md` item 17
   ("A small real screen unit that proves the autopilot end to end", "nothing else
   changed"), and "How an item is worked" (fix in the item only what its exit needs
   or what is small and inside its scope). Confidence: grounded. Stand-in.
4. **Size: a project with a written design and plan**, though the change is small,
   because the runbook treats every roadmap item that way and the dry run exists to
   exercise every stage. Builder.
5. **The `docs/app.md` Today wording is updated in the same change** (CLAUDE.md:
   touch a part, update its doc). Builder.
