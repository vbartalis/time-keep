---
name: run-item
description: Runs one roadmap unit unattended in an autopilot session started by scripts/autopilot.sh. Picks the unit, resumes it at its first unfinished stage, works the superpowers stages with the operator-stand-in answering in the operator's place and the usability-gate deciding when it is done, and writes .autopilot/outcome.json.
---

# Run one roadmap unit, unattended

No human is present. Run the process `CLAUDE.md` names (superpowers' stages, impeccable
for anything on screen) exactly as written, except where this runbook says who answers
in the operator's place. Never ask, never wait: decide, record the call, continue.

## Fixed terms

- **Unit**: the first item or part, in page order, in the current round of
  `docs/roadmap.md` on `main` that has no done note. Its id is the heading's number and
  part (`10`, `10a`, `17`). The current round is the first round section holding an
  item without a done note. An item or part is done when its heading or part line reads
  `— done <date>`.
- **Branch**: `feat/<unit>-<slug>` (a screen or code) or `docs/<unit>-<slug>` (a
  document). Created from `main`; never deleted.
- **Stand-in**: the `operator-stand-in` agent. **Gate**: the `usability-gate` agent.
- **Outcome**: `.autopilot/outcome.json`, written last, exactly
  `{"status": "passed" | "continue" | "round-complete" | "failed", "unit": "<id>", "summary": "<one line>"}`.
  Create `.autopilot/` if missing. Writing it ends the session.
- **Verdict**: `.autopilot/verdicts/<unit>.json`, written by the gate (screen unit) or
  the stand-in (document unit). The script accepts `passed` only when it passes and
  its `tree` equals `git rev-parse main^{tree}`.
- **Ledger**: `progress.md` in the plan's SDD workspace, the directory that
  subagent-driven-development's `scripts/sdd-workspace <plan>` prints. Git-ignored; it
  survives between sessions on disk.

## Forbidden, always

- Forbidden in every session: docker, `git push`, `rm -rf`, sudo, ssh; deleting
  branches; writing to memory.
- The web is read-only: search, fetch, documentation, forums, public demos; no posting,
  commenting, signing up, submitting forms other than a public demo's sign-in, and no
  downloading or running anything from an untrusted source. Dependencies only from the
  npm registry through `npm install`.
- Nothing else remote except the unit's GitHub issue and Project writes in
  `vbartalis/time-keep` (standing-authorized). No `git pull` or fetch.
- Never write to `.claude/memory/` or any memory store. Never edit
  `docs/operator-voice.md`.
- Never disable or bypass a hook or gate; satisfy it and retry. An action the
  permission classifier refuses is not retried in another form: record it, find
  another way, or fail the unit.
- `.claude/rules/` applies unchanged.

## 1. Orient

1. Read from `main`, with `git show main:<path>`: `docs/roadmap.md`, `docs/vision.md`,
   `docs/operator-voice.md`, `docs/questions.md`, `docs/autopilot.md`. Find the last
   done note on the roadmap.
2. Pick the unit. If it is item 9, write outcome `round-complete` and end.
3. Find its branch: `git branch --list 'feat/<unit>-*' 'docs/<unit>-*'`, `<unit>` the
   id read from `main`. Only while `main` still shows the item unsplit, also look for
   `feat/<n>[a-z]-*` and `docs/<n>[a-z]-*` (`<n>` the item number: a brainstorm split it
   on a branch not yet merged). Skip any branch whose part is done on `main`. Item 16's
   branches are `docs/16-usability-check` (first run) and `docs/16-usability-check-2`
   (once `main` shows the first-run note; then only that one counts). If found,
   `git checkout` it and read the roadmap there: the unit is the part that branch names.
4. Find the first unfinished stage from what the branch adds over `main` and from the
   ledger. A spec or plan counts only if the branch added it:
   `git diff --name-only main...HEAD -- docs/superpowers/specs docs/superpowers/plans`.
   The first row that matches wins.

   | Evidence                                                             | Resume at       |
   | -------------------------------------------------------------------- | --------------- |
   | no branch                                                            | 2               |
   | passing verdict for `HEAD^{tree}`                                    | 8               |
   | the branch added no spec                                             | 2               |
   | spec not approved                                                    | 3               |
   | document unit, spec approved, no passing verdict for `HEAD^{tree}`   | D               |
   | item 16, failing verdict for `HEAD^{tree}`                           | 16's fail rule  |
   | item 16, spec approved, no passing verdict for `HEAD^{tree}`         | 6, step 2       |
   | screen unit, failing verdict for `HEAD^{tree}`                       | 7               |
   | the branch added no plan, or it is not approved                      | 4               |
   | ledger missing, or a plan task without `Task <N>: complete`          | 5               |
   | all tasks complete, no `Final review: clean` line                    | 5 (final)       |
   | final review clean, no passing verdict whose `tree` is `HEAD^{tree}` | 6               |

   Approved means the document carries this line:

   ```
   Approved by the operator stand-in, revision <n>, <date>.
   ```

   "16's fail rule" is item 16's **First run fails** on `docs/16-usability-check` and
   its **Second run fails** on `docs/16-usability-check-2`.

