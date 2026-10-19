# Autopilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A script runs round 2's roadmap units one after another in fresh headless Claude Code sessions, with a stand-in answering for the operator and a usability gate deciding when a unit is done.

**Architecture:** `scripts/autopilot.sh` is the loop: it starts `claude -p` sessions, reads `.autopilot/outcome.json`, and checks a pass against a verdict file it did not write. Each session follows the `run-item` project skill (superpowers stages, impeccable for screens). The stand-in and the gate are subagent definitions in `.claude/agents/`; the stand-in reads `docs/operator-voice.md`; a seeding script gives the gate a realistic month.

**Tech Stack:** bash, jq, git, the Claude Code CLI (`claude -p`, `--permission-mode auto`, `--output-format stream-json`), tsx, Vitest, Playwright's Chromium, the app's core (`openCore`).

**Spec:** `docs/superpowers/specs/2026-10-19-autopilot-design.md`

## Global Constraints

- Sessions run with `--permission-mode auto`. `.claude/settings.json` is not changed.
- Forbidden in every session and in every file this plan writes: docker, `git push`, `rm -rf`, sudo, ssh; deleting branches; writing to memory. Nothing in the autopilot mentions pushing.
- The web is read-only: search, fetch, documentation, forums, public demos; no posting, commenting, signing up, submitting forms other than a public demo's sign-in, and no downloading or running anything from an untrusted source. Dependencies only from the npm registry through `npm install`.
- Outcome file: `.autopilot/outcome.json`, `{"status": "passed" | "continue" | "round-complete" | "failed", "unit": "<id>", "summary": "<one line>"}`. `unit` is the roadmap heading's number and part, e.g. `10`, `10a`, `17`.
- Verdict file: `.autopilot/verdicts/<unit>.json`, `{"unit", "pass": boolean, "tree": "<git tree hash judged>", "by": "usability-gate" | "operator-stand-in", "findings": [...], "screenshots": [...]}`. `tree` is `git rev-parse HEAD^{tree}` of the branch judged; a squash-merge keeps the tree, so the script compares it with `git rev-parse main^{tree}`.
- `.autopilot/` (outcome, verdicts, logs, `runs.md`, `stop`) is git-ignored.
- Branches: one per unit, `feat/<unit>-<slug>` or `docs/<unit>-<slug>`; squash-merged into `main` locally as one Conventional Commit; never deleted.
- Conventional Commits, no scope, lowercase imperative, no AI or tooling attribution.

## Review Focus

1. **A session that dies without writing an outcome** (crash, refusal, budget): the script stops with a message naming the log, and does not loop — Task 1.
2. **A stale outcome file from the previous session** read as this session's: the script deletes it before each session — Task 1.
3. **A `passed` whose verdict judged a different tree** (the builder changed code after the gate): refused like a failure — Task 1.
4. **The operator's brake set mid-run**: the running session finishes, no new one starts — Task 1.
5. **The stand-in answering from the builder's framing**: it is handed only the question and artifact, never the builder's reasoning, and must cite a source or mark the answer ungrounded — Task 2 (agent text) and Task 6 (the dry run shows citations).

---

### Task 1: The loop

**Files:**
- Create: `scripts/autopilot.sh`, `scripts/autopilot.test.ts`
- Modify: `vite.config.ts` (the server project also includes `scripts/**/*.test.ts`), `.gitignore` (`.autopilot/`)

**Interfaces:**
- Produces: `scripts/autopilot.sh [max-sessions]` (default 10). Environment: `AUTOPILOT_CLAUDE` (the CLI to run, default `claude`), `AUTOPILOT_DIR` (default `.autopilot`, relative to the repo root). Exit 0 on `round-complete` or the brake; 1 on `failed`, a missing or invalid outcome, or a refused pass; 2 on a dirty tree; 3 when `max-sessions` is reached with work left.
- Each session runs `$AUTOPILOT_CLAUDE -p "Invoke the run-item skill and follow it." --permission-mode auto --output-format stream-json --verbose`, stdout and stderr to `$AUTOPILOT_DIR/logs/<UTC yyyymmdd-HHMMSS>-<n>.log`.
- After each session it appends one line to `$AUTOPILOT_DIR/runs.md`: `- <UTC ISO time> session <n> unit <unit> <status>: <summary> (log <path>)`.

