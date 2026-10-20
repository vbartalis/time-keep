# Item 10, the reference study — design

Approved by the operator stand-in, revision 1, 2026-10-19.

Date: 2026-10-19. Roadmap item 10, a document unit. Written in an autopilot session;
the operator stand-in answered in the operator's place.

## Intent

Round 1's screens were designed from the vision's list of what Kimai lacks, without
anyone studying how Kimai, or any good time or calendar app, is actually used. The
result passes its tests and is not usable (roadmap, "Round 1"). Round 2 redesigns
every screen, and each of its specs must name the Kimai or calendar-app behaviour it
follows or departs from, and why (roadmap, "In round 2, also"). This study is the
reference those specs cite.

Its first readers are the builders of items 11–15. With it, an item's designer can
settle, without researching first: which views exist, how an entry is made and
edited, how timers run and restart, how the user moves between dates, totals,
filters, what changes between phone and PC, and what the references look like. The
operator reads it too.

Roadmap exit: a reference document in `docs/`, and the amended vision, both approved
by the operator stand-in.

## Goals

- `docs/reference-study.md`: one document, organised by subject, every finding
  sourced and given a verdict for time-keep (follow, adapt or reject).
- Kimai studied live, through its public demo, at phone and PC widths, with
  screenshots the study captures itself.
- The operator's four real entry shapes walked through each reference.
- A verdict on Kimai's weekly hours grid that item 14 reads.
- The vision's two surfaces and fast-capture principle revisited against the findings.
- `docs/vision.md` amended with the views the operator asked for, and nothing else.

## Non-goals

- Choosing the design direction. Item 11 chooses it from rendered options; the study
  records observations of the references' look, not a direction.
- Designing any time-keep screen, or writing specs for items 11–15.
- Changing the data model or the back end.
- Studying features the vision puts out of scope (invoicing, offline, importers,
  sharing), beyond noting that a reference has them.

## Anti-goals

These would make the study a failure even if it covered every reference (stand-in,
question 8):

- Writing from docs or the vision's list of Kimai's faults without using Kimai's demo
  and looking at the calendar apps, or without showing how they look.
- The operator's real entry shapes never walked through a reference.
- A finding with no source or no verdict.
- A study a designer cannot use to name what a screen follows.
- Anything beyond the calendar views and the table slipped into the vision.

## The references and how each is looked at

| Reference | How |
|-----------|-----|
| Kimai | Live: the public demo at demo.kimai.org, signed in as the demo user the Kimai site publishes (`john_user`). Playwright's Chromium at 390 px (touch) and 1440 px. |
| Google Calendar | Public material only: Google's help centre and product pages, viewed in Chromium. It needs an account, and signing up is forbidden. |
| Samsung Calendar | Public material only: Samsung's support and product pages. It is a native Android app. |
| Toggl Track | Public material only: its help centre, product pages and public docs. It needs an account. |
| Clockify | Public material only: its help centre and product pages. It needs an account. |
| Timing | Public material only: its product pages and documentation. It is a native macOS app. |

- **Kimai's demo is read only.** Forms are opened, their fields counted and their
  behaviour observed; nothing is saved, deleted or submitted. The sign-in is the one
  form submitted (roadmap item 10; operator, 2026-10-19, "no posting or similar to the
  web"). The same holds on every other site. Actions that write without a form also
  count as writes: starting, stopping or restarting a timer, deleting, and dragging or
  resizing a calendar block are not done. What they would do is read from the visible
  controls (their menus, buttons and tooltips, opened without confirming) and from
  Kimai's documentation, and the finding says which.
- **Kimai's setup.** The demo's default setup, in the browser at phone and PC widths,
  stands for the operator's Kimai. Where another tracking mode (duration only,
  punch-in) or version would change a finding, the finding notes it. Third-party
  phone apps for Kimai are not studied (stand-in, builder check 1).
- Every finding taken from public material says so beside it ("from docs"), so a
  reader knows it was not seen live.
- If a reference turns out to offer a public demo or a no-account web view, it is used
  live under the same read-only rule.

## The document

`docs/reference-study.md`, in this order:

1. **Purpose and how to use it.** Who reads it, how a spec cites it (by section
   heading), and the verdict words: **follow** (do it the same way), **adapt** (take
   the idea, change named parts), **reject** (do not do it), each with a reason.
2. **The references.** One short entry per reference: what it is, how it was looked
   at (live or from docs), the date, and the URLs used.