5. Read the counters from the branch's commit subjects (`git log --format=%s main..HEAD`)
   and continue them; never restart them:
   - the revision of the spec, plan or document: the highest `<n>` in
     `docs: revise the <unit> <spec|plan|document> (revision <n>)`, or 1 if none;
   - the gate attempts made: the highest `<n>` in
     `chore: record gate attempt <n> on <unit>`, or 0 if none.

6. Stages 2–4 are the **design session**: run them, end with `continue`. Stages 5–8
   are the **build session**: run them, end with `passed` or `failed`. A **document
   unit** (nothing to build, e.g. item 10) runs 2, 3, D in one session. Item 16
   follows its own section below.

## Asking the stand-in

Dispatch the `operator-stand-in` agent wherever a superpowers or impeccable step would
ask the operator. Each dispatch carries only:

- `Unit: <id>.`
- the numbered questions, options stated neutrally, with no recommendation;
- the artifact paths (spec, plan, document, screenshot files);
- for an approval: `Approve or reject <path>. Revision <n> of 3.`
- for a verdict (document unit, stage D only), as its own dispatch after the approval:
  `Write the verdict for unit <id>; tree: <hash>. Revision <n> of 3.` with `<hash>` the
  output of `git rev-parse HEAD^{tree}` and `<n>` the approved revision. Commit
  everything first; commit nothing after it.

Never hand it your reasoning, your preferred answer, or an argument for one. Batch the
questions of one round into one dispatch.

Use its answers as the operator's. Record every answer that settles a choice as a
call, with its `Source:` and `Confidence:`, in the spec's section **Calls made in the
operator's place** (design) or as a ledger `Ruling:` line (build). Calls you settle
yourself (brainstorming's Minor pile, SDD rulings) are recorded the same way, marked as
the builder's. An ungrounded answer was queued in `docs/questions.md` by the
stand-in; commit that file with the stage.

Approval: on `reject`, revise, commit the revision as
`docs: revise the <unit> <spec|plan|document> (revision <n>)` with `<n>` the next
revision number, and ask again with that number. Revision 3 is final: the stand-in
approves with its objection stated; record the objection as a call. After approval,
add the approved line to the document and commit. A document carries one approved
line: a new approval replaces the old line, never adds a second.

## 2. Brainstorm

Invoke `superpowers:brainstorming`. If Orient found the unit's branch (it has no spec
yet), stay on it: no new branch, no second branch for the unit. Otherwise start on
`main` (`git checkout main`) and create the branch once the unit and its slug are known
(`git checkout -b <branch>`; uncommitted `docs/questions.md` entries come along). Its
human touchpoints, answered:

- The opening "skip the questions" line: do not offer it. Send the open questions to
  the stand-in.
- Every question, every playback chunk's "what is wrong or missing": to the stand-in.
- Recon offers: do the recon (reading only; the web rules hold).
- The visual-companion offer: declined. For anything seen, render a mockup (a static
  page or the running app) with Playwright's Chromium at 390 px and 1440 px, save
  screenshots under `.autopilot/screenshots/<unit>/design/`, and hand the paths to the
  stand-in.
- Spikes: none.
- Size: decide it; a roadmap item is a project with a written design.
- An item too big for one spec: split it into parts (`<n>a`, `<n>b`, …), write the
  parts into the roadmap on the branch, and carry on with the first part; name the
  branch for that part.
- Builder check: run it. Its "theirs" pile goes to the stand-in in one dispatch.

## 3. Spec