- [ ] **Step 1: Failing tests** (`autopilot.test.ts`; each test makes a temporary git repo with one commit on `main` and `.autopilot/` in its `.gitignore`, copies the script in, and points `AUTOPILOT_CLAUDE` at a fake CLI: a small bash script written per test that pops the next scripted action from a file — write a given outcome, optionally a verdict with the current `HEAD^{tree}` or a wrong tree, optionally make a commit or leave an untracked file, optionally create the stop file):
  - `passed` with a matching verdict, then `round-complete` → exit 0, two log files, `runs.md` has two lines naming both statuses.
  - `continue` then `round-complete` → exit 0; the fake CLI was called twice.
  - `passed` with no verdict file → exit 1, output contains `no verdict`; `passed` with a verdict whose `tree` differs → exit 1, output contains `tree`; `passed` with `"pass": false` → exit 1.
  - `failed` → exit 1 after one session.
  - The fake CLI writes nothing → exit 1, output contains the log path.
  - An outcome from before the run already in the directory and a fake CLI that writes nothing → exit 1 (the stale file was removed).
  - Dirty tree at start (an untracked file) → exit 2, the fake CLI never called; a session that leaves an untracked file and returns `continue` → exit 2 before the next session.
  - `.autopilot/stop` present at start → exit 0, output contains `stop`, the fake CLI never called; the fake CLI creating `stop` during session 1 and returning `continue` → exit 0 after one session.
  - `max-sessions` 2 with `continue` forever → exit 3 after two sessions.
- [ ] **Step 2: Run** `npx vitest run scripts/autopilot.test.ts` — FAIL.
- [ ] **Step 3: Write `scripts/autopilot.sh`** (`set -euo pipefail`, jq for JSON, run from the repo root found with `git rev-parse --show-toplevel`).
- [ ] **Step 4: Run** the test file — PASS; `npm run check` and `npm run lint` clean.
- [ ] **Step 5: Commit** `feat: add the autopilot loop`.

### Task 2: The stand-in and the operator's voice

**Files:**
- Create: `.claude/agents/operator-stand-in.md`, `docs/operator-voice.md`, `docs/questions.md`

**Interfaces:**
- Produces: the agent `operator-stand-in` (frontmatter `name: operator-stand-in`, a `description` saying it answers for the operator in autopilot runs, `model: opus`, tools `Read, Grep, Glob, Write, Edit`). Its answer format, which Task 4's skill relies on, per question: `Answer:`, `Source:` (file and line, or the quote's date), `Confidence: grounded | inferred | ungrounded`; for an approval also `Verdict: approve | reject` with reasons. For a document unit it writes the verdict file (`by: "operator-stand-in"`). For an ungrounded answer it appends an entry to `docs/questions.md`.

- [ ] **Step 1: Write the agent** from the spec's section 3: what it reads; the answer format above; ungrounded → the conservative option (the smaller change, the more familiar pattern, closer to Kimai and the references) plus a `docs/questions.md` entry; approve or reject with reasons, a builder may revise twice, then the builder's version stands with the objection recorded as a call; the round's big calls (item 11's direction from rendered options, which it views as image files; item 10's vision amendment, limited to the calendar views and the table the operator asked for, anything else to `docs/questions.md`); it answers only from what it is handed and its sources; it never edits `docs/operator-voice.md` or code.
- [ ] **Step 2: Write `docs/operator-voice.md`**: a short header (what the file is; quotes verbatim, dated, grouped; added to only when the operator speaks, never by the autopilot), then sections Scope, Process and autonomy, Interface and design, Data and entries, Working style. Seed it from the discovery notes in `.claude/memory/brainstorm-context-beyond-the-vision.md` (paraphrase, marked "discovery, 2026-10-18"), the dated quotes in `.claude/rules/*.md`, and these, verbatim, dated 2026-10-19:
  - "i can tell with certainity this is nothing like kimai. looks completely different."
  - "this app is not fitting the needs at all. unusable. UX seems awful. no idea if you have studied kimai at all, but i suspect not."
  - "kimai had a calendar like structure in it. this is quite different from a goodle or samsung calendar, but those are actually also good inspiration materials how to make a good time keeping app in terms of design. then kimai also has different views liek those mobile calendars like day or week or mont view. and kimai also hs anothr view that is more like a table not a calendar that is not in those mobile calendars. these are all quite important things."
  - "after all the goal is what. to create an app that does what i need with good ui/ux. right?"
  - "about the backend. i believe that should be mostly ok"
  - "we have to redo the look of the app completely as its not just functionally bad ie ux, but in terms of design like ui and theaming it is also horrendous."
  - "round 2 is to make sure tha app is usable first."
  - "we still want to try to make this work withouth as much supervison from me as possible."
  - "if impeccable has something liek a question we spin up a subagent to do the independent mimicing of the developer, how would he choose."
  - "it should forget about pushes. that is not its responsibility at all. shouldnt even htink about it."
  - "normal web browsing for research can be done. for example seeng how a cerain app looks for inspiration or searching up a documentatiion. or researching some topic on some forums. but no posting or similar to the web, or downloading things fro muntrusted sources etc."
  - "Do not try to blame me ever."
