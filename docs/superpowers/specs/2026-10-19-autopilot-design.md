# Autopilot — design

Date: 2026-10-19. Written with the operator in conversation the same day; choices made
without them are marked **(call)**.

## Intent

The operator wants round 2 (and later rounds) built with as little supervision as
possible, but round 1 showed that the manual process with the human simply removed
does not work. Two things failed:

- **The loop.** One agent carried phase after phase in one session. Its context grew
  until it was compacted automatically at a bad moment, and no one could clear it,
  because clearing the only agent clears the conductor.
- **The judgement.** Every step that asks the operator (brainstorm questions, spec and
  plan approval, impeccable's choices) was answered by the builder itself, and the only
  check at the end of a phase was the builder's own tests. The result passed its tests
  and was unusable.

The autopilot replaces each human step with something outside the builder, and moves
the loop outside any agent.

## Goals

- A script runs the roadmap's items one after another, each in a fresh Claude Code
  session, with no one at the keyboard.
- Inside a session, an item is worked the way the operator works one manually: the
  superpowers stages in order, impeccable for anything on screen, a local squash-merge
  and the GitHub updates at the end.
- Where the manual process asks the operator, a stand-in answers from the operator's
  own words.
- An item is finished only when a gate outside the builder passes it.
- The operator can see what happened, what was decided in their place, and what is
  waiting for them, without reading transcripts.

## Non-goals

- Pushing, deploying, or anything remote except the standing-authorized GitHub issue
  and Project writes. The autopilot does not push and is not told about pushing.
- Running more than one item at a time.
- Running go-live (item 9); the loop stops before it.
- Replacing superpowers or impeccable; both are used unchanged.
- A dashboard or notifications. The operator reads files and logs.

## Anti-goals

- A builder that grades its own work.
- A stand-in that invents preferences it cannot ground in what the operator said.
- A session that waits for a human: it never asks; it decides, records, and goes on.
- A loop that keeps going after a failure, piling new work on a broken item.

## The pieces

### 1. The loop: `scripts/autopilot.sh`

A plain shell script; it holds no context, so it cannot lose any.

```
until a stop condition:
  run:  claude -p "<start prompt>" --permission-mode <mode> ... > log
  read: .autopilot/outcome.json
    "passed"         → next session (next unit)
    "continue"       → next session (same unit, next stage)
    "round-complete" → stop
    "failed"         → stop
    missing/invalid  → stop
```

- A **unit** is the next unfinished roadmap item, or the next unfinished part of a
  split item. A unit takes two sessions **(call: keeps each small enough never to be
  compacted)**: a **design session** (brainstorm, spec, plan, each approved by the
  stand-in) that ends with `continue`, and a **build session** (subagent-driven
  build, gate, finish) that ends with `passed` or `failed`. A unit with nothing to
  build (a document, such as item 10) finishes in its design session.
- When a brainstorm splits an item (10a, 10b, …), the design session writes the parts
  into the roadmap and carries on with the first; each part is then a unit.
- The start prompt only says: invoke the `run-item` skill. Everything else is in files.
- **`passed` is checked, not trusted.** The script accepts it only when the unit's
  verdict file (`.autopilot/verdicts/<unit>.json`), written by the gate or, for a
  document unit, by the stand-in, records a pass for the commit now on `main`
  **(call)**. Otherwise it stops as if the outcome were `failed`.
- **Stop conditions:** an outcome other than `passed` or `continue`; a file `.autopilot/stop`
  (the operator's brake, checked between sessions); a maximum number of sessions per
  run, given as an argument (default 10) **(call)**; the next unit being item 9.
- **Logs:** each session's output goes to `.autopilot/logs/<timestamp>-<unit>.log`
  (stream-json for detail, plus a one-line summary per session in
  `.autopilot/runs.md`) **(call)**. `.autopilot/` is git-ignored.
- Run it in a tmux window to watch it; it needs nothing from the terminal.
- It refuses to start, and stops between sessions, when the working tree is not
  clean **(call: the operator's own work is never mixed into a run, and a crashed
  session's leftovers are never built on blindly)**. Sessions commit at every stage
  boundary, so a clean tree is the normal state.
- **Resuming** is running the script again. Each unit works on one branch,
  `feat/<unit>-<slug>` (or `docs/…`), and a stage is finished when its artifact is
  committed there: the spec, the plan, the ledger's completion lines, the verdict.
  Orient finds the unit's branch and carries on from the first unfinished stage
  **(call)**. After a crash the operator only makes the tree clean (commit or
  discard), as the script's message says.

### 2. The runbook: the `run-item` project skill

`.claude/skills/run-item/SKILL.md`, read by every session. It does not redefine the
process; it says how to run the existing one with no human present:

1. **Orient.** Read `CLAUDE.md` (already loaded), the roadmap, the vision, the
   operator's voice file, `docs/questions.md`, and the last done note. Pick the unit:
   the first item or part in the current round without a done note. If it is item 9,
   write `round-complete` and end. If the unit's branch exists, check it out and
   resume at its first unfinished stage; the design session's stages are 2–4, the
   build session's 5–7.
2. **Brainstorm** with superpowers' brainstorming skill. Every question that would go
   to the operator goes to the stand-in instead (below). Run the builder check; its
   "theirs" pile goes to the stand-in too.
3. **Spec**, committed. Approved by the stand-in, not the builder.
4. **Plan** with writing-plans, approved by the stand-in. The design session ends
   here with `continue`.
5. **Build** with subagent-driven development, as in round 1 (execution is always
   subagent-driven).
6. **Gate** (below). On a fail, the findings go back as fix rounds through the same
   implementer and reviewer loop, at most 3 gate attempts **(call)**; still failing →
   outcome `failed` with the gate's last report.
7. **Finish**: squash-merge the branch into `main` locally as one Conventional Commit,
   keep the branch, write the done note in the roadmap (with every call made, which
   ones came from the stand-in, and its citations), update the GitHub issue and
   Project, write the outcome, end.

**Guidance the skill states, where round 1 went off the rails:**

- Design every screen from references (item 10's study once it exists); the spec
  names which reference behaviour each screen follows or departs from.
- Anything on screen goes through impeccable: its context and direction, then shape,
  build, critique and audit. impeccable's choices and questions go to the stand-in,
  with screenshots for anything visual.
- Never build or judge a screen against empty data; seed a realistic month first.
- Never ask, never wait. Decide, record the call, continue. A question the stand-in
  cannot ground is answered conservatively and queued for the operator.
- The gate decides when the work is done, not the builder's tests.
- Stay inside the unit. Anything else found becomes a roadmap item or a GitHub issue.
- Never write to memory; never touch Docker; never delete branches (the rules apply
  unchanged).

### 3. The stand-in: `.claude/agents/operator-stand-in.md`

A subagent definition, dispatched by the session wherever the manual process asks the
operator.

- **Reads:** `docs/operator-voice.md`, the vision, the roadmap, `.claude/rules/`,
  `.claude/memory/`, the reference study once it exists, and the artifact it is asked
  about (a question, a spec, a plan, a set of screenshots).
- **Answers** each question with the answer, the source it rests on (a quote with its
  file and line, or its date), and a confidence: **grounded** (a source says it),
  **inferred** (follows from sources; the reasoning given), or **ungrounded**.
- An ungrounded answer is the conservative option (the smaller change, the more
  familiar pattern, closer to Kimai and the references) and is appended to
  `docs/questions.md` with the call made **(call)**.
- **Approves or rejects** a spec or plan with reasons; a rejection goes back to the
  builder, at most twice, then the builder's version stands with the objection
  recorded as a call **(call)**.
- **Decides for the operator on the round's big calls too** **(call: the operator
  asked for as little supervision as possible)**: it picks item 11's direction from
  rendered options, and it approves item 10's amendment of the vision, which may add
  only what the operator asked for (the calendar views and the table, 2026-10-19).
  Anything else the study suggests for the charter goes to `docs/questions.md`, not
  into the vision.
- For a document unit it writes the verdict file, as the gate does for a screen
  unit.
- It sees only what it is handed, never the builder's reasoning, so its judgement is
  its own. It runs on the most capable model **(call)**.

### 4. The operator's voice: `docs/operator-voice.md`

What the stand-in reads as the operator: their corrections and preferences, each
quoted with its date, grouped by subject (scope, process, interface, design, data,
working style). Seeded in this change from the vision's discovery notes
(`.claude/memory/`), the rules, and the operator's words of 2026-10-19 about round 1
("nothing like kimai", "unusable. UX seems awful", "horrendous" design, the calendar
and table views, minimal supervision). New words are added when the operator says
them, in the session where they say them; the autopilot never adds to it **(call:
the stand-in must not learn from itself)**.

### 5. Questions for the operator: `docs/questions.md`

What the stand-in could not ground: the question, the unit, the call made, and what
changes if the operator answers differently. Newest first. The operator answers in
the file or in conversation whenever they like; an answer moves into
`docs/operator-voice.md` and, if it changes built work, becomes a roadmap item.

### 6. The gate: `.claude/agents/usability-gate.md`

A subagent definition, dispatched at the end of every unit that changes what a user
sees **(call: a unit with no screen, such as item 10, is gated by the stand-in's
approval of its document)**.

- **Gets:** the unit's spec, its exit from the roadmap, the reference study, and a
  running production build seeded with a realistic month (the operator's entry shapes
  from the voice file and memory: support work three companies deep with a ticket,
  development two deep, start plus duration, a café, at the client).
- **Does** the exit's tasks as a user would, in Playwright's Chromium at 390 px and
  1440 px, light and dark: for example "log yesterday 9:00–14:30 on CompX ›
  ClientY – ProjectZ, then move it to 9:30". It counts the steps, takes screenshots,
  and compares each task with how the reference study says the references do it.
- **Writes** its verdict itself to `.autopilot/verdicts/<unit>.json` (pass or fail,
  the commit judged, the findings, the screenshots' paths).
- **Decides** pass or fail with findings, each with a screenshot and the task it broke.
  It fails a unit for a task that cannot be done, one clearly slower or more confusing
  than the reference, or a visual defect impeccable's audit would flag. It does not
  read the code or the builder's report **(call)**.
- The builder's own tests (check, lint, unit, e2e) still run first; the gate does not
  replace them.

### 7. Headless permissions

A headless session cannot ask, so permissions are given by the script's flags, never
by changing the operator's settings. **The script runs with `--permission-mode auto`**
(operator, 2026-10-19: "yes auto"): what a safety classifier approves, plus the allow
list, runs; a risky action is refused rather than asked, and the session records the
refusal and works around it or fails the unit.

**Forbidden**, by the deny list in `.claude/settings.json` and restated in the
runbook: docker, `git push`, `rm -rf`, sudo and ssh. The deny list must hold under
`auto`; building this verifies it, and if it does not hold the script does not run.

**The web is for reading** (operator, 2026-10-19): searching, reading documentation,
forums and articles, and looking at apps and public demos for inspiration, through
web search and fetch or Playwright's Chromium. Never writing to it: no posting,
commenting, signing up, submitting forms other than a public demo's sign-in, or
anything else that leaves a trace on someone else's site; and no downloading or
running anything from an untrusted source. Dependencies come only from the npm
registry, added through `npm install` as in round 1. The runbook states this; the
classifier backs it up.

### 8. `CLAUDE.md`

"Gates are human decisions. Present the design, stop, and wait for a yes." gains its
other half: in an autopilot run, the stand-in and the gate decide in the operator's
place, as `docs/autopilot.md` describes. Nothing else in `CLAUDE.md` changes. No new
rule in `.claude/rules/`: none of this holds in every session.

## Round 2 of the roadmap

Rewritten to match:

- "The operator sees it running" is removed. Each item's exit is met by the gate
  (screens) or the stand-in (documents).
- The round 2 rules stay: impeccable for every interface item, references first,
  realistic data, round 1's interface calls not binding.
- Item 16, the usability check, becomes the gate run over every task in the app on
  phone and PC. What it fails becomes new round 2 items before item 9, worked by the
  loop; item 16 then runs once more. If that second run still fails, the round stops
  with `failed` **(call: bounds the round)**. Either way the round ends with a report
  for the operator in `docs/round-2-report.md`: what was built, the calls made in
  their place, and the open questions.
- Item 10's study may use Playwright's Chromium to look at Kimai's public demo and the
  references, not only their docs.

## Documentation

- `docs/autopilot.md`: the part doc: how to start, watch, brake and resume a run;
  the files; the permission options.
- `docs/decisions/008-rounds-run-on-an-autopilot-with-a-stand-in-and-a-gate.md`.
- `docs/environment.md`: a pointer to `docs/autopilot.md`.
- `docs/roadmap.md`: the three rounds, round 2 as above.
- `.gitignore`: `.autopilot/`.

## Proving it before round 2

The setup is itself a unit, worked manually with the operator's approval as usual.
Its exit: one dry run of the script on a small real screen unit, removing round 1's
"At the desk — not built yet" panel from Today, shows a design session ending with
`continue`, a build session seeding data, passing the usability gate with its verdict
file, merging locally and writing `passed`, and the script accepting it; and a second
run with `.autopilot/stop` present starts nothing **(call: a real fix rather than a
throwaway, and it exercises the gate)**.

## Left to the builder

The exact start prompt and flags, the outcome file's fields beyond `status`, the log
format, how each impeccable step's human prompt is routed to the stand-in, the gate's
seeding script and task format, and the wording of the agent definitions within what
this document fixes.
