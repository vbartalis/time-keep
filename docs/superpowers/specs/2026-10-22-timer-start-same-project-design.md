# Starting a timer on a project that has one running — design

Roadmap item 18. Written 2026-10-22 in an autopilot design session; the operator
stand-in answered in the operator's place (see the last section).

## Intent

The vision says: "Starting an entry on a project stops that project's running timer."
The usability check (item 16, first run, gate task 3) found that it does not hold when
the second start comes soon after the first. Timer 1 on CompX › ClientY – ProjectZ
started at 06:09:27; the entry form opened in timer mode filled Start with 06:09, which
the server read as 06:09:00, before timer 1's start; the core refused the save with
"The running timer on this project started later; stop it first." The screen showed
both starts as 06:09, so the message read as false. On the PC the form opened again a
minute later still showed 06:09 and was refused again.

This item makes the plain path never refuse, and makes the one refusal left say what
is wrong in terms the screen shows. It is a fix to one rule, not a feature.

## Where the fault is

- `beforeRunning` (`src/lib/server/core/entries.ts`) refuses a running entry whose
  start is at or before the project's running timer's start, to the millisecond.
- The entry form (`/entries/new`, in timer mode `?timer=1` and any new entry saved with
  no end and no duration) posts Start as a minute, so a start in the same minute as a
  timer started seconds earlier always reads as earlier.
- On the PC the form is opened in place through `preloadData` (`src/lib/entry-link.ts`)
  with `data-sveltekit-preload-data="hover"`; a reopened form showed the Start loaded
  for the earlier open. The builder confirms the cause.