3. **Findings by subject.** One section per subject. Under each, each reference's
   findings (what it does, the source as a URL or screenshot path), then
   **For time-keep:** the verdicts. The subjects:
   - Views: day, week, month, agenda or list, Kimai's timesheet table, Kimai's weekly
     hours grid.
   - Creating an entry: from where, how many steps and fields, start plus end against
     start plus duration, time input, picking customer and project.
   - Editing, moving and deleting an entry, including drag and resize.
   - Timers: starting, the running timer's display, stopping, restarting a past entry,
     several at once.
   - Recents, favourites and templates, weighed against the discovery call that
     user-saved templates, which may be partial, replace "recent" and "repeat last
     entry" (stand-in, approval note).
   - Moving between dates: buttons, swipe, a date picker, "today".
   - Totals: per day, week and period, and where they show.
   - Filters and search.
   - Phone against desktop: what each surface shows and leaves out, navigation.
   - Look and layout: density, colour, type, how the shell and navigation sit, phone
     against desktop. Observations only (stand-in, playback 1c).
4. **The weekly hours grid.** A verdict for item 14 to read. It weighs the grid
   against the entry model: an entry is always an interval, and duration-only entries
   were rejected. The default is reject or defer unless the walk-through below shows a
   clear need (stand-in, question 6; queued in `docs/questions.md`). A follow or adapt
   verdict means item 14 builds it, only as another way to fill in the table's entries,
   with every saved cell a real interval (a start and an end); a grid that needs
   duration-only entries changes the charter, so its verdict is reject. Whatever the
   verdict, it is noted under the grid's existing entry in `docs/questions.md`, and the
   vision leaves the grid out (stand-in, builder check 2).
5. **The operator's entries, walked through.** The four real shapes, each logged in
   every reference: one table per reference, a row per shape, with the steps or taps
   and fields it takes and what gets in the way. In Kimai this is counted on the
   opened forms, never saved. The shapes, in the study's words:
   - support, three companies deep: CompX › "ClientY – ProjectZ", ticket and end
     client in the reference and description, a standard timeframe;
   - development, two deep: own project X, from y to z, at a café, doing A;
   - start plus duration: CompX, project Y, from a start for Z hours, doing A;
   - at the client: CompX › "CompY – …", doing Z from A to B, at the client.

   For a reference not used live, the counts are reconstructed from its documentation
   and marked "estimated from docs"; a cell with no evidence says so. The calendars
   have no customer, project, activity or location fields: a shape is mapped onto
   what they have (title, description, location, colour or calendar), the mapping is
   stated, and what cannot be expressed is named.
6. **The vision revisited.** The two surfaces and the fast-capture principle checked
   against the findings: what holds, and what the findings question. What they
   question goes to `docs/questions.md`, not into the vision.
7. **Round 1's failures, answered.** Each failure the roadmap lists (no entry for an
   arbitrary time, no calendar or day-grouped list, timers only on Today, a phone that
   cannot reach past entries, a dated and heavy look) next to the findings that answer
   it.
8. **For each round 2 item.** Items 11–15, each with what it should follow, adapt
   and reject, pointing at the sections above.

### Screenshots

- Only screenshots the study captures itself, of pages it looks at in Chromium.
  Nothing downloaded from third-party sites.
- Kept in `docs/reference-study/`, named `<reference>-<view>-<phone|pc>.png`; a
  capture of a public help or product page (for references not used live) is named
  `<reference>-<subject>-docs.png` and its finding cites the page's URL.
- A few per view, enough to show the look and layout of each view a finding cites:
  roughly 30 at most in all, each under 300 KB.
- Linked from the finding they support.

## The vision amendment

- A new short section, **Views**, after "Two surfaces": the day, week and month
  calendar views and the table view of the user's entries, on both surfaces.
- "Two surfaces" stays as it is. Nothing else in the vision changes.
- Anything else the study suggests for the charter is queued in `docs/questions.md`
  and left out of the vision.

## Reference behaviour

The study is the reference; it follows none. Its form follows the roadmap's "In round
2, also": a spec names which Kimai or calendar-app behaviour each screen follows or
departs from, and why.

## Gate tasks

Done by the stand-in reading the document, as a builder of items 11–15 would:

1. From the study alone, name which reference behaviour item 13's day and week views
   follow, adapt or reject for: blocks on a time grid, creating an entry on empty time,
   moving between dates, totals.
2. From the study alone, say whether item 14 builds Kimai's weekly hours grid, and why.
3. Find how Kimai creates an entry (the fields, start plus duration, the steps) and
   open the screenshot that shows it.
4. Read how many steps the support entry, three companies deep, takes in Kimai and in
   Toggl, and what gets in the way in each.
5. Find what the phone shows and leaves out in Kimai and in Google Calendar, and the
   study's verdict for time-keep's phone.
6. Read the vision's Views section and confirm it adds the calendar views and the
   table and nothing else.

## Calls made in the operator's place

The stand-in's:

1. What the study lets a designer settle: for every screen and behaviour, which
   reference behaviour it follows, adapts or rejects, and why; also whether item 14
   builds the weekly grid. Source: `docs/roadmap.md` "In round 2, also" and items 10,
   14. Confidence: grounded.
2. What the operator relied on in Kimai: the calendar-like structure, its day, week and
   month views and the table view; what annoyed: invoicing, no undo, fiddly entry of
   new and small things, the weak phone. Nothing else is on record; the study covers
   Kimai's timesheet, calendar and timer behaviours evenly. Source:
   `docs/operator-voice.md`, 2026-10-19 and discovery. Confidence: grounded for the
   named parts, ungrounded beyond them (queued in `docs/questions.md`).
3. Dedicated trackers: Toggl, Clockify and Timing, as the roadmap names them. Source:
   roadmap item 10. Confidence: grounded.
4. Reader and form: one document; the builders of items 11–15 first, the operator
   too. Source: roadmap item 10's exit and "In round 2, also". Confidence: inferred.
5. Screenshots: kept in the repo, only ones the study captures itself; nothing
   downloaded. Source: `docs/operator-voice.md`, 2026-10-19 (looking for inspiration,
   no downloading from untrusted sources); roadmap item 11 (rendered options, not
   descriptions). Confidence: inferred.
6. The weekly hours grid: the study settles it; the default is reject or defer unless
   the walk-through shows a clear need. Source: roadmap item 14; the 2026-10-18
   discovery (duration-only entries rejected). Confidence: grounded that the study
   decides, ungrounded on the operator's opinion of the grid (queued in
   `docs/questions.md`).
7. On the phone, making a new entry matters most, then how a day and a week look on a
   time grid, then moving between days by swipe and buttons. Source:
   `docs/operator-voice.md` discovery (the phone for quick capture); vision principle
   1. Confidence: inferred.
8. The failure modes listed under Anti-goals. Source: `docs/operator-voice.md`,
   2026-10-19 ("no idea if you have studied kimai at all"); roadmap "Round 1".
   Confidence: grounded.
9. The vision revisit is a section of the study; what it finds beyond the views goes to
   `docs/questions.md`. Source: roadmap item 10. Confidence: grounded.
10. Kimai's demo is read only: forms opened and counted, nothing saved. Source:
    roadmap item 10; `docs/operator-voice.md`, 2026-10-19. Confidence: grounded.
11. Look and layout is a subject, as observations only. Source:
    `docs/operator-voice.md`, 2026-10-19 (the calendars as design inspiration; the UI
    "horrendous"); roadmap item 11. Confidence: inferred.
12. The study closes by checking round 1's failures against its findings. Source:
    roadmap "Round 1". Confidence: inferred.
13. Organised by subject, with the references list and the walk-through kept per
    reference. Source: roadmap "In round 2, also". Confidence: inferred.
14. The views go into a new "Views" section of the vision; "Two surfaces" is left as
    it is. Source: `docs/operator-voice.md`, 2026-10-19; roadmap item 10; the exits
    of items 13 and 14 (both views on phone and PC). Confidence: inferred.
15. Docs-only findings are marked as such, and the study ends with a summary per item
    11–15 (both builder guesses, accepted). Source: roadmap item 10 ("recorded with
    its source") and "In round 2, also". Confidence: inferred.

16. Kimai's setup: the demo's default, in the browser, stands for the operator's;
    findings note where another mode or version differs; no third-party phone apps.
    Source: roadmap item 10; the 2026-10-18 discovery (duration-only entries
    rejected). Confidence: ungrounded (queued in `docs/questions.md`).
17. The weekly grid's verdict binds item 14 only as another way to fill in the
    table, every saved cell a real interval; a grid needing duration-only entries is
    rejected; the verdict is noted under the grid's existing question; the vision
    leaves it out. Source: roadmap items 10 and 14; `docs/vision.md`, "The entry".
    Confidence: grounded on the study deciding and the vision leaving it out,
    inferred on the interval rule.

The builder's:

- Actions in Kimai's demo that write without a form (timers, delete, drag, resize)
  are treated as writes and not done; they are read from the visible controls and
  the docs. Answered by the read-only rule (roadmap item 10; the runbook's web rules).
- Captures of public help or product pages count as screenshots the study takes,
  named `-docs` and cited with their URL. Without them, five of the six references
  would show nothing of how they look.
- Walk-through counts for references not used live are "estimated from docs"; the
  calendars' shapes are mapped onto their own fields, with the mapping stated.
- The document's path, `docs/reference-study.md`, and the screenshots' folder,
  `docs/reference-study/`, with the naming and the size cap above.
- References that need an account or are native apps are studied from public material
  only, since signing up is forbidden; one turning out to have a public demo is used
  live.
- The verdict words are defined once at the top, so specs can quote them.