1. Write the spec where brainstorming puts it. It also holds:
   - for every screen, which reference behaviour it follows or departs from (item 10's
     study once it exists, else Kimai and the calendar apps the vision names);
   - **Gate tasks**: what a user must be able to do to meet the unit's exit, each a
     concrete task on seeded data (e.g. "log yesterday 9:00–14:30 on CompX › ClientY –
     ProjectZ, then move it to 9:30");
   - **Calls made in the operator's place**.
2. Commit (`docs: add the <topic> spec`). Ask the stand-in to approve it (revision 1).
   Approved → commit the approved line.

## D. Document unit

1. Write the document the spec describes (and anything it amends, e.g. the vision),
   with the calls recorded in it.
2. Write the done note on the branch (stage 8, step 1). Commit.
3. Ask the stand-in to approve the document: approval only, no verdict request.
   Reject → revise, commit, ask again (revision 2, 3), as under Asking the stand-in.
4. On approve: add the approved line (replacing any earlier one), add any objection or
   new call to the done note, run `npx prettier --write` on the changed files and
   `npm run lint`, and commit them with any `docs/questions.md` change. Then, as in
   stage 6 step 2: if `git merge-base --is-ancestor main HEAD` fails, merge `main` into
   the branch and commit; on a conflict in docs only, take both sides where they are
   lists; any other conflict: `git merge --abort`, write outcome `failed` (branch
   intact, `main` untouched), end. Tree clean.
5. Dispatch the verdict request with the new `git rev-parse HEAD^{tree}` and the
   approved revision (`Revision <n> of 3.`), adding:
   `Give the verdict only; queue no questions.` Commit nothing after it. Check the
   verdict file passes with that tree.
   - If `docs/questions.md` changed anyway, commit it (never discard it) and request
     the verdict again with the new tree, at most once more; then `failed`.
   - A failing verdict counts as a rejection: revise, remove the approved line (the
     next approval writes its own), commit as a revision, and go back to step 3 with
     the next revision number. At revision 3 the stand-in's verdict passes with its
     objection in `findings`; a fail there anyway → `failed`.
6. Finish as in stage 8, steps 2–7.

## 4. Plan

1. Invoke `superpowers:writing-plans` on the approved spec. Its execution question is
   not asked: execution is always subagent-driven.
2. Commit (`docs: add the <topic> plan`). Ask the stand-in to approve it (revision 1).
   Approved → commit the approved line.
3. Make sure the tree is clean on the branch. Write outcome `continue` and end.

## 5. Build

Invoke `superpowers:subagent-driven-development` on the approved plan, on the branch,
in this checkout:

- No worktree; the branch is the isolation. Do not ask about one.
- Resume from the ledger as that skill says.
- Its rulings stand. Its four stop reasons, answered:
  - an irreversible or destructive operation: do not do it; find another way, or
    `failed`;
  - a security-sensitive action: same;
  - a side effect outside the checkout: none is taken; the only merge is stage 8's;
  - a plan so broken every path is a guess: `failed`.
- After the final whole-branch review comes back clean, append `Final review: clean`
  to the ledger. Skip "delete this plan's workspace": the ledger is the resume map.
- Commit at every task boundary (the implementers do).

## 6. Checks, then the gate

1. Write the done note on the branch now (stage 8, step 1), and update every part doc
   the unit touched. Commit. The squash-merge must be the last change to `main` in
   this unit, so nothing is written after the gate judges.
2. If `git merge-base --is-ancestor main HEAD` fails, merge `main` into the branch and
   commit. On a conflict in docs only, take both sides where they are lists; any other
   conflict: `git merge --abort`, write outcome `failed` (branch intact, `main`
   untouched), end.
3. Run, all passing: `npm run check`, `npm run lint`, `npm run test:unit`,
   `npm run test:e2e`. A failure goes back through the SDD loop as a fix task.
4. Tree clean. Note `git rev-parse HEAD^{tree}`.
5. Dispatch the `usability-gate` agent with: the unit id, the spec path, the unit's exit
   text from the roadmap, the spec's Gate tasks, and the reference study path (or that
   none exists yet). Nothing else: no account of how the code works.
6. Read the verdict. It counts only if its `tree` equals the tree noted in step 4.
   `<attempt>` is one more than the gate attempts Orient counted (or recorded since).
   Append `Gate <attempt>: pass | fail — <one line>` to the ledger (item 16 has none),
   and record the attempt durably with an empty commit, which leaves the tree as judged:
   `git commit --allow-empty -m "chore: record gate attempt <attempt> on <unit>"`.

## 7. The gate loop

- Pass → stage 8.
- Fail, attempt 1 or 2 → each finding becomes a fix task in the ledger, worked through
  the same implementer and reviewer loop; add the new rulings and calls to the done
  note;
  commit; back to stage 6, step 2.
- Fail, attempt 3 → make the tree clean (commit what is there with a descriptive
  message), write outcome `failed` with the gate's last findings in `summary`, end.

