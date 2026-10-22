# Overlaps in the Calendar's week view (item 19)

## Why

The usability check (item 16, first run, 2026-10-22) found the PC week view cutting
today's column into 23 px lanes: block titles broke letter by letter ("Co/mp/Y –
/Su/pp/ort") and an entry that overlapped nothing was drawn as "C…". The day view drew
the same day at readable widths, but it too narrowed "CompZ – Audit 2026" at 07:00,
which overlaps nothing. Screenshots: `.autopilot/screenshots/16/t12-screen-calendar-1440-light.png`
and `.autopilot/screenshots/16/defect-calendar-day-today-1440-light.png`.

The cause is in the shared grid layout (`TimeGrid.svelte`'s `placed`, `grid.ts`'s
`lanes`). Blocks are grouped by their drawn extent. A block that shares its column is
then redrawn taller so its wrapped name fits (two or three lines, or what it measured),
and the groups are formed again from the taller blocks. In a narrow lane a name wraps
letter by letter, so it measures many lines and grows, runs into more blocks, and the
group spreads. A few timers started in one minute (gate task 3) pulled the whole day
into one group with six lanes.

The study asks for overlaps side by side at a readable width, never hidden, and
rejects Toggl's slivers (Views 10).

## Goals

- Only blocks that are drawn into each other share a column; a block in no such group
  takes its day's full width.
- Every block drawn in the PC week at 1440 px shows its project's first word whole, and
  its name breaks only between words.
- Where more blocks meet than fit at that width, the week shows as many as fit and a
  "+n" chip that opens the day.
- The day view gets the same grouping, since it shares the code and showed the same
  narrowing.

## Non-goals

