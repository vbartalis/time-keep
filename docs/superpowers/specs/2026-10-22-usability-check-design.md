# The usability check — design

Roadmap item 16, the last item of round 2. Written 2026-10-22 in an autopilot design
session; the operator stand-in answered in the operator's place (see the last section).
There is nothing to build: this document says what the usability gate does to judge
the whole app, what counts as a pass, and what the round's report holds.

## Intent

Round 2 rebuilt every screen, one unit at a time (items 17 and 10–15), and the gate
passed each unit on its own tasks. Nobody has yet used the app from end to end the
way its one user will: a day logged as it happens on the phone, yesterday corrected,
the month reorganised and copied out for Excel at the desk. Item 16 is that run. Its
verdict decides whether round 2 is over and go-live (item 9, the operator's) can
start, or whether what fails becomes new round 2 items first.

Nothing is fixed in this item (roadmap, item 16). The run either passes, or its
findings are written as new items and the check runs once more after them.

## Goals

- Every task in the app done as a user would, on a seeded month, at 390 px and
  1440 px, in light and dark (calls 1, 2).
- A verdict that a reader can trust without re-running it: per task, the step count,
  the comparison with the references, and screenshots.
- `docs/round-2-report.md`, short, for the operator (call 7).

## Non-goals

- Fixing anything found. A finding becomes a new item.
- Agents through the MCP server. The gate clicks; it does not run an agent (call 3).
- Bulk time shifts: not built, queued under 2026-10-20 — 14 in `docs/questions.md`
  (call 3).
- Go-live, deployment, the Kimai import.

## Anti-goals

- A pass because the app is nearly right. The gate's rules decide (call 6).
- A fail on taste. Polish and ideas are not findings (call 6).
- Findings without evidence: every one names a task or screen, a width, a theme and a
  screenshot.

## Constraints

- The gate is `.claude/agents/usability-gate.md`, unchanged: it builds and runs the
  app itself on a temporary database, seeds the month with
  `TZ=Europe/Budapest npx tsx scripts/seed-month.ts`, never reads `src/`, and writes
  `.autopilot/verdicts/16.json`.
- The seeded data: user `gate-user` (password `gate-password-1`), customers CompX
  (projects ClientY – ProjectZ, CompY – Support) and Myself (time-keep); activities
  Development, Meeting, Support ticket, Research; locations Office, Home office, Café,
  At the client; templates Standup and Ticket; 3 to 7 entries on every weekday of the
  30 days before today, one past midnight, one overlapping pair; nothing today. The
  admin is `admin` (password `admin-password-1`).
- **Yesterday** means the last weekday before today with seeded entries (call 8).
- The restore runs last in each setting's run, so it disturbs no other task
  (call 5). A fresh database per setting is the gate's choice.

## The bar

The gate's failing rules, unchanged (call 6): a task that cannot be done; a task
clearly slower or more confusing than the references do it; a visual defect an audit
would flag (too little contrast, overlap, clipped text that hides meaning, sideways
scroll at 390 px, touch targets under 44 px, a broken layout at either width or in
either theme). Bugs deferred in earlier done notes fail only when they hit one of
these rules.

- **A stated outcome is part of its task.** Where a task below says what happens (an
  end that reads 13:30, a project's timer stopped by the next on it, "n changed", a
  confirm that names the file), and it does not happen as written, the task was not
  done; the finding names the outcome that did not happen (call 10).
- **Coverage.** One gate dispatch does all twelve tasks at all four settings and
  writes the one verdict. A task-setting it does not try fails the run, its finding
  saying it was not tried rather than broken (call 11).
- **Times of day.** The tasks' times stand whatever hour the check runs at: an entry
  later than now is allowed (no rule forbids it), and a running timer overlapping a
  logged entry is expected. Neither is a finding (call 12).
- **Round 1's look** is judged against `DESIGN.md`, the direction that shipped: a
  screen visibly outside it (its colours, type, ruled surfaces, row menus and
  dialogs) is the finding (call 13).

## The references each task is judged against

The reference study (`docs/reference-study.md`) is the bar:

- **Logging and correcting** (tasks 2–4): section 5's walk-through of the operator's
  four entry shapes (Kimai 11–15 actions through its form, about 8 by a drag on its
  week; Google about 7, Toggl about 5); "Creating an entry", "Editing, moving and
  deleting" and "Timers" in section 3. On the phone, moves go through the form, not
  by drag (study, section 9, call 5), judged against what the references do on a
  phone.
- **Reorganising** (task 5): "Editing, moving and deleting" (bulk at the top once rows
  are ticked, undo after every change) and "Filters and search"; Kimai's timesheet.
- **Moving between dates and totals** (tasks 4, 5): "Moving between dates" and
  "Totals".
- **History, Copy-out and agent access** have no reference counterpart (study,
  section 8, item 15): they are judged against the patterns of items 11–14 (call 6).
- **Setup, Templates, Account, Users, Backup, sign-in**: the reference each followed,
  named in its spec (`2026-10-20-today-templates-setup-design.md`,
  `2026-10-21-account-users-backup-design.md`).

## Gate tasks

Every task at all four settings: 390 px and 1440 px, each in light and dark (call 2).
At 390 px the month-end tasks are done the phone's way (no drag; a move goes through
the form). Each starts signed in as gate-user unless it says otherwise.