## 8. Finish

1. **Done note** (written before the gate, stage 6 step 1, or stage D step 2): the
   heading or part line gains `— done <YYYY-MM-DD>`; under it, `Done <date>:` what was
   built, the spec and plan paths, decision records, and every call made: the
   stand-in's, marked as such with source and confidence; every ledger `Ruling:` line
   and every other call the builder settled, copied in and marked as the builder's; the
   questions queued in `docs/questions.md`. When the last part of an item is done, the
   item's heading is marked done too.
2. `superpowers:finishing-a-development-branch`, answered: tests are stage 6's checks;
   the base branch is `main`; the menu is not shown, the choice is always option 1,
   merge locally, done as below; never delete the branch; no other option.
3. Before touching `main`: `git merge-base --is-ancestor main <branch>` succeeds and
   `git rev-parse <branch>^{tree}` equals the verdict's `tree`. Otherwise write outcome
   `failed` (`branch tree differs from the verdict`) on the branch, `main` untouched,
   and end.
4. `git checkout main`, `git merge --squash <branch>`, then one Conventional Commit
   (`feat: …` for a screen unit, `docs: …` for a document unit; no scope, lowercase
   imperative, no attribution).
5. Backstop: `git rev-parse main^{tree}` equals the verdict's `tree`. If not, write
   outcome `failed` (`main tree differs from the verdict`) and end.
6. GitHub: if the unit has an issue in `vbartalis/time-keep` (find it with
   `gh issue list --search`), comment the done note, close it, and set its Project
   (#12) status to Done. Create no issue just for the unit.
7. Tree clean, on `main`. Write outcome `passed` with a one-line summary. End.

## Item 16, the usability check

- The design session writes the spec whose Gate tasks are every task in the app on
  phone and PC (logging the day as it happens, correcting yesterday, reorganising the
  month, copying it out for Excel), approved by the stand-in. There is no plan or
  build; the session goes on to stage 6, steps 2–6.
- Before the gate: the done note and `docs/round-2-report.md` (what round 2 built, the
  calls made in the operator's place, the open questions in `docs/questions.md`),
  committed on the branch. One gate attempt per run; nothing is fixed in item 16.
- Item 16 has no plan and no ledger, so nothing goes back through the SDD loop. A
  failing builder check (stage 6, step 3) is a gate finding: the run fails without
  dispatching the gate, the failed check is its finding, and the fail rules below
  handle it.
- Pass → stage 8.
- **First run fails**: remove the `— done` marker from item 16's heading, replace the
  done note with the line
  `First run <date> failed; its findings became items <n>–<m>.` and drop the report.
  Write each finding (or group) as a new round 2 item, numbered from the next free
  number, placed before item 16 (so before item 9). Commit, squash-merge into `main`
  (`docs: add the usability check's findings`), write outcome `continue`, end. Item
  16 runs once more after them, on `docs/16-usability-check-2`.
- **Second run fails**: rewrite the report with the failure, commit, squash-merge into
  `main` (`docs: add the round 2 report`), write outcome `failed` with the findings in
  `summary`, end.

## Ending `failed`

Whenever a unit ends `failed` (except item 16's second run, which merges its report),
`main` stays untouched and the branch is kept as it is, tree clean. If `git diff --quiet main...HEAD -- docs/questions.md` fails (the branch
queued questions), the outcome's `summary` also says
`questions queued on <branch> in docs/questions.md`, since they do not reach `main`.

## Throughout

- Commit at every stage boundary: spec, approval, plan, approval, each task, done
  note, gate fix round. Never end a session with a dirty tree; scratch files go in
  `mktemp -d` or `.autopilot/`.
- References first: every screen is designed from item 10's study once it exists.
- Anything on screen goes through `impeccable:impeccable`: its context and direction,
  then shape, build, critique and audit. Its questions, its confirmations and its
  visual choices go to the stand-in, with screenshots for anything visual. Do not use
  its live-browser modes (`live`, `generate`); render options as screenshots instead.
- Never build or judge a screen against empty data. Run the app as the gate's agent
  file describes and seed a realistic month:
  `TZ=Europe/Budapest npx tsx scripts/seed-month.ts <db> <user> <password>`.
- The gate decides when the work is done, not the builder's tests.
- Stay inside the unit. Anything else found becomes a roadmap item (placed before the
  first item that needs it) or a GitHub issue.
- Commits: Conventional Commits, no scope, lowercase imperative, no AI or tooling
  attribution, no `Co-Authored-By`.