- Widening a block into room left free beside it in its group (Google's layout). Lanes
  in a group stay equal.
- The month view, the phone week (colour-only columns), Today, Entries.
- Any core, MCP, data or seed change; the overlap rule itself.

## Anti-goals

- A block drawn over another, a cascade, or one entry hidden without a mark that counts
  it (item 13's anti-goal: "A calendar that hides an overlap or shows one entry over
  another").
- Slivers: names broken letter by letter, or cut to a letter and an ellipsis.
- A whole day split into lanes because one stretch of it is crowded.
- Blocks whose text is cut through a line.

## The design

### Grouping

1. A block's **drawn box** is its time, at least one line tall (`heightFor(1, marks)`,
   as today; the phone day's 44 px growth into free time stays as it is).
2. Blocks whose drawn boxes intersect are a **group**; groups chain (A meets B, B meets
   C: one group). Boxes that only touch at an edge (one ends where the next starts) do
   not meet. This is today's `lanes` rule applied to the one-line boxes.
3. A block in no group takes the day's full width.
4. Inside a group, lanes are assigned as today (first free lane, by start then end) and
   are equal in width.
5. The red top edge is unchanged: it marks the core's overlap (times intersect), not
   the layout. A block may share its column with another without a red edge (a
   zero-minute timer beside the entry that starts in the same minute).

### A name in a narrow lane

6. The grouping is done once, from the one-line boxes. A block that shares its column
   may then be drawn taller so its name wraps whole, but only into time left free below
   it in its lane, up to the next drawn block's top in that lane or, below the group's
   end, the next block in the day. Growing never changes a group or its lanes. Where it
   cannot grow far enough, the name ends with an ellipsis after its first whole word.
7. In a one-line block that shares its column, the start time gives way before the
   name is cut; the running time is still never cut (DESIGN.md, Running block).
8. A name wraps only between words (no breaking inside a word). Where a name runs out
   of room, its ellipsis falls where the room ends, as CSS puts it ("ClientY – Proj…",
   DESIGN.md, Block); that is readable once the first word shows whole. A block that
   does not share its column is unchanged.

### The readable floor and the "+n" chip

9. A lane is never narrower than a **readable floor**: wide enough that the first word
   of the seeded names ("ClientY", "CompY", "time-keep", "Myself", "CompZ") shows whole
   with the block's padding and edge. It is a fixed constant the builder measures once
   against those names (expected about 64 px), so a PC week column at 1440 px (about
   150 px) holds two lanes. A real first word wider than the floor ends in an ellipsis
   after the floor's width; the floor does not widen for it. The number of lanes that
   fit is the column's width over the floor, measured on the rendered column (and
   recomputed when it resizes), with a fallback of two for the PC week before measuring
   and without JavaScript.
10. **The week:** where a group needs more lanes than fit, the last lane that fits holds
    the chip instead of blocks: blocks in lanes up to the one before it are drawn; the
    rest are not drawn, and each run of hidden blocks that meet gets one chip at the
    top of the run's first drawn box, in that last lane, counting the run's blocks.
    With two lanes, a group of five same-minute timers draws one block and "+4".
    A running block is never hidden: inside a group, running blocks take the first
    lanes, so a running timer is drawn and a chip counts only finished entries (unless
    more timers run at once than lanes fit, when the extra running ones are counted
    too).
11. **The chip** (the stand-in's choice, option A): one line tall, the lane's width, on
    the surface with a 1 px `input` stroke and 2 px corners, "+4" in the block's 12 px
    type, semibold, text colour. Hover fills it with accent. It is a link to that day's
    view (`view=day&date=…`, the filter's scope carried), reachable by Tab, opened by
    Enter, with the 2 px blue focus ring; its accessible name says what it hides
    ("4 more entries from 06:12, Thursday 22 October; open the day"). Without
    JavaScript it is the same link. A chip is not dragged and does not start a create
    drag.
12. **The day view** (PC and phone): nothing is hidden. Where a group needs more lanes
    than fit at the floor, the lanes keep the floor's width and the day's grid scrolls
    sideways for that (the stand-in's call, round 2). On the phone the scroll goes
    first: while the grid can still scroll in a swipe's direction, the swipe scrolls it
    and the day stays; a swipe that starts with the grid at its edge in that direction,
    or where nothing scrolls, changes the day as today. One touch never does both:
    reaching the edge mid-swipe does not change the day; the next swipe does (call 17).
13. At 1440 px the PC day column (about 1050 px) holds sixteen lanes; the phone day at
    390 px (about 340 px) holds five.

### References

| Screen | Follows | Departs from |
| --- | --- | --- |
| Week, groups | Kimai and Google: overlapping blocks side by side; Samsung's week | Today's layout, where one crowded minute splits the day |
| Week, crowding | Samsung's week, a "+3" chip where short events crowd (study, Views); the month's "+n more" (item 13) | Toggl's slivers (study, Views 10, rejected) |
| Day, crowding | Views 10: side by side, never hidden, a readable width | — |
| Equal lanes | Item 13's call 23 (equal shares) | Google's widening into free room (not taken; queued) |

## Gate tasks

On a seeded month (`TZ=Europe/Budapest npx tsx scripts/seed-month.ts`), first do the
usability check's tasks 2, 3, 7 and 8 on today
(`docs/superpowers/specs/2026-10-22-usability-check-design.md`): shape (a) 9:00–10:30,
(b) 13:00–15:30, (c) 8:00 for 5.5 h; three timers started at once and stopped; CompZ –
Audit 2026 logged; the Café dev template used. Then, at 1440 px, in light and dark:

1. **Open the Calendar's week holding today.** Today's column: every block that
   overlaps nothing (the Standup, CompZ – Audit 2026, any lone timer) runs the column's
   full width; the 8:00–13:30, 9:00–10:30 and 13:00–15:30 entries share it in two lanes
   with their names wrapping between words; no title anywhere in the week wraps inside
   a word or is cut before its first word ends (an ellipsis after the first word, as
   "ClientY – Proj…", is fine).
2. **The crowded minute.** Where task 3's timers were started in the same minute, the
   column shows as many blocks as fit, each with its first word whole, and a "+n" chip
   counting the rest. Tab to the chip and press Enter: the day view opens on that day,
   and every one of those entries is there, side by side, none hidden.
3. **Last week's seeded overlaps** (its Wednesday's overlapping pair): two lanes,
   whole-word names, red top edges; the other days' lone blocks full width.
4. **Correct a block in a group.** Drag one block of the 8:00–13:30 group 1 hour later
   in the week view, then Undo: the layout follows each time, with no block drawn over
   another.
5. **The day view.** Open today in the day view at 1440 px and at 390 px (phone): lone
   blocks full width (CompZ – Audit 2026 no longer narrow), the crowded minute side by
   side with names readable; nothing hidden.

## Calls made in the operator's place

The stand-in's, from the brainstorm (`.autopilot/agents/19-brainstorm-1.md`,
`.autopilot/agents/19-brainstorm-2.md`):

1. **Blocks share a column when they would be drawn into each other**, counting a short
   entry's one-line minimum; blocks that only meet at an edge do not; the red edge
   keeps the core's rule. Source: item 13's spec, anti-goals and line 259; study,
   Views 10; item 19's exit. Confidence: inferred.
2. **More than fit: as many as fit, then a "+n" chip opening the day**, keyboard
   reachable; no cascade, no slivers. Source: study, Views (Samsung's "+3"), Views 10;
   item 13's anti-goal and call 14. Confidence: inferred.
3. **Lanes in a group stay equal;** no widening into free room. Source: none (item
   19's exit asks only for a lone entry at full width). Confidence: ungrounded; queued
   in `docs/questions.md`.
4. **A very short entry and the next sit side by side;** neither is drawn over the
   other nor cut. Source: item 13's anti-goals; DESIGN.md ("Blocks that meet sit side
   by side"); study, Views 10. Confidence: inferred.
5. **The day and week views alike.** Source: roadmap, "How an item is worked" (small and
   in scope is fixed in the item); item 19 cites the day view's screenshot. Confidence:
   inferred.
6. **Readable means whole words:** the name breaks only between words and at least its
   first word shows whole; a one-line block may end its name with "…"; the builder may
   set a px floor measured against the seeded names. Source: item 19's defect; item
   13's done note ("names wrapped whole"); DESIGN.md, Block; study, Views 10; item 13's
   call 30. Confidence: inferred.
7. **The chip is option A**, a one-line "+n" on the surface with an `input` stroke.
   Source: study, Views (Samsung's week); DESIGN.md, Month ("+n more", plain); questions,
   2026-10-20 — 11 (blue and red kept for their meanings). Confidence: inferred.
8. **The day view hides nothing: past the floor its grid scrolls sideways.** Source:
   study, Views 10. Confidence: ungrounded; queued in `docs/questions.md`.

The builder's:

9. **The grouping is done once, from the one-line boxes;** a block's growth for its
   name never changes a group. This is the fix for the runaway, and the reading of call
   1's "drawn" as the one-line minimum, not a measured height.
10. **One chip per run of hidden blocks that meet**, not one per group, so a long group
    does not count blocks hours apart under one chip.
11. **The floor is measured from the seeded names' first words** (about 64 px), and the
    lanes that fit come from the rendered column's width; two is the PC week's
    fallback without JavaScript.
12. **The phone week is unchanged:** its blocks are colour only and its columns link to
    the day, so lane width does not touch readability there.
13. **The gate checks the day view too,** since call 5 changes it.

From the builder check (`.autopilot/agents/19-builder-check.md`):

14. **A cut name's ellipsis falls where CSS puts it,** once the first word shows whole;
    words are never broken to wrap. Answered by call 6 ("a one-line block may end its
    name with '…'"); DESIGN.md's "ClientY – Proj… 09:30" stands. Builder's reading.
15. **The floor is a fixed constant,** measured once against the seeded names; a longer
    real first word ends in an ellipsis rather than widening the floor. Builder's call.
16. **A running block is never hidden behind a chip:** running blocks take a group's
    first lanes. DESIGN.md: the running time "is never cut". Builder's call.

The stand-in's, from the builder check (`.autopilot/agents/19-builder-check-theirs.md`):

17. **On the phone day the sideways scroll goes first, the swipe changes the day from
    the edge,** one touch never doing both. Source: study, Moving between dates
    (Samsung's swipe by one period; Kimai's swipe that did nothing, counted against
    it); study, Views 10; call 8. Confidence: ungrounded; queued in
    `docs/questions.md`.

Approved by the operator stand-in, revision 1, 2026-10-22.