1. **Sign in.** Signed out, open the app: the sign-in page. Sign in as gate-user with
   a wrong password (refused, the username kept), then the right one: Today.
2. **Log the day as it happens.** On Today: start a timer from the Standup template,
   then stop it from the timer bar; Undo the stop from the strip, then stop it again.
   Log shape (a) from the Ticket template: CompX › ClientY – ProjectZ, Support ticket,
   today 9:00–10:30, reference `T-1234`, description "end client B: login fails".
   Log shape (b) through New entry: Myself › time-keep, Development, Café, today
   13:00–15:30. Log shape (c) through New entry: CompX › CompY – Support, Support
   ticket, today 8:00 for `5.5` hours (the end reads 13:30). The overlap of (a) and
   (c) shows its warning, and saving is not blocked. Restart (b) from its row, then
   stop it. Today's total in its head matches the entries.
3. **Start a timer with no template.** From the timer bar's Start, start a timer on
   CompX › ClientY – ProjectZ, Development; start a second on Myself › time-keep: both
   run, shown as one plus a count; start another on ClientY – ProjectZ: that project's
   first timer stops. Stop the rest.
4. **Correct yesterday.** On Calendar, go to yesterday (‹ or a swipe on the phone, the
   date picker, or `d` and the arrows on the PC). Open one of its entries and move it
   30 minutes later and change its activity to Meeting; on the PC also drag another
   block in the week view 1 hour later and drag its end 30 minutes longer (snapping to
   5 minutes). Log the missed shape (d) on yesterday's empty time: CompX › CompY –
   Support, Meeting, At the client, 16:00–17:00 (a tap or drag on empty time).
   Delete one of yesterday's entries from its menu and Undo it from the strip. The
   day's total in its header follows each change.
5. **Reorganise the month.** On Entries, range the 30 days before today; filter to
   CompX; search a word that some descriptions hold. Tick several rows (on the PC a
   shift-click run), Edit…: move them to CompX › CompY – Support with activity Support
   ticket and location Home office, and replace a word in their descriptions with
   Find and Replace; one batch, "n changed". Find the seeded overlapping pair (its
   overlap mark), delete one: the mark goes. On Calendar's month view, check the day
   and week totals agree with the table. On History: the bulk edit is one batch;
   Undo it in one step (the rows are back), Redo it, then tick two of its changes and
   Undo selected (only those revert).
6. **Copy the month out for Excel.** On Copy-out, the 30 days before today (or last
   month): choose Date, Start, End, Duration, Customer, Project, Activity, Location,
   Reference, Description, then untick Location; round to 5 minutes; h:mm, then
   decimal. Copy: the clipboard holds tab-separated rows in the chosen columns, rounded
   when asked (where the browser does not let the gate read the clipboard, the status
   message and the CSV are the evidence, and the finding says so). Download CSV: the
   same rows with a header. On Reports, the same range: the totals per day, week,
   customer and project match the rows (call 4).
7. **Set up the reference data.** On Setup: add customer CompZ with project
   "CompZ – Audit", activity Review, location Library; rename the project to
   "CompZ – Audit 2026"; log one entry on it, then archive it: it leaves the entry
   form's picker and stays on that entry. Undo the archive.
8. **Templates.** Make a template "Café dev": Myself › time-keep, Development, Café,
   no times (it shows as TIMER). Change it to a 2-hour duration (LOG). Use it from
   Today with a description. Save an existing entry as a template from its form.
   Delete a template and Undo it.
9. **Account.** Change gate-user's password (a mismatched confirm refused first), sign
   out, sign in with the new one. Make a token "kimai-import" (shown once, Copy), then
   revoke it.
10. **Admin: users.** Sign in as admin; open Users (the PC's sidebar, the phone's
    More). Make user "anna" (a short username refused first), set her password,
    disable her (she cannot sign in), enable her. As gate-user, `/admin/users` and
    `/admin/backup` are refused with a way back.
11. **Admin: backup and restore, last.** As admin, download a backup; as gate-user
    change something (delete an entry); as admin restore the downloaded file (the
    confirm names it); sign in again: the change is gone, and Backup offers the copy
    from before the restore.
12. **Getting around and the look.** Every screen is reached from the phone's bottom
    bar and More and from the PC's sidebar; on the PC the keys work (`n`, `s`, and
    `d` `w` `m` on Calendar); Tab reaches every control in order and dialogs return
    focus. On every screen passed, at every setting: no sideways scroll at 390 px,
    targets at least 44 px on the phone, no clipped or overlapping text, readable
    contrast in both themes, none of round 1's look.

## The verdict and what follows it

The gate writes `.autopilot/verdicts/16.json` as its agent file says, passing only if
no failing rule applied; when passing, one finding per task with its step counts and
the comparison.