- [ ] **Step 3: Write `docs/questions.md`**: a header (what lands here; the entry format: date, unit, question, call made, what changes if answered differently; newest first; how the operator answers) and "None yet."
- [ ] **Step 4: Verify**: `head -8 .claude/agents/operator-stand-in.md` shows the frontmatter; `npx prettier --check docs/operator-voice.md docs/questions.md` passes.
- [ ] **Step 5: Commit** `feat: add the operator stand-in`.

### Task 3: The gate and its seed

**Files:**
- Create: `scripts/seed-month.ts`, `scripts/seed-month.test.ts`, `.claude/agents/usability-gate.md`

**Interfaces:**
- Produces: `seedMonth(db: DB, userId: string, opts: { today: string; zone: string }): { entries: number }` (`today` as `YYYY-MM-DD`) and a CLI `npx tsx scripts/seed-month.ts <database> <username> <password>` that creates the user (not admin) if missing and seeds through `openCore(db, userId, 'system')`. The month: customers `CompX`, `Myself`; projects `ClientY – ProjectZ` and `CompY – Support` (CompX), `time-keep` (Myself); activities `Development`, `Meeting`, `Support ticket`, `Research`; locations `Office`, `Home office`, `Café`, `At the client`; templates `Standup` (CompX › ClientY – ProjectZ, Meeting, 09:30–09:45) and `Ticket` (CompX › CompY – Support, Support ticket, 30 minutes); on every weekday of the 30 days before `today`, 3–5 entries varying by weekday: a standup, a development block at the client or at home, a support entry with a reference `T-<number>` and a description naming an end client, on some days an evening entry at the Café on `time-keep`; one overnight entry; one pair of overlapping entries; nothing in the future.
- Produces: the agent `usability-gate` (`model: opus`, tools `Read, Write, Bash, Glob, Grep`). It receives the unit, the spec path, the exit text and the task list. It starts a production build itself (`npm run build`; `node build` on a free `PORT` with `DATABASE_PATH` in a temporary directory, `ADMIN_USERNAME` and `ADMIN_PASSWORD` set, `PROTOCOL_HEADER=x-forwarded-proto`, and Playwright sending `x-forwarded-proto: http`), seeds with the CLI, drives Playwright's Chromium with a script it writes in a temporary directory at 390 and 1440 px in light and dark (`colorScheme`), takes screenshots, writes the verdict file, and stops the server it started. It never reads `src/` or the builder's report.

- [ ] **Step 1: Failing tests** (`seed-month.test.ts`, an in-memory database migrated, a user via `createUser`): `entries` ≥ 60; every entry starts before `today` in `zone`; at least one entry crosses midnight; at least one pair overlaps; at least one entry's reference matches `/^T-\d+$/`; customers, projects, activities, locations and templates exactly as listed; seeding a second user leaves the first user's rows unchanged.
- [ ] **Step 2: Run** `npx vitest run scripts/seed-month.test.ts` — FAIL.
- [ ] **Step 3: Write `scripts/seed-month.ts`** (deterministic: the variation comes from the date, not `Math.random`).
- [ ] **Step 4: Run** — PASS; then the CLI against a migrated temporary database prints the entry count.
- [ ] **Step 5: Write the agent** `.claude/agents/usability-gate.md` as above, with the verdict format from Global Constraints and the failing rules: a task that cannot be done; one clearly slower or more confusing than the reference study says the references do it; a visual defect impeccable's audit would flag (contrast, overlap, clipped text, a broken layout at either width or theme).
- [ ] **Step 6: Commit** `feat: add the usability gate and its seed`.

### Task 4: The runbook

**Files:**
- Create: `.claude/skills/run-item/SKILL.md`

**Interfaces:**
- Consumes: Task 1's outcome and verdict contracts, Task 2's stand-in and its answer format, Task 3's gate and seed CLI.

- [ ] **Step 1: Write the skill** (frontmatter `name: run-item`, a `description` saying it runs one roadmap unit unattended in an autopilot session). Body, from the spec's section 2:
  - Orient: what to read; pick the unit (the first item or part, in page order, in the current round without a done note); item 9 → `round-complete`; an existing unit branch → check it out and resume at its first unfinished stage, judged by what is committed (spec, plan, ledger completion lines, merge).
  - The sessions: design (brainstorm, spec, plan; every operator question, the builder check's "theirs" pile and every approval go to the stand-in; ends with `continue`); build (subagent-driven development, the gate, finish). A unit with nothing to build ends once its document is approved, with a stand-in verdict and `passed`.
  - The gate loop: at most 3 gate attempts, fix rounds through the subagent-driven loop; a final fail → `failed` with the gate's last findings in `summary`.
  - Finish: squash-merge, keep the branch, the done note (the calls, which came from the stand-in, their citations), the GitHub issue and Project, the outcome.
  - Commit at every stage boundary; never end with a dirty tree.
  - The guidance list from the spec: references first; impeccable for anything on screen, its human prompts and visual choices routed to the stand-in with screenshots; realistic data via `scripts/seed-month.ts`; never ask or wait; the gate decides; stay inside the unit.
  - The forbidden list and the web rules from Global Constraints, verbatim.
  - Item 16: its failures become new round 2 items placed before item 9, then item 16 runs once more; a second fail → `failed`; either way write `docs/round-2-report.md`.
  - Superpowers' own stop-and-ask points (the brainstorm's questions, the spec and plan gates, SDD's four stop reasons, finishing-a-development-branch's menu) are answered here: the stand-in answers; finishing always takes "merge locally" and never deletes the branch.