The template paths (`/timers/start`, Today's template sheet with no times) and Restart
pass no start, so the core starts them at the request's exact time; they are not
affected and stay as they are.

## The rule, after this item

When a new running entry is made on a project (a new timer, or a new entry saved with
no end) and that project already has a running timer R, with the new start S:

1. **S after R's start:** R stops at S (as today).
2. **S in the same minute as R's start, at or before it** (both read the same minute
   in the new entry's zone): taken as the same time. The new entry starts just after R
   (R's start plus one millisecond) and R stops there. Never refused.
3. **S in an earlier minute than R's start:** refused, on the Start field, keeping what
   was typed, with the message
   "This project's timer has been running since HH:MM. Start at HH:MM or later, or stop that
   timer first." (HH:MM is R's start in the new entry's zone; when R's local day is
   not S's, R's date goes before the time, in the ISO form the timer bar uses.)
   R is not changed. The old "started later" message is gone.

An **edit** that makes an existing entry running (its end removed, or a running entry
moved to another project) keeps its saved start: R stops at it when it is after R's
start, and otherwise the edit is refused with the same message, shown where the edit
form shows a refusal that is not on a field it changed. Rule 2 does not apply to edits,
since it would move a saved start the user did not touch.

The rule lives in the core, so the UI and the MCP server get it alike (vision,
principle 3). As today, the start and the stop are one batch: one Undo takes both back.

## The form

- **An untouched Start means now.** When the form filled Start with the current
  minute (timer mode, or a plain new entry with no start given) and the date and Start
  are saved as filled, with no end and no duration, the new running entry starts
  at the moment Save is pressed (the request's time), not at the minute shown. A Start
  or date the user changed is taken as typed (and the rule above applies). An entry
  with an end or a duration takes its Start as typed, as today. A Start the form filled
  from elsewhere (a calendar slot's `?start=`, a template's start time, a copied entry)
  is taken as filled, never replaced by now.
- **A reopened form is fresh.** Every time the form is opened for a new entry it shows
  the current date and minute; Cancel discards what was typed. This holds on the PC
  (opened in place) and on the phone, in timer mode and not.

Nothing else on screen changes: no new control, no setting, no layout change. The
refusal shows where the form already shows a Start refusal.

## The reference each part follows

- **Follows** Kimai, Toggl and Clockify (study, Timers): a new start stops the running
  timer and never asks; Kimai's ▶ opens the form "with begin now", which the untouched
  Start keeps meaning.
- **Departs** from all three only where the vision does: several timers may run, and
  only the same project's timer stops (study, Timers 2).
- The typed-earlier refusal has no reference: Toggl and Clockify cannot type a start
  for a new running timer in their bar; Kimai's behaviour there is not on record.

## Goals

- On the plain path (Start untouched, same project, same minute or the next), the
  project's running timer stops and the new one runs, on phone and PC.
- A typed Start in the running timer's minute behaves as the same time.
- The one refusal left names the running timer's start, as the screen shows it.
- The form opened again shows the current minute.

## Non-goals

- A "one timer at a time" setting, or stopping other projects' timers.
- Any change to the timer bar, the phone strip (item 20) or the calendar (item 19).
- Changing how an entry with an end or a duration reads its Start.

## Anti-goals

- Any refusal on the plain path.
- A message that says a timer started later when the screen shows the same time.
- The running timer's time lost (deleted or shortened to nothing) as a side effect.
- A stop that one Undo cannot take back together with the start.
- The phone and the PC behaving differently.

## Constraints

- The core stays the one place the rule lives; the routes only decide what "untouched"
  means and pass a start or none.
- Times stay stored exactly (principle 4); the millisecond in rule 2 is stored, the
  screens show minutes as today.
- Tests first (TDD): core tests for rules 1–3 and the edit path; route tests for the
  untouched Start; an e2e for gate tasks 1–2 on both widths.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`), signed in as the seeded user, at 390 px
and 1440 px, in light and in dark. Each task starts with no timer running.

1. **Same project at once.** From the timer bar's Start › "Start on a project…", start
   a timer on CompX › ClientY – ProjectZ, Development. Then start one on Myself ›
   time-keep. Then, within the same minute as the first, start another on CompX ›
   ClientY – ProjectZ the same way, leaving Start as filled. It saves without a
   refusal; the first ClientY timer has stopped (it shows in Today or Entries with an
   end), the new ClientY timer and the time-keep timer run.
2. **Same project a minute later.** Cancel out of a form you opened, wait into the next
   minute, open "Start on a project…" again: Start shows the current minute. Start on
   CompX › ClientY – ProjectZ again: it saves; the running ClientY timer stops; never
   refused.
3. **One Undo.** Right after task 2's save, Undo from the strip: the new timer is gone
   and the ClientY timer it stopped runs again.
4. **A typed Start in the same minute.** With a ClientY timer running since HH:MM,
   start another on the same project with Start typed as that same HH:MM: it saves,
   and the running one stops.
5. **A typed Start clearly earlier.** With a ClientY timer running, start another on
   the same project with Start typed ten minutes before the running one's start: the
   form refuses on Start with "This project's timer has been running since HH:MM.
   Start at HH:MM or later, or stop that timer first.", with the running timer's real start;
   what was typed stays; the running timer is unchanged.

## Builder's latitude

- How the form tells the server Start was untouched (for example a hidden field with
  the filled date and Start, compared on save), as long as it works without client
  script and the core is given no start, or the request's time.
- How the reopened form is made fresh (no preload cache for the form's URL, a cache-
  busting query, or reloading on open), as long as the PC keeps opening it in place.
- The impeccable pass for this item is the refusal's copy and its placement; no
  shaping or new direction work, since nothing new is laid out.

## Calls made in the operator's place

The stand-in's answers (`.autopilot/agents/18-standin-q1.md`):

1. **An untouched Start means the moment Save is pressed;** a typed Start is taken as
   typed. Source: vision, Timers ("Starting an entry on a project stops that project's
   running timer"); study, Timers (Kimai's form "with begin now"); roadmap item 18
   ("whatever the minute"). Confidence: ungrounded; queued in `docs/questions.md`.
2. **A typed Start earlier than the running timer's is refused,** in the form, keeping
   what was typed, with a message that names the running timer's start; the running
   timer is not removed. Source: vision, Timers (starting stops, not removes); an entry
   is always an interval; roadmap item 18. Confidence: ungrounded; queued in
   `docs/questions.md`.
3. **A typed Start in the same minute as the running timer's is the same time:** the
   running one stops, never refused. Source: roadmap item 18 and its exit. Confidence:
   grounded.
4. **A reopened form shows the current minute;** Cancel discards what was typed.
   Source: roadmap item 18 (the stale Start is named as part of the defect); study,
   Timers (Kimai's begin now). Confidence: inferred.
5. **Nothing beyond the exit;** the winces are the anti-goals above. Source: roadmap
   item 18; operator's voice (Kimai disliked for no Ctrl+Z and fiddly small things;
   several timers may run); study, Timers 2. Confidence: inferred.

The builder's calls:

6. **"Same minute" is read in the new entry's zone,** and in rule 2 the new entry
   starts one millisecond after R's start, so R keeps a positive length and the new
   start reads as the typed minute even when R started in its minute's last second.
   (Builder's call, from the builder check.)
7. **Edits keep their saved start:** rules 1 and 3 apply to an edit that makes an
   entry running, rule 2 does not, and the refusal shows as the form's general
   message unless Start was changed. (Builder's call, from the builder check.)
8. **"Untouched" needs Start filled with the current minute, the date and Start saved
   as filled, and no end or duration;** a changed date, or a Start filled from a slot,
   a template or a copy, is taken as given. (Builder's call, from the builder check.)
9. **The refusal shows R's date when R's local day is not S's,** not when R started
   before today: under rule 3 S is earlier than R, so that is the case that occurs.
   (Builder's call, from the builder check.)

Calls made during the build (the stand-in, in the impeccable clarify pass,
`.autopilot/agents/18-standin-build-q1.md`):

10. **The refusal says "Start at HH:MM or later",** not "Start after HH:MM": a Start in
    the running timer's own minute is accepted (rule 2), so "after" read as false.
    Source: rule 2; the anti-goal on a message the screen contradicts; operator's voice
    (Kimai's fiddly small things). Confidence: inferred.
11. **The refusal shows under Start and in the form's alert by Save,** as every refusal
    on this form does. Source: The form ("nothing else on screen changes").
    Confidence: inferred.

Approved by the operator stand-in, revision 1, 2026-10-22.