- **Pass:** the done note stands and the branch merges (`docs: …`).
- **First run fails:** each finding, or a group of findings on one screen or flow,
  becomes a new round 2 item, numbered from 18 and placed before item 16; item 16's
  done note becomes "First run <date> failed; its findings became items <n>–<m>.";
  the report is dropped until the next run. Item 16 runs once more after them, on
  `docs/16-usability-check-2`.
- **Second run fails:** the report is rewritten with the failure and merged; the
  round stops as failed.

## The round 2 report

`docs/round-2-report.md`, about a page, pointing at the done notes rather than
repeating them (call 7):

- **What round 2 built**: one or two lines per item (17, 10, 11, 12, 13, 14, 15a–d)
  and item 16's result, with any items it spawned.
- **The calls made in the operator's place**: the stand-in's that the operator may
  want to overrule, one line each with its confidence, the ungrounded (queued) ones
  first; the builder's as a count per item, linked to its done note.
- **The open questions**: one-line titles, linking to `docs/questions.md`, not the
  entries copied.
- A last line: go-live (item 9) is the operator's and waits for them.

## What is left to the builder

The report's wording and grouping; how a failing run's findings are grouped into
items and what each item's exit says (each exit the gate's tasks it failed).

## Calls made in the operator's place

The stand-in's answers; its round is in `.autopilot/agents/16-brainstorm.md`. Nothing
was queued in `docs/questions.md`.

1. **"Every task in the app" is the four flows plus each screen's own tasks** (Setup,
   Templates, History, Reports, Account, Users, Backup and restore, sign-in), one short
   task per screen where a flow does not already cover it. Source: roadmap item 16
   ("every task in the app"), item 15's screen list. Confidence: inferred.
2. **Every task at all four settings; the phone does the month-end tasks too, the
   phone's way.** Source: `usability-gate.md` ("Do each task at four settings");
   roadmap, "In round 2, also"; vision, Views ("on both surfaces"). Confidence:
   grounded.
3. **Reorganising the month is a bulk edit of project, activity and location, a find
   and replace in descriptions, deleting a duplicate, moving and resizing an entry,
   and undoing the batch (whole and chosen changes); not bulk time shifts, not an
   agent.** Source: roadmap item 5's exit; operator's voice, Data and entries (the MCP
   for month-end, "why batch undo matters most"); the study, Editing; questions,
   2026-10-20 — 14. Confidence: inferred.
4. **Copy-out is shown to work: the clipboard's tab-separated rows in the chosen
   columns with rounding and both duration formats, the CSV holding the same rows, and
   Reports' totals matching.** Source: roadmap item 6's exit; operator's voice (what the
   sheets need). Confidence: inferred.
5. **The check includes a restore, last in each run, and that a plain user cannot
   reach Users or Backup.** Source: roadmap item 8's exit; vision, Hosting.
   Confidence: inferred.
6. **The bar is the gate's existing rules, neither stricter nor looser; deferred bugs
   fail only when they hit a rule; History, Copy-out and agent access are judged
   against the patterns of items 11–14.** Source: `usability-gate.md`; the study,
   section 8; `.claude/rules/merges-on-good-enough-defers-defects.md`. Confidence:
   grounded for the rules, inferred for the rest.
7. **The report is short and points at the done notes**: what was built per item,
   the stand-in's calls one line each (queued first), the builder's as counts, the
   open questions as titles linking to `docs/questions.md`, go-live left to the
   operator. Source: roadmap item 16; `docs/autopilot.md`, Afterwards; operator's
   voice (2026-10-19, "withouth as much supervison from me as possible").
   Confidence: grounded for the contents, inferred for the length.

The builder's calls:

8. **Yesterday is the last weekday before today with seeded entries**, since the seed
   leaves weekends empty. Builder's call.
9. **The task data (the entries, the Setup names, "anna", "kimai-import") are invented
   for the check**, in the operator's entry shapes (study, section 5). Builder's call.

From the builder check (`.autopilot/agents/16-builder-check.md`); the stand-in's
answers are in `.autopilot/agents/16-builder-check-theirs.md`:

10. **A stated outcome that does not happen as written fails its task.** Source:
    roadmap item 16's exit ("passes every task"); `usability-gate.md` ("a task that
    cannot be done", "Never pass a unit because it looks nearly right"); operator's
    voice, discovery 2026-10-18 (starting on a project stops its timer). Confidence:
    inferred. The stand-in's.
11. **One gate dispatch; a task-setting not tried fails the run** (not split per
    setting, not passed as uncovered). Source: roadmap item 16's exit;
    `usability-gate.md` (four settings, the gate writes its own verdict); run-item
    ("One gate attempt per run"). Confidence: inferred. The stand-in's.
12. **The tasks' times stand at any hour; a later-than-now entry and a timer
    overlapping a logged entry are not findings.** Source: vision, The entry
    (overlaps allowed, no rule on future times). Builder's call.
13. **"Round 1's look" is judged against `DESIGN.md`**, since the gate cannot read the
    code. Builder's call.

Approved by the operator stand-in, revision 1, 2026-10-22.