- [ ] **Step 2: Verify**: `head -5 .claude/skills/run-item/SKILL.md` shows the frontmatter; `claude -p "List the project skills you can invoke, names only." --permission-mode auto` lists `run-item`.
- [ ] **Step 3: Commit** `feat: add the run-item runbook`.

### Task 5: Docs and the roadmap

**Files:**
- Create: `docs/autopilot.md`, `docs/decisions/008-rounds-run-on-an-autopilot-with-a-stand-in-and-a-gate.md`
- Modify: `CLAUDE.md`, `docs/decisions/README.md`, `docs/environment.md`, `docs/roadmap.md`

- [ ] **Step 1: `docs/autopilot.md`**: what it is (one paragraph); the pieces and their files; starting a run (`scripts/autopilot.sh [max-sessions]` from a clean tree, in a tmux window); watching (`.autopilot/runs.md`, the logs); braking (`touch .autopilot/stop`); resuming after a crash (make the tree clean, run again); the exit codes; the permission mode and the web rules; what the operator reads afterwards (`docs/questions.md`, the done notes, `docs/round-2-report.md`).
- [ ] **Step 2: Decision 008** in the format of the earlier records: context (round 1's loop and judgement), decision (the spec's pieces in one paragraph), consequences (the operator's role: words in, questions out, the round's report; the stand-in's calls reviewable in done notes). Add it to `docs/decisions/README.md`'s list.
- [ ] **Step 3: `CLAUDE.md`**: after "Gates are human decisions. Present the design, stop, and wait for a yes." add "In an autopilot run the operator stand-in and the usability gate decide in the operator's place; see [docs/autopilot.md](docs/autopilot.md)." Nothing else.
- [ ] **Step 4: `docs/environment.md`**: one line pointing to `docs/autopilot.md`.
- [ ] **Step 5: `docs/roadmap.md`**: the three rounds as in the uncommitted rewrite in the working tree (round 1's phases word for word), with round 2 changed per the spec's "Round 2 of the roadmap": remove "The operator sees it running"; each item's exit met by the gate (screens) or the stand-in (documents); item 16 per the spec; item 10 may use Playwright's Chromium on Kimai's public demo; "How an item is worked" says round 2 runs on the autopilot. Add, first in round 2, `### 17. Autopilot dry run — Today's placeholder panel`: remove the "At the desk — not built yet" panel from Today on phone and PC; exit: the gate passes Today with the panel gone and nothing else changed. Under the round's heading, note that items are worked in page order and keep their numbers.
- [ ] **Step 6: Verify** `npx prettier --check` on every changed markdown file passes.
- [ ] **Step 7: Commit** `docs: describe the autopilot and plan round 2 on it`.

### Task 6: Dry run (the controller, after the merge)

The loop works on `main`, so this runs once the branch is squash-merged into `main` (finishing-a-development-branch, merge locally). Any failure is fixed on the branch, merged again, and the dry run repeated.

- [ ] **Step 1: Deny list under auto**: `claude -p "Run exactly: git push --dry-run origin main. Report whether the tool call was allowed." --permission-mode auto` → refused. If allowed, stop: the script does not run (spec section 7), and the operator is told.
- [ ] **Step 2: Brake**: `touch .autopilot/stop; scripts/autopilot.sh` → exit 0, no session, no log; then remove `.autopilot/stop`.
- [ ] **Step 3: The run**: from a clean `main`, `scripts/autopilot.sh 2` in the background. Expected: session 1 picks unit 17 and ends `continue`; session 2 builds, the gate writes a passing verdict, the branch is squash-merged, `passed`; the script stops at its session limit (exit 3) before unit 10.
- [ ] **Step 4: Check**: `runs.md` has both lines; the verdict's `tree` equals `main^{tree}`; the stand-in's answers in the unit's spec or ledger carry `Source:` lines; Today no longer shows the panel; `git log` shows one squash commit for unit 17 and its branch is kept; the roadmap has unit 17's done note.
